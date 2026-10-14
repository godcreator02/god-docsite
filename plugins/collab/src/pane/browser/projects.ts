import type { NotificationGroup } from '@godcreator/collab'

/** collab.projects 的回执里窗格读的那几样，形状照 node 侧 src/pane/commands.ts 的 ProjectRow、src/pane/summary.ts 的 ProjectSummary */

export type ProjectSummary = {
  title: string
  name: string
  /** 通知各组几条，和网站顶部提示栏是同一份通知 */
  counts: Record<NotificationGroup, number>
  giteaUrl: string
}

export type SiteRow = { url: string | null; running: boolean; error: string | null }

/** 一个项目按打不打得开分两种：打得开的 summary 必在、error 必空；打不开的只在 error 里写原因 */
export type ProjectRow = { repo: string; summary: ProjectSummary; error: null; site: SiteRow } | { repo: string; summary: null; error: string; site: SiteRow }

/** 实时推送：全部项目共用一条订阅，形状照 node 侧 src/organization/events/project-topics-subscription.ts 的 PushStatus */
export type PushStatus = { state: 'connected' | 'connecting' | 'waiting' | 'off'; url: string | null; topics: string[]; error: string | null }

/** 状态的颜色：正常（绿）、要处理（黄）、出错或要人工处理（红）、没有结论（灰） */
export type Tone = 'ok' | 'warn' | 'bad' | 'muted'

export type Chip = { key: string; label: string; tone: Tone; title?: string }

/** 三组在标签里的叫法，和网站提示栏的分组一样 */
const groupLabels: Record<NotificationGroup, string> = { 'collab-repo': '协作仓', 'other-repos': '别的仓', 'for-me': '找我的' }

const groupsInOrder: NotificationGroup[] = ['collab-repo', 'other-repos', 'for-me']

/**
 * 一个项目那一行的通知标签：各组几条和网站顶部提示栏一样，详情去网站看；协作仓组有通知标红，只有别的两组标黄，没有的那一组不写。
 * 项目打不开、站点没能启动时网站上看不到提示栏，标签写明是哪样，原因在悬停提示里
 */
export function notificationsChipOf(row: ProjectRow): Chip {
  if (row.error !== null) return { key: 'error', label: '打不开', tone: 'bad', title: row.error }
  if (row.site.error !== null) return { key: 'site', label: '站点没能启动', tone: 'bad', title: row.site.error }
  const { counts } = row.summary
  if (!hasNotifications(row)) return { key: 'messages', label: '没有通知', tone: 'ok' }
  const label = groupsInOrder
    .filter((group) => counts[group] > 0)
    .map((group) => `${groupLabels[group]} ${counts[group]} 条`)
    .join(' · ')
  return { key: 'messages', label, tone: counts['collab-repo'] > 0 ? 'bad' : 'warn', title: '打开协作站，顶部的提示栏里有每一条；要交给 AI，点这一行的「交给 AI 处理」' }
}

/** collab.ai.handoff 的回执，形状照 node 侧 src/ai-handoff/commands.ts */
export type AiHandoffResult = { handler: 'zcode' | 'claude-terminal'; detail: string; items: number }

/** 交给 AI 之后那一行写的：交了几件事、交给了谁、在哪看 */
export function aiHandoffTextOf({ handler, detail, items }: AiHandoffResult): string {
  if (handler === 'zcode') return `已把 ${items} 件事交给 ZCode，会话 ${detail}`
  return `已把 ${items} 件事交给新开窗口里的 Claude Code，提示词在 ${detail}`
}

/** 有没有要交给 AI 的事：和通知标签数的是同一份通知 */
export function hasNotifications(row: ProjectRow): boolean {
  const { summary } = row
  if (summary === null) return false
  return groupsInOrder.some((group) => summary.counts[group] > 0)
}

/** 站点那个链接的颜色与说明：运行中绿，没运行灰，常驻失败或启动前就失败红 */
export function siteStateOf(site: SiteRow): { tone: Tone; label: string } {
  if (site.running) return { tone: 'ok', label: '运行中' }
  if (site.error !== null) return { tone: 'bad', label: '没能启动' }
  return { tone: 'muted', label: '未运行' }
}

/** 地址最后一段：Gitea 主人页面的组织名、文件路径的文件名 */
export function lastSegmentOf(pathOrUrl: string): string {
  return pathOrUrl.split(/[\\/]/).filter(Boolean).pop() ?? pathOrUrl
}

/**
 * 窗格顶上实时推送那个标签：连上了绿（有项目没订上黄）；正在连灰；断开了等重连（连不上 NAS）黄；没能开始红；列表是空的灰。
 * 悬停看原因，或订的是哪几个 topic
 */
export function pushChipOf(push: PushStatus): Chip {
  const shown =
    push.state === 'connected'
      ? push.error === null
        ? { label: '实时推送已连上', tone: 'ok' as const }
        : { label: '实时推送已连上，有项目没订上', tone: 'warn' as const }
      : push.state === 'connecting'
        ? { label: '实时推送连接中', tone: 'muted' as const }
        : push.state === 'waiting'
          ? { label: '连不上 NAS，稍后重连', tone: 'warn' as const }
          : push.error === null
            ? { label: '没有项目，没在订阅', tone: 'muted' as const }
            : { label: '实时推送没能开始', tone: 'bad' as const }
  const title = push.error ?? (push.url === null ? undefined : `订阅 ${push.url} 上的 ${push.topics.join('、')}`)
  return { key: 'push', ...shown, ...(title === undefined ? {} : { title }) }
}

/** gwb-gitea 配的账号；没装、没填令牌或令牌无效时 login 为 null，原因在 error */
export type GiteaStatus = { login: string | null; baseUrl: string | null; error: string | null }

export type ProjectList = { watchError: string | null; gitea: GiteaStatus; push: PushStatus; projects: ProjectRow[] }

/** 命令总线的回执：{ ok: true, data } 或 { ok: false, error } */
export type Receipt<T> = { ok: true; data: T } | { ok: false; error: string }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function receiptOf<T>(reply: unknown): Receipt<T> {
  if (!isRecord(reply)) return { ok: false, error: `命令回执不是对象：${JSON.stringify(reply)}` }
  if (reply.ok === true) return { ok: true, data: reply.data as T }
  return { ok: false, error: typeof reply.error === 'string' ? reply.error : JSON.stringify(reply) }
}
