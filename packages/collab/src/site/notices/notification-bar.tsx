import { Fragment, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useFetcher } from 'react-router'
import {
  ArrowDownToLine,
  ChevronDown,
  CircleCheck,
  FileWarning,
  GitBranch,
  ListTodo,
  LoaderCircle,
  Lock,
  MessageSquare,
  RotateCcw,
  TriangleAlert,
  Upload,
  type LucideIcon,
} from 'lucide-react'
import { CopyForAiButton } from '@godcreator/comments/site'
import type { PublicPerson } from '@godcreator/identity'
import { recordPageUrlOf, tasksPageUrl } from '../../core/layout.js'
import { hasUnsubmittedChanges, isSubmitInProgress, submitBlockersOf, type SubmitState } from '../../core/notifications/submit-state.js'
import type { WriteResult } from '../page-data.js'
import { notificationOriginalTextOf, notificationSentenceOf } from '../../core/notifications/notification-text.js'
import {
  notificationCountsOf,
  notificationGroupOf,
  notificationGroups,
  notificationTargetOf,
  type Notification,
  type NotificationGroup,
  type NotificationKind,
} from '../../core/notifications/notifications.js'
import { peopleLookupOf } from '../../core/people.js'

/*
 * 顶部正中的提示栏：推送通道交来的通知（gwb-collab 算出）按协作仓、别的仓、找我的三组列在这里，有就一直显示，解决了自己消失。
 * 句子、原文、去处都由通知模型按 kind 算，这里只摆出来；「复制给 AI」复制 gwb-collab 写好的提示词，粘贴给哪个 AI 由人定。
 * 平时的提交审核不用叫 AI：「一键提交」让 gwb-collab 直接跑，提交到哪一步也显示在这里
 */

/** 原文超过这么多字或这么多行就先折起来 */
const longOriginalCharacters = 140
const longOriginalLines = 3

const kindIcon: Record<NotificationKind, LucideIcon> = {
  unsubmitted: Upload,
  conflicts: TriangleAlert,
  'submit-failure': TriangleAlert,
  'sync-problem': RotateCcw,
  'check-error': TriangleAlert,
  'off-main': GitBranch,
  'record-problem': FileWarning,
  'webhook-setup': Lock,
  unpushed: Upload,
  unpulled: ArrowDownToLine,
  diverged: GitBranch,
  'pull-to-review': GitBranch,
  'issue-to-answer': MessageSquare,
  'my-pull-update': GitBranch,
  'my-issue-answered': MessageSquare,
  'repo-setup': Lock,
  task: ListTodo,
  mention: MessageSquare,
  reply: MessageSquare,
}

/** 三组各一种颜色：协作仓红，别的仓琥珀，找我的蓝 */
const groupText: Record<NotificationGroup, string> = { 'collab-repo': 'text-danger', 'other-repos': 'text-open', 'for-me': 'text-info' }
const groupTone: Record<NotificationGroup, string> = {
  'collab-repo': 'bg-danger-soft ring-danger/40 hover:ring-danger',
  'other-repos': 'bg-open-soft ring-open/40 hover:ring-open',
  'for-me': 'bg-info-soft ring-info/40 hover:ring-info',
}
const groupTitle: Record<NotificationGroup, string> = { 'collab-repo': '协作仓', 'other-repos': '别的仓', 'for-me': '找我的' }
const groupSummaryIcon: Record<NotificationGroup, LucideIcon> = { 'collab-repo': TriangleAlert, 'other-repos': GitBranch, 'for-me': MessageSquare }
const groupSummaryOf: Record<NotificationGroup, (count: number) => string> = {
  'collab-repo': (count) => `协作仓 ${count} 件事`,
  'other-repos': (count) => `别的仓 ${count} 件事`,
  'for-me': (count) => `${count} 条找我的`,
}

