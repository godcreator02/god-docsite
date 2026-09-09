import fs from 'node:fs'
import path from 'node:path'

/**
 * 「有哪些站」这件事本件**不自己做**：扫容器根、认 fumadocs 站、判 build 新鲜度、起停，
 * 整套归站件（`@godcreator02/gwb-docs-site`，命令 `docs-site.list`）。这儿只有两样——
 * 把站件的回执收敛成本件要的那几个字段，加本件自己判得了的两条盘上事实。
 *
 * 站件不在的 home 里本件照常挂、照常干活：那时 `docs-site.list` 不在总线上，调用方要自己
 * 给站目录的绝对路径。**方便程度不同，能不能用不变。**
 *
 * 纯函数加 fs 读，不起进程、不碰 ctx，node 里直接跑得起测试（tests/site-lookup.test.ts）。
 */

/** 站件那条列站命令的名字。它不在总线上就是「没装站件」 */
export const DOCS_SITE_LIST = 'docs-site.list'

/** 从站件回执里取出来的一条站：站目录，加它属于哪个单元 */
export interface KnownSite {
  dir: string
  unit: string
}

/** 站件回执收敛完的样子：当前选中的单元（站件从 unit-folder 那儿拿的），加全部站 */
export interface SiteListing {
  currentUnit: string | null
  sites: KnownSite[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * 站件 `docs-site.list` 回执的 `data` → 本件要的两个字段。形状对不上回 undefined
 * ——**不部分容忍**：站件换了回执形状时，本件宁可回一句「挑不出，给 cwd」，
 * 也不要拿半份清单去猜一个仓，猜错的代价是在错误的仓里跑了一次 confirm。
 */
export function parseSiteListing(data: unknown): SiteListing | undefined {
  if (!isRecord(data) || !Array.isArray(data['sites'])) return undefined
  const sites: KnownSite[] = []
  for (const raw of data['sites']) {
    if (!isRecord(raw)) return undefined
    const dir = raw['dir']
    const unit = raw['unit']
    if (typeof dir !== 'string' || typeof unit !== 'string') return undefined
    sites.push({ dir, unit })
  }
  const current = data['currentUnit']
  return { currentUnit: typeof current === 'string' ? current : null, sites }
}

/**
 * 一个单元里挑「那个站」：`live-doc.cli` 不给 cwd 时落在这儿。
 * 名字正好叫 `docs-site` 的优先（仓的站按约定就叫这个），只有它唯一时才算数；
 * 不然整个单元只有一个站也算数。多于一个又挑不出，回 undefined——调用方去报「给 cwd」，
 * 别替人猜。
 */
export function pickSiteInUnit(sites: readonly KnownSite[], unit: string): { dir?: string; candidates: string[] } {
  const inUnit = sites.filter((s) => s.unit === unit)
  const named = inUnit.filter((s) => path.basename(s.dir) === 'docs-site')
  const candidates = inUnit.map((s) => s.dir)
  if (named.length === 1) return { dir: named[0]?.dir, candidates }
  if (named.length === 0 && inUnit.length === 1) return { dir: inUnit[0]?.dir, candidates }
  return { candidates }
}

/** 站根有 livedoc.config.mjs——接了 livedoc 的站。`live-doc.stale` 只对这种站有意义 */
export function hasLivedocConfig(siteDir: string): boolean {
  try {
    return fs.statSync(path.join(siteDir, 'livedoc.config.mjs')).isFile()
  } catch {
    return false
  }
}

/** 站得有 content 目录才往里写——挡住把反馈落进一个随手给的目录 */
export function isSiteDir(dir: string): boolean {
  try {
    return fs.statSync(path.join(dir, 'content')).isDirectory()
  } catch {
    return false
  }
}
