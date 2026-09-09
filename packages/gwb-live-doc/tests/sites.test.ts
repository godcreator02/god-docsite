import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  buildState,
  findSitesInUnit,
  hasLivedocConfig,
  hasNodeModules,
  isFumadocsSite,
  isInside,
  isRetiredUnit,
  pickDocsSite,
  readUnitPurpose,
  rootFromSetting,
  scanUnitsRoot,
  shouldSkipDir,
  siteLabel,
} from '../src/sites.js'

/**
 * 认站、起名、判 build 新鲜度、限深扫描——全是「喂一棵目录看输出」的纯逻辑，不起进程。
 * 目录用 os.tmpdir() 下现造的，每条用例一棵，跑完删。
 */

let tmp: string
beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gwb-live-doc-'))
})
afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true })
})

function put(rel: string, text = ''): string {
  const full = path.join(tmp, rel)
  fs.mkdirSync(path.dirname(full), { recursive: true })
  fs.writeFileSync(full, text)
  return full
}

function pkg(deps: Record<string, string> = {}, dev: Record<string, string> = {}): string {
  return JSON.stringify({ name: 'x', dependencies: deps, devDependencies: dev })
}

describe('isFumadocsSite：package.json 依赖里有 fumadocs 家任一包就是站', () => {
  it('dependencies 里有 fumadocs-core / fumadocs-mdx / fumadocs-ui 任一', () => {
    expect(isFumadocsSite(pkg({ 'fumadocs-core': '16.0.0' }))).toBe(true)
    expect(isFumadocsSite(pkg({ 'fumadocs-mdx': '15.0.0' }))).toBe(true)
    expect(isFumadocsSite(pkg({ 'fumadocs-ui': 'npm:@fumadocs/base-ui@16.15.1' }))).toBe(true)
  })

  it('devDependencies 里也算——站把它们放哪一档不由我们管', () => {
    expect(isFumadocsSite(pkg({}, { 'fumadocs-mdx': '15.0.0' }))).toBe(true)
  })

  it('泛 fumadocs 站：不要求任何 livedoc 包', () => {
    expect(isFumadocsSite(pkg({ 'fumadocs-core': '1', next: '16' }))).toBe(true)
  })

  it('只有 next 不算；名字只是前缀像也不算', () => {
    expect(isFumadocsSite(pkg({ next: '16' }))).toBe(false)
    expect(isFumadocsSite(pkg({ 'fumadocs-core-extra': '1' }))).toBe(false)
    expect(isFumadocsSite(pkg({ '@fumadocs/base-ui': '1' }))).toBe(false)
  })

  it('不是 JSON、不是对象、没有依赖段，都不是站', () => {
    expect(isFumadocsSite('{ not json')).toBe(false)
    expect(isFumadocsSite('"a string"')).toBe(false)
    expect(isFumadocsSite('null')).toBe(false)
    expect(isFumadocsSite('{}')).toBe(false)
  })
})

describe('siteLabel：目录叫 docs-site 就用上一级的名字', () => {
  it('docs-site → 上一级目录名', () => {
    expect(siteLabel(path.join('D:', 'u', 'gwb-live-doc', 'docs-site'))).toBe('gwb-live-doc')
  })
  it('不叫 docs-site 就用自己的名', () => {
    expect(siteLabel(path.join('D:', 'u', 'gwb-live-doc', 'website'))).toBe('website')
  })
  it('末尾斜杠不影响', () => {
    expect(siteLabel(path.join('D:', 'u', 'repo', 'docs-site') + path.sep)).toBe('repo')
  })
})

describe('shouldSkipDir：扫描时跳过的目录', () => {
  it('node_modules、.git、点开头、dist、out、.next 一律跳', () => {
    for (const name of ['node_modules', '.git', '.next', '.source', '.claude', 'dist', 'out']) {
      expect(shouldSkipDir(name), name).toBe(true)
    }
  })
  it('普通目录不跳', () => {
    for (const name of ['docs-site', 'src', 'packages', 'gwb-live-doc']) {
      expect(shouldSkipDir(name), name).toBe(false)
    }
  })
})

