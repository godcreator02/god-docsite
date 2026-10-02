import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  applyChanges,
  applyConventions,
  createSite,
  extendManifest,
  MANAGED_FILES,
  planSite,
  readTree,
  REMOVED_FILES,
  replaceOnce,
  type Scaffold,
  type SiteFile,
} from '../src/scaffold.js'

/**
 * 建站：本机约定改了官方输出的哪几处、传入的三个清单怎么检查、package.json 怎么合并、
 * 端口在哪儿查重、写入磁盘的前置条件。官方输出用 tests/fixtures 下存的那份（实际运行脚手架的对照在 scaffold.slow.test.ts）。
 */

const here = path.dirname(fileURLToPath(import.meta.url))
const FIXTURE = path.join(here, 'fixtures', 'create-fumadocs-app-16.2.12')

/** 不联网的脚手架：把样本复制过去 */
const fixtureScaffold: Scaffold = async (into) => {
  fs.cpSync(FIXTURE, into, { recursive: true })
}

const official = readTree(FIXTURE)
const text = (files: readonly SiteFile[], file: string): string => {
  const found = files.find((f) => f.path === file)
  if (found === undefined) throw new Error(`没有 ${file}`)
  return found.text
}

let tmp: string
beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gwb-docfirst-scaffold-'))
})
afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true })
})

describe('applyConventions：本机约定', () => {
  const done = applyConventions(official, { title: '示例站', port: 4321 })

  it('多出 pnpm-workspace.yaml，少了分享图路由与落地页，别的文件一份不多一份不少', () => {
    const expected = [...official.map((f) => f.path).filter((p) => !REMOVED_FILES.includes(p)), 'pnpm-workspace.yaml']
    expect(done.map((f) => f.path)).toEqual(expected.sort((a, b) => a.localeCompare(b)))
    expect(REMOVED_FILES.every((p) => official.some((f) => f.path === p))).toBe(true)
  })

  it('/ 跳到 /docs；docs 页面的元数据不再指向分享图', () => {
    expect(text(done, 'next.config.mjs')).toContain("redirects: async () => [{ source: '/', destination: '/docs', permanent: true }],")
    const page = text(done, 'src/app/docs/[[...slug]]/page.tsx')
    expect(page).not.toMatch(/openGraph|getPageImageUrl/)
  })

  it('改动只落在本机约定管的那几份上', () => {
    const changed = done.filter((f) => official.find((o) => o.path === f.path)?.text !== f.text).map((f) => f.path)
    expect(changed.sort()).toEqual([...MANAGED_FILES].sort())
  })

  it('.gitignore 保留官方的内容，另外排除 next dev 在站根生成的 AGENTS.md 与 CLAUDE.md', () => {
    const ignore = text(done, '.gitignore')
    expect(ignore.startsWith(text(official, '.gitignore'))).toBe(true)
    expect(ignore.split('\n')).toEqual(expect.arrayContaining(['/AGENTS.md', '/CLAUDE.md']))
  })

  it('md 路由的 Content-Type 带 charset=utf-8，浏览器才按 UTF-8 显示中文', () => {
    const route = text(done, 'src/app/llms.mdx/docs/[[...slug]]/route.ts')
    expect(route).toContain("'Content-Type': 'text/markdown; charset=utf-8',")
    expect(route).not.toContain("'Content-Type': 'text/markdown',")
  })

  it('pnpm-workspace.yaml 放行 esbuild', () => {
    expect(text(done, 'pnpm-workspace.yaml')).toMatch(/allowBuilds:\n {2}esbuild: true/)
  })

  it('dev / start 写上端口并只监听 127.0.0.1', () => {
    const scripts = (JSON.parse(text(done, 'package.json')) as { scripts: Record<string, string> }).scripts
    expect(scripts['dev']).toBe('next dev -p 4321 -H 127.0.0.1')
    expect(scripts['start']).toBe('next start -p 4321 -H 127.0.0.1')
  })

  it('不从 Google 加载字体、页面语言 zh-CN、字体是 Sarasa Mono SC', () => {
    const layout = text(done, 'src/app/layout.tsx')
    expect(layout).not.toContain('next/font/google')
    expect(layout).toContain('<html lang="zh-CN" suppressHydrationWarning>')
    expect(text(done, 'src/app/global.css')).toMatch(/--font-sans: 'Sarasa Mono SC'/)
  })

  it('站名写进 appName', () => {
    expect(text(done, 'src/lib/shared.ts')).toContain('export const appName = "示例站";')
  })

  it('站上没有指向 GitHub 的链接：gitConfig 与两处 githubUrl 都去掉了', () => {
    for (const file of done.filter((f) => f.path.startsWith('src/'))) {
      expect(file.text, file.path).not.toMatch(/gitConfig|githubUrl|github\.com/)
    }
  })

  it('官方输出里找不到要替换的原文就报错，说清是哪份文件', () => {
    const drifted = official.map((f) => (f.path === 'src/lib/shared.ts' ? { ...f, text: f.text.replace('My App', 'Other') } : f))
    expect(() => applyConventions(drifted, { title: 'x', port: 4310 })).toThrow(/src\/lib\/shared\.ts.*出现了 0 次/)
    const scripted = official.map((f) => (f.path === 'package.json' ? { ...f, text: f.text.replace('"next dev"', '"next dev --turbo"') } : f))
    expect(() => applyConventions(scripted, { title: 'x', port: 4310 })).toThrow(/dev 脚本/)
  })

  it('replaceOnce：出现多次也报错', () => {
    expect(() => replaceOnce('a a', 'a', 'b', 'f')).toThrow(/出现了 2 次/)
  })
})

