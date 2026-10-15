import { browserHostOf, devOriginEnvName } from '../core/site-origin.js'
import type { DocsiteContext } from './site-context.js'

/** 启动方可以直接给出可信 origin（如经反向代理访问时），给了就只认它 */
export const siteOriginEnvName = 'DOCSITE_ORIGIN'

function checkedOrigin(value: string, envName: string): string {
  let url: URL
  try {
    url = new URL(value)
  } catch (error) {
    if (error instanceof TypeError) throw new Error(`${envName} 不是网址：${value}`)
    throw error
  }
  if (url.origin !== value) throw new Error(`${envName} 只写 origin（协议、主机、端口），不带路径和末尾的斜杠：收到 ${value}，应写 ${url.origin}`)
  return value
}

/**
 * 站点的可信 origin：写入请求的 Origin 头要和它完全一样。规则：
 * - 设了 DOCSITE_ORIGIN 就是它；
 * - dev（react-router dev）：平台的 vite 插件定下端口后写的 DOCSITE_DEV_ORIGIN；没有就是开发服务没经 godDocsite() 启动，报错；
 * - start（docsite-serve 或 react-router-serve）：端口取环境变量 PORT，主机取 HOST（没写是 localhost）；没设 PORT 报错，因为 react-router-serve 会自己挑空闲端口
 */
export function siteOrigin(mode: DocsiteContext['mode'], { env = process.env }: { env?: NodeJS.ProcessEnv } = {}): string {
  const configured = env[siteOriginEnvName]
  if (configured !== undefined) return checkedOrigin(configured, siteOriginEnvName)
  if (mode === 'dev') {
    const devOrigin = env[devOriginEnvName]
    if (devOrigin === undefined) throw new Error(`算不出可信 origin：开发服务没经平台的 vite 插件 godDocsite() 启动（它定下端口后写 ${devOriginEnvName}），或者设 ${siteOriginEnvName}`)
    return checkedOrigin(devOrigin, devOriginEnvName)
  }
  const port = env['PORT']
  if (port === undefined || port === '') throw new Error(`算不出可信 origin：发布版用 docsite-serve 启动（它挑端口、设 PORT），或者设环境变量 PORT 或 ${siteOriginEnvName}`)
  return `http://${browserHostOf(env['HOST'])}:${port}`
}
