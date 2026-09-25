import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { attachSite, planAttach, DEFAULT_PORT, DOCFIRST_DEPS, type AttachPlan } from '../src/attach.js'
import { readTemplate, renderSite, renderText, ATTACH_TEMPLATE, type SiteValues } from '../src/template.js'

/**
 * 装配经对外的两个函数测：`planAttach` 只计算不写盘，骨架检查、名字、package.json 合并、占位符
 * 都在它返回的计划里看；`attachSite` 在临时目录里真的写盘，看装出来的站与写盘失败时的恢复。
 *
 * 另有一条检查两处版本号一致：装配写进目标站的依赖表是手写的（工作区里写的是 `workspace:*`，
 * 写进别的站装不上），两个包发版升版本号时要跟着改。
 */

const HERE = path.dirname(fileURLToPath(import.meta.url))
const PACKAGES = path.resolve(HERE, '..', '..')

/** 包名 → 它在 packages/ 下的目录名 */
const DIR_OF: Record<string, string> = {
  '@godcreator/docfirst-workflow': 'docfirst-workflow',
  '@godcreator/docfirst-trajectory': 'docfirst-trajectory',
}

/** 渲染模板用的一套值 */
const VALUES: SiteValues = { title: '样例', site: 'docs-site' }

/** 模板里的三个区，各有集合、路由、侧栏根节点与 meta.json */
const ZONES = ['docs', 'trajectory', 'future']

/** 模板里的全部骨架页（相对 content/） */
const PAGES = [
  'docs/index.mdx',
  'docs/glossary.mdx',
  'docs/outputs/readme.mdx',
  'docs/outputs/agents.mdx',
  'docs/outputs/claude.mdx',
  'trajectory/index.mdx',
  'future/roadmap.mdx',
]

/** 站点插件生成的骨架 package.json，最小的一份 */
function skeletonManifest(port: number | null): string {
  const scripts: Record<string, string> = { build: 'next build' }
  if (port !== null) {
    scripts.dev = `next dev -p ${String(port)}`
    scripts.start = `next start -p ${String(port)}`
  }
  const manifest = { name: 'hello-docs-site', version: '0.1.0', private: true, type: 'module', scripts, dependencies: { 'fumadocs-core': '16.15.1', next: '16.3.0' } }
  return `${JSON.stringify(manifest, null, 2)}\n`
}

/** 造一个刚生成的骨架 `<tmp>/我的仓/docs-site`，仓根与站里可以额外放文件。跑完整个删掉 */
function inSkeleton(
  setup: { port?: number | null; repoFiles?: Record<string, string>; siteFiles?: Record<string, string> },
  body: (site: string, repo: string) => void,
): void {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gwb-docfirst-workflow-attach-'))
  const repo = path.join(root, '我的仓')
  const site = path.join(repo, 'docs-site')
  try {
    fs.mkdirSync(path.join(site, 'content', 'docs'), { recursive: true })
    fs.writeFileSync(path.join(site, 'package.json'), skeletonManifest(setup.port === undefined ? 4317 : setup.port))
    fs.writeFileSync(path.join(site, 'content', 'docs', 'index.mdx'), '---\ntitle: 骨架\n---\n')
    fs.writeFileSync(path.join(site, 'content', 'docs', 'meta.json'), '{ "pages": ["index", "..."] }\n')
    fs.mkdirSync(path.join(site, 'src', 'app', 'docs'), { recursive: true })
    fs.writeFileSync(path.join(site, 'src', 'app', 'docs', 'layout.tsx'), 'export default function Layout() {}\n')
    for (const [rel, text] of Object.entries(setup.siteFiles ?? {})) {
      fs.mkdirSync(path.dirname(path.join(site, rel)), { recursive: true })
      fs.writeFileSync(path.join(site, rel), text, 'utf8')
    }
    for (const [rel, text] of Object.entries(setup.repoFiles ?? {})) {
      fs.mkdirSync(path.dirname(path.join(repo, rel)), { recursive: true })
      fs.writeFileSync(path.join(repo, rel), text, 'utf8')
    }
    body(site, repo)
  } finally {
    fs.rmSync(root, { recursive: true, force: true, maxRetries: 5 })
  }
}

/** 造一份临时的小模板，用来单独测渲染与写盘 */
function templateDir(files: Record<string, string>): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gwb-docfirst-workflow-tpl-'))
  for (const [rel, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true })
    fs.writeFileSync(path.join(root, rel), text, 'utf8')
  }
  return root
}

