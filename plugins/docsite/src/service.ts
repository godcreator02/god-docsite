import { Service, type Context } from 'cordis'
import type { JoiningPerson } from './people-file.js'
import type { SiteInitOptions, SiteInitResult } from './site-init.js'
import type { SiteStarted, SiteStatus } from './site-host.js'

/**
 * 别的插件注入的服务 gwbDocsite：托管站点的开发服务、往站点推数据、本 home 的身份码。
 * 站点目录都写绝对路径；同一个站点目录大小写、斜杠不同的写法算同一个
 */
export interface GwbDocsiteApi {
  /** 本 home 的身份码（设置 identity-code），开发服务按它在站点的 people.json 里认人 */
  identityCode(): string
  /** 启动站点的开发服务：已在运行或正在启动就复用，不重复启动。启动不了抛 Error，消息写明原因 */
  start(dir: string): Promise<SiteStarted>
  /** 停掉站点的开发服务；没在运行就抛 Error */
  stop(dir: string): Promise<{ url: string }>
  /** 此刻的样子（running / stopped / failed） */
  status(dir: string): SiteStatus
  /** 往站点的推送通道推一份数据（频道只用字母、数字、_、-）；站点没在运行就抛 Error */
  push(dir: string, channel: string, data: unknown): Promise<void>
  /** 把本 home 的身份码加进站点的 people.json：已有这个 id 就加进它的 codes，没有就新加一项；changed 为 false 是本来就在 */
  join(dir: string, person: JoiningPerson): Promise<{ changed: boolean }>
  /** 某个站的状态变了（启动、停止、出错）时调用；返回撤掉的函数 */
  onStatus(listener: (dir: string) => void): () => void
  /**
   * 从零建站：拉功能包模板、在内存里组装整棵站点树（骨架模板从自述站派生、随插件发布）、一次写盘、
   * 一次 pnpm install、起服务检查首页（content/、comments/、people.json 是新站的起始物）。
   * 骨架写完就归站点，没有更新已有站点骨架的通道；已有站点再调就拒绝
   */
  init(dir: string, options: SiteInitOptions): Promise<SiteInitResult>
}

/** 只存闭包：cordis 读服务属性时会把属性里存的服务重新绑到调用方上下文 */
export class DocsiteService extends Service implements GwbDocsiteApi {
  constructor(
    ctx: Context,
    private readonly api: GwbDocsiteApi,
  ) {
    super(ctx, 'gwbDocsite')
  }
  identityCode() {
    return this.api.identityCode()
  }
  start(dir: string) {
    return this.api.start(dir)
  }
  stop(dir: string) {
    return this.api.stop(dir)
  }
  status(dir: string) {
    return this.api.status(dir)
  }
  push(dir: string, channel: string, data: unknown) {
    return this.api.push(dir, channel, data)
  }
  join(dir: string, person: JoiningPerson) {
    return this.api.join(dir, person)
  }
  onStatus(listener: (dir: string) => void) {
    return this.api.onStatus(listener)
  }
  init(dir: string, options: SiteInitOptions) {
    return this.api.init(dir, options)
  }
}
