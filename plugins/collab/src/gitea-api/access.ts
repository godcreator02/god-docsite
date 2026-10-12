import type { GwbContext } from '@godcreator/gwb-kernel-desktop'
import type { GwbGiteaApi } from '@godcreator/gwb-gitea'
import { CollabRejected } from '../errors.js'
import type { GiteaHttp } from './gitea.js'

export type CommandBus = NonNullable<GwbContext['gwbCommands']>

/** gwb-gitea 设置里配的 Gitea：地址、令牌，和令牌对应的账号 */
export type GiteaAccount = { baseUrl: string; token: string; login: string }

/** 与 gwb-gitea 的写法一致：去掉结尾的 /，没写协议的当 https */
export function normalizeBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/+$/, '')
  return trimmed.includes('://') ? trimmed : `https://${trimmed}`
}

/** gwb-gitea 设置里的 push-url：http(s)://主机[:端口]，不带路径；不对就报错，不替它改 */
export function pushUrlOf(value: unknown): string {
  if (typeof value !== 'string' || !/^https?:\/\/[^/]+$/.test(value)) throw new CollabRejected(`gwb-gitea 的设置 push-url 要是 http(s)://主机[:端口]，不带路径，现在是 ${JSON.stringify(value)}`)
  return value
}

/** 经 gwb-gitea 的服务用 Gitea：转发接口请求、现读地址与令牌、令牌对应的账号、和 Gitea 同一台机器上的推送地址 */
export type GiteaAccess = {
  http: GiteaHttp
  /** 每次现读：人在设置里换了令牌，下一条命令就用新的。本插件不另存令牌 */
  account(): Promise<GiteaAccount>
  pushUrl(): Promise<string>
}

/** currentGitea 回局部注入拿到的服务 gwbGitea；gwb-gitea 没装或停用时回 null */
export function giteaAccessOf(currentGitea: () => GwbGiteaApi | null): GiteaAccess {
  const giteaService = (): GwbGiteaApi => {
    const service = currentGitea()
    if (service === null) throw new CollabRejected('gwb-gitea 没装或没启用：在插件管理里装上并启用 gwb-gitea（0.1.16 以上）')
    return service
  }

  const http: GiteaHttp = async (request) => {
    const service = giteaService()
    try {
      const response = await service.http(request)
      return { status: response.status, body: response.body }
    } catch (error) {
      throw new CollabRejected(`gwb-gitea 没能发出请求：${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /** 令牌对应的 Gitea 账号：同一个令牌只问一次 */
  const loginsByToken = new Map<string, string>()

  const account = async (): Promise<GiteaAccount> => {
    const { baseUrl, token } = giteaService().connection()
    if (token === '') throw new CollabRejected('还没填 Gitea 令牌：在 gwb 的设置里给 gwb-gitea 填 token，或经 credentials.copy / credentials.import 配置（Gitea 网页「设置 → 应用」里生成）')
    let login = loginsByToken.get(token)
    if (login === undefined) {
      const me = await http({ method: 'GET', path: '/user' })
      if (me.status === 401) throw new CollabRejected('Gitea 不认这个令牌（401）：在 gwb-gitea 的设置里换一个没过期的 token')
      const found = (me.body as { login?: unknown } | null)?.login
      if (me.status !== 200 || typeof found !== 'string') throw new CollabRejected(`向 Gitea 查令牌的账号失败：${me.status} ${JSON.stringify(me.body)}`)
      login = found
      loginsByToken.set(token, login)
    }
    return { baseUrl: normalizeBaseUrl(baseUrl), token, login }
  }

  /** gwb-gitea 设置里推送服务的地址：它和 Gitea 在同一台机器上，跟 base-url 一起换 */
  const pushUrl = async (): Promise<string> => pushUrlOf(giteaService().connection().pushUrl)

  return { http, account, pushUrl }
}
