import { CollabRejected } from '../errors.js'
import { sameRepo } from '../project/project.js'
import { argsOf, openProjectAt, registerCommand, repoOf, repoUsage, type PluginServices, repoOfArgs } from '../commands.js'
import { featurePackage } from './site-files.js'

/** 新建站点、照新模板更新骨架交给 gwb-docsite；项目站点平时由它常驻，start、stop 给人为停止、连续失败停下、检查不过修好之后用 */
export function registerSiteCommands(services: PluginServices): void {
  const { commands, sites, events } = services
  registerCommand(
    commands,
    {
      name: 'collab.site.init',
      effect: 'write',
      description: '从空目录建出项目站点，交给 gwb-docsite 一步做（拉功能包模板、组装骨架、装依赖、起服务检查首页）',
      usage:
        `{ repo, port, title }：repo 是协作仓的仓根绝对路径，不要求在项目列表里；port 是开发端口、title 是站名（写进 content/meta.json），两样都必给。` +
        `只对新站点（site/ 还没有建过）：功能包 ${featurePackage} 的范围写成 ^${__COLLAB_SITE_VERSION__}（本插件打包时带的那一版），基础包的范围由 gwb-docsite 写；骨架建完就归站点，已有站点直接拒绝（要重建删掉 site/ 再来，content/、comments/、people.json、journal/ 想留先拷走）。` +
        '项目在列表里就启动站点并把通知推过去。只写文件、不提交：用 collab.submit 提交审核（site/package.json 里依赖两段以外的键、site/ 根下的配置文件只有负责人能改）。回 { created, features }',
    },
    async (args) => {
      const parsed = argsOf(args, ['repo', 'port', 'title'])
      const repo = repoOf(parsed)
      const { port, title } = parsed
      if (port === undefined || !(Number.isInteger(port) && (port as number) > 0 && (port as number) < 65536)) throw new CollabRejected('port 要是 1 到 65535 的整数')
      if (title === undefined || typeof title !== 'string' || title.trim() === '') throw new CollabRejected('title 要是非空字符串')
      const listed = events.listed().projects.some((each) => sameRepo(each, repo))
      return sites.init(repo, { featureRange: `^${__COLLAB_SITE_VERSION__}`, port: port as number, title: title as string, listed })
    },
  )

  registerCommand(
    commands,
    {
      name: 'collab.site.start',
      effect: 'external',
      description: '启动项目站点的开发服务（交给 gwb-docsite，幂等：已在运行或正在启动就回现状），回地址；要看页面把地址交给 VS Code 的浏览器打开',
      usage:
        `${repoUsage}。列表里的项目的站点平时由本插件在加载、项目加进列表时启动；这条命令用在进程退出停下之后：交给 gwb-docsite 启动，起不来把开发服务的输出报出来。` +
        '启动时用本 home 的身份码认人；本插件把通知与项目负责人推到站点推送通道的频道 collab，之后一变就再推。回 { url, pid, alreadyRunning }',
    },
    async (args) => sites.start(await openProjectAt(services, repoOfArgs(args))),
  )

  registerCommand(
    commands,
    {
      name: 'collab.site.stop',
      effect: 'write',
      description: '停掉项目站点的开发服务，这次加载期间不再自动启动',
      usage: `${repoUsage}。交给 gwb-docsite 停掉，连同它的子进程；没在运行就报错。停掉后这次加载期间不自动启动，直到 collab.site.start 或插件重新加载。回 { url }`,
    },
    async (args) => sites.stop(repoOfArgs(args)),
  )
}
