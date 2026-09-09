import fs from 'node:fs'
import path from 'node:path'

/**
 * 认站、起名、判 build 新不新鲜、限深扫描——纯函数加 fs 读，不起进程、不碰 ctx，
 * node 里直接跑得起测试（tests/sites.test.ts）。认站与 build 三态自 vscode-docs-site 的
 * pure.ts 搬来；扫描那半是这儿新写的（那边靠 vscode 的 findFiles，这边自己走盘）。
 */

/** fumadocs 家的三个包名。依赖里有任一就是站——**泛 fumadocs 站，不只认 livedoc 站** */
export const FUMADOCS_PACKAGES: readonly string[] = ['fumadocs-core', 'fumadocs-mdx', 'fumadocs-ui']

/** 这份 package.json 是不是一个 fumadocs 站：dependencies 与 devDependencies 里有 fumadocs 家的包 */
export function isFumadocsSite(pkgJsonText: string): boolean {
  let pkg: unknown
  try {
    pkg = JSON.parse(pkgJsonText)
  } catch {
    return false
  }
  if (typeof pkg !== 'object' || pkg === null) return false
  const p = pkg as { dependencies?: Record<string, unknown>; devDependencies?: Record<string, unknown> }
  const names = [...Object.keys(p.dependencies ?? {}), ...Object.keys(p.devDependencies ?? {})]
  return names.some((n) => FUMADOCS_PACKAGES.includes(n))
}

/** 站叫什么：目录叫 docs-site 就用上一级目录名（仓名）；不叫 docs-site 就用它自己的名 */
export function siteLabel(siteDir: string): string {
  const base = path.basename(siteDir)
  if (base !== 'docs-site') return base
  const parent = path.basename(path.dirname(siteDir))
  return parent === '' ? base : parent
}

/** 每个单元往下找 package.json 最多几层：单元根算第一层，`<单元>/<仓>/docs-site` 正是第三层 */
export const SCAN_DEPTH = 3

const SCAN_SKIP = new Set(['node_modules', 'dist', 'out'])

/** 扫描时不进的目录：node_modules、dist、out，以及所有点开头的（.git / .next / .source / .claude …） */
export function shouldSkipDir(name: string): boolean {
  return name.startsWith('.') || SCAN_SKIP.has(name)
}

/** 扫出来的一条站：站目录、所属单元的目录名与路径 */
export interface FoundSite {
  dir: string
  unit: string
  unitPath: string
}

function readDir(dir: string): fs.Dirent[] {
  try {
    return fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return []
  }
}

/** 一个单元里限深找站。找到站之后它的子目录照样往下走（限深之内）——一个单元里两个站是可能的 */
export function findSitesInUnit(unitPath: string, unit: string, depth = SCAN_DEPTH): FoundSite[] {
  const out: FoundSite[] = []
  const walk = (dir: string, level: number): void => {
    const entries = readDir(dir)
    if (entries.some((e) => e.isFile() && e.name === 'package.json')) {
      let text: string | undefined
      try {
        text = fs.readFileSync(path.join(dir, 'package.json'), 'utf8')
      } catch {
        // 正在写、没权限：下次再看
      }
      if (text !== undefined && isFumadocsSite(text)) out.push({ dir, unit, unitPath })
    }
    if (level >= depth) return
    for (const e of entries) {
      if (e.isDirectory() && !shouldSkipDir(e.name)) walk(path.join(dir, e.name), level + 1)
    }
  }
  walk(unitPath, 1)
  return out.sort((a, b) => a.dir.localeCompare(b.dir))
}

/** 一次扫描的结果：站，加被出生证挡下的退役单元 */
export interface ScanResult {
  rootExists: boolean
  sites: FoundSite[]
  /** `unit.json` 里 `retired: true` 的单元目录名，整个没扫 */
  retired: string[]
}

/**
 * 根下一层一个单元（点开头的不算），逐个限深扫。根不存在回 rootExists: false，不抛。
 *
 * **出生证写了 `retired: true` 的单元整个跳过**：退役单元里的站还在盘上、还起得来，但它
 * 讲的是已经作废的东西，列在清单里只会被人和 agent 当成现状去读。跳了几个进 `retired`，
 * 回执里说得出总数——静默少几条站比多几条更难查。
 */
export function scanUnitsRoot(root: string): ScanResult {
  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(root, { withFileTypes: true })
  } catch {
    return { rootExists: false, sites: [], retired: [] }
  }
  const units = entries
    .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
    .map((e) => e.name)
    .sort((a, b) => a.localeCompare(b))
  const retired: string[] = []
  const sites: FoundSite[] = []
  for (const unit of units) {
    const unitPath = path.join(root, unit)
    if (isRetiredUnit(unitPath)) {
      retired.push(unit)
      continue
    }
    sites.push(...findSitesInUnit(unitPath, unit))
  }
  return { rootExists: true, sites, retired }
}

