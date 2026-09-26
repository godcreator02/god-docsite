import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { DOC_SCRIPTS, planCreate, SCAFFOLD_FILES_REMOVED, type CreateInput } from '../src/create.js'
import { DOCFIRST_DEPS } from '../src/deps.js'
import { filesFirstRenderOverwrites, readRepoManifest } from '../src/repo-root.js'
import { readTemplate, renderFiles, renderText, TEMPLATE_ROOT, type SiteValues, type TemplateFile } from '../src/template.js'

/**
 * 建站选项经纯函数 `planCreate` 测：交给 `createSite` 的选项形状、依赖与脚本、模板渲染、显示名。
 * 模板本身另测一组：三个清单跟官方脚手架的输出对得上、不碰本机约定改过的文件、三个区齐全。
 * 读仓根的两个函数在临时目录里测。
 *
 * 另有一条检查两处版本号一致：写进站的依赖表是手写的（工作区里写的是 `workspace:*`，
 * 写进别的站装不上），表里的包发版升版本号时要跟着改。
 */

const HERE = path.dirname(fileURLToPath(import.meta.url))
const PACKAGES = path.resolve(HERE, '..', '..', '..', 'packages')

/** 包名 → 它在 packages/ 下的目录名 */
const DIR_OF: Record<string, string> = {
  '@godcreator/docfirst-workflow': 'docfirst-workflow',
  '@godcreator/docfirst-fumadocs': 'docfirst-fumadocs',
}

/** 模板可以 import 的 docfirst 出口：只有写进站依赖表的两个包的这几个出口 */
const TEMPLATE_IMPORTABLE = [
  '@godcreator/docfirst-workflow/mdx',
  '@godcreator/docfirst-fumadocs',
  '@godcreator/docfirst-fumadocs/roster',
  '@godcreator/docfirst-fumadocs/pre',
  '@godcreator/docfirst-fumadocs/light.css',
]

/**
 * 清单作用的那一套文件：官方脚手架 `create-fumadocs-app@16.2.8`（`src/scaffold.ts` 写死的版本，参数
 * `--template +next+fuma-docs-mdx --src --search orama`）的输出，应用本机约定之后——
 * 多了 pnpm-workspace.yaml，少了分享图路由 `src/app/og/docs/[...slug]/route.tsx` 与落地页 `src/app/(home)/` 两份。
 * `src/scaffold.ts` 换脚手架版本或改本机约定时这张表跟着改：新增清单里的文件在这张表里就是重名，替换、删除清单里的不在就是找不到。
 */
const SCAFFOLD_OUTPUT = [
  '.gitignore',
  'README.md',
  'content/docs/index.mdx',
  'content/docs/test.mdx',
  'next.config.mjs',
  'package.json',
  'pnpm-workspace.yaml',
  'postcss.config.mjs',
  'src/app/api/search/route.ts',
  'src/app/docs/[[...slug]]/page.tsx',
  'src/app/docs/layout.tsx',
  'src/app/global.css',
  'src/app/layout.tsx',
  'src/app/llms-full.txt/route.ts',
  'src/app/llms.mdx/docs/[[...slug]]/route.ts',
  'src/app/llms.txt/route.ts',
  'src/components/mdx.tsx',
  'src/lib/cn.ts',
  'src/lib/layout.shared.tsx',
  'src/lib/shared.ts',
  'src/lib/source.ts',
  'src/proxy.ts',
  'tsconfig.json',
]

/** 本机约定改过的文件（`src/scaffold.ts` 的 `MANAGED_FILES`）：清单不能替换、不能删除 */
const MANAGED_BY_CONVENTIONS = [
  'package.json',
  'pnpm-workspace.yaml',
  'next.config.mjs',
  'src/app/layout.tsx',
  'src/app/global.css',
  'src/lib/shared.ts',
  'src/lib/layout.shared.tsx',
  'src/app/docs/[[...slug]]/page.tsx',
]

/** 渲染模板用的一套值 */
const VALUES: SiteValues = { title: '样例', site: 'docs-site' }

/** 模板里的三个区，各有集合、loader、侧栏根节点与 meta.json */
const ZONES = ['docs', 'trajectory', 'future']

