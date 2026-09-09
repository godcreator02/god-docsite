import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react'
import { createRoot } from 'react-dom/client'
import { BookOpenIcon, ClockIcon, ExternalLinkIcon, HammerIcon, PlayIcon, RefreshCwIcon, SquareIcon } from 'lucide-react'
import { cn } from 'cn'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatRemaining, WARN_BEFORE_MS } from '../deadline.js'

/**
 * 浏览器半：一格「文档站」。站清单按单元分组，每条一行：名字、livedoc 记号、build 状态、
 * 运行中显示端口与倒计时，按钮起 / 停 / 打开 / 重建 / 延长。
 *
 * 数据只走本件自己的命令（`live-doc.sites` 等）；实时那段走页面的公共面 `window.gwb.on`，
 * node 半经内核事件口推 `{ t: 'gwb-live-doc', kind: 'run' | 'selection' }`。**页面不认识
 * unit-folder**：置顶靠回包里的 `currentUnit` 与 selection 推送，那是 node 半局部注入
 * gwb-unit-folder 得来的；没装它 currentUnit 是 null，清单照常显示。
 *
 * 类名一律带 `livedoc:` 前缀——样式围栏就是这个前缀本身（见 ./styles.css）。**不是 `live-doc:`**：
 * Tailwind v4 的 prefix 只收 a-z。漏加前缀静默不出规则，tests/prefix.test.ts 钉着。
 */

const SITES_COMMAND = 'live-doc.sites'
const START_COMMAND = 'live-doc.start'
const STOP_COMMAND = 'live-doc.stop'
const OPEN_COMMAND = 'live-doc.open'
const EXTEND_COMMAND = 'live-doc.extend'

/** 内核事件口上认自己那条的记号，跟 node 半的 EVENT 是同一个字符串 */
const EVENT = 'gwb-live-doc'

/** 倒计时刷新间隔 */
const CLOCK_MS = 5_000

/** 外壳调 `mountPane` 时给的那几样。按形状收，不牵 shell 那个包的类型 */
interface PaneArgs {
  host: { call: (command: string, args?: unknown) => Promise<unknown> }
  shell: {
    openPane: (paneId: string, options?: { duplicate?: boolean }) => void
    bus: { emit: (type: string, detail?: unknown) => void; on: (type: string, listener: (detail: unknown) => void) => () => void }
  }
  pane: { id: string; instance: string }
}

/** 页面的公共面。按形状收——正本钉在内核的词汇表包上 */
declare global {
  interface Window {
    gwb: {
      command<T = unknown>(command: string, args?: unknown): Promise<T>
      on(cb: (payload: unknown) => void): () => void
    }
  }
}

type Phase = 'idle' | 'building' | 'starting' | 'running' | 'stopping'
type BuildState = 'missing' | 'fresh' | 'stale'

interface RunInfo {
  port: number
  pid?: number
  deadline?: number
  startedAt: number
  url: string
}

/** 与 node 半 `SiteInfo` 对应 */
interface SiteInfo {
  dir: string
  label: string
  unit: string
  unitPath: string
  unitPurpose?: string
  livedoc: boolean
  buildState: BuildState
  nodeModules: boolean
  phase: Phase
  running?: RunInfo
  lastError?: string
  lastExit?: number | null
}

interface SitesData {
  root: string
  rootExists: boolean
  currentUnit: string | null
  sites: SiteInfo[]
}

interface Reply<T> {
  ok?: boolean
  data?: T
  error?: string
  code?: string
}

/** node 半推来的运行态变化 */
interface RunPush {
  event: string
  state: { dir: string; phase: Phase; run?: RunInfo; lastError?: string; lastExit?: number | null }
}

type ListState =
  | { status: 'loading' }
  | { status: 'loaded'; data: SitesData }
  | { status: 'error'; message: string; unconfigured: boolean }

/** 单元 purpose 那句话切出短名：第一个中文分隔符之前（照 unit-folder 的切法，半角冒号不在列） */
function purposeHead(purpose: string): string {
  let at = -1
  for (const sep of ['：', '——', '，', '—', ' - ', ',']) {
    const index = purpose.indexOf(sep)
    if (index > 0 && (at === -1 || index < at)) at = index
  }
  return (at > 0 ? purpose.slice(0, at) : purpose).trim()
}

const BUILD_TEXT: Record<BuildState, string> = { fresh: '产物新鲜', stale: '源比产物新', missing: '没 build 过' }
const BUILD_TONE: Record<BuildState, string> = {
  fresh: 'livedoc:text-muted-foreground',
  stale: 'livedoc:text-amber-600 livedoc:dark:text-amber-400',
  missing: 'livedoc:text-muted-foreground livedoc:opacity-70',
}
const BUSY_TEXT: Partial<Record<Phase, string>> = { building: '构建中…', starting: '启动中…', stopping: '停止中…' }