describe('applyChanges：传入的三个清单', () => {
  const base = applyConventions(official, { title: 't', port: 4310 })

  it('增、换、删都照做', () => {
    const out = applyChanges(base, {
      addFiles: [{ path: 'src/app/extra/page.tsx', text: 'add' }],
      replaceFiles: [{ path: 'src/lib/source.ts', text: 'replaced' }],
      removeFiles: ['content/docs/test.mdx'],
    })
    expect(text(out, 'src/app/extra/page.tsx')).toBe('add')
    expect(text(out, 'src/lib/source.ts')).toBe('replaced')
    expect(out.map((f) => f.path)).not.toContain('content/docs/test.mdx')
  })

  it('有问题的一次列全，一个都不改', () => {
    const run = () =>
      applyChanges(base, {
        addFiles: [
          { path: 'src/lib/source.ts', text: '' },
          { path: 'a\\b.ts', text: '' },
          { path: '../up.ts', text: '' },
          { path: 'README.md/inner.md', text: '' },
        ],
        replaceFiles: [
          { path: 'nope.ts', text: '' },
          { path: 'src/app/layout.tsx', text: '' },
        ],
        removeFiles: ['src/lib/shared.ts', 'nope.ts'],
      })
    expect(run).toThrow(/src\/lib\/source\.ts：官方输出里已经有/)
    expect(run).toThrow(/a\\b\.ts：要相对站目录/)
    expect(run).toThrow(/\.\.\/up\.ts：路径里不能有/)
    expect(run).toThrow(/nope\.ts：官方输出里没有这份，没法替换/)
    expect(run).toThrow(/src\/app\/layout\.tsx：本机约定已经改过这份，不能再替换/)
    expect(run).toThrow(/src\/lib\/shared\.ts：本机约定已经改过这份，不能再删除/)
    expect(run).toThrow(/nope\.ts：在清单里出现了不止一次/)
  })

  it('新增的文件跟已有文件形成「既是文件又是目录」也报错', () => {
    expect(() => applyChanges(base, { addFiles: [{ path: 'README.md/inner.md', text: '' }] })).toThrow(/README\.md：既是文件/)
  })
})

describe('extendManifest：依赖与脚本合进 package.json', () => {
  const manifest = `${JSON.stringify({ name: 'x', description: '原来的', scripts: { dev: 'next dev' }, devDependencies: { typescript: '7' } }, null, 2)}\n`

  it('新依赖按名字排进原表，脚本追加，description 替换', () => {
    const merged = JSON.parse(
      extendManifest(manifest, { description: '新的', devDependencies: { '@a/b': '1.0.0' }, scripts: { doc: 'docfirst check' } }),
    ) as Record<string, Record<string, string> | string>
    expect(merged['description']).toBe('新的')
    expect(Object.keys(merged['devDependencies'] as Record<string, string>)).toEqual(['@a/b', 'typescript'])
    expect(merged['scripts']).toEqual({ dev: 'next dev', doc: 'docfirst check' })
  })

  it('什么都不加时原样输出', () => {
    expect(extendManifest(manifest, {})).toBe(manifest)
  })

  it('键重名就报错并一次列全', () => {
    expect(() => extendManifest(manifest, { scripts: { dev: 'x' }, devDependencies: { typescript: '6' } })).toThrow(
      /devDependencies\.typescript、scripts\.dev/,
    )
  })
})