/** 模板里的全部起始页（相对 content/） */
const PAGES = [
  'docs/index.mdx',
  'docs/glossary.mdx',
  'docs/outputs/readme.mdx',
  'docs/outputs/agents.mdx',
  'docs/outputs/claude.mdx',
  'trajectory/index.mdx',
  'future/roadmap.mdx',
]

/** 生成正本：正文的一级标题会进生成物，所以它们保留 */
const OUTPUT_SOURCES = ['content/docs/outputs/readme.mdx', 'content/docs/outputs/agents.mdx']

/** 一个不存在的站目录：`planCreate` 不碰盘，路径只用来认名字 */
const SITE_DIR = path.join(os.tmpdir(), 'gwb-docfirst-workflow-不存在', '我的仓', 'docs-site')

/** 缺省输入：包里的模板、没有仓根 package.json */
function inputWith(overrides: Partial<CreateInput> = {}): CreateInput {
  return { siteDir: SITE_DIR, repoManifest: null, template: readTemplate(), ...overrides }
}

/** 渲染好的整套模板：新增与替换合在一起 */
function renderedAll(): TemplateFile[] {
  const template = readTemplate()
  return [...renderFiles(template.add, VALUES), ...renderFiles(template.replace, VALUES)]
}

/** 渲染好的某一份；不在就报出有哪些文件 */
function renderedText(rel: string): string {
  const all = renderedAll()
  const found = all.find((file) => file.rel === rel)
  expect(found, `模板里没有 ${rel}：${all.map((f) => f.rel).join('、')}`).toBeDefined()
  return found!.text
}

/** 建一个临时仓根，放入给定文件；跑完整个删掉 */
function inRepo(files: Record<string, string>, body: (repo: string) => void): void {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'gwb-docfirst-workflow-repo-'))
  try {
    for (const [rel, text] of Object.entries(files)) fs.writeFileSync(path.join(repo, rel), text, 'utf8')
    body(repo)
  } finally {
    fs.rmSync(repo, { recursive: true, force: true, maxRetries: 5 })
  }
}

