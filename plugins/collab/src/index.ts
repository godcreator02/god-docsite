import type { GwbContext } from '@godcreator/gwb-kernel-desktop'
// 空的类型 import 只为让这几个包的 `declare module 'cordis'` 生效，ctx 上才有 timer 与各服务的类型
import type {} from '@cordisjs/plugin-timer'
import type {} from '@godcreator/gwb-commands'
import type {} from '@godcreator/gwb-settings'
import type { GwbShellApi } from '@godcreator/gwb-shell'
import type {} from '@godcreator/gwb-skills'
import type {} from '@godcreator/gwb-data'
import type { GwbGiteaApi } from '@godcreator/gwb-gitea'
import type { GwbQqBotApi } from '@godcreator/gwb-qq-bot'
import type {} from '@godcreator/gwb-docsite'
import { shell } from 'electron'
import { registerAiCommands } from './ai-prompt/commands.js'
import { CollabRepoLeads } from './collab-repo/leads.js'
import { registerRecordCommands } from './collab-repo/records/commands.js'
import { collabRecordsStateOf } from './collab-repo/records/inbox.js'
import { CollabRepoRules } from './collab-repo/rules.js'
import { registerCollabRepoCommands } from './collab-repo/submit/commands.js'
import { SubmitFailures } from './collab-repo/submit/submit-failures.js'
import { CollabRepoSync } from './collab-repo/sync/state.js'
import { openProjectAt, remoteProjectAt, type PluginServices } from './commands.js'
import { messageOf } from './errors.js'
import { giteaAccessOf } from './gitea-api/access.js'
import { ProjectNotifications } from './notifications/project-notifications.js'
import { QqPrivateChat, sentNotificationsDocKey } from './notifications/qq-private-chat.js'
import { registerOrganizationEventCommands } from './organization/events/commands.js'
import { ProjectEvents } from './organization/events/project-events.js'
import { WebhookChecks } from './organization/events/webhook.js'
import { registerOrganizationSetupCommands } from './organization/setup/commands.js'
import { organizationSourceOf } from './other-repos/fetch/clone-new-repos.js'
import { registerOtherRepoCommands } from './other-repos/fetch/commands.js'
import { OtherReposFetch } from './other-repos/fetch/state.js'
import { OtherReposReview } from './other-repos/review.js'
import { OtherReposRules } from './other-repos/rules.js'
import { registerPaneCommands } from './pane/commands.js'
import { QqTaskGroups, qqCommandsDocKey } from './project/qq-task-groups.js'
import { RepoChangeRelay } from './project/repo-change-relay.js'
import { CollabSites } from './site-process/collab-sites.js'
import { registerSiteCommands } from './site-process/commands.js'
import { pnpmInstall } from './site-process/dependencies.js'

export const name = 'gwb-collab'

/**
 * 站点由 gwb-docsite 托管，身份码也由它保管，所以它在顶层注入里。
 * 外壳与说明书服务不在：没装外壳只是没有窗格，没装说明书服务只是读不到说明书，检查照常
 */
export const inject = ['gwbCommands', 'gwbSettings', 'gwbData', 'gwbDocsite', 'timer']

/** 产物在 dist/index.js，说明书目录是它上一级的 skills/；gwbSkills 只扫这个目录的子目录 */
const skillsDir = new URL('../skills/', import.meta.url)

/** 浏览器侧与样式表的地址，注册窗格时报给外壳；构建产物里它们与本模块同在 dist/ 下 */
const clientUrl = new URL('./client.js', import.meta.url).href
const styleUrl = new URL('./style.css', import.meta.url).href

/** 一个仓的文件或引用接连变化时，停下这么久没有新变化才重算 */
const repoSettleMilliseconds = 300

const settingDefinitions = [
  {
    key: 'qq-notifications',
    type: 'boolean',
    title: 'QQ 通知',
    description: '网站提示栏里出现新的通知、连续 1 分钟还在，就经 QQ 私聊主人，一条通知只发一次（只存在几秒的中间状态与本机还没提交审核的文件不发）；需要同 home 装了 gwb-qq-bot 并配好 owner-openid',
    default: false,
  },
  { key: 'projects', type: 'string-list', title: '项目', description: '要管理的项目仓根，一行一个绝对路径；collab.project.clone、collab.project.add 会写到这里', default: [] },
] as const

