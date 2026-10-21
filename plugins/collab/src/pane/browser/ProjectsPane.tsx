import type { HostBridge, ShellBridge } from '@godcreator/gwb-shell/pane'
import { CircleHelp, Copy, GitFork } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type ReactElement, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import {
  aiPromptCopiedTextOf,
  hasNotifications,
  lastSegmentOf,
  notificationsChipOf,
  pushChipOf,
  receiptOf,
  siteStateOf,
  type AiPromptResult,
  type Chip as ChipData,
  type ProjectList,
  type ProjectRow,
  type Receipt,
  type SiteRow,
  type Tone,
} from './projects'

/** 窗格看得见时多久重读一次列表：只读本机，很快；取回远端由 node 侧的检查做 */
const refreshMilliseconds = 15_000

/** 窗格只显示状态：读 collab.projects，点站点链接调 docsite.site.start；克隆、处理冲突这些操作由人让自己的 AI 调命令，平时的提交审核在网页提示栏一键提交 */
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

/** 点站点链接：经 docsite.site.open 启动站点（已在运行就不动）并用 Chrome 应用窗口打开，一个站一个窗口；失败的原话交给那一行显示 */
type OpenSite = (site: SiteRow) => Promise<string | null>

/** 用 VS Code 打开项目文件夹；失败的原话交给那一行显示 */
type OpenFolder = (repo: string) => Promise<string | null>

/** 点「复制给 AI」：经 collab.ai.prompt 把这个项目的全部通知写成提示词，交回原文 */
type PromptForAi = (repo: string) => Promise<Receipt<AiPromptResult>>