describe('结构模板', () => {
  it('包里的模板读得出来，分新增与替换两个目录', () => {
    expect(fs.existsSync(path.join(TEMPLATE_ROOT, 'add', 'docfirst.config.mjs.tpl'))).toBe(true)
    expect(fs.existsSync(path.join(TEMPLATE_ROOT, 'replace', 'src', 'lib', 'source.ts.tpl'))).toBe(true)
    expect(fs.readdirSync(TEMPLATE_ROOT).sort()).toEqual(['add', 'replace'])
  })

  it('写盘时去掉 .tpl 后缀', () => {
    const { add, replace } = readTemplate()
    expect([...add, ...replace].every((f) => f.rel.endsWith('.tpl'))).toBe(true)
    expect(renderedAll().every((f) => !f.rel.endsWith('.tpl'))).toBe(true)
  })

  it('整套渲染完不留占位符，认不出的占位符当场抛出', () => {
    for (const file of renderedAll()) expect(file.text, file.rel).not.toMatch(/\{\{\w+\}\}/)
    expect(() => renderText('{{typo}}', VALUES, 'x')).toThrow(/认不出的占位符 \{\{typo\}\}（x）/)
  })

  it('新增的文件官方输出里都没有：重名 createSite 就报错', () => {
    for (const file of renderFiles(readTemplate().add, VALUES)) expect(SCAFFOLD_OUTPUT, `新增清单里的 ${file.rel} 官方输出里已经有`).not.toContain(file.rel)
  })

  it('替换与删除的文件官方输出里都有，且都不是本机约定改过的', () => {
    const touched = [...renderFiles(readTemplate().replace, VALUES).map((f) => f.rel), ...SCAFFOLD_FILES_REMOVED]
    for (const rel of touched) {
      expect(SCAFFOLD_OUTPUT, `${rel} 官方输出里没有，没法替换或删除`).toContain(rel)
      expect(MANAGED_BY_CONVENTIONS, `${rel} 本机约定已经改过`).not.toContain(rel)
    }
  })

  it('官方的 docs 页面不替换：它从 @/components/mdx 取组件，状态点靠替换 mdx.tsx 接上', () => {
    expect(renderedAll().map((f) => f.rel)).not.toContain('src/app/docs/[[...slug]]/page.tsx')
  })

  it('没有 source.config.ts 与构建配置：集合用 macro 写在 src/lib/source.ts', () => {
    const rels = renderedAll().map((f) => f.rel)
    for (const gone of ['source.config.ts', 'next.config.mjs', 'tsconfig.json', 'postcss.config.mjs']) expect(rels).not.toContain(gone)
  })

  it('content/ 下只有 docs、trajectory、future 三个区，页面只有那几页；轨迹与未来各有路由与 layout', () => {
    const rels = renderedAll().map((f) => f.rel)
    const contentDirs = new Set(rels.filter((rel) => rel.startsWith('content/')).map((rel) => rel.split('/')[1]))
    expect([...contentDirs].sort()).toEqual([...ZONES].sort())
    const pages = rels.filter((rel) => rel.startsWith('content/') && rel.endsWith('.mdx')).map((rel) => rel.slice('content/'.length))
    expect(pages.sort()).toEqual([...PAGES].sort())
    for (const zone of ['trajectory', 'future']) {
      expect(rels).toContain(`src/app/${zone}/[[...slug]]/page.tsx`)
      expect(renderedText(`src/app/${zone}/layout.tsx`).trim()).toBe("export { default } from '../docs/layout';")
    }
  })

  it('src/lib/source.ts：三个区各一个 macro 集合，现状集合经 applyMdxPreset 接 docfirst，官方的导出名还在', () => {
    const source = renderedText('src/lib/source.ts')
    expect(source).toMatch(/from 'fumadocs-mdx\/macro'/)
    expect([...source.matchAll(/const (\w+) = defineDocs\(\{\s*dir: 'content\/(\w+)'/g)].map((m) => [m[1], m[2]])).toEqual(ZONES.map((zone) => [zone, zone]))
    expect(source).toMatch(/mdxOptions: applyMdxPreset\(docfirstMdxOptions\(\{ root: process\.cwd\(\) \}\)\),/)
    expect((source.match(/includeProcessedMarkdown/g) ?? []).length, '只有现状区开 processed markdown').toBe(1)
    expect(source).toMatch(/schema: cardSchema/)
    expect(source, '不许靠强转过类型检查').not.toMatch(/\bas (never|unknown|any)\b/)
    for (const name of ['source', 'sourceTrajectory', 'sourceFuture', 'docsLlms']) expect(source).toMatch(new RegExp(`export const ${name} = `))
    expect([...source.matchAll(/baseUrl: ([^,\n]+),/g)].map((m) => m[1])).toEqual(['docsRoute', "'/trajectory'", "'/future'"])
  })

  it('src/app/docs/layout.tsx：侧栏三个根节点，引入 docfirst 的样式', () => {
    const layout = renderedText('src/app/docs/layout.tsx')
    expect([...layout.matchAll(/zone\('([^']+)'/g)].map((m) => m[1])).toEqual(['现状', '轨迹', '未来'])
    expect(layout).toMatch(/root: true/)
    expect(layout).toMatch(/import '\.\.\/docfirst\.css';/)
    expect(renderedText('src/app/docfirst.css')).toMatch(/@import '@godcreator\/docfirst-fumadocs\/light\.css';/)
  })

  it('模板里引用的 docfirst 出口都在站依赖表的两个包里', () => {
    const referenced = new Set<string>()
    for (const file of renderedAll()) {
      for (const m of file.text.matchAll(/(?:from|@import)\s+'(@godcreator\/docfirst-[^']+)'/g)) referenced.add(m[1]!)
    }
    expect([...referenced].filter((spec) => !TEMPLATE_IMPORTABLE.includes(spec)), '模板引用了不在清单里的出口').toEqual([])
    for (const spec of referenced) expect(Object.keys(DOCFIRST_DEPS), `${spec} 所在的包不在站依赖表里`).toContain(spec.split('/').slice(0, 2).join('/'))
  })

  it('src/components/mdx.tsx：pre 换成状态点组件，官方的 useMDXComponents 与全局类型还在', () => {
    const mdx = renderedText('src/components/mdx.tsx')
    expect(mdx).toMatch(/import \{ DocfirstPre \} from '@godcreator\/docfirst-fumadocs\/pre';/)
    expect(mdx).toMatch(/pre: DocfirstPre,/)
    expect(mdx).toMatch(/export const useMDXComponents = getMDXComponents;/)
    expect(mdx).toMatch(/type MDXProvidedComponents = /)
  })

  it('模板里不引用本机约定删掉的 gitConfig', () => {
    for (const file of renderedAll()) expect(file.text, file.rel).not.toContain('gitConfig')
  })

  it('docfirst.config.mjs：content 目录与 outputs 映射到仓根', () => {
    const config = renderedText('docfirst.config.mjs')
    const body = config.slice(config.indexOf('export default'))
    expect(body).toMatch(/content: 'content'/)
    for (const gone of ['docs', 'trajectory', 'comparator', 'ledger', 'fumadocs']) expect(body, `配置里还有 ${gone} 键`).not.toMatch(new RegExp(`^\\s*${gone}:`, 'm'))
    expect(body).toMatch(/'content\/docs\/outputs\/readme\.mdx': \['\.\.\/README\.md'\]/)
    expect(body).toMatch(/'content\/docs\/outputs\/agents\.mdx': \['\.\.\/AGENTS\.md'\]/)
    expect(body).toMatch(/'content\/docs\/outputs\/claude\.mdx': \['\.\.\/CLAUDE\.md'\]/)
  })

  it('docfirst.config.mjs：格式是 workflow 包的 mdx，名册展开 fumadocs 包的 fumadocsRoster', () => {
    const config = renderedText('docfirst.config.mjs')
    expect(config).toMatch(/^import \* as mdx from '@godcreator\/docfirst-workflow\/mdx'$/m)
    expect(config).toMatch(/^import \{ fumadocsRoster \} from '@godcreator\/docfirst-fumadocs\/roster'$/m)
    expect(config).toMatch(/formats: \[mdx\],/)
    expect(config).toMatch(/components: \{\s*\.\.\.fumadocsRoster,\s*\}/)
  })

  it('起始页只规定第一句「本页回答」与待填位置，不规定小标题', () => {
    for (const file of renderedAll()) {
      if (!file.rel.startsWith('content/') || !file.rel.endsWith('.mdx')) continue
      expect(file.text, `${file.rel} 要有「本页回答」`).toMatch(/\*\*本页回答\*\*：/)
      expect(file.text, `${file.rel} 里有小标题`).not.toMatch(/^#{2,} /m)
    }
  })

  it('起始页正文不写一级标题：页面已经用 frontmatter 的 title 渲染标题；生成正本除外，它的一级标题要进生成物', () => {
    for (const file of renderedAll()) {
      if (!file.rel.startsWith('content/') || !file.rel.endsWith('.mdx')) continue
      if (OUTPUT_SOURCES.includes(file.rel)) expect(file.text, `${file.rel} 生成出去要有一级标题`).toMatch(/^# /m)
      else expect(file.text, `${file.rel} 正文里又写了一遍标题`).not.toMatch(/^# /m)
    }
  })

  it('CLAUDE 正本 frontmatter 之后的第一行是 @AGENTS.md', () => {
    const body = renderedText('content/docs/outputs/claude.mdx').replace(/^---\n[\s\S]*?\n---\n/, '')
    expect(body.trimStart().split('\n')[0]).toBe('@AGENTS.md')
  })

  it('AGENTS 正本指回自己在站里的路径', () => {
    expect(renderedText('content/docs/outputs/agents.mdx')).toContain('`docs-site/content/docs/outputs/agents.mdx`')
  })
})

describe('planCreate：交给 createSite 的选项', () => {
  it('三个清单：新增、替换来自模板，删除是官方的示例页', () => {
    const template = readTemplate()
    const args = planCreate(inputWith({ template }))
    const values: SiteValues = { title: '我的仓', site: 'docs-site' }
    expect(args.dir).toBe(SITE_DIR)
    expect(args.addFiles).toEqual(renderFiles(template.add, values).map((f) => ({ path: f.rel, text: f.text })))
    expect(args.replaceFiles).toEqual(renderFiles(template.replace, values).map((f) => ({ path: f.rel, text: f.text })))
    expect(args.removeFiles).toEqual(['content/docs/test.mdx'])
    const paths = [...args.addFiles!.map((f) => f.path), ...args.replaceFiles!.map((f) => f.path), ...args.removeFiles!]
    expect(new Set(paths).size, '三个清单之间有重复路径').toBe(paths.length)
  })

  it('依赖与脚本：docfirst-workflow 与 docfirst-fumadocs 进 devDependencies，doc 脚本进 scripts，不占官方的 dev / build / start', () => {
    const args = planCreate(inputWith())
    expect(args.devDependencies).toEqual(DOCFIRST_DEPS)
    expect(args.dependencies, '不往运行时依赖里加').toBeUndefined()
    expect(args.scripts).toEqual(DOC_SCRIPTS)
    for (const taken of ['dev', 'build', 'start', 'types:check']) expect(Object.keys(args.scripts!)).not.toContain(taken)
    expect(args.scripts!['doc']).toBe('docfirst check')
    expect(args.scripts!['verify:roster']).toBe('node scripts/verify-roster.mjs')
  })

  it('端口给了就传，不给就不带这个键，由 createSite 选', () => {
    expect(planCreate(inputWith({ port: 4317 })).port).toBe(4317)
    expect('port' in planCreate(inputWith())).toBe(false)
  })

  it('显示名：title 优先，其次仓根 package.json 的 title，再次包名去掉 scope，最后仓的目录名', () => {
    const titleOf = (overrides: Partial<CreateInput>): string => planCreate(inputWith(overrides)).title!
    expect(titleOf({ repoManifest: { name: '@scope/hello' } })).toBe('hello')
    expect(titleOf({ repoManifest: { name: '@scope/hello' }, title: '打个招呼' })).toBe('打个招呼')
    expect(titleOf({ repoManifest: { name: '@scope/hello', title: '你好' } })).toBe('你好')
    expect(titleOf({ repoManifest: null })).toBe('我的仓')
  })

  it('传给 createSite 的显示名与模板里的是同一个，description 也用它', () => {
    const args = planCreate(inputWith({ repoManifest: { name: '@scope/hello', title: '你好' } }))
    expect(args.title).toBe('你好')
    const index = args.replaceFiles!.find((file) => file.path === 'content/docs/index.mdx')
    expect(index?.text).toMatch(/^title: 你好$/m)
    expect(args.description).toMatch(/^你好 的文档站（docfirst）/)
  })

  it('模板里有认不出的占位符当场抛出', () => {
    expect(() => planCreate(inputWith({ template: { add: [{ rel: 'a.txt.tpl', text: '{{typo}}' }], replace: [] } }))).toThrow(
      /认不出的占位符 \{\{typo\}\}（a\.txt\.tpl）/,
    )
  })
})

describe('仓根', () => {
  it('readRepoManifest：没有文件是 null，有就解析，不是合法 JSON 就报错', () => {
    inRepo({}, (repo) => expect(readRepoManifest(repo)).toBeNull())
    inRepo({ 'package.json': JSON.stringify({ name: '@s/hello', title: '你好' }) }, (repo) => {
      expect(readRepoManifest(repo)).toEqual({ name: '@s/hello', title: '你好' })
    })
    inRepo({ 'package.json': '{ 坏的' }, (repo) => {
      expect(() => readRepoManifest(repo)).toThrow(/仓根的 package\.json 不是合法的 JSON/)
    })
  })

  it('filesFirstRenderOverwrites：只列仓根已有的 README / AGENTS / CLAUDE', () => {
    inRepo({ 'README.md': '# 老 README\n', 'CLAUDE.md': '老 CLAUDE\n', 'other.md': '' }, (repo) => {
      expect(filesFirstRenderOverwrites(repo)).toEqual(['README.md', 'CLAUDE.md'])
    })
    inRepo({}, (repo) => expect(filesFirstRenderOverwrites(repo)).toEqual([]))
  })
})

it('写进站的依赖表是精确版本号，与工作区里对应包的版本一致', () => {
  for (const [name, pin] of Object.entries(DOCFIRST_DEPS)) {
    const dir = DIR_OF[name]
    expect(dir, `依赖表里的 ${name} 在 packages/ 下没有对应目录，新加依赖时把 DIR_OF 也补上`).toBeDefined()
    const pkg = JSON.parse(fs.readFileSync(path.join(PACKAGES, dir!, 'package.json'), 'utf8')) as { name: string; version: string }
    expect(pkg.name, `${String(dir)} 的包名与依赖表里的 ${name} 不一致`).toBe(name)
    expect(pin, `依赖表里 ${name} 写的是 ${pin}，工作区里是 ${pkg.version}：写精确号（不带 ^ / ~ / >=），发版时跟着改`).toBe(pkg.version)
  }
})
