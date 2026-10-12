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
      description: '初始化项目站点，或照装好的新版模板更新它的骨架（site/ 的 app/ 与配置文件），交给 gwb-docsite 做',
      usage:
        `{ repo, port?, title? }：repo 是协作仓的仓根绝对路径，不要求在项目列表里。site/ 还没有 package.json 是新站点，要给 port（开发端口）与 title（站名）；已有站点不能给这两样。` +
        `功能包 ${featurePackage} 的范围写成 ^${__COLLAB_SITE_VERSION__}（本插件打包时带的那一版），基础包的范围由 gwb-docsite 写；先装依赖，再照装好的基础包与功能包的模板整个重写 site/app/、覆盖配置文件，模板带来新依赖就再装一次。` +
        'site/content/、site/comments/、site/people.json、site/journal/ 已有的不动；迁移旧形态的协作仓时，scripts/migrate-site.mjs 迁完页面与评论后运行这一条。站点在运行就先停、做完再启动；项目在列表里就再查一遍，通过了交给 gwb-docsite 托管。' +
        '只写文件、不提交：用 collab.submit 提交审核（site/package.json 里依赖两段以外的键、site/ 根下的配置文件只有负责人能改）。回 { created, features }',
    },
    async (args) => {
      const parsed = argsOf(args, ['repo', 'port', 'title'])
      const repo = repoOf(parsed)
      const { port, title } = parsed
      if (port !== undefined && !(Number.isInteger(port) && (port as number) > 0 && (port as number) < 65536)) throw new CollabRejected('port 要是 1 到 65535 的整数')
      if (title !== undefined && (typeof title !== 'string' || title.trim() === '')) throw new CollabRejected('title 要是非空字符串')
      const listed = events.listed().projects.some((each) => sameRepo(each, repo))
      return sites.init(repo, { featureRange: `^${__COLLAB_SITE_VERSION__}`, listed, ...(port !== undefined ? { port: port as number } : {}), ...(title !== undefined ? { title: title as string } : {}) })
    },
  )

  registerCommand(
    commands,
    {
      name: 'collab.site.start',
      effect: 'external',
      description: '打开项目站点（窗口照 gwb-docsite 的设置 site-window，默认 Chrome 的应用窗口）；站点没在运行就先启动开发服务（site/ 里的 pnpm dev）',
      usage:
        `${repoUsage}。列表里的项目的站点平时交给 gwb-docsite 常驻；这条命令用在人为停止过、连续失败停下、检查不过修好之后：先查一遍，再交给 gwb-docsite 启动并打开，清掉人为停止与连续失败的记录；协作窗格里点站点链接也调它。` +
        '查的是：site/ 装的功能包（@godcreator/collab-site）和本插件的站点协议号一样，不一样就拒绝，写明把 site/package.json 里的范围改成哪个、或者升级本插件；站点检查（site/people.json、评论文件、日志页的文件名）没有问题，不过就拒绝，列出每条问题。' +
        'gwb-docsite 启动前还会查装没装依赖。开发服务是 gwb-docsite 的子进程，启动时用本 home 的身份码认人；本插件把通知与项目负责人推到站点推送通道的频道 collab，之后一变就再推。回 { url, pid, alreadyRunning }',
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
