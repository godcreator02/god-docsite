import { Service, type Context } from 'cordis'
import type { JoiningPerson } from '@godcreator/identity'
import type { SiteFeatureAdded, SiteFeatureOptions } from './scaffold/add-feature.js'
import type { SiteInitOptions, SiteInitResult } from './scaffold/create.js'
import type { SiteStarted, SiteStatus } from './site-host.js'

/**
 * 别的插件注入的服务 gwbDocsite：建站与加功能、托管站点的开发服务（常驻的站只记在 gwb-data 的 hosted-sites 里，别的插件的站也经 add 登记）、往站点推数据、本 home 的身份码。
 * 站点都建在平台包 @godcreator/god-docsite 上，站点根有身份文件 docsite.json（类别与布局代号，建站时写）。站点目录都写绝对路径；同一个站点目录大小写、斜杠不同的写法算同一个
 */
export interface GwbDocsiteApi {
  /** 本 home 的身份码（设置 identity-code），开发服务按它在站点的 people.json 里认人 */
  identityCode(): string
  /**
   * 托管一个站点：登记为常驻（已登记的不重复写）再启动，之后工作台每次启动都启动它。启动不了抛 Error，登记照留。
   * by 是谁登记的，显示在站点窗格里：别的插件写自己的名字（gwb-collab 写 gwb-collab），不给记成 docsite.site.add
   */
  add(dir: string, options?: { by?: string }): Promise<SiteStatus>
  /** 不再托管：去掉常驻登记，在运行就停掉。registered 为 false 是本来就没登记 */
  remove(dir: string): Promise<{ registered: boolean }>
  /** 启动站点的开发服务：已在运行或正在启动就复用，不重复启动。启动不了抛 Error，消息写明原因 */
  start(dir: string): Promise<SiteStarted>
  /** 停掉站点的开发服务；没在运行就抛 Error */
  stop(dir: string): Promise<{ url: string }>
  /** 此刻的样子（running / stopped / failed） */
  status(dir: string): SiteStatus
  /** 往站点的推送通道推一份数据（频道只用字母、数字、_、-）：POST 到站点的 __docsite/feed/<频道>，带这次启动的推送令牌；站点没在运行就抛 Error */
  push(dir: string, channel: string, data: unknown): Promise<void>
  /** 把本 home 的身份码加进站点的 people.json：已有这个 id 就加进它的 codes，没有就新加一项；changed 为 false 是本来就在 */
  join(dir: string, person: JoiningPerson): Promise<{ changed: boolean }>
  /** 某个站的状态变了（启动、停止、出错）时调用；返回撤掉的函数 */
  onStatus(listener: (dir: string) => void): () => void
  /**
   * 从空目录建站：平台建站器复制模板（平台包的版本取插件旁边装着的那几个）、按 options.kind 写身份文件 docsite.json、pnpm install、起服务检查首页。
   * 骨架写完就归站点；要功能再 addFeature
   */
  init(dir: string, options: SiteInitOptions): Promise<SiteInitResult>
  /**
   * 给已有站点加一个功能：pnpm add 功能包，平台建站器补 app/features/<功能名>/ 里缺的文件、重写功能汇总文件，再起服务检查首页。
   * 重复运行只补缺的；站点在运行时拒绝
   */
  addFeature(dir: string, options: SiteFeatureOptions): Promise<SiteFeatureAdded>
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
  add(dir: string, options?: { by?: string }) {
    return this.api.add(dir, options)
  }
  remove(dir: string) {
    return this.api.remove(dir)
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
  addFeature(dir: string, options: SiteFeatureOptions) {
    return this.api.addFeature(dir, options)
  }
}