export function ProjectsPane({ host, shell }: { host: HostBridge; shell: ShellBridge }): ReactElement {
  const { list, refresh } = useProjectList(host, shell)
  const openSite = useCallback<OpenSite>(
    async (site) => {
      const reply = receiptOf<unknown>(await host.call('docsite.site.open', { dir: site.dir }))
      await refresh()
      return reply.ok ? null : reply.error
    },
    [host, refresh],
  )
  const [helpOpen, setHelpOpen] = useState(false)
  const openFolder = useCallback<OpenFolder>(async (repo) => {
    const reply = receiptOf<unknown>(await host.call('collab.project.open', { repo }))
    return reply.ok ? null : reply.error
  }, [host])
  const promptForAi = useCallback<PromptForAi>(async (repo) => receiptOf<AiPromptResult>(await host.call('collab.ai.prompt', { repo })), [host])

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
          还没有项目。把项目的组织地址告诉你的 AI，比如「加入 https://…/hybrid-mmc 这个项目，放在 D:\projects 下」，它会克隆组织里没归档的仓并加到这里。
        </p>
      ) : (
        <ul className="collab:m-0 collab:flex collab:list-none collab:flex-col collab:gap-2 collab:p-0">
          {projects.map((row) => (
            <ProjectLine key={row.repo} row={row} openSite={openSite} openFolder={openFolder} promptForAi={promptForAi} />
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
        列表里每个项目的协作站由 gwb-docsite 在后台运行（项目加进列表时交给它，移出时撤掉）。每个项目一行，写着三组通知各有几条：协作仓（没提交审核的文件、冲突、同步不了等）、别的仓（和服务器不一样、等你审阅的合并请求与 issue 等），和找你的任务、@我、回复。点通知或地址打开协作站，网页顶部的提示栏里有每一条；点这一行的「复制给 AI」，把这个项目的通知全部写成一份提示词复制下来，粘贴给你用的 AI（网页提示栏里也有同样的按钮）。
      </p>
      <p className="collab:m-0">
        插件和 NAS 上的推送服务连着，Gitea 一有推送或合并请求的事件，几秒内就取回一次，别人合进 main 的改动快进进来。提交审核时，NAS 上的执行器十几秒内当场定论：合并，或者留言写明原因并打回。
      </p>
      <p className="collab:m-0">
        平时的提交审核不用叫 AI：网页顶部提示栏点开，点「一键提交」，插件直接提交审核，合并了提示栏上会写出来。有冲突、不在 main 这类事时按钮不能点，没成功的原因也会成为一条通知，这时再「复制给 AI」。
      </p>
      <p className="collab:m-0">
        这个窗格只显示状态。克隆、处理冲突、更新别的仓这些事都让你的 AI 做：它会读 gwb-collab 的说明书 <code>collab</code>，调对应的命令。可以这样说：
      </p>
      <ul className="collab:m-0 collab:flex collab:flex-col collab:gap-0.5 collab:pl-4">
        <li>「加入 https://…/&lt;组织&gt; 这个项目，放在 D:\projects 下」</li>
        <li>「看看我有什么待办」「站点没起来，看看为什么」</li>
        <li>「把冲突改好再提交审核」「把资料库更新一下」</li>
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

/** 打开协作站的按钮，长得和链接一样：站点可能没在运行，要先经 gwb-docsite 启动再打开，不能直接用新窗口链接 */
function SiteButton({ onOpen, className, title, children }: { onOpen: () => void; className?: string; title?: string; children: ReactNode }): ReactElement {
  return (
    <button type="button" className={`collab:cursor-pointer collab:border-0 collab:[font-family:inherit] ${className ?? ''}`} title={title} onClick={onOpen}>
      {children}
    </button>
  )
}

type CopyState = { state: 'idle' } | { state: 'copying' } | { state: 'copied'; text: string }

/**
 * 一个项目一行：项目名、身份、通知各组几条的标签（站点在运行时点它打开协作站）、有通知时的「复制给 AI」，站点地址与 Gitea；
 * 项目打不开、站点没能启动、没能打开或没能复制时原因写在下面，复制成功时写复制了几件事
 */
function ProjectLine({ row, openSite, openFolder, promptForAi }: { row: ProjectRow; openSite: OpenSite; openFolder: OpenFolder; promptForAi: PromptForAi }): ReactElement {
  const summary = row.summary
  const chip = notificationsChipOf(row)
  const [openError, setOpenError] = useState<string | null>(null)
  const [openingFolder, setOpeningFolder] = useState(false)
  const [copy, setCopy] = useState<CopyState>({ state: 'idle' })
  const failed = (error: unknown) => setOpenError(error instanceof Error ? error.message : String(error))
  const open = () => void openSite(row.site).then(setOpenError).catch(failed)
  const openInCode = () => {
    setOpeningFolder(true)
    void openFolder(row.repo).then(setOpenError).catch(failed).finally(() => setOpeningFolder(false))
  }
  const copyForAi = async () => {
    setOpenError(null)
    setCopy({ state: 'copying' })
    try {
      const reply = await promptForAi(row.repo)
      if (!reply.ok) throw new Error(`没能写出提示词：${reply.error}`)
      await navigator.clipboard.writeText(reply.data.prompt)
      setCopy({ state: 'copied', text: aiPromptCopiedTextOf(reply.data.items) })
    } catch (error) {
      setCopy({ state: 'idle' })
      failed(error)
    }
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
          <Button type="button" variant="outline" size="xs" title="把这个项目要处理的事全部写成一份提示词复制下来，粘贴给你用的 AI" disabled={copy.state === 'copying'} onClick={() => void copyForAi()}>
            <Copy />
            {copy.state === 'copying' ? '正在复制…' : '复制给 AI'}
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
      {copy.state === 'copied' && <p className="collab:m-0 collab:text-xs collab:break-all collab:text-success">{copy.text}</p>}
    </li>
  )
}

/** 在运行时只显示端口，完整地址放在悬停提示里；没运行时没有地址（端口启动时才挑），写「启动并打开」。点击都是启动并打开站点 */
function SiteLink({ site, onOpen }: { site: SiteRow; onOpen: () => void }): ReactElement {
  const state = siteStateOf(site)
  return (
    <span className="collab:inline-flex collab:items-center collab:gap-1 collab:text-xs">
      <Dot tone={state.tone} />
      <Button type="button" variant="ghost" size="xs" onClick={onOpen} title={site.url === null ? `协作站${state.label}` : `协作站${state.label} · ${site.url}`}>
        {site.url === null ? '启动并打开' : `端口 ${new URL(site.url).port}`}
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