function SiteRow({
  site,
  now,
  onStart,
  onStop,
  onOpen,
  onExtend,
}: {
  site: SiteInfo
  now: number
  onStart(dir: string, rebuild: boolean): void
  onStop(dir: string): void
  onOpen(dir: string): void
  onExtend(dir: string): void
}): ReactElement {
  const run = site.phase === 'running' ? site.running : undefined
  const remaining = run?.deadline === undefined ? undefined : run.deadline - now
  const nearDue = remaining !== undefined && remaining <= WARN_BEFORE_MS
  const busy = BUSY_TEXT[site.phase]

  return (
    <div className="livedoc:flex livedoc:flex-col livedoc:gap-1 livedoc:rounded-md livedoc:px-2 livedoc:py-1.5 livedoc:hover:bg-accent/40">
      <div className="livedoc:flex livedoc:flex-wrap livedoc:items-center livedoc:gap-2">
        <span className="livedoc:text-[13px] livedoc:font-medium">{site.label}</span>
        {site.livedoc && (
          <Badge variant="secondary" title="站根有 livedoc.config.mjs：接了 livedoc 的站">
            livedoc
          </Badge>
        )}
        <span className={cn('livedoc:text-xs', BUILD_TONE[site.buildState])} title="按 .next/BUILD_ID 的 mtime 对源树（content / src / public 与站根文件）的 mtime 判">
          {BUILD_TEXT[site.buildState]}
        </span>
        {run !== undefined && (
          <span className="livedoc:inline-flex livedoc:items-center livedoc:gap-1 livedoc:font-mono livedoc:text-xs livedoc:text-foreground" title={run.url}>
            :{run.port}
            {remaining !== undefined && (
              <span className={cn('livedoc:inline-flex livedoc:items-center livedoc:gap-0.5', nearDue ? 'livedoc:text-amber-600 livedoc:dark:text-amber-400' : 'livedoc:text-muted-foreground')}>
                <ClockIcon className="livedoc:size-3" />
                {formatRemaining(remaining)}
              </span>
            )}
          </span>
        )}
        {busy !== undefined && (
          <span className="livedoc:inline-flex livedoc:items-center livedoc:gap-1 livedoc:text-xs livedoc:text-muted-foreground">
            <RefreshCwIcon className="livedoc:size-3 livedoc:animate-spin" />
            {busy}
          </span>
        )}
        <span className="livedoc:flex-1" />
        <div className="livedoc:flex livedoc:flex-wrap livedoc:items-center livedoc:gap-1">
          {site.phase === 'idle' && !site.nodeModules && (
            <span className="livedoc:text-xs livedoc:text-muted-foreground" title={`先在 ${site.dir} 跑一遍 pnpm install`}>
              先 pnpm install
            </span>
          )}
          {site.phase === 'idle' && site.nodeModules && site.buildState === 'missing' && (
            <Button size="xs" onClick={() => onStart(site.dir, true)}>
              <HammerIcon />
              构建并起
            </Button>
          )}
          {site.phase === 'idle' && site.nodeModules && site.buildState === 'stale' && (
            <>
              <Button size="xs" onClick={() => onStart(site.dir, true)}>
                <HammerIcon />
                重建再起
              </Button>
              <Button size="xs" variant="secondary" onClick={() => onStart(site.dir, false)}>
                <PlayIcon />
                直接起
              </Button>
            </>
          )}
          {site.phase === 'idle' && site.nodeModules && site.buildState === 'fresh' && (
            <>
              <Button size="xs" onClick={() => onStart(site.dir, false)}>
                <PlayIcon />起
              </Button>
              <Button size="xs" variant="ghost" title="重新 pnpm run build 再起" onClick={() => onStart(site.dir, true)}>
                <HammerIcon />
                重建
              </Button>
            </>
          )}
          {run !== undefined && (
            <Button size="xs" onClick={() => onOpen(site.dir)}>
              <ExternalLinkIcon />
              打开
            </Button>
          )}
          {run !== undefined && nearDue && (
            <Button size="xs" variant="secondary" title="到期时刻从此刻按设置 auto-stop-minutes 重算" onClick={() => onExtend(site.dir)}>
              <ClockIcon />
              延长
            </Button>
          )}
          {(site.phase === 'running' || site.phase === 'building' || site.phase === 'starting') && (
            <Button size="xs" variant="ghost" title="杀整棵进程树" onClick={() => onStop(site.dir)}>
              <SquareIcon />停
            </Button>
          )}
        </div>
      </div>
      <div className="livedoc:truncate livedoc:font-mono livedoc:text-[10.5px] livedoc:text-muted-foreground/70" title={site.dir}>
        {site.dir}
      </div>
      {site.lastError !== undefined && site.phase === 'idle' && (
        <p className="livedoc:m-0 livedoc:text-xs livedoc:text-destructive livedoc:whitespace-pre-wrap">{site.lastError}</p>
      )}
    </div>
  )
}

