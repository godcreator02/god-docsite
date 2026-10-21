import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useRevalidator } from 'react-router'
import type { ErrorPayload } from 'vite/types/hmrPayload.js'
import type { ViteHotContext } from 'vite/types/hot.js'
import {
  contentLayoutReportEvent,
  contentLayoutReportRequestEvent,
  dataDirsChangedEvent,
  selfContainedReportEvent,
  selfContainedReportRequestEvent,
  type ContentLayoutReport,
  type SelfContainedReport,
} from '../core/dev-events.js'

/** 浏览器里 Vite 开发服务的热更新连接；发布版与服务端渲染时没有 */
function viteHot(): ViteHotContext | undefined {
  return (import.meta as ImportMeta & { hot?: ViteHotContext }).hot
}

/** dev 下功能包登记的数据目录变了（站外改了任务记录、git 同步进来），重新取当前页的 loader 数据：就地更新，不整页刷新 */
export function RevalidateOnDataDirChange() {
  const revalidator = useRevalidator()
  const revalidate = useRef(revalidator.revalidate)
  revalidate.current = revalidator.revalidate
  useEffect(() => {
    const hot = viteHot()
    if (hot === undefined) return
    const onChange = () => void revalidate.current()
    hot.on(dataDirsChangedEvent, onChange)
    return () => hot.off(dataDirsChangedEvent, onChange)
  }, [])
  return null
}

/** 问题按钮里的一条：title 一行说清是什么，detail 是点开看的完整原话（文件、代码片段、调用栈） */
export interface DevIssue {
  title: string
  detail: string
}

/** 四类问题，按这个顺序分组显示 */
export type DevIssueSource = 'content-layout' | 'self-contained' | 'hot-update' | 'runtime'

export const devIssueSourceNames: Record<DevIssueSource, string> = {
  'content-layout': '内容放法（放好后自动消失）',
  'self-contained': '引用了本站没有的条目（补上后自动消失）',
  'hot-update': '改代码后编译失败（改好后自动消失）',
  runtime: '浏览器里的报错',
}

/** 放法检查的结果换成问题：没查成是一条，放错的每个文件一条（title 是文件，detail 是该怎么放） */
export function contentLayoutIssuesOf(report: ContentLayoutReport): DevIssue[] {
  if (report.checkError !== null) return [{ title: `内容目录 ${report.contentDir} 的放法这次没查成，增删文件后会再查`, detail: report.checkError }]
  return report.problems.map((problem) => {
    const separator = problem.indexOf('：')
    return separator === -1 ? { title: problem, detail: problem } : { title: `${report.contentDir}/${problem.slice(0, separator)}`, detail: problem.slice(separator + 1) }
  })
}

/** 自包含检查的结果换成问题：没查成是一条，每处一条（title 是写这处引用的文件，detail 是缺哪一条与补法） */
export function selfContainedIssuesOf(report: SelfContainedReport): DevIssue[] {
  if (report.checkError !== null) return [{ title: '自包含检查这次没查成，改文件后会再查', detail: report.checkError }]
  return report.problems.map(({ file, message }) => ({ title: file, detail: message }))
}

/** Vite 热更新失败推来的错误：title 是报错第一行，detail 依次是出错的文件与位置、代码片段、调用栈 */
export function hotUpdateIssueOf(err: ErrorPayload['err']): DevIssue {
  const where = err.id === undefined ? '' : `${err.id}${err.loc === undefined ? '' : `:${err.loc.line}:${err.loc.column}`}`
  return {
    title: err.message.split('\n')[0] ?? err.message,
    detail: [err.plugin === undefined ? '' : `插件 ${err.plugin}`, where, err.frame ?? '', err.stack].filter((part) => part !== '').join('\n\n'),
  }
}

/** 浏览器里没接住的报错：Error 取原话与调用栈，别的值转成文字 */
export function runtimeIssueOf(reason: unknown): DevIssue {
  if (reason instanceof Error) return { title: reason.message, detail: reason.stack ?? reason.message }
  const text = typeof reason === 'string' ? reason : JSON.stringify(reason) ?? String(reason)
  return { title: text, detail: text }
}

