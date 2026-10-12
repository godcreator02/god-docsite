import path from 'node:path'
import { portsInScript } from './ports.js'
import { isRecord } from './vocab.js'

/** 托管登记表存在工作台数据里的这份文档：`{ sites: [{ dir }] }`，只记站目录，端口每次启动时从站的 start 脚本现读 */
export const HOSTED_SITES_DOC = 'hosted-sites'

/** 两个写法指同一个目录时认成同一个站：先 resolve，Windows 上再不分大小写 */
export function siteKeyOf(dir: string): string {
  const resolved = path.resolve(dir)
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved
}

/** 读登记表：还没有这份文档是空表；形状不对直接报错，不当成空表——那样会让托管着的站悄悄不再启动 */
export function parseHostedSitesDoc(value: unknown): string[] {
  if (value === undefined) return []
  const sites = isRecord(value) ? value['sites'] : undefined
  if (!Array.isArray(sites)) throw new Error(`工作台数据里的 ${HOSTED_SITES_DOC} 要是 { sites: [{ dir }] }`)
  return sites.map((entry: unknown, index) => {
    const dir = isRecord(entry) ? entry['dir'] : undefined
    if (typeof dir !== 'string' || !path.isAbsolute(dir)) throw new Error(`工作台数据里的 ${HOSTED_SITES_DOC} 第 ${String(index + 1)} 项的 dir 要是绝对路径`)
    return dir
  })
}

export function hostedSitesDoc(dirs: readonly string[]): { sites: { dir: string }[] } {
  return { sites: dirs.map((dir) => ({ dir })) }
}

/**
 * 站在哪个端口：读站 package.json 的 start 脚本里写死的那一个端口（`-p 4339` 这类），跟人手动 `pnpm start` 一致。
 * 没有 start 脚本、没写端口、写了不止一个，都报错并写明怎么改
 */
export function startPortOf(manifest: unknown, dir: string): number {
  const scripts = isRecord(manifest) ? manifest['scripts'] : undefined
  const start = isRecord(scripts) ? scripts['start'] : undefined
  if (typeof start !== 'string') throw new Error(`${dir}/package.json 没有 start 脚本；托管就是运行它，要写成 next start -p <端口> -H 127.0.0.1`)
  const ports = portsInScript(start)
  if (ports.length !== 1) throw new Error(`${dir}/package.json 的 start 脚本要写死一个端口（-p <端口>），现在是：${start}`)
  return ports[0]!
}
