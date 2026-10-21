// 原型：平台的引用扫描 siteReferences。从内容页出发，按语法树收集已登记组件的 id，交给登记它的功能换成那一条的 mdx 文件，接着扫，直到走完
import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { createProcessor } from '@mdx-js/mdx'
import remarkMath from 'remark-math'

/** 功能登记的引用组件与解析函数；正式做法里组件名登记在功能包 package.json，解析函数在 ./node 出口 */
export interface ReferenceResolver {
  components: readonly string[]
  /** 这一条在本站的 mdx 文件；本站没有这一条回 undefined */
  resolveReference(id: string): string[] | undefined
}

export interface FoundReference {
  component: string
  id: string
  from: string
}

export interface ReferenceProblem {
  file: string
  line: number | undefined
  message: string
}

export interface SiteReferences {
  references: FoundReference[]
  missing: FoundReference[]
  problems: ReferenceProblem[]
  scannedFiles: number
  parsedFiles: number
  ms: number
}

type JsxElementInFile = { name: string; id: string | undefined; line: number | undefined }

type ParsedFile = { mtimeMs: number; size: number; elements: JsxElementInFile[] }

const parsedByFile = new Map<string, ParsedFile>()

const processor = createProcessor({ remarkPlugins: [remarkMath] })

/** frontmatter 换成同样行数的空行：mdx 解析器不认 YAML，行号仍对得上原文件 */
function withoutFrontmatter(source: string): string {
  const match = /^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/.exec(source)
  return match === null ? source : match[0].replace(/[^\n]/g, '') + source.slice(match[0].length)
}

type MdastNode = { type: string; name?: string | null; attributes?: Array<{ type: string; name?: string; value?: unknown }>; children?: MdastNode[]; position?: { start: { line: number } } }

function jsxElementsIn(node: MdastNode, found: JsxElementInFile[]): JsxElementInFile[] {
  if ((node.type === 'mdxJsxFlowElement' || node.type === 'mdxJsxTextElement') && typeof node.name === 'string') {
    const idAttribute = node.attributes?.find((attribute) => attribute.type === 'mdxJsxAttribute' && attribute.name === 'id')
    found.push({ name: node.name, id: typeof idAttribute?.value === 'string' ? idAttribute.value : undefined, line: node.position?.start.line })
  }
  for (const child of node.children ?? []) jsxElementsIn(child, found)
  return found
}

/** 一个文件里全部 JSX 元素的名字与 id，按「路径 + 修改时间 + 大小」缓存；第二项是这次有没有真的解析 */
function jsxElementsOfFile(file: string): [JsxElementInFile[], boolean] {
  const { mtimeMs, size } = statSync(file)
  const cached = parsedByFile.get(file)
  if (cached !== undefined && cached.mtimeMs === mtimeMs && cached.size === size) return [cached.elements, false]
  const tree = processor.parse(withoutFrontmatter(readFileSync(file, 'utf8'))) as MdastNode
  const elements = jsxElementsIn(tree, [])
  parsedByFile.set(file, { mtimeMs, size, elements })
  return [elements, true]
}

function contentFilesIn(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true, recursive: true })
    .filter((entry) => entry.isFile() && /\.mdx?$/.test(entry.name))
    .map((entry) => path.join(entry.parentPath, entry.name))
    .sort()
}

function resolverByComponent(resolvers: readonly ReferenceResolver[]): Map<string, ReferenceResolver> {
  const owners = new Map<string, ReferenceResolver>()
  for (const resolver of resolvers) {
    for (const component of resolver.components) {
      if (owners.has(component)) throw new Error(`引用组件 ${component} 有两个功能登记`)
      owners.set(component, resolver)
    }
  }
  return owners
}

export function siteReferences(contentDir: string, resolvers: readonly ReferenceResolver[]): SiteReferences {
  const started = performance.now()
  const owners = resolverByComponent(resolvers)
  const queue = contentFilesIn(contentDir)
  const queued = new Set(queue)
  const result: SiteReferences = { references: [], missing: [], problems: [], scannedFiles: 0, parsedFiles: 0, ms: 0 }
  for (let next = 0; next < queue.length; next++) {
    const file = queue[next]!
    const [elements, parsed] = jsxElementsOfFile(file)
    result.scannedFiles++
    if (parsed) result.parsedFiles++
    for (const element of elements) {
      const resolver = owners.get(element.name)
      if (resolver === undefined) continue
      if (element.id === undefined) {
        result.problems.push({ file, line: element.line, message: `<${element.name}> 的 id 要写成字符串` })
        continue
      }
      const reference = { component: element.name, id: element.id, from: file }
      const files = resolver.resolveReference(element.id)
      if (files === undefined) {
        result.missing.push(reference)
        continue
      }
      result.references.push(reference)
      for (const referencedFile of files) {
        if (queued.has(referencedFile)) continue
        queued.add(referencedFile)
        queue.push(referencedFile)
      }
    }
  }
  result.ms = performance.now() - started
  return result
}

/** 清掉语法树缓存：只给量冷启动耗时用 */
export function forgetParsedFiles(): void {
  parsedByFile.clear()
}