/** 计划里某个文件的正文；不在就报出计划里有哪些文件 */
function fileIn(plan: AttachPlan, rel: string): string {
  const found = plan.files.find((file) => file.rel === rel)
  expect(found, `计划里没有 ${rel}：${plan.files.map((f) => f.rel).join('、')}`).toBeDefined()
  return found!.text
}

/** 调用会抛出时返回错误文本，不抛出时返回空串 */
function errorOf(call: () => unknown): string {
  try {
    call()
  } catch (error) {
    return (error as Error).message
  }
  return ''
}

describe('模板', () => {
  it('包里的模板读得出来', () => {
    expect(fs.existsSync(path.join(ATTACH_TEMPLATE, 'docfirst.config.mjs.tpl'))).toBe(true)
    expect(readTemplate().length).toBeGreaterThan(15)
  })

  it('写盘时去掉 .tpl 后缀', () => {
    const files = readTemplate()
    expect(files.every((f) => f.rel.endsWith('.tpl'))).toBe(true)
    expect(renderSite(files, VALUES).every((f) => !f.rel.endsWith('.tpl'))).toBe(true)
  })

  it('整套渲染完不留占位符，认不出的占位符当场抛出', () => {
    for (const file of renderSite(readTemplate(), VALUES)) expect(file.text, file.rel).not.toMatch(/\{\{\w+\}\}/)
    expect(() => renderText('{{typo}}', VALUES, 'x')).toThrow(/认不出的占位符/)
  })

  it('骨架的那部分不在装配模板里：package.json、tsconfig、postcss 等由站点插件生成', () => {
    for (const rel of ['package.json.tpl', 'tsconfig.json.tpl', 'postcss.config.mjs.tpl', 'pnpm-workspace.yaml.tpl', '.npmrc.tpl']) {
      expect(fs.existsSync(path.join(ATTACH_TEMPLATE, rel)), `装配模板里有骨架的 ${rel}`).toBe(false)
    }
  })

  it('content/ 下只有 docs、trajectory、future 三个区，页面只有那几页', () => {
    const rels = readTemplate().map((f) => f.rel)
    const contentDirs = new Set(rels.filter((rel) => rel.startsWith('content/')).map((rel) => rel.split('/')[1]))
    expect([...contentDirs].sort()).toEqual([...ZONES].sort())
    const pages = rels.filter((rel) => rel.startsWith('content/') && rel.endsWith('.mdx.tpl')).map((rel) => rel.slice('content/'.length, -'.tpl'.length))
    expect(pages.sort()).toEqual([...PAGES].sort())
    const routes = rels.filter((rel) => /^src\/app\/[^/]+\/\[\[\.\.\.slug\]\]\/page\.tsx\.tpl$/.test(rel)).map((rel) => rel.split('/')[2])
    expect(routes.sort()).toEqual([...ZONES].sort())
  })

  it('骨架页只规定第一句「本页回答」与待填位置，不规定小标题', () => {
    for (const file of renderSite(readTemplate(), VALUES)) {
      if (!file.rel.startsWith('content/') || !file.rel.endsWith('.mdx')) continue
      expect(file.text, `${file.rel} 要有「本页回答」`).toMatch(/\*\*本页回答\*\*：/)
      expect(file.text, `${file.rel} 里有小标题`).not.toMatch(/^#{2,} /m)
    }
  })

  it('CLAUDE 正本 frontmatter 之后的第一行是 @AGENTS.md', () => {
    const claude = renderSite(readTemplate(), VALUES).find((f) => f.rel === 'content/docs/outputs/claude.mdx')!.text
    const body = claude.replace(/^---\n[\s\S]*?\n---\n/, '')
    expect(body.trimStart().split('\n')[0]).toBe('@AGENTS.md')
  })

  it('AGENTS 正本指回自己在站里的路径', () => {
    const agents = renderSite(readTemplate(), VALUES).find((f) => f.rel === 'content/docs/outputs/agents.mdx')!.text
    expect(agents).toContain('`docs-site/content/docs/outputs/agents.mdx`')
  })
})

describe('planAttach：只计算不写盘', () => {
  it('一个字都不写，整套文件在计划里', () => {
    inSkeleton({}, (site) => {
      const plan = planAttach({ siteDir: site })
      expect(plan.target).toBe(site)
      expect(fs.existsSync(path.join(site, 'docfirst.config.mjs')), '计算完盘上什么都没有').toBe(false)
      expect(plan.files.length).toBeGreaterThan(15)
      expect(plan.files.some((file) => file.rel.endsWith('.tpl'))).toBe(false)
    })
  })

  it('端口从骨架的脚本里认，装配不改它；认不出用 next 的默认端口', () => {
    inSkeleton({ port: 4317 }, (site) => {
      const plan = planAttach({ siteDir: site })
      expect(plan.port).toBe(4317)
      const merged = JSON.parse(plan.manifest) as { scripts: Record<string, string> }
      expect(merged.scripts.dev, '骨架的脚本不动').toBe('next dev -p 4317')
    })
    inSkeleton({ port: null }, (site) => {
      expect(planAttach({ siteDir: site }).port).toBe(DEFAULT_PORT)
    })
  })

  it('package.json 只加不减：补 doc 脚本与 docfirst 依赖，骨架写的都保留', () => {
    inSkeleton({}, (site) => {
      const plan = planAttach({ siteDir: site })
      const merged = JSON.parse(plan.manifest) as {
        name: string
        scripts: Record<string, string>
        dependencies: Record<string, string>
        devDependencies: Record<string, string>
        description: string
      }
      expect(merged.name).toBe('hello-docs-site')
      expect(merged.dependencies['fumadocs-core']).toBe('16.15.1')
      expect(merged.scripts.build).toBe('next build')
      expect(merged.scripts.doc).toBe('docfirst check')
      expect(merged.scripts['doc:render']).toBe('docfirst render')
      expect(merged.scripts['verify:roster']).toBe('node scripts/verify-roster.mjs')
      for (const [name, range] of Object.entries(DOCFIRST_DEPS)) expect(merged.devDependencies[name]).toBe(range)
      expect(merged.description).toMatch(/^我的仓 的文档站/)
      expect(fileIn(plan, 'package.json')).toBe(plan.manifest)
    })
  })

  it('显示名：title 优先，其次仓根 package.json 的 title，再次包名去掉 scope，最后仓的目录名', () => {
    inSkeleton({ repoFiles: { 'package.json': JSON.stringify({ name: '@scope/hello' }) } }, (site) => {
      expect(fileIn(planAttach({ siteDir: site }), 'content/docs/index.mdx')).toMatch(/^# hello$/m)
      expect(fileIn(planAttach({ siteDir: site, title: '打个招呼' }), 'content/docs/index.mdx')).toMatch(/^# 打个招呼$/m)
    })
    inSkeleton({ repoFiles: { 'package.json': JSON.stringify({ name: '@scope/hello', title: '你好' }) } }, (site) => {
      expect(fileIn(planAttach({ siteDir: site }), 'content/docs/index.mdx')).toMatch(/^# 你好$/m)
    })
    inSkeleton({}, (site) => {
      expect(fileIn(planAttach({ siteDir: site }), 'content/docs/index.mdx')).toMatch(/^# 我的仓$/m)
    })
  })

  it('模板里有认不出的占位符当场抛出，盘上一个字都没写', () => {
    inSkeleton({}, (site) => {
      const template = templateDir({ 'a.txt.tpl': '{{typo}}' })
      try {
        expect(() => planAttach({ siteDir: site, template })).toThrow(/认不出的占位符 \{\{typo\}\}（a\.txt\.tpl）/)
        expect(fs.existsSync(path.join(site, 'a.txt'))).toBe(false)
      } finally {
        fs.rmSync(template, { recursive: true, force: true, maxRetries: 5 })
      }
    })
  })

  it('不在、不是目录、不是 fumadocs 骨架、已经装过、content 下有内容：都在计算时拒绝', () => {
    inSkeleton({}, (site, repo) => {
      expect(() => planAttach({ siteDir: path.join(repo, '没有这个站') })).toThrow(/站不在/)
      fs.writeFileSync(path.join(repo, '文件'), '')
      expect(() => planAttach({ siteDir: path.join(repo, '文件') })).toThrow(/不是目录/)
      expect(() => planAttach({ siteDir: site }), '刚生成的骨架放行').not.toThrow()
    })

    inSkeleton({ siteFiles: { 'docfirst.config.mjs': 'export default {}' } }, (site) => {
      expect(() => planAttach({ siteDir: site })).toThrow(/这个站已有内容，请人工接线：.*已经有 docfirst\.config\.mjs/)
    })

    inSkeleton({ siteFiles: { 'content/docs/写过的页.mdx': '# 有人写过\n', 'content/trajectory/x.mdx': '' } }, (site) => {
      expect(() => planAttach({ siteDir: site })).toThrow(
        /这个站已有内容，请人工接线：content\/ 下有骨架之外的 docs\/写过的页\.mdx、trajectory/,
      )
    })

    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gwb-docfirst-workflow-attach-bare-'))
    try {
      const bare = path.join(root, '空目录')
      fs.mkdirSync(bare)
      expect(() => planAttach({ siteDir: bare })).toThrow(/不是 fumadocs 骨架：.*没有 package\.json/)
      fs.writeFileSync(path.join(bare, 'package.json'), JSON.stringify({ name: 'x', dependencies: { vite: '1' } }))
      expect(() => planAttach({ siteDir: bare })).toThrow(/不是 fumadocs 骨架：.*没有 fumadocs-core/)
    } finally {
      fs.rmSync(root, { recursive: true, force: true, maxRetries: 5 })
    }
  })
})

describe('attachSite：计算后写盘', () => {
  it('三个区各有集合、路由、侧栏根节点与骨架页，配置是新形状', () => {
    inSkeleton({ repoFiles: { 'package.json': JSON.stringify({ name: '@s/hello' }) } }, (site) => {
      const result = attachSite({ siteDir: site })
      expect(result.written).toContain('docfirst.config.mjs')
      expect(result.written.length).toBe(result.files.length)
      expect(fs.existsSync(path.join(site, 'docfirst.config.mjs.tpl'))).toBe(false)

      for (const zone of ZONES) {
        expect(fs.existsSync(path.join(site, 'content', zone, 'meta.json')), `content/${zone}/meta.json`).toBe(true)
        expect(fs.existsSync(path.join(site, 'src', 'app', zone, '[[...slug]]', 'page.tsx')), `src/app/${zone}/[[...slug]]/page.tsx`).toBe(true)
      }
      for (const page of PAGES) expect(fs.existsSync(path.join(site, 'content', page)), page).toBe(true)
      for (const gone of ['spec', 'feedback', 'outputs']) {
        expect(fs.existsSync(path.join(site, 'content', gone)), `content/${gone}`).toBe(false)
        expect(fs.existsSync(path.join(site, 'src', 'app', gone)), `src/app/${gone}`).toBe(false)
      }

      const sourceConfig = fs.readFileSync(path.join(site, 'source.config.ts'), 'utf8')
      expect([...sourceConfig.matchAll(/export const (\w+) = defineDocs\(\{\s*dir: 'content\/(\w+)'/g)].map((m) => [m[1], m[2]])).toEqual(
        ZONES.map((zone) => [zone, zone]),
      )
      expect((sourceConfig.match(/includeProcessedMarkdown/g) ?? []).length, '只有现状区开 processed markdown').toBe(1)
      expect(sourceConfig).toMatch(/schema: cardSchema/)

      const loaders = fs.readFileSync(path.join(site, 'src', 'lib', 'source.ts'), 'utf8')
      expect([...loaders.matchAll(/baseUrl: '([^']+)'/g)].map((m) => m[1])).toEqual(ZONES.map((zone) => `/${zone}`))

      const layout = fs.readFileSync(path.join(site, 'src', 'app', 'layout.tsx'), 'utf8')
      expect([...layout.matchAll(/zone\('([^']+)'/g)].map((m) => m[1])).toEqual(['现状', '轨迹', '未来'])
      expect(layout).toMatch(/root: true/)

      expect(result.superseded).toEqual(['src/app/docs/layout.tsx'])
      expect(fs.existsSync(path.join(site, 'src', 'app', 'docs', 'layout.tsx'))).toBe(false)

      const config = fs.readFileSync(path.join(site, 'docfirst.config.mjs'), 'utf8')
      const body = config.slice(config.indexOf('export default'))
      expect(body).toMatch(/content: 'content'/)
      for (const gone of ['docs', 'trajectory', 'comparator', 'ledger', 'fumadocs']) expect(body, `配置里还有 ${gone} 键`).not.toMatch(new RegExp(`^\\s*${gone}:`, 'm'))
      expect(body).toMatch(/'content\/docs\/outputs\/readme\.mdx': \['\.\.\/README\.md'\]/)
      expect(body).toMatch(/'content\/docs\/outputs\/agents\.mdx': \['\.\.\/AGENTS\.md'\]/)
      expect(body).toMatch(/'content\/docs\/outputs\/claude\.mdx': \['\.\.\/CLAUDE\.md'\]/)

      expect(() => attachSite({ siteDir: site }), '装过一次就拒绝第二次').toThrow(/这个站已有内容，请人工接线/)
    })
  })

  it('仓根一个字不动，会被 render 覆盖的只报出来', () => {
    inSkeleton({ repoFiles: { 'README.md': '# 老 README\n', 'CLAUDE.md': '老 CLAUDE\n' } }, (site, repo) => {
      const result = attachSite({ siteDir: site })
      expect(result.overwrites).toEqual(['README.md', 'CLAUDE.md'])
      expect(fs.readFileSync(path.join(repo, 'README.md'), 'utf8')).toBe('# 老 README\n')
      expect(fs.existsSync(path.join(repo, 'AGENTS.md')), '装配不写生成物，那是 render 的事').toBe(false)
    })
  })
})

describe('写盘安全', () => {
  it('任何扩展名的 docfirst 配置都算已经装过', () => {
    for (const name of ['docfirst.config.ts', 'docfirst.config.js', 'docfirst.config.json']) {
      inSkeleton({ siteFiles: { [name]: 'export default {}' } }, (site) => {
        expect(() => planAttach({ siteDir: site })).toThrow(new RegExp(`这个站已有内容，请人工接线：.*已经有 ${name.replace(/\./g, '\\.')}`))
      })
    }
  })

  it('计划里列出站上已经存在、会被覆盖的文件', () => {
    inSkeleton({}, (site) => {
      const plan = planAttach({ siteDir: site })
      for (const rel of ['content/docs/index.mdx', 'content/docs/meta.json', 'package.json']) expect(plan.replaced).toContain(rel)
      expect(plan.replaced).not.toContain('docfirst.config.mjs')
    })
  })

  it('要写的路径被目录或文件挡住：一次列出全部，一个文件都不写', () => {
    inSkeleton({ siteFiles: { 'src/lib/source.ts/占位': '', 'scripts': '一个普通文件' } }, (site) => {
      const message = errorOf(() => attachSite({ siteDir: site }))
      expect(message).toMatch(/^这些路径写不下去，一个文件都没写：/)
      expect(message).toContain('src/lib/source.ts（已经是目录）')
      expect(message).toContain('scripts（是文件，scripts/verify-roster.mjs 要把它当目录）')
      expect(fs.existsSync(path.join(site, 'docfirst.config.mjs'))).toBe(false)
      expect(fs.readFileSync(path.join(site, 'content', 'docs', 'index.mdx'), 'utf8')).toBe('---\ntitle: 骨架\n---\n')
      expect(fs.existsSync(path.join(site, 'src', 'app', 'docs', 'layout.tsx'))).toBe(true)
    })
  })

  it('写盘途中失败：已写的文件恢复、新建的文件与目录删掉、要删的文件还在', () => {
    const template = templateDir({ 'a.txt.tpl': 'a', 'b/c.txt.tpl': 'c', 'z.txt.tpl': 'z' })
    try {
      inSkeleton({ siteFiles: { 'z.txt': '原来的 z' } }, (site) => {
        const manifestBefore = fs.readFileSync(path.join(site, 'package.json'), 'utf8')
        const readonly = path.join(site, 'z.txt')
        fs.chmodSync(readonly, 0o444)
        try {
          expect(() => attachSite({ siteDir: site, template })).toThrow(/写盘途中失败，站已恢复原样/)
        } finally {
          fs.chmodSync(readonly, 0o644)
        }
        expect(fs.existsSync(path.join(site, 'a.txt'))).toBe(false)
        expect(fs.existsSync(path.join(site, 'b'))).toBe(false)
        expect(fs.readFileSync(readonly, 'utf8')).toBe('原来的 z')
        expect(fs.readFileSync(path.join(site, 'package.json'), 'utf8')).toBe(manifestBefore)
        expect(fs.existsSync(path.join(site, 'src', 'app', 'docs', 'layout.tsx'))).toBe(true)
      })
    } finally {
      fs.rmSync(template, { recursive: true, force: true, maxRetries: 5 })
    }
  })
})

it('装配写进站的依赖表是精确版本号，与工作区两个包的版本一致', () => {
  for (const [name, pin] of Object.entries(DOCFIRST_DEPS)) {
    const dir = DIR_OF[name]
    expect(dir, `装配表里的 ${name} 在 packages/ 下没有对应目录，新加依赖时把 DIR_OF 也补上`).toBeDefined()
    const pkg = JSON.parse(fs.readFileSync(path.join(PACKAGES, dir!, 'package.json'), 'utf8')) as { name: string; version: string }
    expect(pkg.name, `${String(dir)} 的包名与装配表里的 ${name} 不一致`).toBe(name)
    expect(pin, `装配表里 ${name} 写的是 ${pin}，工作区里是 ${pkg.version}：写精确号（不带 ^ / ~ / >=），发版时跟着改`).toBe(pkg.version)
  }
})