function OriginalText({ text }: { text: string }) {
  const long = text.length > longOriginalCharacters || text.split('\n').length > longOriginalLines
  const [open, setOpen] = useState(false)
  return (
    <div className="grid justify-items-start gap-0.5">
      <p className={`m-0 text-[12px] break-words whitespace-pre-wrap text-fd-muted-foreground ${long && !open ? 'line-clamp-3' : ''}`}>{text}</p>
      {long && (
        <button type="button" onClick={() => setOpen(!open)} className="text-[11.5px] text-fd-muted-foreground hover:text-fd-foreground">
          {open ? '收起' : '展开全部'}
        </button>
      )}
    </div>
  )
}

const sentenceClass = 'text-[13px] leading-snug break-words text-fd-foreground'

type NavigationProps = { onNavigate: () => void; nameOf: (personId: string) => string }

/** 短句；点了按 notificationTargetOf 去：一条任务或模块那一页、站内一页（评论带着 ?comment=）、外部网址，没有去处的只显示 */
function Sentence({ notification, onNavigate, nameOf }: { notification: Notification } & NavigationProps) {
  const sentence = notificationSentenceOf(notification, nameOf)
  const target = notificationTargetOf(notification)
  if (target === null) return <span className={sentenceClass}>{sentence}</span>
  if ('url' in target) {
    return (
      <a href={target.url} target="_blank" rel="noreferrer" title={target.url} className={`${sentenceClass} no-underline hover:underline`}>
        {sentence}
      </a>
    )
  }
  const to = 'record' in target ? recordPageUrlOf(target.record) : target.page
  return (
    <Link to={to} onClick={onNavigate} className={`${sentenceClass} no-underline hover:underline`}>
      {sentence}
    </Link>
  )
}

function NotificationLine({ notification, ...navigation }: { notification: Notification } & NavigationProps) {
  const original = notificationOriginalTextOf(notification)
  const KindIcon = kindIcon[notification.kind]
  return (
    <div className="flex items-start gap-2">
      <KindIcon size={15} className={`mt-0.5 shrink-0 ${groupText[notificationGroupOf(notification)]}`} />
      <div className="grid min-w-0 flex-1 gap-1.5">
        <Sentence notification={notification} {...navigation} />
        {original !== null && <OriginalText text={original} />}
      </div>
    </div>
  )
}

const rowClass = 'm-0 border-t border-fd-border px-3 py-2.5 first:border-t-0'

function repoOf(notification: Notification): string {
  if (!('repo' in notification)) throw new Error(`${notification.kind} 不属于「别的仓」组，没有仓名`)
  return notification.repo
}

/** 「别的仓」组按仓归成一行一个仓，仓按名字排；行里各条照交来的顺序 */
function notificationsByRepo(notifications: readonly Notification[]): [string, Notification[]][] {
  const byRepo = new Map<string, Notification[]>()
  for (const notification of notifications) {
    const repo = repoOf(notification)
    byRepo.set(repo, [...(byRepo.get(repo) ?? []), notification])
  }
  return [...byRepo].sort(([a], [b]) => a.localeCompare(b))
}

function GroupRows({ group, notifications, ...navigation }: { group: NotificationGroup; notifications: readonly Notification[] } & NavigationProps) {
  if (group !== 'other-repos') {
    return notifications.map((notification) => (
      <li key={notification.id} className={rowClass}>
        <NotificationLine notification={notification} {...navigation} />
      </li>
    ))
  }
  return notificationsByRepo(notifications).map(([repo, repoNotifications]) => (
    <li key={repo} aria-label={repo} className={`grid gap-1.5 ${rowClass}`}>
      <span className="font-mono text-[12.5px] font-semibold break-all text-fd-foreground">{repo}</span>
      {repoNotifications.map((notification) => (
        <NotificationLine key={notification.id} notification={notification} {...navigation} />
      ))}
    </li>
  ))
}

function SummaryPart({ icon: SummaryIcon, className, children }: { icon: LucideIcon; className: string; children: ReactNode }) {
  return (
    <span className={`inline-flex min-w-0 items-center gap-1.5 font-semibold ${className}`}>
      <SummaryIcon size={15} />
      <span className="truncate">{children}</span>
    </span>
  )
}