/** 装配：Gitea、站点，协作仓与别的仓两套各目录、组织事件、通知与 QQ 私聊，再按领域登记命令（含交给 AI 的提示词）、窗格与说明书 */
export function apply(ctx: GwbContext): void {
  const log = ctx.logger(name)
  const commands = ctx.gwbCommands
  // 命令总线在类型上是可选的（内核也声明了它）；inject 保证了它在，不在就是加载顺序出了错，直接报
  if (commands === undefined) throw new Error('ctx.gwbCommands 不在：inject 里写了它，cordis 本不该调用 apply')
  const settings = ctx.gwbSettings

  ctx.effect(() => {
    const undefineAll = settingDefinitions.map((definition) => settings.define({ ...definition }))
    return () => {
      for (const undefine of undefineAll) undefine()
    }
  })

  // gwb-gitea 也局部注入：它没装时插件照常加载，用到 Gitea 的命令再报「没装或没启用」
  let giteaService: GwbGiteaApi | null = null
  ctx.inject(['gwbGitea'], (scoped) => {
    scoped.effect(() => { giteaService = scoped.gwbGitea ?? null; return () => { giteaService = null } })
  })
  const gitea = giteaAccessOf(() => giteaService)

  // QQ 通知与 QQ 任务组用到的服务是可有可无的：装了才有，卸了自动撤掉；在 QQ 任务组建好之后再注入
  let qqBot: GwbQqBotApi | null = null

  // 两边各目录的状态一变就交给通知，并重对一遍 QQ 任务组（站名可能变了）；通知建好后再接上
  const repoChanges = new RepoChangeRelay()
  const changed = repoChanges.changed
  const resyncQqTaskGroups = (synced: Promise<void>) => void synced.catch((error: unknown) => log.warn(`QQ 任务组没能按现状注册：${messageOf(error)}`))

  // 按项目注册的 QQ 任务组：项目列表、本 home 的 QQ 命令与站名一变就按现状重新注册；项目列表在组织事件建好之后才读
  const qqTaskGroups: QqTaskGroups = new QqTaskGroups({
    projects: () => events.listed().projects,
    read: () => ctx.gwbData.readDoc(qqCommandsDocKey),
    write: (value) => ctx.gwbData.writeDoc(qqCommandsDocKey, value),
    warn: (text) => log.warn(text),
  })

  const docsite = ctx.gwbDocsite
  const openProject = (repo: string) => openProjectAt({ docsite }, repo)
  const sites: CollabSites = new CollabSites({ docsite, feedOf: (repo) => notifications.feedOf(repo), log })
  ctx.effect(() => () => sites.forgetAll())

  // 协作仓那一套
  const submitFailures = new SubmitFailures(changed)
  const collabSync = new CollabRepoSync({
    sites,
    install: pnpmInstall,
    onChange: changed,
    onNothingToSubmit: (repo) => submitFailures.record(repo, null),
    log,
    now: () => new Date(),
    settleMilliseconds: repoSettleMilliseconds,
  })
  ctx.effect(() => () => collabSync.closeAll())
  const collabLeads = new CollabRepoLeads(gitea.http, changed)
  const collabRules = new CollabRepoRules(gitea.http, changed)

  // 别的仓那一套
  const otherFetch = new OtherReposFetch({ onChange: changed, log, settleMilliseconds: repoSettleMilliseconds })
  ctx.effect(() => () => otherFetch.closeAll())
  const otherReview = new OtherReposReview(gitea.http, changed)
  const otherRules = new OtherReposRules(gitea.http, changed)

  // 组织级的
  const webhooks = new WebhookChecks(gitea.http, changed)
  const events: ProjectEvents = new ProjectEvents({
    log,
    projectsSetting: { get: () => settings.get('projects'), set: (projects) => settings.set('projects', projects) },
    gitea,
    openProject,
    openRemote: (repo) => remoteProjectAt({ docsite, gitea }, repo),
    sites,
    collabRepo: {
      startWatching: (repo) => collabSync.startWatching(repo),
      fetch: (project) => collabSync.fetch(project),
      autoSync: (project) => collabSync.autoSync(project),
      readLeads: (project) => collabLeads.refresh(project),
      checkRules: (project) => collabRules.check(project),
      forget: (repo) => {
        collabSync.forget(repo)
        collabLeads.forget(repo)
        collabRules.forget(repo)
        submitFailures.forget(repo)
      },
    },
    otherRepos: {
      startWatching: (repo) => otherFetch.startWatching(repo),
      cloneMissing: (project) => otherFetch.cloneMissing(project, organizationSourceOf(gitea.http, project.gitea.owner, project.gitea.ownerUrl)),
      fetch: (project, name) => otherFetch.fetch(project, name),
      review: (project, name) => otherReview.review(project, name),
      checkRules: (project, name) => otherRules.check(project, name),
      retainOnly: (repo, names) => {
        otherReview.retainOnly(repo, names)
        otherRules.retainOnly(repo, names)
      },
      forget: (repo) => {
        otherFetch.forget(repo)
        otherReview.forget(repo)
        otherRules.forget(repo)
      },
    },
    webhooks,
    onChange: changed,
    onListChanged: (repo, change) => resyncQqTaskGroups(change === 'removed' ? qqTaskGroups.forget(repo) : qqTaskGroups.sync()),
    setTimeout: (run, milliseconds) => {
      ctx.timeout(run, milliseconds)
    },
    now: () => new Date(),
  })
  ctx.effect(() => () => events.stop())

  // 通知与接口 B
  const qqPrivateChat = new QqPrivateChat({
    enabled: () => settings.get('qq-notifications') === true,
    qqBot: () => qqBot,
    read: () => ctx.gwbData.readDoc(sentNotificationsDocKey),
    write: (value) => ctx.gwbData.writeDoc(sentNotificationsDocKey, value),
    setTimeout: (run, milliseconds) => {
      ctx.timeout(run, milliseconds)
    },
    warn: (text) => log.warn(text),
    now: () => new Date(),
  })
  ctx.effect(() => () => qqPrivateChat.close())
  const notifications: ProjectNotifications = new ProjectNotifications({
    readers: {
      openProject,
      collabLocalStateOf: (repo) => collabSync.localStateOf(repo),
      syncProblemOf: (repo) => collabSync.syncProblemOf(repo),
      submitFailureOf: (repo) => submitFailures.failureOf(repo),
      collabSetupProblemsOf: (repo) => collabRules.problemsOf(repo),
      recordsOf: collabRecordsStateOf,
      otherHeadsOf: (repo) => otherFetch.headsOf(repo),
      otherReviewsOf: (repo) => otherReview.reviewsOf(repo),
      otherSetupProblemsOf: (repo) => otherRules.problemsOf(repo),
      webhookProblemOf: (repo) => webhooks.problemOf(repo),
      checkErrorsOf: (repo) => events.errorsOf(repo),
      projectLeadsOf: (repo) => collabLeads.leadsOf(repo),
      refreshedOnce: (repo) => events.refreshedOnce(repo),
    },
    channel: qqPrivateChat,
    onFeedChanged: (repo) => sites.feedChanged(repo),
    log,
  })
  repoChanges.connect((repo) => {
    notifications.changed(repo)
    resyncQqTaskGroups(qqTaskGroups.sync())
  })
  events.start()

  ctx.inject(['gwbQqBot'], (scoped) => {
    scoped.effect(() => {
      qqBot = scoped.gwbQqBot
      resyncQqTaskGroups(qqTaskGroups.attach(scoped.gwbQqBot))
      return () => {
        qqBot = null
        qqTaskGroups.detach()
      }
    })
  })

  const services: PluginServices = { commands, gitea, docsite, submitFailures, notifications, sites, events, qqTaskGroups }
  registerOrganizationSetupCommands(services, (url) => shell.openExternal(url))
  registerOrganizationEventCommands(services)
  registerPaneCommands(services)
  registerCollabRepoCommands(services)
  registerOtherRepoCommands(services)
  registerSiteCommands(services)
  registerRecordCommands(services)
  registerAiCommands(services)

  ctx.inject(['gwbSkills'], (scoped) => {
    scoped.effect(() => scoped.gwbSkills.register(skillsDir))
  })

  ctx.inject(['gwbShell'], (scoped) => {
    scoped.effect(() => {
      const shellApi = scoped.gwbShell as GwbShellApi
      const unregisterPane = shellApi.registerPane({ id: 'projects', title: '协作站', icon: 'users', client: clientUrl, style: styleUrl })
      const undescribeSelf = shellApi.describeSelf({ title: '协作站', icon: 'users' })
      return () => {
        undescribeSelf()
        unregisterPane()
      }
    })
  })
}
