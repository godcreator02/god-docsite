import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { attachSite, planAttach, DEFAULT_PORT, DOCFIRST_DEPS, type AttachPlan } from '../src/attach.js'
import { readTemplate, renderSite, renderText, ATTACH_TEMPLATE, type SiteValues } from '../src/template.js'

/**
 * 装六区那摊的账，全部跨它面上那两个方法测：
 *   `planAttach` 算一套不碰盘——骨架合不合规、名字怎么认、起手页那块钉什么、package.json
 *   怎么合、占位符错了抛不抛，全在它回的那份计划里看得见，一个内部函数都不用点名；
 *   `attachSite` 才落盘——装出来的六区长什么样、骨架里哪份让了位，在临时目录里跑真的。
 *
 * 加一条**跨两份真相的账**：装配往目标站补的那张依赖表跟工作区那两个包的版本对得上。
 * 那张表是手写的（工作区里写的是 `workspace:*`，摆进别人的站里装不动），那两个包发版抬版本号时
 * 忘了抬它，装出来的站会装到一个旧版——这条测试就是那个门。
 */

const HERE = path.dirname(fileURLToPath(import.meta.url))
const PACKAGES = path.resolve(HERE, '..', '..')

/** 包名 → 它在 packages/ 下的目录名。目录名跟包名去掉 scope 那一截同名 */
const DIR_OF: Record<string, string> = {
  '@godcreator/docfirst-workflow': 'docfirst-workflow',
  '@godcreator/docfirst-trajectory': 'docfirst-trajectory',
}

/** 渲模板用的一套值，占位符集合是封闭的五个 */
const VALUES: SiteValues = { title: '样例', pkg: '@s/样例', pkgName: '样例', port: '4317', pinBlock: '（钉块）' }

/** 站件铺出来的那份骨架 package.json，最小的一份 */
function skeletonManifest(port: number | null): string {
  const scripts: Record<string, string> = { build: 'next build' }
  if (port !== null) {
    scripts.dev = `next dev -p ${String(port)}`
    scripts.start = `next start -p ${String(port)}`
  }
  const manifest = { name: 'hello-docs-site', version: '0.1.0', private: true, type: 'module', scripts, dependencies: { 'fumadocs-core': '16.15.1', next: '16.3.0' } }
  return `${JSON.stringify(manifest, null, 2)}\n`
}

/**
 * 造一个「刚被站件铺好」的骨架：`<tmp>/<仓>/docs-site`，仓根可选地放几样东西。
 * 跑完把整片删掉。
 */
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

/** 造一份自带的小模板，用来验渲染本身——不必拿整套六区说事 */
function templateDir(files: Record<string, string>): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gwb-docfirst-workflow-tpl-'))
  for (const [rel, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true })
    fs.writeFileSync(path.join(root, rel), text, 'utf8')
  }
  return root
}

/** 计划里那一份文件的正文；不在就当场报出来（比在 undefined 上匹配好读） */
function fileIn(plan: AttachPlan, rel: string): string {
  const found = plan.files.find((file) => file.rel === rel)
  expect(found, `计划里没有 ${rel}：${plan.files.map((f) => f.rel).join('、')}`).toBeDefined()
  return found!.text
}