/** 合并了的结果在提示栏上留这么久 */
const mergedNoticeMilliseconds = 15_000

/** 刚合并的那次：合并的时刻离现在不到 mergedNoticeMilliseconds 就回它，到点自己消失 */
function useRecentlyMerged(submit: SubmitState | undefined): Extract<SubmitState, { state: 'merged' }> | null {
  const merged = submit?.state === 'merged' ? submit : null
  const remaining = merged === null ? 0 : new Date(merged.at).getTime() + mergedNoticeMilliseconds - Date.now()
  const [, setExpired] = useState(0)
  useEffect(() => {
    if (remaining <= 0) return
    const timer = setTimeout(() => setExpired((count) => count + 1), remaining)
    return () => clearTimeout(timer)
  }, [merged?.at])
  return remaining > 0 ? merged : null
}

/** 提交到了哪一步，提示栏收起时也显示 */
function SubmitProgress({ submit }: { submit: Extract<SubmitState, { state: 'requested' | 'running' | 'merged' }> }) {
  if (submit.state === 'merged') {
    return (
      <SummaryPart icon={CircleCheck} className="text-done">
        已提交审核并合并 #{submit.pull.number}
      </SummaryPart>
    )
  }
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5 font-semibold text-info">
      <LoaderCircle size={15} className="animate-spin" />
      <span className="truncate">{submit.state === 'requested' ? '等工作台接手提交…' : '正在提交审核…'}</span>
    </span>
  )
}

/**
 * 「一键提交」：有本机还没提交审核的改动、或正在提交时出现。点了经任务页的 action 往频道 collab-submit 写一份请求，由 gwb-collab 提交审核；
 * 有冲突、不在 main 等提交审核一定被拒的事时不能点，写明先处理什么。被拒、没成功的原话照旧成为一条通知
 */
function SubmitButton({ submit, notifications }: { submit: SubmitState; notifications: readonly Notification[] }) {
  const fetcher = useFetcher<WriteResult>()
  const inProgress = isSubmitInProgress(submit)
  if (!inProgress && !hasUnsubmittedChanges(notifications)) return null
  const blockers = submitBlockersOf(notifications)
  const busy = inProgress || fetcher.state !== 'idle'
  const error = fetcher.state === 'idle' && fetcher.data?.ok === false ? fetcher.data.error : null
  const title = blockers.length > 0 ? `先处理：${blockers.join('；')}（复制给 AI，让它照说明书处理）` : '提交本机的改动：工作台跑提交审核，没问题就直接合并，不用叫 AI'
  return (
    <fetcher.Form method="post" action={tasksPageUrl} className="inline-flex items-baseline gap-2">
      <input type="hidden" name="intent" value="request-submit" />
      {blockers.length > 0 && <span className="text-[12px] text-fd-muted-foreground">先处理：{blockers.join('；')}</span>}
      {error !== null && <span className="text-[12px] text-danger">{error}</span>}
      <button
        type="submit"
        disabled={busy || blockers.length > 0}
        title={title}
        data-submit-button=""
        className="inline-flex items-center gap-1 rounded-md bg-fd-primary px-2 py-0.5 text-[12px] text-fd-primary-foreground hover:opacity-90 disabled:cursor-default disabled:opacity-50"
      >
        {busy ? <LoaderCircle size={13} className="animate-spin" /> : <Upload size={13} />}
        {inProgress ? '提交中…' : '一键提交'}
      </button>
    </fetcher.Form>
  )
}

/**
 * 顶部正中的提示栏，放在站点布局的顶部插槽里：平台把它排进顶上正中那一行（TopNotices），列表挂在那一行正下方。notifications 是调用方交来的通知（推送通道的最新一份，还没交来为 null），
 * aiPrompt 是同一份通知写成的提示词（gwb-collab 写），people 是公开人员列表（人名从 id 换成显示名）；
 * submit 是一键提交此刻的状态（站点没接一键提交时不给，就没有那个按钮）。没有通知、也没在提交时不显示
 */