/** 浏览器报错最多留这么多条，同样的原话只留一条 */
const keptRuntimeIssueCount = 20

function withRuntimeIssue(issues: DevIssue[], issue: DevIssue): DevIssue[] {
  if (issues.some((each) => each.detail === issue.detail)) return issues
  return [...issues, issue].slice(-keptRuntimeIssueCount)
}

/** 此刻的四类问题。存在模块里、不放组件状态：页面渲染不出来时布局卸载、换成错误页，问题不能跟着丢 */
export interface DevIssues {
  layout: DevIssue[]
  selfContained: DevIssue[]
  hotUpdate: DevIssue[]
  runtime: DevIssue[]
}

const noDevIssues: DevIssues = { layout: [], selfContained: [], hotUpdate: [], runtime: [] }
let currentDevIssues = noDevIssues
const devIssueListeners = new Set<() => void>()
let devIssueSourcesWatched = false

function updateDevIssues(update: (issues: DevIssues) => DevIssues) {
  currentDevIssues = update(currentDevIssues)
  for (const listener of devIssueListeners) listener()
}

/** 浏览器里第一次用到问题清单时接上四个来源，之后整个页面生命周期都留着 */
function watchDevIssueSources() {
  if (devIssueSourcesWatched) return
  const hot = viteHot()
  if (hot === undefined) return
  devIssueSourcesWatched = true
  hot.on(contentLayoutReportEvent, (report: ContentLayoutReport) => updateDevIssues((issues) => ({ ...issues, layout: contentLayoutIssuesOf(report) })))
  hot.on(selfContainedReportEvent, (report: SelfContainedReport) => updateDevIssues((issues) => ({ ...issues, selfContained: selfContainedIssuesOf(report) })))
  hot.on('vite:error', (payload: ErrorPayload) => updateDevIssues((issues) => ({ ...issues, hotUpdate: [hotUpdateIssueOf(payload.err)] })))
  hot.on('vite:afterUpdate', () => updateDevIssues((issues) => ({ ...issues, hotUpdate: [] })))
  window.addEventListener('error', (event) => updateDevIssues((issues) => ({ ...issues, runtime: withRuntimeIssue(issues.runtime, runtimeIssueOf(event.error ?? event.message)) })))
  window.addEventListener('unhandledrejection', (event) => updateDevIssues((issues) => ({ ...issues, runtime: withRuntimeIssue(issues.runtime, runtimeIssueOf(event.reason)) })))
  hot.send(contentLayoutReportRequestEvent)
  hot.send(selfContainedReportRequestEvent)
}

function subscribeDevIssues(listener: () => void) {
  devIssueListeners.add(listener)
  return () => devIssueListeners.delete(listener)
}

/** dev 下此刻的问题清单，变了就重新渲染；发布版与服务端渲染时一直是空的 */
export function useDevIssues(): DevIssues {
  useEffect(watchDevIssueSources, [])
  return useSyncExternalStore(
    subscribeDevIssues,
    () => currentDevIssues,
    () => noDevIssues,
  )
}

/**
 * dev 下的问题按钮：放在顶上正中那一行（TopNotices）的最前面，带数字，点开列出四类问题，每条再点开看完整原话。
 * 放法与自包含的问题随检查结果变；热更新失败在下一次热更新成功时清掉；浏览器报错由人点「清空」。Vite 自带的报错层由平台的 vite 插件关掉，改由这里显示
 */