function LiveDocPane({ args }: { args: PaneArgs }): ReactElement {
  const [list, setList] = useState<ListState>({ status: 'loading' })
  const [now, setNow] = useState(() => Date.now())
  const [notice, setNotice] = useState('')
  const token = useRef(0)

  const load = useCallback(() => {
    const mine = ++token.current
    void args.host.call(SITES_COMMAND).then(
      (res) => {
        if (mine !== token.current) return
        const reply = res as Reply<SitesData>
        if (reply.ok === true && reply.data !== undefined) setList({ status: 'loaded', data: reply.data })
        else setList({ status: 'error', message: reply.error ?? '扫描失败', unconfigured: reply.code === 'unconfigured' })
      },
      (err: unknown) => {
        if (mine === token.current) setList({ status: 'error', message: String(err), unconfigured: false })
      },
    )
  }, [args.host])

  useEffect(() => {
    load()
  }, [load])

  // 倒计时的表
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), CLOCK_MS)
    return () => clearInterval(timer)
  }, [])

  /** 一条站的运行态就地更新；清单里没有它就整表重拉 */
  const patch = useCallback((push: RunPush) => {
    setList((prev) => {
      if (prev.status !== 'loaded') return prev
      const index = prev.data.sites.findIndex((s) => s.dir === push.state.dir)
      if (index === -1) return prev
      const sites = prev.data.sites.slice()
      const old = sites[index]!
      const next: SiteInfo = { ...old, phase: push.state.phase }
      if (push.state.run !== undefined) next.running = push.state.run
      else delete next.running
      if (push.state.lastError !== undefined) next.lastError = push.state.lastError
      else delete next.lastError
      if (push.state.lastExit !== undefined) next.lastExit = push.state.lastExit
      sites[index] = next
      return { status: 'loaded', data: { ...prev.data, sites } }
    })
  }, [])

  useEffect(() => {
    // 事件口上什么件的事件都有，只认带自己记号的
    return window.gwb.on((payload) => {
      if (payload === null || typeof payload !== 'object') return
      const p = payload as { t?: unknown; kind?: unknown; state?: unknown; event?: unknown; currentUnit?: unknown }
      if (p.t !== EVENT) return
      if (p.kind === 'selection') {
        const currentUnit = typeof p.currentUnit === 'string' ? p.currentUnit : null
        setList((prev) => (prev.status === 'loaded' ? { status: 'loaded', data: { ...prev.data, currentUnit } } : prev))
        return
      }
      if (p.kind === 'run' && typeof p.state === 'object' && p.state !== null) {
        const push = { event: String(p.event), state: p.state as RunPush['state'] }
        patch(push)
        setNow(Date.now())
        // 起完、停完 build 状态可能变了（重建之后 stale → fresh），重扫一遍拿新鲜度
        if (push.event === 'started' || push.event === 'stopped' || push.event === 'failed') load()
        if (push.event === 'expired') setNotice(`${push.state.dir} 到点，自动关了`)
      }
    })
  }, [patch, load])

  const act = useCallback(
    (command: string, params: unknown, label: string) => {
      setNotice('')
      void args.host.call(command, params).then(
        (res) => {
          const reply = res as Reply<{ note?: string }>
          if (reply.ok === false) setNotice(`${label}没成：${reply.error ?? '没说原因'}`)
          else if (reply.data?.note !== undefined) setNotice(reply.data.note)
        },
        (err: unknown) => setNotice(`${label}调不通：${String(err)}`),
      )
    },
    [args.host],
  )

  const onStart = useCallback((dir: string, rebuild: boolean) => act(START_COMMAND, { dir, rebuild }, '起'), [act])
  const onStop = useCallback((dir: string) => act(STOP_COMMAND, { dir }, '停'), [act])
  const onOpen = useCallback((dir: string) => act(OPEN_COMMAND, { dir }, '打开'), [act])
  const onExtend = useCallback((dir: string) => act(EXTEND_COMMAND, { dir }, '延长'), [act])

  const data = list.status === 'loaded' ? list.data : null

  /** 按单元分组；当前选中的单元那组顶到最上 */
  const groups = useMemo(() => {
    if (data === null) return []
    const byUnit = new Map<string, SiteInfo[]>()
    for (const site of data.sites) {
      const bucket = byUnit.get(site.unit) ?? []
      bucket.push(site)
      byUnit.set(site.unit, bucket)
    }
    const all = [...byUnit.entries()].map(([unit, sites]) => ({
      unit,
      purpose: sites[0]?.unitPurpose,
      sites,
      current: data.currentUnit !== null && unit === data.currentUnit,
    }))
    all.sort((a, b) => Number(b.current) - Number(a.current) || a.unit.localeCompare(b.unit))
    return all
  }, [data])

  const runningCount = data?.sites.filter((s) => s.phase === 'running').length ?? 0

  return (
    <div className="livedoc:flex livedoc:h-full livedoc:flex-col livedoc:bg-background livedoc:text-foreground">
      <div className="livedoc:flex livedoc:flex-none livedoc:flex-wrap livedoc:items-center livedoc:gap-2 livedoc:border-b livedoc:border-border livedoc:px-3 livedoc:py-2">
        <BookOpenIcon className="livedoc:size-4 livedoc:text-muted-foreground" />
        <span className="livedoc:text-sm livedoc:font-semibold">文档站</span>
        {data !== null && (
          <span className="livedoc:font-mono livedoc:text-xs livedoc:text-muted-foreground">
            {data.sites.length} 个站{runningCount > 0 ? `，${runningCount} 个在跑` : ''}
          </span>
        )}
        {data !== null && (
          <span className="livedoc:max-w-56 livedoc:truncate livedoc:font-mono livedoc:text-xs livedoc:text-muted-foreground/70" title={data.root}>
            {data.root}
          </span>
        )}
        <span className="livedoc:flex-1" />
        <Button size="xs" variant="ghost" title="现扫一次" disabled={list.status === 'loading'} onClick={load}>
          <RefreshCwIcon className={cn(list.status === 'loading' && 'livedoc:animate-spin')} />
          重扫
        </Button>
      </div>

      {notice !== '' && (
        <p className="livedoc:m-0 livedoc:border-b livedoc:border-border livedoc:bg-muted/50 livedoc:px-3 livedoc:py-1.5 livedoc:text-xs livedoc:text-foreground">{notice}</p>
      )}

      <div className="livedoc:min-h-0 livedoc:flex-1 livedoc:overflow-y-auto livedoc:overflow-x-hidden livedoc:px-1 livedoc:py-1">
        {list.status === 'loading' && <p className="livedoc:m-0 livedoc:px-2 livedoc:py-4 livedoc:text-sm livedoc:text-muted-foreground">扫描中…</p>}
        {list.status === 'error' && (
          <p className={cn('livedoc:m-0 livedoc:px-2 livedoc:py-4 livedoc:text-sm', list.unconfigured ? 'livedoc:text-muted-foreground' : 'livedoc:text-destructive')}>
            {list.message}
          </p>
        )}
        {data !== null && !data.rootExists && (
          <p className="livedoc:m-0 livedoc:px-2 livedoc:py-4 livedoc:text-sm livedoc:text-muted-foreground">容器根不存在：{data.root}</p>
        )}
        {data !== null && data.rootExists && groups.length === 0 && (
          <p className="livedoc:m-0 livedoc:px-2 livedoc:py-4 livedoc:text-sm livedoc:text-muted-foreground">
            容器根下没有 fumadocs 站（每个单元限深三层找 package.json）。
          </p>
        )}
        {groups.map((group) => (
          <div
            key={group.unit}
            className={cn('livedoc:mb-1.5 livedoc:rounded-md', group.current && 'livedoc:bg-primary/8 livedoc:ring-1 livedoc:ring-primary/30')}
          >
            <div className="livedoc:flex livedoc:items-center livedoc:gap-2 livedoc:px-2 livedoc:pt-1.5 livedoc:pb-0.5">
              <span className={cn('livedoc:text-xs livedoc:font-semibold', group.current ? 'livedoc:text-primary' : 'livedoc:text-muted-foreground')}>
                {group.purpose === undefined ? group.unit : purposeHead(group.purpose)}
              </span>
              <span className="livedoc:font-mono livedoc:text-[10.5px] livedoc:text-muted-foreground/70">{group.unit}</span>
              {group.current && <Badge title="单元文件夹里当前选中的单元">当前</Badge>}
            </div>
            {group.sites.map((site) => (
              <SiteRow key={site.dir} site={site} now={now} onStart={onStart} onStop={onStop} onOpen={onOpen} onExtend={onExtend} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * 窗格件那半的入口。导出名是 `mountPane` 不是 `bootShell`——外壳占整页那个根，窗格占井里一格。
 * 契约要求**同步**返回 `{ dispose }`。
 */
export function mountPane(args: PaneArgs, container: HTMLElement): { dispose(): void } {
  const root = createRoot(container)
  // 认不出的 paneId 报错、不回落到 main：「注册了 x 却画出 main」是那种没有任何现象的错
  if (args.pane.id === 'main') root.render(<LiveDocPane args={args} />)
  else root.render(<p className="livedoc:p-3 livedoc:text-sm livedoc:text-destructive">本件没有叫 {args.pane.id} 的窗格</p>)
  return {
    dispose() {
      root.unmount()
      container.textContent = ''
    },
  }
}
