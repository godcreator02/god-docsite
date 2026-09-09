import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { hasLivedocConfig, isSiteDir, parseSiteListing, pickSiteInUnit } from '../src/site-lookup.js'

/**
 * 「有哪些站」这一层：站件回执的收敛与挑站规则。喂的是一份 JSON，不起进程、不装工作台
 * ——判据是「能不能只喂输入看输出」。
 */

const site = (dir: string, unit: string): { dir: string; unit: string } => ({ dir, unit })

describe('parseSiteListing', () => {
  it('认得出站件回执里那两个字段，别的字段一概不管', () => {
    const listing = parseSiteListing({
      root: 'D:\\unitfolders',
      currentUnit: '26090315xby',
      sites: [{ dir: 'D:\\u\\a\\docs-site', unit: '26090315xby', label: 'a', buildState: 'fresh' }],
    })
    expect(listing).toEqual({ currentUnit: '26090315xby', sites: [site('D:\\u\\a\\docs-site', '26090315xby')] })
  })

  it('没选中单元时 currentUnit 是 null，不是错', () => {
    expect(parseSiteListing({ currentUnit: null, sites: [] })).toEqual({ currentUnit: null, sites: [] })
  })

  it('形状对不上一律 undefined——半份清单会让人在错误的仓里跑 confirm', () => {
    expect(parseSiteListing(undefined)).toBeUndefined()
    expect(parseSiteListing({ sites: 'nope' })).toBeUndefined()
    expect(parseSiteListing({ sites: [{ dir: 1, unit: 'u' }] })).toBeUndefined()
    expect(parseSiteListing({ sites: [{ dir: 'd' }] })).toBeUndefined()
  })
})

describe('pickSiteInUnit', () => {
  const sites = [site('D:\\u\\a\\docs-site', 'a'), site('D:\\u\\b\\docs-site', 'b'), site('D:\\u\\b\\other-site', 'b')]

  it('单元里唯一那个叫 docs-site 的优先', () => {
    expect(pickSiteInUnit(sites, 'b').dir).toBe('D:\\u\\b\\docs-site')
  })

  it('单元里只有一个站、名字不叫 docs-site 也算数', () => {
    expect(pickSiteInUnit([site('D:\\u\\c\\www', 'c')], 'c').dir).toBe('D:\\u\\c\\www')
  })

  it('挑不出就交候选、不猜——调用方去报「给 cwd」', () => {
    const picked = pickSiteInUnit([site('D:\\u\\d\\one', 'd'), site('D:\\u\\d\\two', 'd')], 'd')
    expect(picked.dir).toBeUndefined()
    expect(picked.candidates).toEqual(['D:\\u\\d\\one', 'D:\\u\\d\\two'])
  })

  it('单元里一个站都没有：候选是空表', () => {
    expect(pickSiteInUnit(sites, 'zzz')).toEqual({ candidates: [] })
  })
})

describe('盘上那两条事实', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'livedoc-lookup-'))

  it('hasLivedocConfig 只认站根那一个文件', () => {
    expect(hasLivedocConfig(tmp)).toBe(false)
    fs.writeFileSync(path.join(tmp, 'livedoc.config.mjs'), 'export default {}')
    expect(hasLivedocConfig(tmp)).toBe(true)
  })

  it('isSiteDir 要求有 content 目录——挡住把反馈落进一个随手给的目录', () => {
    expect(isSiteDir(tmp)).toBe(false)
    fs.mkdirSync(path.join(tmp, 'content'))
    expect(isSiteDir(tmp)).toBe(true)
  })

  it('目录根本不在也只回 false，不抛', () => {
    expect(hasLivedocConfig(path.join(tmp, 'nope'))).toBe(false)
    expect(isSiteDir(path.join(tmp, 'nope'))).toBe(false)
  })
})
