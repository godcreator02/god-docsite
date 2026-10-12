import { CollabRejected } from '../../errors.js'
import { sameRepo } from '../../project/project.js'
import { setupOrganizationWebhook } from './webhook.js'
import { argsOf, registerCommand, remoteAuthUsage, remoteProjectAt, repoOf, repoOfArgs, type PluginServices } from '../../commands.js'

/** 立即刷新、配组织的 webhook */
export function registerOrganizationEventCommands(services: PluginServices): void {
  const { commands, gitea, events } = services
  registerCommand(
    commands,
    {
      name: 'collab.check',
      effect: 'external',
      description: '立即刷新：协作仓取回、读负责人、核对规矩、能快进就自动同步；别的仓补克隆组织里新加的、逐个取回、读合并请求与 issue、核对规矩；再核对组织 webhook。要人处理的都成为通知，交给网站顶部的提示栏',
      usage:
        '{ repo? }：给了 repo 只刷新这一个项目（要在项目列表里，不在就拒绝），不给就刷新列表里的全部。插件自己也做这件事：实时推送（和 Gitea 同一台机器上的 ntfy，组织级 webhook 发到 collab-<组织>）每次连上（插件加载后第一次连上、断线后又连上）刷新全部项目一次，补上没连着时的事；' +
        '收到那个组织的消息时按消息说的仓只做那一处（等 2 秒攒成一批）：协作仓有新提交就取回并自动同步，别的仓有新提交只取回它，合并请求、issue、评论有动静重读那个仓，负责人换了（leads changed）重读并核对规矩，组织里建了仓就克隆进来；认不出的消息完整刷新那个组织的项目（同一个项目最快每 10 秒一次）。' +
        '回 [{ repo, check }]：check 是 { at, error }，error 是这次各步出错的原话（一步一行，没出错为 null），这个项目正在刷新时是 "busy"。' +
        '协作仓：用令牌取回 origin；读 Gitea 上协作仓的协作者作为项目负责人，交给网站；本机身份是协作仓的管理员时读 main 的分支保护核对协作仓的规矩（谁都不能直接推，合并只许 bots）；' +
        '再自动同步：在 main 上、本地 main 能快进到 origin/main（没有还没进 main 的提交、没有还没改好的冲突、工作区的改动不和新改动碰到同一个文件），就快进；快进进来的改动动了 site/package.json 或 site/pnpm-lock.yaml，就在 site/ 里 pnpm install（站点正由本插件运行就先停、装完再启动）；不满足就不动，原因成为「没能自动同步」的通知。' +
        '别的仓：把组织里新加的、项目文件夹（协作仓的上一级，以组织命名）里没有的仓用令牌克隆进来，克隆了哪些写进 gwb 的日志；对项目文件夹里协作仓以外的每个仓 git fetch origin 一次（只取回，不动分支与工作区：要更新由 agent 调 collab.repos.update）；' +
        '每个仓读协作者作为它的负责人：本机身份是负责人时列出别人开的、合到 main 的合并请求（等我审阅）与最后发言的不是负责人的 issue（轮到负责人回）；不论是不是负责人，都看我开的、合到 main 的合并请求最新的有效审阅是不是要求修改、最后一条评论是不是别人，我提的 issue 最后发言的是不是这个仓的负责人；' +
        '本机身份是那个仓的管理员（有 main 的）时读 main 的分支保护按规矩核对，每个问题一句：没有协作者（没有负责人）、main 没有分支保护、推送或合并没有限定人、推送或合并许可里的人和负责人对不上、许可里写了团队、允许强制推送；有问题的仓成为「没按规矩配好」的通知，由 collab.repo.setup 配好。' +
        '协作仓按它自己的规矩核对，问题句子另有几种：推送许可里有人或团队（协作仓 main 谁都不能直接推，负责人也算）、合并许可里写了人（负责人也算）或 bots 以外的团队、合并许可里没有 bots。' +
        '组织：本机身份是组织管理员时核对组织 webhook，不对就成为通知，由 collab.org.setup 配好。' +
        '这几步一样出错别的照常做，各步的出错合成一条「gwb 检查项目出错」的通知，那一步下次做成了就去掉。第一步是打开项目，核对 origin 在配的 Gitea 上、令牌的账号就是本机身份、协作仓放在以组织命名的项目文件夹里：核对不过时后面各步都不做，命令照常回执，原因在 check.error 里，也成为那条通知。' +
        '各仓 HEAD 和服务器上的同名分支比出的未推送、未拉取、分叉不用等刷新：插件一直盯着各仓的引用，变了就重算',
    },
    async (args) => {
      const { repo } = argsOf(args ?? {}, ['repo'])
      if (repo === undefined) return events.refreshAll()
      const onlyRepo = repoOf({ repo })
      if (!events.listed().projects.some((listed) => sameRepo(listed, onlyRepo))) throw new CollabRejected(`${onlyRepo} 不在项目列表里：先用 collab.project.add 加进来`)
      return [{ repo: onlyRepo, check: await events.refresh(onlyRepo) }]
    },
  )

  registerCommand(
    commands,
    {
      name: 'collab.org.setup',
      effect: 'external',
      description: '把协作仓所在组织的 webhook 配成插件要的样子：push、合并请求与它的审阅和评论、issue 与 issue 评论、仓库的建删都推到这个组织的 ntfy topic，消息只带种类、仓与编号',
      usage:
        `{ repo }：repo 是项目仓根（协作仓）的绝对路径，按它的 origin 找到组织。${remoteAuthUsage}；本机身份要是这个组织的管理员（读写组织的 webhook 只有管理员能做），不是就拒绝、什么都不改。` +
        '期望配置写在插件里：地址是 http://ntfy/collab-<组织>（NAS 上 Gitea 按服务名访问 ntfy），带 ntfy 的消息模板，标题是 <组织>/<仓>，正文是 push <ref>、pr <动作> #<编号>（审阅是 pr reviewed）、issue <动作> #<编号>、comment <动作> #<编号>（issue 与合并请求上的评论）、repo <动作>；' +
        '事件是 push、合并请求（打开、关闭、重新打开、编辑）、合并请求推了新提交、合并请求的审阅（批准、要求修改、评论）、合并请求上的评论、issue（打开、关闭、重新打开、编辑）、issue 评论、仓库的建与删，请求体 JSON。' +
        '组织里没有发到这个 topic 的 webhook 就建一个，有一个就改它（地址与事件一起写：Gitea 只改地址会把事件重置成只剩 push），已经对了就不动；有好几个就拒绝、列出编号，由人在 Gitea 网页上删到只剩一个。' +
        '写完读回来再核对一次，还不对就报错写明哪里不对。管理员的插件完整刷新时也照同一份核对，不对就成为通知。' +
        '回 { organization, hook, outcome, url, events }：hook 是 webhook 的编号，outcome 是 created、updated 或 unchanged，url 与 events 是 Gitea 读回来的',
    },
    async (args) => {
      const project = await remoteProjectAt(services, repoOfArgs(args))
      return setupOrganizationWebhook(gitea.http, project.gitea.owner)
    },
  )
}
