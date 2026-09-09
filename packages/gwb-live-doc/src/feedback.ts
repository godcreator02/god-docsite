import fs from 'node:fs'
import path from 'node:path'

/**
 * 反馈区那一页：往目标站的 `content/feedback/inbound.mdx` **追加**一条，以及把条目读回来。
 *
 * 格式不是这儿发明的，是 live-doc-cli 的站模板
 * `template/docs-site/content/feedback/inbound.mdx.tpl` 定的（那份注释里写着一条长什么样）：
 *
 * ```
 * ## <yyyy-MM-dd> <标题>
 *
 * 来源：<投来的仓或单元>
 *
 * <正文>
 * ```
 *
 * 三条纪律：**只追加**（不改别的页、不动已有条目）、**不 commit**（那个仓的人自己看了再提交）、
 * **页不存在就建**（对面的站可能还没改成六区，缺一页不该让跨仓反馈投不进去）。
 */

/** 反馈页在站里的位置（相对站根） */
export const INBOUND_PARTS = ['content', 'feedback', 'inbound.mdx'] as const

/** 反馈页的绝对路径 */
export function inboundPath(siteDir: string): string {
  return path.join(siteDir, ...INBOUND_PARTS)
}

/** 一条反馈 */
export interface FeedbackEntry {
  /** yyyy-MM-dd */
  date: string
  title: string
  /** 谁投的。没给就是「未署名」 */
  from: string
  body: string
}

/** 本机时区的 yyyy-MM-dd。**不用 toISOString**——那是 UTC，晚上八点之后写的条目会落到明天 */
export function today(now: Date = new Date()): string {
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${String(now.getFullYear())}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

/** 一条渲成 mdx 的一节。标题里的换行折平——`## ` 那一行只能是一行 */
export function formatEntry(entry: FeedbackEntry): string {
  const title = entry.title.replace(/\s+/g, ' ').trim()
  const from = entry.from.replace(/\s+/g, ' ').trim()
  return `## ${entry.date} ${title}\n\n来源：${from}\n\n${entry.body.trim()}\n`
}

/**
 * 追加一节到页尾。**新的在下**（追加的自然序，跟模板里那句一致），条目之间空一行。
 * 页尾原有的空行先裁掉，免得追加几次之后页里全是空行。
 */
export function appendEntry(page: string, entry: FeedbackEntry): string {
  const body = page.replace(/\s+$/, '')
  return `${body}\n\n${formatEntry(entry)}`
}

/**
 * 页不存在时先铺的那一份。照模板那页的骨架，只是不带 `{{pkgName}}`——这儿不知道对面仓叫什么，
 * 而「本页回答」一句是六区页的硬约定，不能省。
 */
export function newPage(): string {
  return [
    '---',
    'title: 投来的反馈',
    'description: 别的仓在用这个仓时投来的反馈——带日期与来源，处理完删',
    '---',
    '',
    '{/*',
    '  这一页由 gwb-live-doc 件的 `live-doc.feedback` 命令往末尾追加，一条的格式：',
    '',
    '  ## <yyyy-MM-dd> <标题>',
    '',
    '  来源：<投来的仓或单元>',
    '',
    '  <正文，可多段，可带代码围栏>',
    '',
    '  条目之间空一行。追加不 commit，由本仓的人处理后提交；处理完删条目、决定落轨迹卡。',
    '*/}',
    '',
    '# 投来的反馈',
    '',
    '**本页回答**：别的仓在用这个仓的过程中投来了什么反馈、处理到哪儿了。',
    '',
    '一条一节，新的在下（追加的自然序）。处理一条：改代码或改文档 → 决定落轨迹卡 → 删掉这一条。',
    '',
  ].join('\n')
}

/** `## <日期> <标题>` 那一行。日期没写成 yyyy-MM-dd 的，整行都当标题 */
const HEADING = /^##[ \t]+(?:(\d{4}-\d{2}-\d{2})[ \t]+)?(.*)$/

/**
 * 把页里的条目读回来。**只认二级标题**：`#` 是页标题、`###` 是条目正文里的小节。
 * 围栏里的 `## ` 不算——代码块里贴一段 markdown 是常事。
 */
export function parseEntries(page: string): FeedbackEntry[] {
  const out: FeedbackEntry[] = []
  let fence: string | undefined
  let current: { date: string; title: string; lines: string[] } | undefined
  const flush = (): void => {
    if (current === undefined) return
    const { from, body } = splitFrom(current.lines)
    out.push({ date: current.date, title: current.title, from, body })
    current = undefined
  }
  for (const line of page.split(/\r?\n/)) {
    const opener = /^\s*(```+|~~~+)/.exec(line)
    if (fence === undefined && opener !== null) fence = opener[1]
    else if (fence !== undefined && opener !== null && (opener[1] ?? '').startsWith(fence)) fence = undefined
    if (fence === undefined) {
      const heading = HEADING.exec(line)
      if (heading !== null) {
        flush()
        current = { date: heading[1] ?? '', title: (heading[2] ?? '').trim(), lines: [] }
        continue
      }
    }
    current?.lines.push(line)
  }
  flush()
  return out
}

/** 一节的正文里切出「来源：」那行。没有那行就是未署名，正文原样留着 */
function splitFrom(lines: readonly string[]): { from: string; body: string } {
  const at = lines.findIndex((line) => line.trimStart().startsWith('来源：'))
  if (at < 0) return { from: '', body: lines.join('\n').trim() }
  const from = (lines[at] ?? '').trimStart().slice('来源：'.length).trim()
  return { from, body: [...lines.slice(0, at), ...lines.slice(at + 1)].join('\n').trim() }
}

/** 读回页的正文；页还不在回 undefined */
export function readInbound(siteDir: string): string | undefined {
  try {
    return fs.readFileSync(inboundPath(siteDir), 'utf8')
  } catch {
    return undefined
  }
}

/** 追加一条落盘。回执说清楚落在哪、是不是顺手把页建了出来 */
export function writeFeedback(siteDir: string, entry: FeedbackEntry): { file: string; created: boolean; total: number } {
  const file = inboundPath(siteDir)
  const existing = readInbound(siteDir)
  const created = existing === undefined
  const next = appendEntry(existing ?? newPage(), entry)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, next)
  return { file, created, total: parseEntries(next).length }
}