describe('planSite / createSite', () => {
  it('算出来的文件就是官方输出加本机约定，不写目标目录', async () => {
    fs.mkdirSync(path.join(tmp, 'repo'))
    const plan = await planSite({ dir: path.join(tmp, 'repo', 'docs-site') }, fixtureScaffold)
    expect(plan.files.map((f) => f.path)).toContain('pnpm-workspace.yaml')
    expect(plan.title).toBe('repo')
    expect(fs.existsSync(plan.target)).toBe(false)
  })

  it('站名与 docfirst.create 同一套规则：给了用给的，否则仓根 package.json 的 title → 包名去掉 scope → 仓目录名', async () => {
    const titleIn = async (repo: string, manifest: unknown, title?: string): Promise<string> => {
      fs.mkdirSync(path.join(tmp, repo))
      if (manifest !== undefined) fs.writeFileSync(path.join(tmp, repo, 'package.json'), JSON.stringify(manifest))
      return (await planSite({ dir: path.join(tmp, repo, 'docs-site'), ...(title === undefined ? {} : { title }) }, fixtureScaffold)).title
    }
    expect(await titleIn('a', { name: 'x' }, '手给的')).toBe('手给的')
    expect(await titleIn('b', { title: '我的仓', name: '@s/r' })).toBe('我的仓')
    expect(await titleIn('c', { name: '@scope/my-repo' })).toBe('my-repo')
    expect(await titleIn('d', { name: 'unscoped' })).toBe('d')
    expect(await titleIn('e', undefined)).toBe('e')
  })

  it('仓根 package.json 不是合法 JSON 就报错，不跑脚手架', async () => {
    fs.mkdirSync(path.join(tmp, 'repo'))
    fs.writeFileSync(path.join(tmp, 'repo', 'package.json'), '{ 坏的')
    const never: Scaffold = async () => {
      throw new Error('不该跑到这里')
    }
    await expect(planSite({ dir: path.join(tmp, 'repo', 'docs-site') }, never)).rejects.toThrow(/仓根的 package\.json 不是合法的 JSON/)
  })

  it('端口从没被占用的里选；给定的端口被占着也照用，只在 portTakenBy 里说一声', async () => {
    fs.mkdirSync(path.join(tmp, 'other', 'docs-site'), { recursive: true })
    fs.writeFileSync(path.join(tmp, 'other', 'docs-site', 'package.json'), JSON.stringify({ scripts: { dev: 'next dev -p 4310' } }))
    fs.mkdirSync(path.join(tmp, 'mine'))
    expect((await planSite({ dir: path.join(tmp, 'mine', 'docs-site') }, fixtureScaffold)).port).toBe(4311)
    const forced = await planSite({ dir: path.join(tmp, 'mine', 'docs-site'), port: 4310 }, fixtureScaffold)
    expect(forced.portTakenBy).toBe(path.join(tmp, 'other', 'docs-site'))
  })

  it('站在容器根里就在整个容器根查端口；没给容器根或站不在它里面，只查站目录的祖父目录', async () => {
    fs.mkdirSync(path.join(tmp, 'unit-a', 'repo', 'docs-site'), { recursive: true })
    fs.writeFileSync(path.join(tmp, 'unit-a', 'repo', 'docs-site', 'package.json'), JSON.stringify({ scripts: { dev: 'next dev -p 4310' } }))
    fs.mkdirSync(path.join(tmp, 'unit-b', 'repo'), { recursive: true })
    const dir = path.join(tmp, 'unit-b', 'repo', 'docs-site')

    const wide = await planSite({ dir, unitsRoot: tmp }, fixtureScaffold)
    expect(wide.portScan).toEqual({ root: tmp, coversUnitsRoot: true, incomplete: [] })
    expect(wide.port).toBe(4311)

    const narrow = await planSite({ dir }, fixtureScaffold)
    expect(narrow.portScan).toEqual({ root: path.join(tmp, 'unit-b'), coversUnitsRoot: false, incomplete: [] })
    expect(narrow.port).toBe(4310)

    const outside = await planSite({ dir, unitsRoot: path.join(tmp, 'unit-a') }, fixtureScaffold)
    expect(outside.portScan.coversUnitsRoot).toBe(false)
    expect(outside.portScan.root).toBe(path.join(tmp, 'unit-b'))
  })

  it('容器根里别的单元用 vite --port 占着的端口也跳过（2026-10-02 在 lceda-test 撞过 4330）', async () => {
    const vite = (port: number): string => JSON.stringify({ scripts: { dev: `vite --port ${String(port)} --host 127.0.0.1` } })
    fs.mkdirSync(path.join(tmp, 'unit-a', 'repo', 'docs-site'), { recursive: true })
    fs.writeFileSync(path.join(tmp, 'unit-a', 'repo', 'docs-site', 'package.json'), JSON.stringify({ scripts: { dev: 'next dev -p 4310' } }))
    fs.mkdirSync(path.join(tmp, 'unit-b', 'hybrid-mmc', 'collab', 'site'), { recursive: true })
    fs.writeFileSync(path.join(tmp, 'unit-b', 'hybrid-mmc', 'collab', 'site', 'package.json'), vite(4311))
    fs.mkdirSync(path.join(tmp, 'unit-b', 'chb-dab-sst', 'collab', 'site'), { recursive: true })
    fs.writeFileSync(path.join(tmp, 'unit-b', 'chb-dab-sst', 'collab', 'site', 'package.json'), vite(4312))
    fs.mkdirSync(path.join(tmp, 'unit-c', 'repo'), { recursive: true })
    const plan = await planSite({ dir: path.join(tmp, 'unit-c', 'repo', 'docs-site'), unitsRoot: tmp }, fixtureScaffold)
    expect(plan.port).toBe(4313)
  })

  it('查重时没读成的 package.json 进 portScan.incomplete，照常建站', async () => {
    fs.mkdirSync(path.join(tmp, 'broken'))
    fs.writeFileSync(path.join(tmp, 'broken', 'package.json'), '{ nope')
    fs.mkdirSync(path.join(tmp, 'repo'))
    const plan = await planSite({ dir: path.join(tmp, 'repo', 'docs-site') }, fixtureScaffold)
    expect(plan.portScan.incomplete.map((p) => p.path)).toEqual([path.join(tmp, 'broken', 'package.json')])
    expect(plan.port).toBe(4310)
  })

  it('目标不合规就抛，不跑脚手架：相对路径、已经存在、上一级不存在', async () => {
    const never: Scaffold = async () => {
      throw new Error('不该跑到这里')
    }
    await expect(planSite({ dir: 'docs-site' }, never)).rejects.toThrow(/绝对路径/)
    fs.mkdirSync(path.join(tmp, 'repo', 'docs-site'), { recursive: true })
    await expect(planSite({ dir: path.join(tmp, 'repo', 'docs-site') }, never)).rejects.toThrow(/已经存在/)
    await expect(planSite({ dir: path.join(tmp, 'nope', 'docs-site') }, never)).rejects.toThrow(/上一级目录不存在/)
  })

  it('脚手架失败时报它的错，临时目录删掉、目标目录不建', async () => {
    fs.mkdirSync(path.join(tmp, 'repo'))
    const failing: Scaffold = async () => {
      throw new Error('没联网')
    }
    await expect(createSite({ dir: path.join(tmp, 'repo', 'docs-site') }, failing)).rejects.toThrow(/没联网/)
    expect(fs.existsSync(path.join(tmp, 'repo', 'docs-site'))).toBe(false)
  })

  it('写出来的文件对得上计划', async () => {
    fs.mkdirSync(path.join(tmp, 'repo'))
    const result = await createSite({ dir: path.join(tmp, 'repo', 'docs-site'), title: '仓的站', port: 4321 }, fixtureScaffold)
    expect(result.written).toEqual(result.files.map((f) => f.path))
    for (const file of result.files) expect(fs.readFileSync(path.join(result.target, file.path), 'utf8'), file.path).toBe(file.text)
  })

  it('清单检查不过时目标目录不会被建出来', async () => {
    fs.mkdirSync(path.join(tmp, 'repo'))
    await expect(createSite({ dir: path.join(tmp, 'repo', 'docs-site'), removeFiles: ['nope.ts'] }, fixtureScaffold)).rejects.toThrow(/nope\.ts/)
    expect(fs.existsSync(path.join(tmp, 'repo', 'docs-site'))).toBe(false)
  })

  // Windows 的文件名里不能有 `<`，写到这个文件时失败；别的系统上它是合法文件名，造不出失败
  it.runIf(process.platform === 'win32')('写盘途中失败就删掉新建的目标目录', async () => {
    fs.mkdirSync(path.join(tmp, 'repo'))
    await expect(
      createSite({ dir: path.join(tmp, 'repo', 'docs-site'), addFiles: [{ path: 'content/bad<name>.mdx', text: 'x' }] }, fixtureScaffold),
    ).rejects.toThrow(/已删掉新建的/)
    expect(fs.existsSync(path.join(tmp, 'repo', 'docs-site'))).toBe(false)
  })
})
