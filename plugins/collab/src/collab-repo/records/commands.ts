import { collabInbox } from './inbox.js'
import { createModule, deleteModules, moduleCreateArgsOf, moduleDeleteArgsOf, moduleUpdateArgsOf, updateModule } from './module.js'
import { createTask, deleteTasks, taskCreateArgsOf, taskDeleteArgsOf, taskUpdateArgsOf, updateTask } from './task.js'
import { projectLeadsOf } from '../leads.js'
import { openProjectAt, registerCommand, remoteAuthUsage, remoteProjectAt, repoUsage, type PluginServices, repoOfArgs } from '../../commands.js'

/** 待办与建改任务、模块：只读写工作区、不提交；删任务与模块要从 Gitea 读项目负责人，要联网 */
export function registerRecordCommands(services: PluginServices): void {
  const { commands, gitea } = services
  registerCommand(
    commands,
    {
      name: 'collab.inbox',
      effect: 'read',
      description: '我的待办：指派给我的任务、@我的评论与回复、回复我的（我发起或回复过的评论串里别人后来写的）',
      usage:
        `${repoUsage}。读工作区里的 collab/、site/people.json 与 site/comments/（包括还没提交、还没合并的），不取回远端，身份是本 home 的身份码在 site/people.json 里认出的那个人。` +
        "回 { tasks, mentions, repliesToMe, problems }：tasks 是负责人是我、status 不是 done 的任务；mentions 是还没解决的评论串里别人写的、正文 @了我（@<id>）的 { in: 'comment' | 'reply', comment, author, text, page }；" +
        'repliesToMe 是还没解决的评论串里，我发起或回复过之后别人写的回复 { comment, author, text, threadId, page }；comment 是「评论串文件夹名/文件名」（site/comments/ 下），threadId 是评论串文件夹名；' +
        'page 是点到它时去的地址：挂在页面上的是「那一页?comment=<评论串>」，不挂在页面上的是「/comments?comment=<评论串>」；problems 是读出记录时的问题 { file, message }。' +
        '没有「已读」：任务做完、评论串标为已解决（docsite.comment.resolve）之后就不再列出。读评论原文、回复评论用 gwb-docsite 的 docsite.comments、docsite.comment.reply（dir 是 site/ 的绝对路径）',
    },
    async (args) => collabInbox(await openProjectAt(services, repoOfArgs(args))),
  )

  registerCommand(
    commands,
    {
      name: 'collab.task.create',
      effect: 'write',
      description: '建一条任务，写成工作区里 collab/records/ 下的新文件，和网站走同一套写入规则',
      usage: `{ repo, title, owner?, due?, page?, detail?, module? }：repo 是项目仓根的绝对路径；title 必填；owner 是负责人的 Gitea 用户名，要在 site/people.json 里；due 是 YYYY-MM-DD；page 是站点里相关页面的地址，如 /plan/control-plan；module 是所属模块的记录 id，要是一条已有的模块记录。status 固定是 todo，作者是本 home 的身份，都不能自己给。只写工作区、不提交：写完调 collab.submit 提交审核。回 { id, file }，file 是记录文件相对仓根的路径`,
    },
    async (args) => {
      const { repo, fields } = taskCreateArgsOf(args)
      return createTask(await openProjectAt(services, repo), fields)
    },
  )

  registerCommand(
    commands,
    {
      name: 'collab.task.update',
      effect: 'write',
      description: '改一条任务的字段，直接改写那条记录的文件，和网站走同一套写入规则',
      usage: `{ repo, id, fields }：repo 是项目仓根的绝对路径；id 是任务的记录 id；fields 是要改的字段与新值，比如 { "status": "doing" }，status 是 todo / doing / done。自己的任务能改除 id、type、author 以外的任何字段；别人的任务只能改 status、owner、due、title、module，改了别的整条拒绝、文件不变。id 对应的不是任务就拒绝。只写工作区、不提交：写完调 collab.submit 提交审核。回 { id, file }，file 是记录文件相对仓根的路径`,
    },
    async (args) => {
      const { repo, id, fields } = taskUpdateArgsOf(args)
      return updateTask(await openProjectAt(services, repo), id, fields)
    },
  )

  registerCommand(
    commands,
    {
      name: 'collab.task.delete',
      effect: 'write',
      description: '删掉一条或几条任务：删掉工作区里它们的记录文件，和网站走同一套写入规则',
      usage: `{ repo, ids }：repo 是项目仓根的绝对路径；ids 是任务记录 id 的数组，一次可以删好几条。只有任务的作者和负责人（Gitea 上协作仓的协作者）能删，状态不限。${remoteAuthUsage}：负责人每次经 Gitea 现读。有一条不存在、不是任务或删不了，整次拒绝，一个文件都不删。只写工作区、不提交：删完调 collab.submit 提交审核。回 { ids, files }，files 是删掉的记录文件相对仓根的路径`,
    },
    async (args) => {
      const { repo, ids } = taskDeleteArgsOf(args)
      const project = await remoteProjectAt(services, repo)
      return deleteTasks(project, ids, await projectLeadsOf(gitea, project))
    },
  )

  registerCommand(
    commands,
    {
      name: 'collab.module.create',
      effect: 'write',
      description: '建一个模块（一块有截止日的大工作，画在任务页的甘特图上，任务用 module 字段归进来），写成工作区里 collab/records/ 下的新文件，和网站走同一套写入规则',
      usage: `{ repo, title, due, owner?, group?, detail? }：repo 是项目仓根的绝对路径；title、due 必填；due 是截止日，YYYY-MM-DD；模块没有开始日，给 start 就拒绝；owner 是负责人的 Gitea 用户名，要在 site/people.json 里；group 是分组的 id，要列在协作仓的 collab/groups.json 里（任务页一组画一张甘特图），仓里没有这个文件就不能给。模块不存状态，作者是本 home 的身份，不能自己给。只写工作区、不提交：写完调 collab.submit 提交审核。回 { id, file }，id 是模块的记录 id（建任务时填进 module），file 是记录文件相对仓根的路径`,
    },
    async (args) => {
      const { repo, fields } = moduleCreateArgsOf(args)
      return createModule(await openProjectAt(services, repo), fields)
    },
  )

  registerCommand(
    commands,
    {
      name: 'collab.module.update',
      effect: 'write',
      description: '改一个模块的字段，直接改写那条记录的文件，和网站走同一套写入规则',
      usage: `{ repo, id, fields }：repo 是项目仓根的绝对路径；id 是模块的记录 id；fields 是要改的字段与新值，比如 { "due": "2026-11-15" }。自己的模块能改除 id、type、author 以外的任何字段；别人的模块只能改 title、owner、due、group（group 要列在 collab/groups.json 里），改了别的整条拒绝、文件不变。id 对应的不是模块就拒绝。只写工作区、不提交：写完调 collab.submit 提交审核。回 { id, file }，file 是记录文件相对仓根的路径`,
    },
    async (args) => {
      const { repo, id, fields } = moduleUpdateArgsOf(args)
      return updateModule(await openProjectAt(services, repo), id, fields)
    },
  )

  registerCommand(
    commands,
    {
      name: 'collab.module.delete',
      effect: 'write',
      description: '删掉一个或几个模块：删掉工作区里它们的记录文件，和网站走同一套写入规则',
      usage: `{ repo, ids }：repo 是项目仓根的绝对路径；ids 是模块记录 id 的数组。只有模块的作者和负责人（Gitea 上协作仓的协作者）能删。${remoteAuthUsage}：负责人每次经 Gitea 现读。模块下还有任务（任务的 module 是它）就拒绝并列出这些任务：先用 collab.task.delete 删掉，或用 collab.task.update 改到别的模块。有一条不存在、不是模块或删不了，整次拒绝，一个文件都不删。只写工作区、不提交：删完调 collab.submit 提交审核。回 { ids, files }，files 是删掉的记录文件相对仓根的路径`,
    },
    async (args) => {
      const { repo, ids } = moduleDeleteArgsOf(args)
      const project = await remoteProjectAt(services, repo)
      return deleteModules(project, ids, await projectLeadsOf(gitea, project))
    },
  )
}