describe('findSitesInUnit：一个单元里限深三层找站', () => {
  it('三种深度都找得到：单元根、下一层、再下一层（<单元>/<仓>/docs-site 正是第三层）', () => {
    put('u1/package.json', pkg({ 'fumadocs-core': '1' }))
    put('u1/repo/package.json', pkg({ 'fumadocs-mdx': '1' }))
    put('u1/repo2/docs-site/package.json', pkg({ 'fumadocs-ui': '1' }))
    const found = findSitesInUnit(path.join(tmp, 'u1'), 'u1').map((s) => path.relative(tmp, s.dir))
    expect(found.sort()).toEqual(['u1', path.join('u1', 'repo'), path.join('u1', 'repo2', 'docs-site')].sort())
  })

  it('第四层不找——限深是硬的，不然每个单元几万个文件都要摸一遍', () => {
    put('u1/a/b/c/package.json', pkg({ 'fumadocs-core': '1' }))
    expect(findSitesInUnit(path.join(tmp, 'u1'), 'u1')).toEqual([])
  })

  it('node_modules、点目录、dist、out、.next 里的 package.json 不算', () => {
    put('u1/node_modules/fumadocs-core/package.json', pkg({ 'fumadocs-core': '1' }))
    put('u1/.git/package.json', pkg({ 'fumadocs-core': '1' }))
    put('u1/dist/package.json', pkg({ 'fumadocs-core': '1' }))
    put('u1/out/package.json', pkg({ 'fumadocs-core': '1' }))
    put('u1/.next/package.json', pkg({ 'fumadocs-core': '1' }))
    expect(findSitesInUnit(path.join(tmp, 'u1'), 'u1')).toEqual([])
  })

  it('不是站的 package.json 不算，坏 JSON 不炸', () => {
    put('u1/repo/package.json', pkg({ next: '16' }))
    put('u1/bad/package.json', '{ nope')
    expect(findSitesInUnit(path.join(tmp, 'u1'), 'u1')).toEqual([])
  })

  it('每条都带单元名与单元路径', () => {
    put('u1/repo/docs-site/package.json', pkg({ 'fumadocs-core': '1' }))
    const [site] = findSitesInUnit(path.join(tmp, 'u1'), 'u1')
    expect(site).toEqual({ dir: path.join(tmp, 'u1', 'repo', 'docs-site'), unit: 'u1', unitPath: path.join(tmp, 'u1') })
  })

  it('单元目录不存在回空表', () => {
    expect(findSitesInUnit(path.join(tmp, 'nope'), 'nope')).toEqual([])
  })
})

describe('scanUnitsRoot：根下一层一个单元，逐个扫', () => {
  it('根不存在：rootExists false、空表，不抛', () => {
    expect(scanUnitsRoot(path.join(tmp, 'nope'))).toEqual({ rootExists: false, sites: [], retired: [] })
  })

  it('两个单元各自的站都在，按单元名再按目录排', () => {
    put('zz/repo/docs-site/package.json', pkg({ 'fumadocs-core': '1' }))
    put('aa/docs-site/package.json', pkg({ 'fumadocs-core': '1' }))
    put('aa/other/package.json', pkg({ 'fumadocs-mdx': '1' }))
    put('README.md', '根下的文件不是单元')
    const got = scanUnitsRoot(tmp)
    expect(got.rootExists).toBe(true)
    expect(got.sites.map((s) => [s.unit, path.relative(tmp, s.dir)])).toEqual([
      ['aa', path.join('aa', 'docs-site')],
      ['aa', path.join('aa', 'other')],
      ['zz', path.join('zz', 'repo', 'docs-site')],
    ])
  })

  it('根下点开头的目录不当单元', () => {
    put('.hidden/docs-site/package.json', pkg({ 'fumadocs-core': '1' }))
    expect(scanUnitsRoot(tmp).sites).toEqual([])
  })

  it('出生证写了 retired: true 的单元整个不扫，名字进 retired', () => {
    put('live/unit.json', JSON.stringify({ kind: 'repo', purpose: '还在用' }))
    put('live/docs-site/package.json', pkg({ 'fumadocs-core': '1' }))
    put('dead/unit.json', JSON.stringify({ kind: 'repo', purpose: '退役了', retired: true }))
    put('dead/docs-site/package.json', pkg({ 'fumadocs-core': '1' }))
    const got = scanUnitsRoot(tmp)
    expect(got.retired).toEqual(['dead'])
    expect(got.sites.map((s) => s.unit)).toEqual(['live'])
  })
})

describe('出生证：purpose 与 retired', () => {
  it('retired 只认布尔的真——字符串 "true"、1 都不算，宁可多列一个站', () => {
    put('a/unit.json', JSON.stringify({ retired: true }))
    put('b/unit.json', JSON.stringify({ retired: 'true' }))
    put('c/unit.json', JSON.stringify({ retired: 1 }))
    put('d/unit.json', JSON.stringify({}))
    expect(isRetiredUnit(path.join(tmp, 'a'))).toBe(true)
    for (const unit of ['b', 'c', 'd']) expect(isRetiredUnit(path.join(tmp, unit)), unit).toBe(false)
  })

  it('没有出生证、出生证是坏 JSON：不退役、没有 purpose，不抛', () => {
    put('bad/unit.json', '{ nope')
    expect(isRetiredUnit(path.join(tmp, 'bad'))).toBe(false)
    expect(isRetiredUnit(path.join(tmp, 'nope'))).toBe(false)
    expect(readUnitPurpose(path.join(tmp, 'bad'))).toBeUndefined()
  })

  it('purpose 读得出来，空白当没有', () => {
    put('a/unit.json', JSON.stringify({ purpose: '干这个的' }))
    put('b/unit.json', JSON.stringify({ purpose: '   ' }))
    expect(readUnitPurpose(path.join(tmp, 'a'))).toBe('干这个的')
    expect(readUnitPurpose(path.join(tmp, 'b'))).toBeUndefined()
  })
})

