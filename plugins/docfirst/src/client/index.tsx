import { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import type { GwbResult } from '@godcreator/gwb-commands/client'
import type { HostBridge, PaneArgs, PaneHandle, ShellBridge } from '@godcreator/gwb-shell/pane'
import { firstLine, REFRESH_MS, remainingText, shortName, SITE_LIST_COMMAND, statusLabel, statusTone, type SiteRow } from './site-rows.js'

const STATUS_CLASS: Record<ReturnType<typeof statusTone>, string> = {
  normal: 'docfirst:shrink-0',
  error: 'docfirst:shrink-0 docfirst:text-destructive',
  muted: 'docfirst:shrink-0 docfirst:text-muted-foreground',
}

async function listSites(host: HostBridge): Promise<SiteRow[]> {
  const reply = (await host.call(SITE_LIST_COMMAND, {})) as GwbResult<{ sites: SiteRow[] }>
  if (!reply.ok) throw new Error(`${SITE_LIST_COMMAND} 没成功：${reply.error ?? '回执没写原因'}`)
  return reply.data?.sites ?? []
}

/** 只显示，不带按钮：开关、重启都由 agent 调 docfirst.site.* 做 */
function SitesPane({ host, shell }: { host: HostBridge; shell: ShellBridge }) {
  const [sites, setSites] = useState<SiteRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    let refreshTimer: ReturnType<typeof setInterval> | undefined
    let tickTimer: ReturnType<typeof setInterval> | undefined
    const refresh = () => {
      listSites(host).then(
        (rows) => {
          setSites(rows)
          setError(null)
        },
        (reason: unknown) => setError(reason instanceof Error ? reason.message : String(reason)),
      )
    }
    const stopVisibility = shell.onVisibility((visible) => {
      clearInterval(refreshTimer)
      clearInterval(tickTimer)
      if (!visible) return
      refresh()
      setNow(Date.now())
      refreshTimer = setInterval(refresh, REFRESH_MS)
      tickTimer = setInterval(() => setNow(Date.now()), 1000)
    })
    return () => {
      stopVisibility()
      clearInterval(refreshTimer)
      clearInterval(tickTimer)
    }
  }, [host, shell])

  return (
    <div className="docfirst:flex docfirst:h-full docfirst:flex-col docfirst:gap-3 docfirst:overflow-auto docfirst:p-4 docfirst:text-sm">
      {error !== null ? <p className="docfirst:text-destructive">{error}</p> : null}
      {sites === null && error === null ? <p className="docfirst:text-muted-foreground">读取中…</p> : null}
      {sites !== null && sites.length === 0 ? <p className="docfirst:text-muted-foreground">没有托管的文档站。让 agent 调 docfirst.site.add 登记一个。</p> : null}
      {sites?.map((site) => (
        <div key={site.dir} className="docfirst:flex docfirst:flex-col docfirst:gap-1 docfirst:rounded-md docfirst:border docfirst:border-border docfirst:p-3">
          <div className="docfirst:flex docfirst:items-baseline docfirst:justify-between docfirst:gap-3">
            <span className="docfirst:truncate docfirst:font-medium" title={site.dir}>
              {shortName(site.dir)}
            </span>
            <span className={STATUS_CLASS[statusTone(site.status)]}>{statusLabel(site.status)}</span>
          </div>
          <div className="docfirst:flex docfirst:justify-between docfirst:gap-3 docfirst:text-muted-foreground">
            <span>{site.url ?? (site.port === null ? '' : `端口 ${String(site.port)}`)}</span>
            {site.expiresAt !== null ? <span className="docfirst:shrink-0">还剩 {remainingText(site.expiresAt, now)}</span> : null}
          </div>
          {site.error !== null ? (
            <p className="docfirst:truncate docfirst:text-destructive" title={site.error}>
              {firstLine(site.error)}
            </p>
          ) : null}
        </div>
      ))}
    </div>
  )
}

export function mountPane(args: PaneArgs, container: HTMLElement): PaneHandle {
  const root = createRoot(container)
  root.render(<SitesPane host={args.host} shell={args.shell} />)
  return {
    dispose() {
      root.unmount()
      container.replaceChildren()
    },
  }
}
