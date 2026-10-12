import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { CalendarDays } from 'lucide-react'
import { recordPageUrlOf, tasksPageUrl } from '@godcreator/collab-model/task-model'
import { linkChipClassName, linkChipIconClassName, type SiteLinkKind } from '@godcreator/docsite-ui'
import { repoLinkPrefix } from '../repo-link-api.js'
import { calendarUrl, isRealDate } from '../site-data.js'
import { todayDay } from '../timeline.js'
import { useCollabData } from './collab-data.js'
import { DueMark, dueStateOf, moduleColorsOf } from './module-marks.js'
import { StatusDot, statusLabel } from './parts.js'
import { RepoLinkChip } from './repo-link.js'

const chipClass = 'mx-0.5 inline-flex max-w-full items-center gap-1 rounded-md border px-1.5 align-baseline text-[0.92em] leading-[1.6] font-normal no-underline whitespace-nowrap'

function hasWrittenText(children: ReactNode) {
  return !(children === undefined || children === null || children === '' || (Array.isArray(children) && children.length === 0))
}

/**
 * 页面里引用一条任务或一个模块：<RecordLink id="…" />，或写成链接 [](/tasks/<id>)，MDX 页面不用 import 就能写。没写文字时显示记录当前的标题，
 * 任务带状态、模块带截止日的记号（颜色是模块色）；点了进它那一页。记录不存在（后来删了）时写「已删除的记录」，不报错：
 * 以前写的日志页不能因为删了任务就打不开
 */
export function RecordLink({ id, children }: { id: string; children?: ReactNode }) {
  const { tasks, modules } = useCollabData()
  const colors = moduleColorsOf(modules)
  const written = hasWrittenText(children)
  const task = tasks.find((entry) => entry.id === id)
  if (task) {
    return (
      <Link
        to={recordPageUrlOf(id)}
        title={`任务：${task.title}（${statusLabel[task.status]}）`}
        style={task.module ? colors.get(task.module) : undefined}
        className={`${chipClass} ${task.module ? 'border-module/45 bg-module-soft' : 'border-fd-border bg-fd-muted'} text-fd-foreground`}
      >
        <StatusDot status={task.status} size={12} />
        <span className="truncate">{written ? children : task.title}</span>
      </Link>
    )
  }
  const module = modules.find((entry) => entry.id === id)
  if (module) {
    return (
      <Link to={recordPageUrlOf(id)} title={`模块：${module.title}（${module.due} 截止）`} style={colors.get(module.id)} className={`${chipClass} border-module/45 bg-module-soft text-fd-foreground`}>
        <DueMark state={dueStateOf(module, tasks, todayDay())} size={8} />
        <span className="truncate">{written ? children : module.title}</span>
      </Link>
    )
  }
  return (
    <span title={`没有 id 为 ${id} 的任务或模块，可能已经被删掉了`} className={`${chipClass} border-fd-border text-fd-muted-foreground`}>
      已删除的记录 {id}
    </span>
  )
}

/** 某一天的日志页：没有日志的日子也能打开（页面上提示让 AI 写），卡片画成虚线 */
function JournalLink({ date, href, children }: { date: string; href: string; children?: ReactNode }) {
  const { journalDates } = useCollabData()
  const hasJournal = journalDates.includes(date)
  return (
    <Link
      to={href}
      title={hasJournal ? `${date} 的日志` : `${date} 还没有日志`}
      className={`${linkChipClassName} border-fd-border ${hasJournal ? 'bg-fd-muted/60 text-fd-foreground' : 'border-dashed text-fd-muted-foreground'}`}
    >
      <CalendarDays className={linkChipIconClassName} />
      {hasWrittenText(children) ? children : `${date} 的日志`}
    </Link>
  )
}

const recordHrefPattern = new RegExp(`^${tasksPageUrl}/([^/?#]+)$`)
const journalHrefPattern = new RegExp(`^${calendarUrl}/(\\d{4}-\\d{2}-\\d{2})$`)

/** 正文里协作站自己的链接：任务与模块那一页、某一天的日志页、repo: 链接 */
export const collabLinkKinds: readonly SiteLinkKind[] = [
  {
    matches: (href) => recordHrefPattern.test(href),
    Chip: ({ href, children }) => <RecordLink id={decodeURIComponent(recordHrefPattern.exec(href)![1]!)}>{children}</RecordLink>,
  },
  {
    matches: (href) => isRealDate(journalHrefPattern.exec(href)?.[1] ?? ''),
    Chip: ({ href, children }) => (
      <JournalLink date={journalHrefPattern.exec(href)![1]!} href={href}>
        {children}
      </JournalLink>
    ),
  },
  { matches: (href) => href.startsWith(repoLinkPrefix), Chip: RepoLinkChip },
]

/** MDX 页面（内容页与日志页）不用 import 就能写的组件，骨架把它并进 MDX 的 components */
export const collabMdxComponents = { RecordLink }