describe('模板本身', () => {
  it('件里那份模板读得出来，源码态与产物态是同一个相对位置', () => {
    expect(fs.existsSync(path.join(ATTACH_TEMPLATE, 'docfirst.config.mjs.tpl'))).toBe(true)
    expect(readTemplate().length).toBeGreaterThan(20)
  })

  it('落盘时脱掉 .tpl 后缀——带着它躺在包里，才不会被别的工具当成真配置去解析', () => {
    const files = readTemplate()
    expect(files.every((f) => f.rel.endsWith('.tpl'))).toBe(true)
    expect(renderSite(files, VALUES).every((f) => !f.rel.endsWith('.tpl'))).toBe(true)
  })

  it('整套渲完不留占位符——模板里多一个认不出的 {{typo}} 就当场抛', () => {
    for (const file of renderSite(readTemplate(), VALUES)) expect(file.text, file.rel).not.toMatch(/\{\{\w+\}\}/)
    expect(() => renderText('{{typo}}', VALUES, 'x')).toThrow(/认不出的占位符/)
  })

  it('骨架那半一份都不在装配模板里——package.json、tsconfig、postcss 那几份归站件', () => {
    for (const rel of ['package.json.tpl', 'tsconfig.json.tpl', 'postcss.config.mjs.tpl', 'pnpm-workspace.yaml.tpl', '.npmrc.tpl']) {
      expect(fs.existsSync(path.join(ATTACH_TEMPLATE, rel)), `装配模板里还留着骨架那半的 ${rel}`).toBe(false)
    }
  })

  it('反馈区只有孵化一页——跨仓反馈集中投总控台，不再往各仓的站里投', () => {
    const rels = readTemplate().map((f) => f.rel)
    expect(rels).toContain('content/feedback/hatch.mdx.tpl')
    expect(rels).not.toContain('content/feedback/inbound.mdx.tpl')
  })
})

