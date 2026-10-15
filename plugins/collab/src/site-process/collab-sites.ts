import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { collabPathInRepo, journalDirName, mergeWorkflowPathInRepo, siteFeedChannel, sitePathInRepo, type SiteFeed } from '@godcreator/collab'
import type { GwbDocsiteApi, SiteFeatureAdded, SiteInitResult } from '@godcreator/gwb-docsite'
import { CollabRejected, messageOf } from '../errors.js'
import { repoKeyOf, sameRepo, type Project } from '../project/project.js'
import { featurePackage } from './site-files.js'

/** 用到的 gwb-docsite 服务方法：登记与撤销常驻、站点进程的启动与停止、状态与状态变化、推数据、从零建站、加功能 */
export type DocsiteHosting = Pick<GwbDocsiteApi, 'add' | 'remove' | 'start' | 'stop' | 'status' | 'onStatus' | 'push' | 'init' | 'addFeature'>

/** collab.site.init 的结果：gwb-docsite 建的基础站、加上的协作功能、自动合并工作流（written 为 false 是仓里已经有、没动）、写成项目首页的文件 */
export type CollabSiteInitResult = SiteInitResult & { feature: SiteFeatureAdded; mergeWorkflow: { path: string; written: boolean }; homePage: string }

/** 站点的首页文件（平台模板的 index 路由），相对站点目录 */
const homePageInSite = 'app/routes/home.tsx'

/** 窗格要的：dir 是站点目录；url 只在运行时有（端口启动时才挑）；起不来时的原因 */
export type SiteState = { dir: string; url: string | null; running: boolean; error: string | null }

export type CollabSitesOptions = {
  docsite: DocsiteHosting
  /** 这个项目此刻推给站点的整份数据：通知、提示词与项目负责人 */
  feedOf: (repo: string) => Promise<SiteFeed>
  /** 项目列表里的仓根：站点状态变了时按它认出是哪个项目的站 */
  listedProjects: () => string[]
  log: { warn: (message: string) => void }
}

const siteDirOf = (repo: string) => path.join(repo, sitePathInRepo)

/**
 * 站点运行时会被写入的两个目录：仓根的 collab/（任务与模块）与站点的 journal/（日志）。协作功能的 styles.css 用 @source not
 * 把它们排除出 Tailwind 的扫描，目录要在开发服务启动前就存在才生效；否则一写入就整页刷新、推送连接断掉
 */
function createDirsWrittenWhileRunning(repo: string): void {
  mkdirSync(path.join(repo, collabPathInRepo), { recursive: true })
  mkdirSync(path.join(siteDirOf(repo), journalDirName), { recursive: true })
}

/** 协作仓里还没有自动合并工作流就写进去，回写没写；已有的是负责人管的（升检查工具的版本就是改它），不覆盖 */
function writeMergeWorkflowIfMissing(repo: string, mergeWorkflow: string): boolean {
  const file = path.join(repo, mergeWorkflowPathInRepo)
  if (existsSync(file)) return false
  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(file, mergeWorkflow)
  return true
}

/**
 * 项目站点交给 gwb-docsite 托管：常驻的站只记在它的设置 sites 里，进程的启停、状态、起不来的原因、工作台启动时拉起都是它做的。
 * 这里只做三件事：项目加进列表（以及插件加载、自动同步改了 site/ 之后）登记站点，移出列表撤销登记；
 * 站点一转成运行就把整份数据推到频道 collab（gwb-docsite 的 onStatus），通知、提示词或项目负责人一变也推
 */
export class CollabSites {
  private readonly feedQueues = new Map<string, Promise<void>>()
  private readonly feedErrors = new Map<string, string>()

  constructor(private readonly options: CollabSitesOptions) {}

  stateOf(repo: string): SiteState {
    const status = this.options.docsite.status(siteDirOf(repo))
    return { dir: status.dir, url: status.url, running: status.state === 'running', error: status.error }
  }

  /**
   * 交给 gwb-docsite 常驻（登记进设置 sites 再启动；已登记、已在运行就不动），再推一次数据（站点可能在本插件接上 onStatus 之前就起来了）。
   * site/ 还没建就报错、不登记：等项目负责人 collab.site.init
   */
  async host(repo: string): Promise<void> {
    if (!existsSync(path.join(siteDirOf(repo), 'package.json'))) throw new CollabRejected(`${repo} 里还没有站点 ${sitePathInRepo}/：项目负责人用 collab.site.init 建站`)
    await this.options.docsite.add(siteDirOf(repo))
    this.feedChanged(repo)
  }

