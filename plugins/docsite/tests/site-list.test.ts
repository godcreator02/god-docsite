import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { addedByCommand } from '../src/hosted-sites.js'
import { canUnhost, kindOf, siteNameOf, sourceOf, type SiteRow } from '../src/pane/browser/sites.js'
import { siteDescriptionOf, siteListingsOf, siteTitleOf } from '../src/site-list.js'
import type { SiteStatus } from '../src/site-host.js'
import { longTempDir } from './site-fixtures.js'

const docsDir = path.resolve('/repo/docs-site')
const collabDir = path.resolve('/projects/demo/collab/site')
const trialDir = path.resolve('/tmp/trial-site')

const stopped = (dir: string): SiteStatus => ({ dir, state: 'stopped', url: null, error: null })

describe('docsite.site.list 的每一行', () => {
  it('常驻的站按登记先后在前、带谁登记的；只被启动过的没登记的站在后，hosted 为 false', () => {
    const running: SiteStatus = { dir: trialDir, state: 'running', url: 'http://127.0.0.1:4000/', error: null }
    const rows = siteListingsOf(
      [
        { dir: docsDir, by: addedByCommand },
        { dir: collabDir, by: 'gwb-collab' },
      ],
      [stopped(collabDir.toUpperCase()), running],
      stopped,
      (dir) => (dir === docsDir ? { title: '文档站', kind: 'docs' } : { title: null, kind: dir === trialDir ? null : 'collab' }),
    )
    expect(rows).toEqual([
      { ...stopped(docsDir), title: '文档站', kind: 'docs', hosted: true, by: addedByCommand },
      { ...stopped(collabDir), title: null, kind: 'collab', hosted: true, by: 'gwb-collab' },
      { ...running, title: null, kind: null, hosted: false, by: null },
    ])
  })
})

describe('站名与类别', () => {
  let siteDir = ''
  afterEach(() => rmSync(siteDir, { recursive: true, force: true }))

  it('类别取自站点根 docsite.json 的 kind：没有这个文件为 null，写坏了报错', () => {
    siteDir = longTempDir('site-kind-')
    expect(siteDescriptionOf(siteDir)).toEqual({ title: null, kind: null })
    writeFileSync(path.join(siteDir, 'docsite.json'), '{"kind":"collab","format":1}')
    expect(siteDescriptionOf(siteDir)).toEqual({ title: null, kind: 'collab' })
    writeFileSync(path.join(siteDir, 'docsite.json'), '{"kind":"collab","format":2}')
    expect(() => siteDescriptionOf(siteDir)).toThrow('只认第 1 代布局')
  })
})

describe('站名取自 content/meta.json 的 title', () => {
  let siteDir = ''
  afterEach(() => rmSync(siteDir, { recursive: true, force: true }))

  it('有 title 回它；文件不在或没写 title 回 null；不是合法 JSON 就报错', () => {
    siteDir = longTempDir('site-title-')
    expect(siteTitleOf(siteDir)).toBeNull()
    mkdirSync(path.join(siteDir, 'content'))
    writeFileSync(path.join(siteDir, 'content', 'meta.json'), '{"pages":[]}')
    expect(siteTitleOf(siteDir)).toBeNull()
    writeFileSync(path.join(siteDir, 'content', 'meta.json'), '{"title":"协作站测试"}')
    expect(siteTitleOf(siteDir)).toBe('协作站测试')
    writeFileSync(path.join(siteDir, 'content', 'meta.json'), '{"title":')
    expect(() => siteTitleOf(siteDir)).toThrow('不是合法 JSON')
  })
})

describe('站点窗格的一行', () => {
  const row = (fields: Partial<SiteRow>): SiteRow => ({ dir: collabDir, state: 'stopped', url: null, error: null, title: null, kind: 'collab', hosted: true, by: addedByCommand, ...fields })

  it('类别：协作站、文档站、基础站；没有身份文件写「未标注」', () => {
    expect(kindOf(row({})).label).toBe('协作站')
    expect(kindOf(row({ kind: 'docs' })).label).toBe('文档站')
    expect(kindOf(row({ kind: 'base' })).label).toBe('基础站')
    expect(kindOf(row({ kind: null })).label).toBe('未标注')
  })

  it('只有手动登记的站能在窗格里不再托管；插件登记的与临时的不能', () => {
    expect(canUnhost(row({}))).toBe(true)
    expect(canUnhost(row({ by: 'gwb-collab' }))).toBe(false)
    expect(canUnhost(row({ hosted: false, by: null }))).toBe(false)
  })

  it('来源：手动、插件名、临时', () => {
    expect(sourceOf(row({})).label).toBe('手动')
    expect(sourceOf(row({ by: 'gwb-collab' })).label).toBe('gwb-collab')
    expect(sourceOf(row({ hosted: false, by: null })).label).toBe('临时')
  })

  it('没有站名用目录名，协作站的 site 带上上一级', () => {
    expect(siteNameOf(row({ title: '协作站测试' }))).toBe('协作站测试')
    expect(siteNameOf(row({}))).toBe('collab/site')
    expect(siteNameOf(row({ dir: docsDir }))).toBe('docs-site')
  })
})
