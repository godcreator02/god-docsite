import { readdirSync, readFileSync, statSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { createProcessor } from '@mdx-js/mdx'
import remarkMath from 'remark-math'
import { findDepPkgJsonPath } from 'vitefu'
import type { SelfContainedProblem } from '../core/dev-events.js'
import type { ReferencePlace, ReferenceResolverModule, SiteReference, SiteReferenceProblem, SiteReferences } from '../core/site-references.js'
import { isRecord } from './scaffold/files.js'
import { siteAudienceOf } from './site-identity.js'

/** 内容页所在的目录，相对站点根：扫描从这里的全部 mdx 出发 */
const contentDirInSite = 'content'

interface ReferenceComponentOwner {
  packageName: string
  resolver: ReferenceResolverModule
}

/** 功能包 package.json 里 "godDocsite": { "references": { "components": [...] } }；没写就是没有 */
export function referenceComponentsDeclaredBy(packageName: string, packageJson: Record<string, unknown>): string[] {
  const declared = packageJson['godDocsite']
  if (declared === undefined) return []
  if (!isRecord(declared)) throw new Error(`${packageName} 的 package.json 里 godDocsite 要是对象，收到 ${JSON.stringify(declared)}`)
  const references = declared['references']
  if (references === undefined) return []
  const components = isRecord(references) ? references['components'] : undefined
  if (!Array.isArray(components) || components.length === 0 || !components.every((name) => typeof name === 'string' && /^[A-Z][A-Za-z0-9]*$/.test(name))) {
    throw new Error(`${packageName} 的 package.json 里 godDocsite.references 要写成 { "components": ["组件名", …] }，组件名大写开头，收到 ${JSON.stringify(references)}`)
  }
  return components as string[]
}

/** 包的 ./node 出口对应的文件：exports['./node'] 写成路径，或带 import / default 条件的对象 */
function nodeEntryOf(packageName: string, packageDir: string, packageJson: Record<string, unknown>): string {
  const exportsField = packageJson['exports']
  const target = isRecord(exportsField) ? exportsField['./node'] : undefined
  const file = typeof target === 'string' ? target : isRecord(target) ? (target['import'] ?? target['default']) : undefined
  if (typeof file !== 'string') throw new Error(`${packageName} 在 godDocsite.references 里登记了组件，但 package.json 的 exports 里没有 ./node 出口（要导出 resolveReference 与 publishHint）`)
  return path.resolve(packageDir, file)
}

async function referenceResolverOf(packageName: string, entryFile: string): Promise<ReferenceResolverModule> {
  const loaded = (await import(/* @vite-ignore */ pathToFileURL(entryFile).href)) as Partial<ReferenceResolverModule>
  if (typeof loaded.resolveReference !== 'function' || typeof loaded.publishHint !== 'function') {
    throw new Error(`${packageName} 的 ./node 出口（${entryFile}）要导出函数 resolveReference 与 publishHint`)
  }
  return { resolveReference: loaded.resolveReference, publishHint: loaded.publishHint }
}

async function siteDependencyNamesOf(siteDir: string): Promise<string[]> {
  const manifest = JSON.parse(await readFile(path.join(siteDir, 'package.json'), 'utf8')) as Record<string, unknown>
  return [...new Set([manifest['dependencies'], manifest['devDependencies']].flatMap((deps) => (isRecord(deps) ? Object.keys(deps) : [])))]
}

/** 站点直接依赖的包里登记了引用组件的，组件名到登记它的包；一个组件名只许一个包登记 */
export async function referenceComponentOwnersOf(siteDir: string): Promise<Map<string, ReferenceComponentOwner>> {
  const owners = new Map<string, ReferenceComponentOwner>()
  for (const packageName of (await siteDependencyNamesOf(siteDir)).sort()) {
    const manifestFile = await findDepPkgJsonPath(packageName, siteDir)
    if (manifestFile === undefined) continue
    const packageJson = JSON.parse(await readFile(manifestFile, 'utf8')) as Record<string, unknown>
    const components = referenceComponentsDeclaredBy(packageName, packageJson)
    if (components.length === 0) continue
    const resolver = await referenceResolverOf(packageName, nodeEntryOf(packageName, path.dirname(manifestFile), packageJson))
    for (const component of components) {
      const owner = owners.get(component)
      if (owner !== undefined) throw new Error(`引用组件 ${component} 被 ${owner.packageName} 与 ${packageName} 都登记了：一个组件名只许一个功能包登记`)
      owners.set(component, { packageName, resolver })
    }
  }
  return owners
}

/** 文件里一个大写开头的 JSX 元素：id 是写成字符串的 id 属性，没写是 null，写成表达式是 'expression' */
type JsxElementInFile = { name: string; id: { text: string } | null | 'expression'; line: number | undefined }

type ParsedFile = { mtimeMs: number; size: number; elements: JsxElementInFile[] | { error: string } }

const parsedByFile = new Map<string, ParsedFile>()

/** 只解析不编译，只要认得出公式与 JSX：公式里的 { } 不当成表达式 */
const mdxParser = createProcessor({ remarkPlugins: [remarkMath] })

/** frontmatter 换成同样行数的空行：mdx 解析器不认 YAML，行号仍对得上原文件 */
function withoutFrontmatter(source: string): string {
  const match = /^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/.exec(source)
  return match === null ? source : match[0].replace(/[^\n]/g, '') + source.slice(match[0].length)
}

type MdastNode = {
  type: string
  name?: string | null
  attributes?: Array<{ type: string; name?: string; value?: unknown }>
  children?: MdastNode[]
  position?: { start: { line: number } }
}

function jsxElementsIn(node: MdastNode, found: JsxElementInFile[]): JsxElementInFile[] {
  if ((node.type === 'mdxJsxFlowElement' || node.type === 'mdxJsxTextElement') && typeof node.name === 'string' && /^[A-Z]/.test(node.name)) {
    const idAttribute = node.attributes?.find((attribute) => attribute.type === 'mdxJsxAttribute' && attribute.name === 'id')
    const id = idAttribute === undefined ? null : typeof idAttribute.value === 'string' ? { text: idAttribute.value } : 'expression'
    found.push({ name: node.name, id, line: node.position?.start.line })
  }
  for (const child of node.children ?? []) jsxElementsIn(child, found)
  return found
}

/** 一个文件里全部大写开头的 JSX 元素，按「路径 + 修改时间 + 大小」缓存：热缓存时每个文件只剩一次 stat */
function jsxElementsOfFile(file: string): ParsedFile['elements'] {
  const { mtimeMs, size } = statSync(file)
  const cached = parsedByFile.get(file)
  if (cached !== undefined && cached.mtimeMs === mtimeMs && cached.size === size) return cached.elements
  let elements: ParsedFile['elements']
  try {
    elements = jsxElementsIn(mdxParser.parse(withoutFrontmatter(readFileSync(file, 'utf8'))) as MdastNode, [])
  } catch (error) {
    elements = { error: error instanceof Error ? error.message : String(error) }
  }
  parsedByFile.set(file, { mtimeMs, size, elements })
  return elements
}

function mdxFilesUnder(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true, recursive: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.mdx'))
    .map((entry) => path.join(entry.parentPath, entry.name))
    .sort()
}

function where(file: string, line: number | undefined): string {
  return line === undefined ? file : `${file}:${line}`
}

/**
 * 从内容目录的全部 mdx 出发，收集已登记组件的引用，交给登记它的功能包换成那一条在本站的 mdx 文件，接着扫那些文件，直到走完。
 * 只扫从内容页走得到的页面；代码块里写的组件例子不是 JSX 元素，不算引用
 */
export async function siteReferences(place: ReferencePlace): Promise<SiteReferences> {
  const owners = await referenceComponentOwnersOf(place.siteDir)
  const queue = mdxFilesUnder(path.join(place.siteDir, contentDirInSite))
  const queued = new Set(queue)
  const references: SiteReference[] = []
  const missing: SiteReference[] = []
  const problems: SiteReferenceProblem[] = []
  for (let next = 0; next < queue.length; next++) {
    const file = queue[next]!
    const elements = jsxElementsOfFile(file)
    if ('error' in elements) {
      problems.push({ from: file, message: `解析不了，引用扫不出来：${elements.error}` })
      continue
    }
    for (const element of elements) {
      const owner = owners.get(element.name)
      if (owner === undefined) continue
      if (element.id === null || element.id === 'expression') {
        problems.push({ from: where(file, element.line), message: `<${element.name}> 的 id 要写成字符串（id="…"），${element.id === null ? '没写' : '写成了表达式'}` })
        continue
      }
      const reference: SiteReference = { component: element.name, id: element.id.text, from: file }
      const files = owner.resolver.resolveReference(reference.id, place)
      if (files === undefined) {
        missing.push(reference)
        continue
      }
      references.push(reference)
      for (const referencedFile of files) {
        if (queued.has(referencedFile)) continue
        queued.add(referencedFile)
        queue.push(referencedFile)
      }
    }
  }
  return { references, missing, problems }
}

/**
 * 自包含检查：shared 站引用了本站没有的条目、引用扫不出来，每条一行，写明哪个文件引用了哪一条、功能包给的补法；过了是空数组。
 * 个人站不查：它读本机提供的目录，别人本来就打不开
 */
export async function selfContainedProblemsOf(siteDir: string): Promise<SelfContainedProblem[]> {
  if (siteAudienceOf(siteDir) !== 'shared') return []
  const owners = await referenceComponentOwnersOf(siteDir)
  if (owners.size === 0) return []
  const { missing, problems } = await siteReferences({ siteDir, audience: 'shared', providedDirs: {} })
  const relative = (file: string) => path.relative(siteDir, file).replaceAll('\\', '/')
  return [
    ...missing.map(({ component, id, from }) => ({
      file: relative(from),
      message: `引用了 <${component} id="${id}">，本站没有这一条：${owners.get(component)!.resolver.publishHint(id, siteDir)}`,
    })),
    ...problems.map(({ from, message }) => ({ file: relative(from), message })),
  ]
}

/** 一条自包含问题一行：文件（相对站点根）加原因 */
export function selfContainedProblemLine({ file, message }: SelfContainedProblem): string {
  return `${file}：${message}`
}