  /** 接到 gwb-docsite 的站点状态变化：是列表里某个项目的站、且转成了运行，就把数据推过去；返回撤掉的函数 */
  watchStatus(): () => void {
    return this.options.docsite.onStatus((dir) => {
      const repo = this.options.listedProjects().find((each) => sameRepo(siteDirOf(each), dir))
      if (repo !== undefined && this.options.docsite.status(dir).state === 'running') this.feedChanged(repo)
    })
  }

  /**
   * collab.site.init：交给 gwb-docsite 从零建基础站，建好站点运行时会写入的目录，仓里没有自动合并工作流就写进去，再加协作功能（功能包写成给的范围；
   * 加功能时 gwb-docsite 会起服务检查首页），最后把平台模板的首页换成协作功能的项目首页（homePage 是它的原文）；
   * title 是新站的站名；项目在列表里就交给 gwb-docsite 常驻
   */
  async init(repo: string, options: { featureRange: string; mergeWorkflow: string; homePage: string; title: string; listed: boolean }): Promise<CollabSiteInitResult> {
    const { featureRange, mergeWorkflow, homePage, listed, ...newSite } = options
    const siteDir = siteDirOf(repo)
    const created = await this.options.docsite.init(siteDir, newSite)
    createDirsWrittenWhileRunning(repo)
    const mergeWorkflowWritten = writeMergeWorkflowIfMissing(repo, mergeWorkflow)
    // 站点目录已登记在 gwb-docsite 的设置 sites 里时（项目在列表里、重建站点），建站检查完首页它保持运行；加功能要站点停着
    if (this.options.docsite.status(siteDir).state === 'running') await this.options.docsite.stop(siteDir)
    const feature = await this.options.docsite.addFeature(siteDir, { packageName: featurePackage, specifier: featureRange })
    // 项目首页 import 协作功能的接线文件（app/features/collab/），要等加完功能再写
    writeFileSync(path.join(siteDir, homePageInSite), homePage)
    if (listed) await this.host(repo)
    return { ...created, feature, mergeWorkflow: { path: mergeWorkflowPathInRepo, written: mergeWorkflowWritten }, homePage: `${sitePathInRepo}/${homePageInSite}` }
  }

  /** 自动同步快进进来改了 site/ 的提交之后：确保站点登记着、在运行（已在运行就不动、不重启），把最新的数据推过去 */
  async recheck(project: Project): Promise<void> {
    await this.host(project.repo)
  }

  /**
   * 装依赖等要在站点停着时做的事：先停（本来就没运行就不停），做完 work，再启动；启动后的推送由 onStatus 做。
   * wasRunning 是做之前站点在不在运行；relaunched 是这一次启动了新的开发服务，启动时站点已被别处启动（alreadyRunning）为 false；起不来时报错
   */
  async whileStopped<T>(project: Project, work: (wasRunning: boolean) => Promise<T>): Promise<{ result: T; relaunched: boolean }> {
    const wasRunning = this.options.docsite.status(project.siteDir).state === 'running'
    if (wasRunning) await this.options.docsite.stop(project.siteDir)
    const result = await work(wasRunning)
    const started = await this.options.docsite.start(project.siteDir)
    return { result, relaunched: !started.alreadyRunning }
  }

  /**
   * 这个项目的通知、提示词或项目负责人可能变了：站点在运行就读最新的一份推给 gwb-docsite；没在运行就不推，启动时 onStatus 会补推。
   * 排队一个一个推，接连变化时后推的一定是新的；推不上报出来，同样的原因不重复报
   */
  feedChanged(repo: string): void {
    const key = repoKeyOf(repo)
    const queued = (this.feedQueues.get(key) ?? Promise.resolve()).then(async () => {
      if (this.options.docsite.status(siteDirOf(repo)).state !== 'running') return
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

  /** 项目移出列表：撤销 gwb-docsite 的登记并停掉站点，忘掉排着的推送 */
  async unhost(repo: string): Promise<void> {
    const key = repoKeyOf(repo)
    this.feedErrors.delete(key)
    this.feedQueues.delete(key)
    await this.options.docsite.remove(siteDirOf(repo))
  }
}
