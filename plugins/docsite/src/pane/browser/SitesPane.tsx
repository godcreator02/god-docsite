import type { HostBridge, ShellBridge } from '@godcreator/gwb-shell/pane'
import { ExternalLink, Play, Square, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react'
import { Button } from '@/components/ui/button'
import { canUnhost, kindOf, receiptOf, siteNameOf, siteStateOf, sourceOf, type Receipt, type SiteRow, type Tone } from './sites'

/** 窗格看得见时多久重读一次列表：只读本机内存与各站的 meta.json，很快 */
const refreshMilliseconds = 5_000

function useSiteList(host: HostBridge, shell: ShellBridge): { list: Receipt<{ sites: SiteRow[] }> | undefined; refresh: () => Promise<void> } {
  const [list, setList] = useState<Receipt<{ sites: SiteRow[] }> | undefined>(undefined)
  const mounted = useRef(true)

  const refresh = useCallback(async () => {
    const reply = receiptOf<{ sites: SiteRow[] }>(await host.call('docsite.site.list'))
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

/** 调一条站点命令（参数只有 dir），交回回执；做完都重读一次列表 */
type RunSiteCommand = (command: string, dir: string) => Promise<Receipt<unknown>>

/** 站点窗格：gwb-docsite 托管的每个站一行，能打开、启停；手动登记的还能不再托管。建站、加功能这些事由人让自己的 AI 调命令 */
export function SitesPane({ host, shell }: { host: HostBridge; shell: ShellBridge }): ReactElement {
  const { list, refresh } = useSiteList(host, shell)
  const run = useCallback<RunSiteCommand>(
    async (command, dir) => {
      const reply = receiptOf<unknown>(await host.call(command, { dir }))
      await refresh()
      return reply
    },
    [host, refresh],
  )

  if (list === undefined) return <p className="docsite:m-0 docsite:p-4 docsite:text-sm docsite:text-muted-foreground">正在读站点列表…</p>
  if (!list.ok) return <p className="docsite:m-0 docsite:p-4 docsite:text-sm docsite:whitespace-pre-wrap docsite:text-destructive">{list.error}</p>

  const { sites } = list.data
  return (
    <div className="docsite:flex docsite:flex-col docsite:gap-3 docsite:p-4">
      <p className="docsite:m-0 docsite:text-xs docsite:text-muted-foreground">
        gwb-docsite 在后台运行的文档站与协作站。常驻的站工作台每次启动都会启动；协作站随协作窗格的项目列表登记与撤销。
      </p>
      {sites.length === 0 ? (
        <p className="docsite:m-0 docsite:text-sm docsite:text-muted-foreground">还没有站点。让你的 AI 用 docsite.site.add 托管一个站，或在协作窗格里加项目。</p>
      ) : (
        <ul className="docsite:m-0 docsite:flex docsite:list-none docsite:flex-col docsite:gap-2 docsite:p-0">
          {sites.map((site) => (
            <SiteLine key={site.dir} site={site} run={run} />
          ))}
        </ul>
      )}
    </div>
  )
}

const dotToneClass: Record<Tone, string> = {
  ok: 'docsite:bg-success',
  bad: 'docsite:bg-destructive',
  muted: 'docsite:bg-muted-foreground/40',
}

function Dot({ tone }: { tone: Tone }): ReactElement {
  return <span className={`docsite:inline-block docsite:size-2 docsite:shrink-0 docsite:rounded-full ${dotToneClass[tone]}`} aria-hidden />
}

function Notice({ text }: { text: string }): ReactElement {
  return (
    <p className="docsite:m-0 docsite:rounded-md docsite:border docsite:border-destructive/40 docsite:bg-destructive/10 docsite:px-3 docsite:py-2 docsite:text-xs docsite:whitespace-pre-wrap docsite:break-all docsite:text-destructive">
      {text}
    </p>
  )
}

/** 一个站一行：站名、类别、来源、状态与端口，右边打开、启停、不再托管；站点出错或这一行的操作失败时原因写在下面 */
function SiteLine({ site, run }: { site: SiteRow; run: RunSiteCommand }): ReactElement {
  const state = siteStateOf(site)
  const kind = kindOf(site)
  const source = sourceOf(site)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [confirmingUnhost, setConfirmingUnhost] = useState(false)

  /** after 收到的是这条命令回执的 data，形状照各命令的 usage */
  const act = <T,>(command: string, after?: (data: T) => void) => {
    setBusy(true)
    setActionError(null)
    void run(command, site.dir)
      .then((reply) => {
        if (!reply.ok) setActionError(reply.error)
        else after?.(reply.data as T)
      })
      .catch((error: unknown) => setActionError(error instanceof Error ? error.message : String(error)))
      .finally(() => setBusy(false))
  }
  const open = () => act('docsite.site.open')
  const reason = site.error ?? actionError

  return (
    <li className="docsite:flex docsite:flex-col docsite:gap-1.5 docsite:rounded-lg docsite:border docsite:border-border docsite:bg-card docsite:px-3 docsite:py-2">
      <div className="docsite:flex docsite:flex-wrap docsite:items-center docsite:gap-x-2 docsite:gap-y-1">
        <span className="docsite:min-w-0 docsite:truncate docsite:text-sm docsite:font-medium docsite:text-foreground">{siteNameOf(site)}</span>
        <span className="docsite:rounded-full docsite:border docsite:border-border docsite:px-2 docsite:py-0.5 docsite:text-xs docsite:text-foreground" title={kind.title}>
          {kind.label}
        </span>
        <span className="docsite:rounded-full docsite:bg-muted docsite:px-2 docsite:py-0.5 docsite:text-xs docsite:text-muted-foreground" title={source.title}>
          {source.label}
        </span>
        <span className="docsite:inline-flex docsite:items-center docsite:gap-1.5 docsite:text-xs docsite:text-muted-foreground" title={site.url ?? undefined}>
          <Dot tone={state.tone} />
          {state.label}
          {site.url !== null && ` · 端口 ${new URL(site.url).port}`}
        </span>
        <span className="docsite:ml-auto docsite:flex docsite:shrink-0 docsite:items-center docsite:gap-1">
          <Button type="button" variant="ghost" size="xs" disabled={busy} title={site.url === null ? '启动并在 Chrome 应用窗口里打开' : `在 Chrome 应用窗口里打开 ${site.url}`} onClick={open}>
            <ExternalLink />
            打开
          </Button>
          {site.state === 'running' ? (
            <Button type="button" variant="ghost" size="xs" disabled={busy} title="停掉这个站的开发服务；常驻的站下次工作台启动时还会启动" onClick={() => act('docsite.site.stop')}>
              <Square />
              停止
            </Button>
          ) : (
            <Button type="button" variant="ghost" size="xs" disabled={busy} title="启动这个站的开发服务" onClick={() => act('docsite.site.start')}>
              <Play />
              启动
            </Button>
          )}
          {canUnhost(site) &&
            (confirmingUnhost ? (
              <>
                <Button type="button" variant="destructive" size="xs" disabled={busy} onClick={() => act('docsite.site.remove', () => setConfirmingUnhost(false))}>
                  确认不再托管
                </Button>
                <Button type="button" variant="ghost" size="xs" disabled={busy} onClick={() => setConfirmingUnhost(false)}>
                  取消
                </Button>
              </>
            ) : (
              <Button type="button" variant="ghost" size="icon-xs" disabled={busy} title="不再托管：停掉并去掉常驻登记，站点目录不动" aria-label="不再托管" onClick={() => setConfirmingUnhost(true)}>
                <X />
              </Button>
            ))}
        </span>
      </div>
      <span className="docsite:truncate docsite:text-xs docsite:text-muted-foreground" title={site.dir}>
        {site.dir}
      </span>
      {reason !== null && <Notice text={reason} />}
    </li>
  )
}
