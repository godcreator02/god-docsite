import path from 'node:path'
import { siteFeedChannel, sitePathInRepo, type SiteFeed } from '@godcreator/collab'
import type { GwbDocsiteApi, SiteInitResult, SiteStarted } from '@godcreator/gwb-docsite'
import { messageOf } from '../errors.js'
import { repoKeyOf, type Project } from '../project/project.js'
import { featurePackage } from './site-files.js'

/** 用到的 gwb-docsite 服务方法：站点进程的启动与停止、状态、推数据、从零建站 */
export type DocsiteHosting = Pick<GwbDocsiteApi, 'start' | 'stop' | 'status' | 'push' | 'init'>

/** 窗格要的：url 在运行时是实际地址，没运行时是 gwb-docsite 按 site/package.json 的 dev 脚本预期的地址；起不来时的原因 */
export type SiteState = { url: string | null; running: boolean; error: string | null }

export type CollabSitesOptions = {
  docsite: DocsiteHosting
  /** 这个项目此刻推给站点的整份数据：通知与项目负责人 */
  feedOf: (repo: string) => Promise<SiteFeed>
  log: { warn: (message: string) => void }
}

const siteDirOf = (repo: string) => path.join(repo, sitePathInRepo)

/**
 * 项目站点交给 gwb-docsite（进程的启动与停止、状态、起不来的原因都是它做的）。
 * 这里只多两件事：插件加载、项目加进列表等时点确保站点在运行（start 幂等，起不来原因留在 gwb-docsite 的 status 里，
 * 与地基一样不自动重启，collab.site.start 重启）；通知或项目负责人一变就把整份数据推到频道 collab
 */
export class CollabSites {
  private readonly feedQueues = new Map<string, Promise<void>>()
  private readonly feedErrors = new Map<string, string>()
  /** 启动过或推过数据的项目（仓根键 → 仓根），插件卸载时停掉它们的站点 */
  private readonly touched = new Map<string, string>()

  constructor(private readonly options: CollabSitesOptions) {}

  stateOf(repo: string): SiteState {
    const status = this.options.docsite.status(siteDirOf(repo))
    return { url: status.url ?? status.expectedUrl, running: status.state === 'running', error: status.error }
  }

  /** 确保站点在运行：插件加载后、项目加进列表后调。start 幂等：已在运行或正在启动就复用 */
  async keep(repo: string): Promise<void> {
    const key = repoKeyOf(repo)
    this.touched.set(key, repo)
    await this.options.docsite.start(siteDirOf(repo))
    this.feedChanged(repo)
  }

  /** collab.site.start：交给 gwb-docsite 启动（幂等），回地址；要看页面把它交给 VS Code 的浏览器打开 */
  async start(project: Project): Promise<SiteStarted> {
    const started = await this.options.docsite.start(project.siteDir)
    this.feedChanged(project.repo)
    return started
  }

  stop(repo: string): Promise<{ url: string }> {
    return this.options.docsite.stop(siteDirOf(repo))
  }

  /**
   * collab.site.init：交给 gwb-docsite 从零建站（功能包写成给的范围），port 与 title 是新站的开发端口与站名；
   * 项目在列表里就启动并推一次数据
   */
  async init(repo: string, options: { featureRange: string; port: number; title: string; listed: boolean }): Promise<SiteInitResult> {
    const { featureRange, listed, ...newSite } = options
    const result = await this.options.docsite.init(siteDirOf(repo), { features: { [featurePackage]: featureRange }, ...newSite })
    if (listed) await this.keep(repo)
    return result
  }

  /** 自动同步快进进来改了 site/ 的提交之后：确保站点在运行（已在运行就不动、不重启），把最新的数据推过去 */
  async recheck(project: Project): Promise<void> {
    await this.keep(project.repo)
  }

  /**
   * 装依赖等要在站点停着时做的事：先停（本来就没运行就不停），做完 work，再启动并把数据推过去。
   * wasRunning 是做之前站点在不在运行；relaunched 是这一次启动了新的开发服务，启动时站点已被别处启动（alreadyRunning）为 false；起不来时报错
   */
  async whileStopped<T>(project: Project, work: (wasRunning: boolean) => Promise<T>): Promise<{ result: T; relaunched: boolean }> {
    const wasRunning = this.options.docsite.status(project.siteDir).state === 'running'
    if (wasRunning) await this.options.docsite.stop(project.siteDir)
    const result = await work(wasRunning)
    const started = await this.options.docsite.start(project.siteDir)
    this.feedChanged(project.repo)
    return { result, relaunched: !started.alreadyRunning }
  }

  /**
   * 这个项目的通知或项目负责人可能变了：读最新的一份推给 gwb-docsite（站点没在运行它就先记着，启动后补推）。
   * 排队一个一个推，接连变化时后推的一定是新的；推不上报出来，同样的原因不重复报
   */
  feedChanged(repo: string): void {
    const key = repoKeyOf(repo)
    this.touched.set(key, repo)
    const queued = (this.feedQueues.get(key) ?? Promise.resolve()).then(async () => {
      try {
        await this.options.docsite.push(siteDirOf(repo), siteFeedChannel, await this.options.feedOf(repo))
        this.feedErrors.delete(key)
      } catch (error) {
        const message = messageOf(error)
        if (this.feedErrors.get(key) !== message) this.options.log.warn(`${repo} 推给站点的数据没能推出去：${message}`)
        this.feedErrors.set(key, message)
      }
    })
    this.feedQueues.set(key, queued)
  }

  /** 项目移出列表：停掉站点，忘掉排着的推送 */
  async forget(repo: string): Promise<void> {
    const key = repoKeyOf(repo)
    this.feedErrors.delete(key)
    this.feedQueues.delete(key)
    this.touched.delete(key)
    const status = this.options.docsite.status(siteDirOf(repo))
    if (status.state === 'running') await this.options.docsite.stop(siteDirOf(repo))
  }

  /** 插件卸载：启动过的站点全部停掉 */
  async forgetAll(): Promise<void> {
    await Promise.all([...this.touched.values()].map((repo) => this.forget(repo)))
  }
}
