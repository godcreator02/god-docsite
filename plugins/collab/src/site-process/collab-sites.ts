import path from 'node:path'
import { siteFeedChannel, type SiteFeed } from '@godcreator/collab-model/notification-model'
import { sitePathInRepo } from '@godcreator/collab-model/project-model'
import type { GwbDocsiteApi, SiteInitResult, SiteStarted } from '@godcreator/gwb-docsite'
import { CollabRejected, messageOf } from '../errors.js'
import { repoKeyOf, type Project } from '../project/project.js'
import { featurePackage } from './site-files.js'

/** 用到的 gwb-docsite 服务方法 */
export type DocsiteHosting = Pick<GwbDocsiteApi, 'keep' | 'forget' | 'open' | 'stop' | 'status' | 'whileStopped' | 'push' | 'init'>

/** 窗格要的：url 在运行时是实际地址，没运行时是 gwb-docsite 按 site/package.json 的 dev 脚本预期的地址；启动前就失败、常驻失败停下时的原因 */
export type SiteState = { url: string | null; running: boolean; error: string | null }

export type CollabSitesOptions = {
  docsite: DocsiteHosting
  /** 交给 gwb-docsite 托管之前的检查：不过就抛 CollabRejected，写明原因。生产里是 requireCollabSitePasses */
  checkSite: (siteDir: string) => Promise<void>
  /** 这个项目此刻推给站点的整份数据：通知与项目负责人 */
  feedOf: (repo: string) => Promise<SiteFeed>
  log: { warn: (message: string) => void }
}

const siteDirOf = (repo: string) => path.join(repo, sitePathInRepo)

/**
 * 项目站点交给 gwb-docsite 托管（常驻、重启、打开、推数据都是它做）；这里只多两件事：
 * 托管之前查一遍协议号与站点，不过就不托管、记下原因；通知或项目负责人一变就把整份数据推到频道 collab
 */
export class CollabSites {
  /** 托管之前的检查没过的原因，按仓根记 */
  private readonly checkFailures = new Map<string, string>()
  private readonly feedQueues = new Map<string, Promise<void>>()
  private readonly feedErrors = new Map<string, string>()
  /** 交给过 gwb-docsite 的项目（托管过或推过数据），插件卸载时都要撤掉：仓根键 → 仓根 */
  private readonly touched = new Map<string, string>()

  constructor(private readonly options: CollabSitesOptions) {}

  stateOf(repo: string): SiteState {
    const status = this.options.docsite.status(siteDirOf(repo))
    return { url: status.url ?? status.expectedUrl, running: status.running, error: this.checkFailures.get(repoKeyOf(repo)) ?? status.error }
  }

  /** 查过就记下或清掉原因；没过回 false */
  private async passesCheck(repo: string): Promise<boolean> {
    const key = repoKeyOf(repo)
    this.touched.set(key, repo)
    try {
      await this.options.checkSite(siteDirOf(repo))
    } catch (error) {
      if (!(error instanceof CollabRejected)) throw error
      this.checkFailures.set(key, error.message)
      this.options.log.warn(`${repo} 的站点没有交给 gwb-docsite 托管：${error.message}`)
      return false
    }
    this.checkFailures.delete(key)
    return true
  }

  /** 常驻：插件加载后、项目加进列表后调。检查不过只记下原因 */
  async keep(repo: string): Promise<void> {
    if (!(await this.passesCheck(repo))) return
    await this.options.docsite.keep(siteDirOf(repo))
    this.feedChanged(repo)
  }

  /** collab.site.start：查过就交给 gwb-docsite 启动并打开（人为停止、连续失败停下的记录一并清掉）；检查不过就拒绝 */
  async start(project: Project): Promise<SiteStarted> {
    if (!(await this.passesCheck(project.repo))) throw new CollabRejected(this.checkFailures.get(repoKeyOf(project.repo))!)
    const started = await this.options.docsite.open(project.siteDir)
    this.feedChanged(project.repo)
    return started
  }

  stop(repo: string): Promise<{ url: string }> {
    return this.options.docsite.stop(siteDirOf(repo))
  }

  /**
   * collab.site.init：交给 gwb-docsite 初始化站点或照新模板更新骨架，功能包写成 featureRange；
   * 项目在列表里就再查一遍，通过了就托管
   */
  async init(repo: string, options: { featureRange: string; port?: number; title?: string; listed: boolean }): Promise<SiteInitResult> {
    const { featureRange, listed, ...newSite } = options
    const result = await this.options.docsite.init(siteDirOf(repo), { features: { [featurePackage]: featureRange }, ...newSite })
    if (listed) await this.keep(repo)
    return result
  }

  /**
   * 自动同步快进进来改了 site/ 的提交之后再查一遍：不过就停掉、不再托管，记下原因；通过了就托管（人为停止的 gwb-docsite 不启动）
   */
  async recheck(project: Project): Promise<void> {
    if (await this.passesCheck(project.repo)) {
      await this.options.docsite.keep(project.siteDir)
      this.feedChanged(project.repo)
      return
    }
    await this.options.docsite.forget(project.siteDir)
  }

  /**
   * 装依赖用：gwb-docsite 先停、做完 work 再按常驻的规矩启动；装完协议号可能变了，所以再查一遍，不过就停掉。
   * wasRunning 是做之前站点在不在运行
   */
  async whileStopped<T>(project: Project, work: (wasRunning: boolean) => Promise<T>): Promise<{ result: T; relaunched: boolean }> {
    const wasRunning = this.options.docsite.status(project.siteDir).running
    const done = await this.options.docsite.whileStopped(project.siteDir, () => work(wasRunning))
    if (await this.passesCheck(project.repo)) return done
    await this.options.docsite.forget(project.siteDir)
    return { result: done.result, relaunched: false }
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
        this.options.docsite.push(siteDirOf(repo), siteFeedChannel, await this.options.feedOf(repo))
        this.feedErrors.delete(key)
      } catch (error) {
        const message = messageOf(error)
        if (this.feedErrors.get(key) !== message) this.options.log.warn(`${repo} 推给站点的数据没能推出去：${message}`)
        this.feedErrors.set(key, message)
      }
    })
    this.feedQueues.set(key, queued)
  }

  /** 项目移出列表：gwb-docsite 停掉它、忘掉它的推送，这里忘掉检查的原因 */
  async forget(repo: string): Promise<void> {
    const key = repoKeyOf(repo)
    this.checkFailures.delete(key)
    this.feedErrors.delete(key)
    this.feedQueues.delete(key)
    this.touched.delete(key)
    await this.options.docsite.forget(siteDirOf(repo))
  }

  /** 插件卸载：交给 gwb-docsite 的站点全部停掉、不再托管 */
  async forgetAll(): Promise<void> {
    await Promise.all([...this.touched.values()].map((repo) => this.forget(repo)))
  }
}
