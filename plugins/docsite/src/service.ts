import { Service, type Context } from 'cordis'
import type { SiteIdentity } from '@godcreator/god-docsite/identity'
import type { JoiningPerson } from '@godcreator/identity'
import type { StoredThread } from './comments.js'
import type { SiteFeatureAdded, SiteFeatureOptions } from './scaffold/add-feature.js'
import type { SiteInitOptions, SiteInitResult } from './scaffold/create.js'
import type { MdxCheck } from './scaffold/platform.js'
import type { SiteCheck } from './site-check.js'
import type { SiteStarted, SiteStatus } from './site-host.js'

/**
 * 别的插件注入的服务 gwbDocsite：建站与加功能、托管站点的开发服务（常驻的站只记在 gwb-data 的 hosted-sites 里，别的插件的站也经 add 登记）、往站点推数据与订阅站点的频道、本 home 的身份码、给个人站提供本机目录，以及不要站点在运行的几样检查与读取（一页外部 mdx、整个站点、一个评论目录）。
 * 站点都建在平台包 @godcreator/god-docsite 上，站点根有身份文件 docsite.json（类别与布局代号，建站时写）。站点目录都写绝对路径；同一个站点目录大小写、斜杠不同的写法算同一个
 */
export interface GwbDocsiteApi {
  /** 本 home 的身份码（设置 identity-code），开发服务按它在站点的 people.json 里认人 */
  identityCode(): string
  /**
   * 站点根身份文件 docsite.json 写的类别（kind）、给谁看（audience）与布局代号；没有这个文件为 null，写错了、布局代号不是这一版认的抛 Error。
   * 别的插件要判断一个站给不给别人看（比如只往 audience 为 shared 的站里发布）就调它
   */
  siteIdentity(dir: string): SiteIdentity | null
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
  /**
   * 订阅站点推送通道的一个频道，带着这次启动的推送令牌（站点由此知道启动方在听，见平台包的 siteFeedHasLauncher）：站点在运行就马上连上，
   * 之后每次启动都重新连；连上时先收到频道现在的值，之后每变一次收一次。频道名不对抛 Error。返回撤掉订阅的函数
   */
  subscribe(dir: string, channel: string, listener: (data: unknown) => void): () => void
  /** 把本 home 的身份码加进站点的 people.json：已有这个 id 就加进它的 codes，没有就新加一项；changed 为 false 是本来就在 */
  join(dir: string, person: JoiningPerson): Promise<{ changed: boolean }>
  /**
   * 提供一个本机目录给个人站（audience 为 personal）：放进托管方上下文的 dirs（名字到绝对路径），在运行的站马上收到，站点的功能包经站点上下文的 providedDirs() 读。
   * 名字是功能包和插件约好的小写词；同一个名字只许一个插件提供，第二个抛 Error 写明谁先提供的目录。返回撤销的函数，放进 ctx.effect 里
   */
  provideSiteDir(name: string, dir: string): () => void
  /**
   * 一页外部 mdx（不在站点 content/ 里，功能包的路由请求时编译的那种）编译过不过，不过时带编译器原话：frontmatter、MDX 语法、import、越出 rootDir 的图片地址。
   * 用插件旁边装的平台包编译，站点不用在运行；不加载站点的组件表，查不出组件名写错
   */
  checkMdx(file: string, options: { rootDir: string }): Promise<MdxCheck>
  /** 在站点目录里运行站点自己那一版的 docsite-check（内容放法、shared 站引用的条目本站都有）；没跑起来抛 Error，查出问题照常回 passed: false */
  checkSite(dir: string): Promise<SiteCheck>
  /** 读一个评论目录里的全部评论串（论文、资料旁边的 comments/），照文件原样回，作者是人员 id；目录不存在回空 */
  readComments(commentsDir: string): Promise<StoredThread[]>
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
  siteIdentity(dir: string) {
    return this.api.siteIdentity(dir)
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
  subscribe(dir: string, channel: string, listener: (data: unknown) => void) {
    return this.api.subscribe(dir, channel, listener)
  }
  join(dir: string, person: JoiningPerson) {
    return this.api.join(dir, person)
  }
  provideSiteDir(name: string, dir: string) {
    return this.api.provideSiteDir(name, dir)
  }
  checkMdx(file: string, options: { rootDir: string }) {
    return this.api.checkMdx(file, options)
  }
  checkSite(dir: string) {
    return this.api.checkSite(dir)
  }
  readComments(commentsDir: string) {
    return this.api.readComments(commentsDir)
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