/** 出生证 `unit.json` 读出来的那个对象；读不动、不是 JSON、不是对象都回 undefined */
function readUnitJson(unitPath: string): Record<string, unknown> | undefined {
  try {
    const raw: unknown = JSON.parse(fs.readFileSync(path.join(unitPath, 'unit.json'), 'utf8'))
    return typeof raw === 'object' && raw !== null && !Array.isArray(raw) ? (raw as Record<string, unknown>) : undefined
  } catch {
    return undefined
  }
}

/** 单元出生证里的 purpose——给界面分组头用。读不出就没有，不是错 */
export function readUnitPurpose(unitPath: string): string | undefined {
  const purpose = readUnitJson(unitPath)?.['purpose']
  return typeof purpose === 'string' && purpose.trim() !== '' ? purpose : undefined
}

/**
 * 这个单元退役了没有：出生证里 `retired: true`。**只认布尔的真**——写成 `"true"`、`1`
 * 的一律不算退役，宁可多列一个站，也不要因为一个字符串把一个还在用的单元藏起来。
 */
export function isRetiredUnit(unitPath: string): boolean {
  return readUnitJson(unitPath)?.['retired'] === true
}

/**
 * 一个单元里挑「那个站」：`live-doc.cli` 不给 cwd 时落在这儿。
 * 名字正好叫 `docs-site` 的优先（仓的站按约定就叫这个），只有它唯一时才算数；
 * 不然整个单元只有一个站也算数。多于一个又挑不出，回 undefined——调用方去报「给 cwd」，
 * 别替人猜。
 */
export function pickDocsSite(sites: readonly FoundSite[]): string | undefined {
  const named = sites.filter((s) => path.basename(s.dir) === 'docs-site')
  if (named.length === 1) return named[0]?.dir
  if (named.length === 0 && sites.length === 1) return sites[0]?.dir
  return undefined
}

/** 算源树 mtime 时跳过的目录 */
const MTIME_SKIP = new Set(['node_modules', '.next', '.source', 'out', 'dist', '.git', '.turbo'])

/** 一棵目录下最新的文件改动时间（毫秒）；空目录回 0 */
export function newestMtime(dir: string): number {
  let newest = 0
  for (const entry of readDir(dir)) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (MTIME_SKIP.has(entry.name)) continue
      newest = Math.max(newest, newestMtime(full))
    } else if (entry.isFile()) {
      try {
        newest = Math.max(newest, fs.statSync(full).mtimeMs)
      } catch {
        // 文件正被改，下次再看
      }
    }
  }
  return newest
}

/** 站里算「源」的东西：content / src / public 三棵树，以及站根下的所有文件（配置、账本、package.json） */
export function sourcesNewestMtime(siteDir: string): number {
  let newest = 0
  for (const sub of ['content', 'src', 'public']) newest = Math.max(newest, newestMtime(path.join(siteDir, sub)))
  for (const entry of readDir(siteDir)) {
    if (!entry.isFile()) continue
    try {
      newest = Math.max(newest, fs.statSync(path.join(siteDir, entry.name)).mtimeMs)
    } catch {
      // 同上
    }
  }
  return newest
}

export type BuildState = 'missing' | 'fresh' | 'stale'

/**
 * build 过没有、还新不新鲜。`.next/BUILD_ID` 是 next build 成功的唯一标志（next dev 不写它）。
 * 源比它新就是 stale——改完 mdx 起旧产物，看到的是旧页面，会以为没生效。
 */
export function buildState(siteDir: string): BuildState {
  let builtAt: number
  try {
    builtAt = fs.statSync(path.join(siteDir, '.next', 'BUILD_ID')).mtimeMs
  } catch {
    return 'missing'
  }
  return sourcesNewestMtime(siteDir) > builtAt ? 'stale' : 'fresh'
}

/** 依赖装了没有：站目录下有 node_modules 目录就算 */
export function hasNodeModules(siteDir: string): boolean {
  try {
    return fs.statSync(path.join(siteDir, 'node_modules')).isDirectory()
  } catch {
    return false
  }
}

/** 站根有 livedoc.config.mjs——接了 livedoc 的站，界面上多亮一个记号；认站不看它 */
export function hasLivedocConfig(siteDir: string): boolean {
  try {
    return fs.statSync(path.join(siteDir, 'livedoc.config.mjs')).isFile()
  } catch {
    return false
  }
}

/**
 * 设置值 → 绝对根（照 gwb-unit-folder 的判法）：不是字符串、去掉空白是空的都算没配；
 * 相对路径当场 `path.resolve`——绝对化只在这一处做，扫描那层只跟绝对路径打交道。
 */
export function rootFromSetting(raw: unknown): string | undefined {
  const dir = typeof raw === 'string' ? raw.trim() : ''
  return dir === '' ? undefined : path.resolve(dir)
}

/** `dir` 在不在 `root` 之内（含根本身）。命令总线对外暴露，起站的目录得关在容器根内 */
export function isInside(root: string, dir: string): boolean {
  const rel = path.relative(path.resolve(root), path.resolve(dir))
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))
}