export function DevIssuesButton() {
  const { layout: layoutIssues, selfContained: selfContainedIssues, hotUpdate: hotUpdateIssues, runtime: runtimeIssues } = useDevIssues()
  const [open, setOpen] = useState(false)
  const clearRuntimeIssues = () => updateDevIssues((issues) => ({ ...issues, runtime: [] }))
  const groups: Array<[DevIssueSource, DevIssue[]]> = [
    ['content-layout', layoutIssues],
    ['self-contained', selfContainedIssues],
    ['hot-update', hotUpdateIssues],
    ['runtime', runtimeIssues],
  ]
  const count = layoutIssues.length + selfContainedIssues.length + hotUpdateIssues.length + runtimeIssues.length
  if (count === 0) return null
  const hasErrors = hotUpdateIssues.length + runtimeIssues.length > 0
  return (
    <div data-dev-issues>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="pointer-events-auto inline-flex items-center gap-2 rounded-lg bg-fd-popover px-2.5 py-1.5 text-[13px] font-medium whitespace-nowrap text-fd-popover-foreground shadow-lg ring-1 ring-fd-border hover:bg-fd-accent"
      >
        <span aria-hidden className={`size-2 rounded-full ${hasErrors ? 'bg-red-500' : 'bg-amber-500'}`} />
        {count} 个问题
      </button>
      {open ? (
        <section
          aria-label="开发服务报出的问题"
          className="pointer-events-auto absolute inset-x-0 top-full mx-auto mt-1.5 flex max-h-[min(60vh,32rem)] w-[min(40rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-xl border bg-fd-popover text-xs text-fd-popover-foreground shadow-xl"
        >
          <header className="flex items-center gap-2 border-b px-3 py-2">
            <h2 className="flex-1 text-sm font-semibold">开发时的问题（{count}）</h2>
            {runtimeIssues.length > 0 ? (
              <button type="button" onClick={clearRuntimeIssues} className="rounded px-2 py-1 text-fd-muted-foreground hover:bg-fd-accent hover:text-fd-accent-foreground">
                清空浏览器报错
              </button>
            ) : null}
            <button type="button" aria-label="收起" onClick={() => setOpen(false)} className="rounded px-2 py-1 text-fd-muted-foreground hover:bg-fd-accent hover:text-fd-accent-foreground">
              ×
            </button>
          </header>
          <div className="overflow-y-auto px-3 py-2">
            {groups
              .filter(([, issues]) => issues.length > 0)
              .map(([source, issues]) => (
                <div key={source} data-dev-issue-group={source} className="py-1">
                  <h3 className={`mb-1 font-medium ${source === 'content-layout' || source === 'self-contained' ? 'text-amber-700 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}`}>{devIssueSourceNames[source]}</h3>
                  <ul className="list-none space-y-1">
                    {issues.map((issue) => (
                      <li key={`${issue.title}\n${issue.detail}`}>
                        <details className="rounded-lg border px-2 py-1.5">
                          <summary className="cursor-pointer break-all">{issue.title}</summary>
                          <pre className="mt-2 max-h-64 overflow-auto text-[11px] whitespace-pre-wrap break-all text-fd-muted-foreground">{issue.detail}</pre>
                        </details>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}

/** dev 下开发服务断开（崩溃或正在重启）时盖住整页：页面上的东西都是旧的、点了也没反应；Vite 连回来后会自己刷新页面 */
export function DevServerLostScreen() {
  const [lost, setLost] = useState(false)
  useEffect(() => {
    const hot = viteHot()
    if (hot === undefined) return
    const onDisconnect = () => setLost(true)
    const onConnect = () => setLost(false)
    hot.on('vite:ws:disconnect', onDisconnect)
    hot.on('vite:ws:connect', onConnect)
    return () => {
      hot.off('vite:ws:disconnect', onDisconnect)
      hot.off('vite:ws:connect', onConnect)
    }
  }, [])
  if (!lost) return null
  return (
    <div data-dev-server-lost role="alert" className="not-prose fixed inset-0 z-[100] flex items-center justify-center bg-fd-background/90 px-4 backdrop-blur-sm">
      <div className="max-w-md rounded-xl border bg-fd-card p-6 text-center text-fd-card-foreground shadow-xl">
        <p className="text-lg font-semibold">开发服务断开了</p>
        <p className="mt-2 text-sm text-fd-muted-foreground">站点的开发服务退出了或正在重启，页面上的内容可能是旧的。连上以后页面会自己刷新；一直连不上就去工作台的「站点」窗格看它的状态。</p>
      </div>
    </div>
  )
}

/** 平台两个布局（文档页与首页）与错误页里放的 dev 更新：数据目录变了重新取数据、开发服务断开的全屏提示；问题按钮另放在 TopNotices 里。发布版里什么也不做 */
export function DevSiteUpdates() {
  return (
    <>
      <RevalidateOnDataDirChange />
      <DevServerLostScreen />
    </>
  )
}
