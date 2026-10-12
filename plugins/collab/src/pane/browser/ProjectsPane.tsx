import type { HostBridge, ShellBridge } from '@godcreator/gwb-shell/pane'
import { Bot, CircleHelp, GitFork } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type ReactElement, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import {
  aiHandoffTextOf,
  hasNotifications,
  lastSegmentOf,
  notificationsChipOf,
  pushChipOf,
  receiptOf,
  siteStateOf,
  type AiHandoffResult,
  type Chip as ChipData,
  type ProjectList,
  type ProjectRow,
  type Receipt,
  type SiteRow,
  type Tone,
} from './projects'

/** 窗格看得见时多久重读一次列表：只读本机，很快；取回远端由 node 侧的检查做 */
const refreshMilliseconds = 15_000

/** 窗格只显示状态：读 collab.projects，点站点链接调 collab.site.start；克隆、提交这些操作都由人让自己的 AI 调命令 */
function useProjectList(host: HostBridge, shell: ShellBridge): { list: Receipt<ProjectList> | undefined; refresh: () => Promise<void> } {
  const [list, setList] = useState<Receipt<ProjectList> | undefined>(undefined)
  const mounted = useRef(true)

  const refresh = useCallback(async () => {
    const reply = receiptOf<ProjectList>(await host.call('collab.projects'))
    if (mounted.current) setList(reply)
  }, [host])

  useEffect(() => {
    mounted.current = true
    let timer: ReturnType<typeof setInterval> | undefined
    const stopListening = shell.onVisibility((visible) => {
      clearInterval(timer)
      timer = undefined
      if (!visible) return
      void refresh()
      timer = setInterval(() => void refresh(), refreshMilliseconds)
    })
    return () => {
      mounted.current = false
      stopListening()
      clearInterval(timer)
    }
  }, [refresh, shell])

  return { list, refresh }
}

/** 点站点链接：经 collab.site.start 打开（窗口照 gwb-docsite 的设置 site-window），没在运行就先启动；失败的原话交给那一行显示 */
type OpenSite = (repo: string) => Promise<string | null>

/** 点「交给 AI 处理」：经 collab.ai.handoff 把这个项目的全部通知交给设置 ai-handling 选的 AI */
type HandOffToAi = (repo: string) => Promise<Receipt<AiHandoffResult>>