describe('planAttach：算一套不碰盘', () => {
  it('一个字都不写盘，整套六区在回的那份计划里', () => {
    inSkeleton({}, (site) => {
      const plan = planAttach({ siteDir: site })
      expect(plan.target).toBe(site)
      expect(fs.existsSync(path.join(site, 'docfirst.config.mjs')), '算完盘上什么都没有').toBe(false)
      expect(plan.files.length, '件里带的那套模板一个文件都没读到').toBeGreaterThan(20)
      expect(plan.files.some((file) => file.rel.endsWith('.tpl')), '.tpl 后缀在计划里就已经脱掉了').toBe(false)
    })
  })

  it('端口从骨架的脚本里认，装配不改它；认不出退 next 的默认口', () => {
    inSkeleton({ port: 4317 }, (site) => {
      const plan = planAttach({ siteDir: site })
      expect(plan.port).toBe(4317)
      expect(fileIn(plan, 'content/outputs/readme.mdx')).toMatch(/localhost:4317/)
      const merged = JSON.parse(plan.manifest) as { scripts: Record<string, string> }
      expect(merged.scripts.dev, '骨架写的那几条脚本一个字不动').toBe('next dev -p 4317')
    })
    inSkeleton({ port: null }, (site) => {
      expect(planAttach({ siteDir: site }).port).toBe(DEFAULT_PORT)
    })
  })

  it('package.json 只加不减——补 doc 脚本与 docfirst 依赖，骨架写的一律留着', () => {
    inSkeleton({}, (site) => {
      const plan = planAttach({ siteDir: site })
      const merged = JSON.parse(plan.manifest) as {
        name: string
        scripts: Record<string, string>
        dependencies: Record<string, string>
        devDependencies: Record<string, string>
        description: string
      }
      expect(merged.name, '骨架挑的包名不动').toBe('hello-docs-site')
      expect(merged.dependencies['fumadocs-core'], '骨架装的依赖不动').toBe('16.15.1')
      expect(merged.scripts.build).toBe('next build')
      expect(merged.scripts.doc).toBe('docfirst check')
      expect(merged.scripts['doc:render']).toBe('docfirst render')
      expect(merged.scripts['verify:roster']).toBe('node scripts/verify-roster.mjs')
      for (const [name, range] of Object.entries(DOCFIRST_DEPS)) expect(merged.devDependencies[name]).toBe(range)
      expect(merged.description).toMatch(/我的仓 的六区文档站/)
      // 合并完的那份也在待写清单里——落盘只走一条路
      expect(fileIn(plan, 'package.json')).toBe(plan.manifest)
    })
  })

  it('名字从仓根 package.json 认，认不出退仓的目录名，title 优先', () => {
    inSkeleton({ repoFiles: { 'package.json': JSON.stringify({ name: '@scope/hello' }) } }, (site) => {
      expect(fileIn(planAttach({ siteDir: site }), 'content/docs/index.mdx')).toMatch(/`hello` 是什么/)
      expect(fileIn(planAttach({ siteDir: site, title: '打个招呼' }), 'content/docs/index.mdx')).toMatch(/^# 打个招呼$/m)
    })
    inSkeleton({}, (site) => {
      expect(fileIn(planAttach({ siteDir: site }), 'content/docs/index.mdx'), '仓根没有 package.json，退目录名').toMatch(/^# 我的仓$/m)
    })
  })

  it('起手页的第一条引用现找——有 export const name 就钉那一行，没有就写「怎么钉」', () => {
    inSkeleton({ repoFiles: { 'src/index.ts': ['// 头', '', "export const name = 'x';", ''].join('\n') } }, (site) => {
      expect(fileIn(planAttach({ siteDir: site }), 'content/docs/index.mdx'), '行号是数出来的，不写死').toMatch(
        /@@docfirst ref \.\.\/src\/index\.ts:3-3 @@/,
      )
    })
    inSkeleton({ repoFiles: { 'src/index.ts': 'export function name() {}\n' } }, (site) => {
      const none = fileIn(planAttach({ siteDir: site }), 'content/docs/index.mdx')
      expect(none).toMatch(/还没钉第一条引用/)
      // 样例记号在围栏里：围栏内容是 code 节点，check 认不出它——硬塞一条钉不住的引用
      // 等于让刚接好线的站开局就报红
      expect(none).toMatch(/```text\n@@docfirst ref/)
    })
  })

  it('模板里有认不出的占位符当场抛，盘上一个字都还没写', () => {
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

  /**
   * 装配唯一的那道门。四条拒的理由各说各的——「这个站已有内容」那两条是约定本身：
   * 只在刚铺好的骨架上跑，跑了半年的站人工接线。
   */
  it('不在 / 不是目录 / 不是 fumadocs 骨架 / 已经接过线 / content 下有内容，五种都在算的那一半就抛', () => {
    inSkeleton({}, (site, repo) => {
      expect(() => planAttach({ siteDir: path.join(repo, '没有这个站') })).toThrow(/站不在/)
      fs.writeFileSync(path.join(repo, '文件'), '')
      expect(() => planAttach({ siteDir: path.join(repo, '文件') })).toThrow(/不是目录/)
      expect(() => planAttach({ siteDir: site }), '刚铺好的骨架放行').not.toThrow()
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

describe('attachSite：算完直接落', () => {
  it('整套落盘——六区各有集合、路由、骨架页，配置预置两区进 check', () => {
    inSkeleton(
      { repoFiles: { 'package.json': JSON.stringify({ name: '@s/hello' }), 'src/index.ts': "// 头\nexport const name = 'hello';\n" } },
      (site) => {
        const result = attachSite({ siteDir: site })
        expect(result.written, '写了哪些文件逐条报出来').toContain('docfirst.config.mjs')
        expect(result.written.length).toBe(result.files.length)
        expect(fs.existsSync(path.join(site, 'docfirst.config.mjs.tpl')), '.tpl 后缀落盘时脱掉').toBe(false)
        expect(fs.readFileSync(path.join(site, 'content', 'docs', 'index.mdx'), 'utf8')).toMatch(/@@docfirst ref \.\.\/src\/index\.ts:2-2 @@/)

        // 六区：六个目录各有骨架页与 meta.json，六个集合、六条路由、侧栏六个根节
        const zones = ['docs', 'trajectory', 'spec', 'future', 'outputs', 'feedback']
        for (const zone of zones) {
          expect(fs.existsSync(path.join(site, 'content', zone, 'meta.json')), `content/${zone}/meta.json`).toBe(true)
          expect(fs.existsSync(path.join(site, 'src', 'app', zone, '[[...slug]]', 'page.tsx')), `src/app/${zone}/[[...slug]]/page.tsx`).toBe(true)
        }
        const pages = [
          'docs/index.mdx', 'docs/system-map.mdx', 'docs/glossary.mdx', 'trajectory/index.mdx', 'spec/index.mdx',
          'future/overview.mdx', 'outputs/agents.mdx', 'outputs/readme.mdx', 'feedback/hatch.mdx',
        ]
        for (const page of pages) {
          expect(fs.readFileSync(path.join(site, 'content', page), 'utf8'), `${page} 头一句要是「本页回答」`).toMatch(/\*\*本页回答\*\*：/)
        }
        const sourceConfig = fs.readFileSync(path.join(site, 'source.config.ts'), 'utf8')
        for (const zone of zones) {
          expect(sourceConfig, `集合 ${zone}`).toMatch(new RegExp(`export const ${zone} = defineDocs\\(\\{\\s*dir: 'content/${zone}'`))
        }
        expect((sourceConfig.match(/includeProcessedMarkdown/g) ?? []).length, '只有 docs 与 outputs 开 processed markdown').toBe(2)
        expect(sourceConfig, '卡集合用 cardSchema').toMatch(/schema: cardSchema/)
        const loaders = fs.readFileSync(path.join(site, 'src', 'lib', 'source.ts'), 'utf8')
        for (const base of ['/docs', '/trajectory', '/spec', '/future', '/outputs', '/feedback']) expect(loaders).toMatch(new RegExp(`baseUrl: '${base}'`))
        const layout = fs.readFileSync(path.join(site, 'src', 'app', 'layout.tsx'), 'utf8')
        expect((layout.match(/zone\('/g) ?? []).length, '侧栏一棵树六个根节').toBe(6)
        expect(layout).toMatch(/root: true/)
        // 骨架那份 DocsLayout 让位：留着就是两层 DocsLayout 套着渲，侧栏出现两遍
        expect(result.superseded).toEqual(['src/app/docs/layout.tsx'])
        expect(fs.existsSync(path.join(site, 'src', 'app', 'docs', 'layout.tsx'))).toBe(false)
        const config = fs.readFileSync(path.join(site, 'docfirst.config.mjs'), 'utf8')
        expect(config, 'check 扫 docs + outputs 两区').toMatch(/docs: \['content\/docs', 'content\/outputs'\]/)
        expect(config).toMatch(/trajectory: 'content\/trajectory'/)
        expect(config).toMatch(/'content\/outputs\/agents\.mdx': \['\.\.\/AGENTS\.md'\]/)
        expect(config).toMatch(/'content\/outputs\/readme\.mdx': \['\.\.\/README\.md'\]/)
        expect(fs.readFileSync(path.join(site, 'content', 'spec', 'index.mdx'), 'utf8')).toMatch(/有页 = 有活在路上，做完删/)

        // 装过一次就拒第二次——这时站里已经有 docfirst.config.mjs
        expect(() => attachSite({ siteDir: site })).toThrow(/这个站已有内容，请人工接线/)
      },
    )
  })

  it('仓根一个字不动——会被 render 覆盖的只报出来', () => {
    inSkeleton({ repoFiles: { 'README.md': '# 老 README\n' } }, (site, repo) => {
      const result = attachSite({ siteDir: site })
      expect(result.overwrites, '仓根已有的生成物点名，没有的不点').toEqual(['README.md'])
      expect(fs.readFileSync(path.join(repo, 'README.md'), 'utf8'), '装配一个字不动它').toBe('# 老 README\n')
      expect(fs.existsSync(path.join(repo, 'AGENTS.md')), '装配不摆生成物，那是 render 的事').toBe(false)
    })
  })
})

it('装配那张依赖表跟工作区那两个包的版本对得上——它们发版抬了版本号忘了抬它，这条红', () => {
  for (const [name, range] of Object.entries(DOCFIRST_DEPS)) {
    const dir = DIR_OF[name]
    expect(dir, `装配表里的 ${name} 在 packages/ 下没有对应目录——新加一条依赖时把 DIR_OF 也补上`).toBeDefined()
    const pkg = JSON.parse(fs.readFileSync(path.join(PACKAGES, dir!, 'package.json'), 'utf8')) as { name: string; version: string }
    expect(pkg.name, `${String(dir)} 的包名对不上装配表里的 ${name}`).toBe(name)
    expect(range, `装配表里 ${name} 写的是 ${range}，工作区里是 ${pkg.version}——发版时这张表得跟着抬`).toBe(`^${pkg.version}`)
  }
})