export function NotificationBar({
  notifications,
  aiPrompt,
  people,
  submit,
}: {
  notifications: readonly Notification[] | null
  aiPrompt: string | null
  people: readonly PublicPerson[]
  submit?: SubmitState
}) {
  const [expanded, setExpanded] = useState(false)
  const nameOf = useMemo(() => peopleLookupOf(people).nameOf, [people])
  const merged = useRecentlyMerged(submit)
  const progress = submit !== undefined && isSubmitInProgress(submit) ? submit : merged
  const shownNotifications = notifications ?? []
  if (shownNotifications.length === 0) {
    if (progress === null) return null
    return (
      <div role="status" className={`pointer-events-auto flex max-w-full min-w-0 items-center gap-2 rounded-lg px-2.5 py-1.5 text-[13px] whitespace-nowrap shadow-lg ring-1 ${progress.state === 'merged' ? 'bg-done-soft ring-done/40' : 'bg-info-soft ring-info/40'}`}>
        <SubmitProgress submit={progress} />
      </div>
    )
  }
  const counts = notificationCountsOf(shownNotifications)
  const shownGroups = notificationGroups.filter((group) => counts[group] > 0)
  const navigation = { onNavigate: () => setExpanded(false), nameOf }
  return (
    <div className="max-w-full min-w-0">
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded(!expanded)}
        title={expanded ? '收起' : '点开看是哪些事'}
        className={`pointer-events-auto flex max-w-full min-w-0 items-center gap-2 rounded-lg py-1.5 pr-2 pl-2.5 text-[13px] whitespace-nowrap text-fd-foreground shadow-lg ring-1 ${groupTone[shownGroups[0]!]}`}
      >
        {progress !== null && (
          <>
            <SubmitProgress submit={progress} />
            <span className="text-fd-muted-foreground">{' · '}</span>
          </>
        )}
        {shownGroups.map((group, index) => (
          <Fragment key={group}>
            {index > 0 && <span className="text-fd-muted-foreground">{' · '}</span>}
            <SummaryPart icon={groupSummaryIcon[group]} className={groupText[group]}>
              {groupSummaryOf[group](counts[group])}
            </SummaryPart>
          </Fragment>
        ))}
        <ChevronDown size={15} className={`shrink-0 text-fd-muted-foreground transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>
      {expanded && (
        <section
          aria-label="要处理的事"
          className="pointer-events-auto absolute inset-x-0 top-full mx-auto mt-1.5 flex max-h-[min(70vh,640px)] w-[min(560px,calc(100vw-2rem))] flex-col overflow-hidden rounded-xl border border-fd-border bg-fd-card shadow-lg"
        >
          <header className="flex flex-wrap items-baseline gap-2 border-b border-fd-border px-3 py-2">
            <h2 className="m-0 text-[13px] font-semibold">要处理的事</h2>
            <span className="ml-auto inline-flex flex-wrap items-baseline justify-end gap-2">
              {submit !== undefined && <SubmitButton submit={submit} notifications={shownNotifications} />}
              {aiPrompt !== null && (
                <CopyForAiButton prompt={aiPrompt} copiedNotice={`已复制 ${shownNotifications.length} 件事，粘贴给你的 AI`} title="把这些事写成一份提示词复制下来，粘贴给你用的 AI" />
              )}
            </span>
          </header>
          <div className="min-h-0 overflow-y-auto">
            {shownGroups.map((group) => (
              <section key={group} aria-label={groupTitle[group]} className="border-t border-fd-border first:border-t-0">
                <h3 className={`m-0 px-3 pt-2 text-[12px] font-semibold ${groupText[group]}`}>{groupTitle[group]}</h3>
                <ul className="m-0 list-none p-0">
                  <GroupRows group={group} notifications={shownNotifications.filter((notification) => notificationGroupOf(notification) === group)} {...navigation} />
                </ul>
              </section>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