export function ProjectsPane({ host, shell }: { host: HostBridge; shell: ShellBridge }): ReactElement {
  const { list, refresh } = useProjectList(host, shell)
  const openSite = useCallback<OpenSite>(
    async (repo) => {
      const reply = receiptOf<unknown>(await host.call('collab.site.start', { repo }))
      await refresh()
      return reply.ok ? null : reply.error
    },
    [host, refresh],
  )
  const [helpOpen, setHelpOpen] = useState(false)
  const openFolder = useCallback<OpenSite>(async (repo) => {
    const reply = receiptOf<unknown>(await host.call('collab.project.open', { repo }))
    return reply.ok ? null : reply.error
  }, [host])
  const handOffToAi = useCallback<HandOffToAi>(async (repo) => receiptOf<AiHandoffResult>(await host.call('collab.ai.handoff', { repo })), [host])

  if (list === undefined) return <p className="collab:m-0 collab:p-4 collab:text-sm collab:text-muted-foreground">正在读项目列表…</p>
  if (!list.ok) return <p className="collab:m-0 collab:p-4 collab:text-sm collab:text-destructive collab:whitespace-pre-wrap">{list.error}</p>

  const { projects, watchError, gitea, push } = list.data
  const pushChip = pushChipOf(push)
  return (
    <div className="collab:flex collab:flex-col collab:gap-3 collab:p-4">
      <div className="collab:flex collab:items-start collab:gap-2">
        <div className="collab:flex collab:min-w-0 collab:flex-col collab:gap-0.5">
          <span className="collab:inline-flex collab:items-center collab:gap-1.5 collab:text-sm" title={gitea.error ?? undefined}>
            <Dot tone={gitea.login === null ? 'bad' : 'ok'} />
            {gitea.login === null ? (
              <span className="collab:text-destructive">Gitea 账号没配好</span>
            ) : (
              <>
                <span className="collab:font-medium collab:text-foreground">{gitea.login}</span>
                <span className="collab:text-muted-foreground">{(gitea.baseUrl ?? '').replace(/^https?:\/\//, '')}</span>
              </>
            )}
          </span>
          <span className="collab:flex collab:flex-wrap collab:items-center collab:gap-1.5 collab:text-xs collab:text-muted-foreground">
            <Chip chip={pushChip} />
          </span>
        </div>
        <Button className="collab:ml-auto" variant={helpOpen ? 'secondary' : 'ghost'} size="xs" aria-expanded={helpOpen} onClick={() => setHelpOpen(!helpOpen)}>
          <CircleHelp />
          怎么用
        </Button>
      </div>

      {helpOpen && <Help />}
      {gitea.error !== null && <Notice text={`拉取、提交、检查都要用 Gitea 令牌：${gitea.error}`} />}
      {watchError !== null && <Notice text={watchError} />}

      {projects.length === 0 ? (
        <p className="collab:m-0 collab:text-sm collab:text-muted-foreground">
          还没有项目。把项目的组织地址告诉你的 AI，比如「加入 https://…/hybrid-mmc 这个项目，放在 D:\projects 下」，它会克隆组织里的全部仓并加到这里。
        </p>
      ) : (
        <ul className="collab:m-0 collab:flex collab:list-none collab:flex-col collab:gap-2 collab:p-0">
          {projects.map((row) => (
            <ProjectLine key={row.repo} row={row} openSite={openSite} openFolder={openFolder} handOffToAi={handOffToAi} />
          ))}
        </ul>
      )}
    </div>
  )
}

/** 点「怎么用」展开：这个窗格怎么看、操作找谁做；具体做法在说明书 collab 里，这里不抄 */
function Help(): ReactElement {
  return (
    <div className="collab:flex collab:flex-col collab:gap-2 collab:rounded-md collab:border collab:border-border collab:bg-muted/40 collab:p-3 collab:text-xs collab:text-foreground">
      <p className="collab:m-0">
        列表里每个项目的协作站由插件在后台自动运行。每个项目一行，写着三组通知各有几条：协作仓（没提交审核的文件、冲突、同步不了等）、别的仓（和服务器不一样、等你审阅的合并请求与 issue 等），和找你的任务、@我、回复。点通知或地址打开协作站，网页顶部的提示栏里有每一条；点这一行的「交给 AI 处理」，把这个项目的通知全部交给 AI（交给 ZCode 还是 Claude Code，在 gwb 设置里 gwb-collab 的 ai-handling 选）。
      </p>
      <p className="collab:m-0">
        插件和 NAS 上的推送服务连着，Gitea 一有推送或合并请求的事件，几秒内就取回一次，别人合进 main 的改动快进进来。提交审核时，NAS 上的执行器十几秒内当场定论：合并，或者留言写明原因并打回。
      </p>
      <p className="collab:m-0">
        这个窗格只显示状态。克隆、提交审核、更新别的仓这些事都让你的 AI 做：它会读 gwb-collab 的说明书 <code>collab</code>，调对应的命令。可以这样说：
      </p>
      <ul className="collab:m-0 collab:flex collab:flex-col collab:gap-0.5 collab:pl-4">
        <li>「加入 https://…/&lt;组织&gt; 这个项目，放在 D:\projects 下」</li>
        <li>「看看我有什么待办」「站点没起来，看看为什么」</li>
        <li>「提交审核」「把资料库更新一下」</li>
      </ul>
      <p className="collab:m-0">
        第一次用之前：在 gwb 的设置里给 gwb-gitea 填 Gitea 令牌（权限勾仓库读写、组织读写、工单读、用户读），装好 Git LFS。你自己在终端或 VS Code 里用 git 联网时，第一次会弹出 Gitea 登录，登录和令牌同一个账号。
      </p>
    </div>
  )
}

const chipToneClass: Record<Tone, string> = {
  ok: 'collab:bg-success/10 collab:text-success',
  warn: 'collab:bg-warning/10 collab:text-warning',
  bad: 'collab:bg-destructive/10 collab:text-destructive',
  muted: 'collab:bg-muted collab:text-muted-foreground',
}

const dotToneClass: Record<Tone, string> = {
  ok: 'collab:bg-success',
  warn: 'collab:bg-warning',
  bad: 'collab:bg-destructive',
  muted: 'collab:bg-muted-foreground/40',
}

function Dot({ tone }: { tone: Tone }): ReactElement {
  return <span className={`collab:inline-block collab:size-2 collab:shrink-0 collab:rounded-full ${dotToneClass[tone]}`} aria-hidden />
}

const chipClass = 'collab:inline-flex collab:items-center collab:gap-1.5 collab:rounded-full collab:px-2 collab:py-0.5 collab:text-xs'

/** 带颜色的状态标签：点加一句话 */
function Chip({ chip }: { chip: ChipData }): ReactElement {
  return (
    <span className={`${chipClass} ${chipToneClass[chip.tone]}`} title={chip.title}>
      <Dot tone={chip.tone} />
      {chip.label}
    </span>
  )
}

function Notice({ text }: { text: string }): ReactElement {
  return (
    <p className="collab:m-0 collab:rounded-md collab:border collab:border-destructive/40 collab:bg-destructive/10 collab:px-3 collab:py-2 collab:text-xs collab:whitespace-pre-wrap collab:break-all collab:text-destructive">
      {text}
    </p>
  )
}

/** 打开协作站的按钮，长得和链接一样；打开要经插件，不能用新窗口链接交给系统浏览器 */
function SiteButton({ onOpen, className, title, children }: { onOpen: () => void; className?: string; title?: string; children: ReactNode }): ReactElement {
  return (
    <button type="button" className={`collab:cursor-pointer collab:border-0 collab:[font-family:inherit] ${className ?? ''}`} title={title} onClick={onOpen}>
      {children}
    </button>
  )
}

type HandoffState = { state: 'idle' } | { state: 'sending' } | { state: 'sent'; text: string }

/**
 * 一个项目一行：项目名、身份、通知各组几条的标签（站点在运行时点它打开协作站）、有通知时的「交给 AI 处理」，站点地址与 Gitea；
 * 项目打不开、站点没能启动、没能打开或没能交给 AI 时原因写在下面，交给 AI 成功时写交给了谁
 */
function ProjectLine({ row, openSite, openFolder, handOffToAi }: { row: ProjectRow; openSite: OpenSite; openFolder: OpenSite; handOffToAi: HandOffToAi }): ReactElement {
  const summary = row.summary
  const chip = notificationsChipOf(row)
  const [openError, setOpenError] = useState<string | null>(null)
  const [openingFolder, setOpeningFolder] = useState(false)
  const [handoff, setHandoff] = useState<HandoffState>({ state: 'idle' })
  const failed = (error: unknown) => setOpenError(error instanceof Error ? error.message : String(error))
  const open = () => void openSite(row.repo).then(setOpenError).catch(failed)
  const openInCode = () => {
    setOpeningFolder(true)
    void openFolder(row.repo).then(setOpenError).catch(failed).finally(() => setOpeningFolder(false))
  }
  const handOff = () => {
    setOpenError(null)
    setHandoff({ state: 'sending' })
    void handOffToAi(row.repo)
      .then((reply) => {
        if (reply.ok) setHandoff({ state: 'sent', text: aiHandoffTextOf(reply.data) })
        else {
          setHandoff({ state: 'idle' })
          setOpenError(`没能交给 AI：${reply.error}`)
        }
      })
      .catch((error: unknown) => {
        setHandoff({ state: 'idle' })
        failed(error)
      })
  }
  const reason = row.error ?? row.site.error ?? openError
  return (
    <li className="collab:flex collab:flex-col collab:gap-2 collab:rounded-lg collab:border collab:border-border collab:bg-card collab:px-3 collab:py-2">
      <div className="collab:flex collab:flex-wrap collab:items-center collab:gap-x-2 collab:gap-y-1">
        <span className="collab:min-w-0 collab:truncate collab:text-sm collab:font-medium collab:text-foreground">{summary?.title ?? lastSegmentOf(row.repo)}</span>
        {summary !== null && <span className="collab:text-xs collab:text-muted-foreground">{summary.name}</span>}
        {row.site.running && chip.key === 'messages' ? (
          <SiteButton onOpen={open} className={`${chipClass} ${chipToneClass[chip.tone]}`} title={chip.title}>
            <Dot tone={chip.tone} />
            {chip.label}
          </SiteButton>
        ) : (
          <Chip chip={chip} />
        )}
        {hasNotifications(row) && (
          <Button type="button" variant="outline" size="xs" title="把这个项目要处理的事全部交给 AI（交给谁看设置 ai-handling）" disabled={handoff.state === 'sending'} onClick={handOff}>
            <Bot />
            {handoff.state === 'sending' ? '正在交给 AI…' : '交给 AI 处理'}
          </Button>
        )}
        <span className="collab:ml-auto collab:flex collab:shrink-0 collab:items-center collab:gap-1">
          <SiteLink site={row.site} onOpen={open} />
          {summary !== null && <GiteaLink url={summary.giteaUrl} />}
          <Button type="button" variant="ghost" size="icon-sm" title="用 VS Code 打开项目文件夹" aria-label="用 VS Code 打开项目文件夹" disabled={openingFolder} onClick={openInCode}>
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M17 2 7.5 10 3 6.5 1 7.5v9l2 1L7.5 14 17 22l6-2.5v-15L17 2Zm0 5v10l-6-5 6-5ZM3 9.5 6 12l-3 2.5v-5Z" />
            </svg>
          </Button>
        </span>
      </div>
      {reason !== null && <Notice text={reason} />}
      {handoff.state === 'sent' && <p className="collab:m-0 collab:text-xs collab:break-all collab:text-success">{handoff.text}</p>}
    </li>
  )
}

/** 只显示端口，完整地址与运行状态放在悬停提示里；点击照常启动并打开站点 */
function SiteLink({ site, onOpen }: { site: SiteRow; onOpen: () => void }): ReactElement {
  const state = siteStateOf(site)
  if (site.url === null) {
    return (
      <span className="collab:inline-flex collab:items-center collab:gap-1 collab:text-xs collab:text-muted-foreground">
        <Dot tone={state.tone} />
        端口未知
      </span>
    )
  }
  return (
    <span className="collab:inline-flex collab:items-center collab:gap-1 collab:text-xs">
      <Dot tone={state.tone} />
      <Button type="button" variant="ghost" size="xs" onClick={onOpen} title={`协作站${state.label} · ${site.url}`}>
        端口 {new URL(site.url).port || (new URL(site.url).protocol === 'https:' ? '443' : '80')}
      </Button>
    </span>
  )
}

function GiteaLink({ url }: { url: string }): ReactElement {
  return (
    <Button type="button" variant="ghost" size="icon-sm" title={`在 Gitea 打开 ${lastSegmentOf(url)} · ${url}`} aria-label={`在 Gitea 打开 ${lastSegmentOf(url)}`} onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}>
      <GitFork aria-hidden />
    </Button>
  )
}
