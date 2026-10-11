import { Service, type Context } from 'cordis'
import type { SiteStarted, SiteStatus } from './site-host.js'
import type { JoiningPerson } from './people-file.js'
import type { SiteInitOptions, SiteInitResult } from './site-init.js'

/**
 * 别的插件注入的服务 gwbDocsite：托管站点的开发服务、往站点推数据、本 home 的身份码。
 * 站点目录都写绝对路径；同一个站点目录大小写、斜杠不同的写法算同一个
 */
export interface GwbDocsiteApi {
  /** 本 home 的身份码（设置 identity-code），开发服务按它在站点的 people.json 里认人 */
  identityCode(): string
  /** 托管一个站：开发服务常驻，意外退出就重启，5 分钟内失败 3 次就停下、原因记在 status 的 error 里。启动前就失败（没装依赖、站点检查不过）的只记下原因 */
  keep(dir: string): Promise<void>
  /** 不再托管：停掉，忘掉它的推送 */
  forget(dir: string): Promise<void>
  /** 人为启动（清掉人为停止与连续失败的记录）；启动不了抛 Error，消息写明原因 */
  start(dir: string): Promise<SiteStarted>
  /** 启动（没在运行时）并照设置 site-window 打开 */
  open(dir: string): Promise<SiteStarted>
  /** 人为停止：这次加载期间不自动启动，直到 start */
  stop(dir: string): Promise<{ url: string }>
  /** 此刻的样子 */
  status(dir: string): SiteStatus
  /** 先停，做完 work 再按常驻的规矩启动；装依赖、换站点文件时用 */
  whileStopped<T>(dir: string, work: () => Promise<T>): Promise<{ result: T; relaunched: boolean }>
  /** 往站点的推送通道推一份数据（频道只用字母、数字、_、-）；站点没在运行就只记下，启动后补推 */
  push(dir: string, channel: string, data: unknown): void
  /** 把本 home 的身份码加进站点的 people.json：已有这个 id 就加进它的 codes，没有就新加一项；changed 为 false 是本来就在 */
  join(dir: string, person: JoiningPerson): Promise<{ changed: boolean }>
  /** 某个站的状态变了（启动、停止、出错）时调用；返回撤掉的函数 */
  onStatus(listener: (dir: string) => void): () => void
  /** 初始化站点或更新它的骨架：照装好的基础包与功能包的模板写 app/ 与配置，装依赖；content/、comments/、people.json 不动。在运行就先停、做完再启动 */
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
  keep(dir: string) {
    return this.api.keep(dir)
  }
  forget(dir: string) {
    return this.api.forget(dir)
  }
  start(dir: string) {
    return this.api.start(dir)
  }
  open(dir: string) {
    return this.api.open(dir)
  }
  stop(dir: string) {
    return this.api.stop(dir)
  }
  status(dir: string) {
    return this.api.status(dir)
  }
  whileStopped<T>(dir: string, work: () => Promise<T>) {
    return this.api.whileStopped(dir, work)
  }
  push(dir: string, channel: string, data: unknown) {
    this.api.push(dir, channel, data)
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