describe('pickDocsSite：live-doc.cli 不给 cwd 时落在哪', () => {
  const site = (dir: string) => ({ dir, unit: 'u', unitPath: path.join(tmp, 'u') })

  it('名字正好叫 docs-site 的那个优先', () => {
    const picked = pickDocsSite([site(path.join(tmp, 'u', 'repo', 'website')), site(path.join(tmp, 'u', 'repo', 'docs-site'))])
    expect(picked).toBe(path.join(tmp, 'u', 'repo', 'docs-site'))
  })

  it('没有叫 docs-site 的，但整个单元只有一个站，就是它', () => {
    expect(pickDocsSite([site(path.join(tmp, 'u', 'repo', 'website'))])).toBe(path.join(tmp, 'u', 'repo', 'website'))
  })

  it('挑不出就回 undefined，不替人猜：没有站、两个 docs-site、两个不同名的站', () => {
    expect(pickDocsSite([])).toBeUndefined()
    expect(pickDocsSite([site(path.join(tmp, 'u', 'a', 'docs-site')), site(path.join(tmp, 'u', 'b', 'docs-site'))])).toBeUndefined()
    expect(pickDocsSite([site(path.join(tmp, 'u', 'a', 'site1')), site(path.join(tmp, 'u', 'b', 'site2'))])).toBeUndefined()
  })
})

describe('buildState：BUILD_ID 的 mtime 对源树的 mtime', () => {
  it('没有 .next/BUILD_ID 就是 missing——next dev 不写它，只有 build 成了才有', () => {
    put('site/package.json', pkg({ 'fumadocs-core': '1' }))
    put('site/content/docs/index.mdx', '# hi')
    expect(buildState(path.join(tmp, 'site'))).toBe('missing')
  })

  it('产物比所有源都新是 fresh', () => {
    put('site/package.json', pkg({ 'fumadocs-core': '1' }))
    put('site/content/docs/index.mdx', '# hi')
    put('site/src/app/page.tsx', 'x')
    const old = new Date(Date.now() - 60_000)
    for (const rel of ['site/package.json', 'site/content/docs/index.mdx', 'site/src/app/page.tsx']) {
      fs.utimesSync(path.join(tmp, rel), old, old)
    }
    put('site/.next/BUILD_ID', 'abc')
    expect(buildState(path.join(tmp, 'site'))).toBe('fresh')
  })

  it('content / src / public 或站根下任一文件比产物新就是 stale', () => {
    put('site/.next/BUILD_ID', 'abc')
    const old = new Date(Date.now() - 60_000)
    fs.utimesSync(path.join(tmp, 'site', '.next', 'BUILD_ID'), old, old)
    put('site/content/docs/index.mdx', '# newer')
    expect(buildState(path.join(tmp, 'site'))).toBe('stale')
  })

  it('.next / node_modules / .source 里的改动不算源——产物自己的 mtime 不能把自己判成 stale', () => {
    put('site/.next/BUILD_ID', 'abc')
    const old = new Date(Date.now() - 60_000)
    fs.utimesSync(path.join(tmp, 'site', '.next', 'BUILD_ID'), old, old)
    put('site/.next/server/app.js', 'newer')
    put('site/node_modules/x/index.js', 'newer')
    put('site/.source/index.ts', 'newer')
    expect(buildState(path.join(tmp, 'site'))).toBe('fresh')
  })
})

describe('两个记号', () => {
  it('hasLivedocConfig：站根有 livedoc.config.mjs 才亮', () => {
    put('site/package.json', pkg({ 'fumadocs-core': '1' }))
    expect(hasLivedocConfig(path.join(tmp, 'site'))).toBe(false)
    put('site/livedoc.config.mjs', 'export default {}')
    expect(hasLivedocConfig(path.join(tmp, 'site'))).toBe(true)
  })

  it('hasNodeModules：站目录下有 node_modules 目录才算装过', () => {
    put('site/package.json', pkg({ 'fumadocs-core': '1' }))
    expect(hasNodeModules(path.join(tmp, 'site'))).toBe(false)
    fs.mkdirSync(path.join(tmp, 'site', 'node_modules'))
    expect(hasNodeModules(path.join(tmp, 'site'))).toBe(true)
  })
})

describe('rootFromSetting：设置值 → 绝对根（照 unit-folder 的判法）', () => {
  it('不是字符串、空白，都是没配', () => {
    for (const raw of [undefined, null, 0, true, {}, [], '', '  ', '\t']) {
      expect(rootFromSetting(raw), JSON.stringify(raw)).toBeUndefined()
    }
  })
  it('首尾空白裁掉、相对路径绝对化', () => {
    expect(rootFromSetting('  units  ')).toBe(path.resolve('units'))
  })
})

describe('isInside：命令参数里的目录必须在容器根内', () => {
  it('根内（含根本身）为真，根外与「前缀像」为假', () => {
    const root = path.resolve(tmp, 'root')
    expect(isInside(root, path.join(root, 'a', 'docs-site'))).toBe(true)
    expect(isInside(root, root)).toBe(true)
    expect(isInside(root, path.resolve(tmp, 'elsewhere'))).toBe(false)
    expect(isInside(root, path.resolve(tmp, 'root-two', 'x'))).toBe(false)
    expect(isInside(root, path.join(root, '..', 'x'))).toBe(false)
  })
})
