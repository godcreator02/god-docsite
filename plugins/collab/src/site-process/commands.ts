import { mergeWorkflowPathInRepo, renderMergeWorkflow } from '@godcreator/collab'
import { CollabRejected } from '../errors.js'
import { sameRepo } from '../project/project.js'
import { argsOf, registerCommand, repoOf, type PluginServices } from '../commands.js'
import { featurePackage } from './site-files.js'

/** 新建站点交给 gwb-docsite；项目站点由它常驻（登记在它的设置 sites 里），启停用 docsite.site.start / docsite.site.stop */
export function registerSiteCommands(services: PluginServices): void {
  const { commands, sites, events } = services
  registerCommand(
    commands,
    {
      name: 'collab.site.init',
      effect: 'write',
      description: '从空目录建出项目站点：交给 gwb-docsite 建基础站（平台模板、装依赖、起服务检查首页），写好自动合并工作流，再加协作功能',
      usage:
        `{ repo, title }：repo 是协作仓的仓根绝对路径，不要求在项目列表里；title 是站名（写进 content/meta.json），必给；端口不写进站点，启动时由 gwb-docsite 挑。` +
        `只对新站点：site/ 要不存在或是空目录，已有站点直接拒绝；升级已有站点没有命令，由 agent 对照平台包与功能包的 template/ 判断要改哪些文件（说明书 collab 的 references/organization.md「升级站点」）。` +
        `先经 gwbDocsite.init 建基础站（平台包的范围由 gwb-docsite 写），再建好仓根的 collab/ 与 site/journal/（站点运行时写入它们，服务启动前就在，写入时才不整页刷新）；` +
        `仓里还没有 ${mergeWorkflowPathInRepo} 就照 ${featurePackage} 的工作流模板写进去，MERGE_CHECK_RANGE 写成 ^${__COLLAB_VERSION__}，已有的不动；` +
        `再经 gwbDocsite.addFeature 加功能包 ${featurePackage}，范围写成 ^${__COLLAB_VERSION__}（本插件打包时带的那一版），补进 site/app/features/collab/ 并起服务检查首页；` +
        `最后把 site/app/routes/home.tsx 换成 ${featurePackage} 的项目首页（templates/home.tsx：没做完的任务、快到期的模块、最近的日志、成员），之后归站点自己改。` +
        '项目在列表里就交给 gwb-docsite 常驻（登记进它的设置 sites 并启动）并把通知推过去。只写文件、不提交：用 collab.submit 提交审核。合并检查里只有负责人能改的：.gitea/ 下的文件、site/package.json 里 @godcreator/ 下的包（加、删、改版本都算）、' +
        'scripts 这类不是依赖的字段、写成网址或本地路径的依赖，以及 site/ 根下的配置文件。新建的站点这几样都是新的，要负责人提交。' +
        '回 { dir, platformDependencies, feature, mergeWorkflow, homePage }：feature 是 gwbDocsite.addFeature 的回执；mergeWorkflow 是 { path, written }，written 为 false 是仓里已经有、没动；homePage 是写出的首页文件（相对仓根）',
    },
    async (args) => {
      const parsed = argsOf(args, ['repo', 'title'])
      const repo = repoOf(parsed)
      const { title } = parsed
      if (title === undefined || typeof title !== 'string' || title.trim() === '') throw new CollabRejected('title 要是非空字符串')
      const listed = events.listed().projects.some((each) => sameRepo(each, repo))
      const mergeWorkflow = renderMergeWorkflow(__COLLAB_MERGE_WORKFLOW_TEMPLATE__, __COLLAB_VERSION__)
      return sites.init(repo, { featureRange: `^${__COLLAB_VERSION__}`, mergeWorkflow, homePage: __COLLAB_HOME_TEMPLATE__, title: title as string, listed })
    },
  )
}
