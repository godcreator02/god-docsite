import { messageOf } from '../errors.js'
import type { QqTaskGroupStatus } from '../project/qq-task-groups.js'
import type { SiteState } from '../site-process/collab-sites.js'
import { summaryOf, type ProjectSummary } from './summary.js'
import { argsOf, registerCommand, type PluginServices } from '../commands.js'

/**
 * collab.projects 回执里的一个项目，按打不打得开分两种：打得开的 summary 必在、error 必空，
 * 打不开的只在 error 里写原因、不让整张列表失败。qqTaskGroup 是这个项目的 QQ 任务组此刻怎样
 */
export type ProjectRow =
  | { repo: string; summary: ProjectSummary; error: null; site: SiteState; qqTaskGroup: QqTaskGroupStatus }
  | { repo: string; summary: null; error: string; site: SiteState; qqTaskGroup: QqTaskGroupStatus }

/** 协作窗格的列表：每个项目一行，只给窗格用 */
export function registerPaneCommands({ commands, gitea, notifications, sites, events, qqTaskGroups }: PluginServices): void {
  const rowOf = async (repo: string): Promise<ProjectRow> => {
    const site = sites.stateOf(repo)
    const qqTaskGroup = qqTaskGroups.statusOf(repo)
    try {
      const summary = await summaryOf(await notifications.currentOf(repo))
      return { repo, summary, error: null, site, qqTaskGroup }
    } catch (error) {
      return { repo, summary: null, error: messageOf(error), site, qqTaskGroup }
    }
  }

  registerCommand(
    commands,
    {
      name: 'collab.projects',
      effect: 'read',
      description: '协作窗格的项目列表：每个项目的站名、身份、通知各组几条、站点地址与在不在运行、Gitea 页面，和实时推送的连接状态；只给窗格用，要处理的事经 collab.ai.handoff 交给 AI',
      usage:
        '无参数。只读本机，不取回远端。回 { watchError, gitea, push, projects }：watchError 是设置 projects 写错了的原因（这时 projects 是空的，刷新、站点、实时推送都没开始），每次现读，改好了就是 null；' +
        'gitea 是 gwb-gitea 配的账号 { login, baseUrl, error }，没装 gwb-gitea、没填令牌或令牌无效时 login 为 null、原因在 error；' +
        'push 是实时推送 { state, url, topics, error }：全部项目共用一条订阅，地址是 gwb-gitea 的设置 push-url（和 Gitea 同一台机器上的 ntfy），topics 是各项目组织的 collab-<组织>；state 是 connected / connecting / waiting（断开了、稍后重连，原因在 error）/ off（列表是空的，或者没能开始，原因在 error）；有项目没订上时原因也写在 error；' +
        'projects 每项 { repo, summary, error, site, qqTaskGroup }：打不开的项目 summary 为 null、原因在 error；' +
        'qqTaskGroup 是 { command, registered, error }：command 是本 home 给这个项目起的 QQ 命令（collab.project.qq-command 设，没设为 null），registered 是此刻有没有注册成 QQ 任务组，没注册上时 error 写明原因；' +
        'site 是 { url, running, error }：url 在运行时是实际地址，没运行时是按 site/package.json 的 scripts.dev 里的 --port 预期的 http://127.0.0.1:<端口>，读不到端口为 null；error 是 gwb-docsite 记下的开发服务没能启动或退出了的原因，没有为 null；自动同步快进进来改了 site/ 的提交后，站点停着就启动、已在运行就不动；' +
        "summary 是 { repo, title, person, name, counts, giteaUrl }：title 是站名，person 是本 home 的身份（身份码在 site/people.json 里认出的那个人）、name 是它的显示名；counts 是通知各组几条 { 'collab-repo', 'other-repos', 'for-me' }，和网站顶部提示栏是同一份通知；giteaUrl 是 Gitea 上协作仓所在组织的网页。" +
        '要看每一条通知、交给 AI 处理调 collab.ai.handoff；要看待办调 collab.inbox',
    },
    async (args) => {
      argsOf(args ?? {}, [])
      const listed = events.listed()
      return {
        watchError: listed.error,
        gitea: await gitea.account().then(
          (account) => ({ login: account.login, baseUrl: account.baseUrl, error: null }),
          (error: unknown) => ({ login: null, baseUrl: null, error: messageOf(error) }),
        ),
        push: events.pushStatus(),
        projects: await Promise.all(listed.projects.map(rowOf)),
      }
    },
  )
}
