import type { CardProblemReport, CheckReport, ComponentReport, DocReport, OutputReport, RefReport } from '@godcreator02/live-doc-cli'

/**
 * `livedoc check --json` 的输出 → 「待重写页」清单。纯函数，不起进程、不碰盘
 * ——进程那半在 index.ts 里经 `gwbNodeCli` 跑，这儿只认一份 JSON。
 *
 * 口径不是这儿定的：**待重写页 = items 里有 changed / missing 的、或有落点不新鲜的文档；
 * 漂移的钉 = 那些 item**。落点新不新鲜也不由这儿解释——报告里每个落点自带 `fresh`，
 * 那是 project 的摆放模块判的，这儿只筛。
 * 只有孤儿记录或名册外组件的页也红，但那不是「重写正文」能解决的事，单列进 `others`
 * ——混在一起会让 agent 去重写一篇其实只要删条记录的页。
 *
 * 类型直接吃 cli 导出的那几个（摆放那个是它从 project 借过来的）：形状是契约，抄一份必然漂。
 * **只 import type**——CLI 形态的东西一律起进程调，不进程内 import（devkit 手册红线）。
 */

/** 一处漂了的钉。字段是 cli 的 `RefReport` 的子集，agent 靠它定位改哪几行 */
export interface StalePin {
  target: string
  kind: RefReport['kind']
  status: RefReport['status']
  /** 记号在文档里的第几行，1 起 */
  line: number
  /** 被引段今天在源文件里的位置 */
  lines: [number, number]
  reason?: string
  /** 有变动时的 - / + 文本 */
  diff?: string
}

/** 一篇待重写的页 */
export interface StalePage {
  doc: string
  /** 这篇贡献的红，原样取 cli 报告里的数 */
  red: number
  /** 漂了的钉：changed（内容变了）与 missing（引用指向空气） */
  pins: StalePin[]
  /** 不新鲜的摆放落点：源改了没重摆、生成物被人直接改了、或源头部缺 frontmatter 字段 */
  outputs: OutputReport[]
}

/** 红但不是「重写正文」能解决的页：孤儿记录（confirm 清）、名册外组件（配置里补压平规则） */
export interface OtherProblemPage {
  doc: string
  orphans: string[]
  components: ComponentReport[]
}

/** `live-doc.stale` 的回执主体 */
export interface StaleSummary {
  /** 整站没有红 */
  ok: boolean
  /** 红的总数，原样取 cli 报告里的数 */
  red: number
  /** 扫了几篇 */
  docs: number
  pages: StalePage[]
  others: OtherProblemPage[]
  /** 记录簿里还留着、文档本身已经不在的 */
  strays: string[]
  /** 轨迹卡的病 */
  trajectory: CardProblemReport[]
}

/** 算漂移的两种状态。unconfirmed（白）不算——那是还没确认过，不是现状漂了 */
const DRIFTED = new Set(['changed', 'missing'])

function pinsOf(doc: DocReport): StalePin[] {
  return doc.items
    .filter((item) => DRIFTED.has(item.status))
    .map((item) => ({
      target: item.target,
      kind: item.kind,
      status: item.status,
      line: item.line,
      lines: item.lines,
      ...(item.reason !== undefined ? { reason: item.reason } : {}),
      ...(item.diff !== undefined ? { diff: item.diff } : {}),
    }))
}

/** 一份 check 报告收敛成待重写清单 */
export function collapse(report: CheckReport): StaleSummary {
  const pages: StalePage[] = []
  const others: OtherProblemPage[] = []
  for (const doc of report.docs) {
    const pins = pinsOf(doc)
    const outputs = doc.outputs.filter((o) => !o.fresh)
    if (pins.length > 0 || outputs.length > 0) {
      pages.push({ doc: doc.doc, red: doc.red, pins, outputs })
      continue
    }
    if (doc.orphans.length > 0 || doc.components.length > 0) {
      others.push({ doc: doc.doc, orphans: doc.orphans, components: doc.components })
    }
  }
  return {
    ok: report.ok,
    red: report.red,
    docs: report.docs.length,
    pages,
    others,
    strays: report.strays,
    trajectory: report.trajectory,
  }
}

/**
 * 从 stdout 里把那一行机读报告捞出来。
 *
 * `--json` 整份打成一行，但**同一条流里还可能有别的话**（配置里的 warn、Node 的告警），
 * 所以从后往前找第一行 `{` 开头、且真能 parse 成报告的。找不到回 undefined，
 * 调用方去报「没拿到机读报告」并把 stdout / stderr 交回去——比抛一个 SyntaxError 有用。
 */
export function parseCheckJson(stdout: string): CheckReport | undefined {
  const lines = stdout.split(/\r?\n/)
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const line = (lines[i] ?? '').trim()
    if (!line.startsWith('{')) continue
    let parsed: unknown
    try {
      parsed = JSON.parse(line)
    } catch {
      continue
    }
    if (isCheckReport(parsed)) return parsed
  }
  return undefined
}

/**
 * 认一份报告：契约上的五个字段都在、形状对得上才算。**加字段照样认**（那是允许的演进），
 * 少字段就不认——少了就说明对面那份 cli 太老，报「没拿到机读报告」比在下游读出 undefined 强。
 */
function isCheckReport(value: unknown): value is CheckReport {
  if (typeof value !== 'object' || value === null) return false
  const v = value as { ok?: unknown; red?: unknown; docs?: unknown; strays?: unknown; trajectory?: unknown }
  return (
    typeof v.ok === 'boolean' &&
    typeof v.red === 'number' &&
    Array.isArray(v.docs) &&
    Array.isArray(v.strays) &&
    Array.isArray(v.trajectory)
  )
}
