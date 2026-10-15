import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { projectDirOfCollabRepo } from '@godcreator/collab/node'
import { CollabRejected } from '../../errors.js'
import { gitRemoteOf, requireOnGitea } from '../../project/account.js'
import { joinProject, sameRepo, type RemoteProject } from '../../project/project.js'
import { qqCommandsDocKey } from '../../project/qq-task-groups.js'
import type { GiteaHttp } from '../../gitea-api/gitea.js'
import { installSiteDependencies, pnpmInstall } from '../../site-process/dependencies.js'
import { requireLeadNames } from '../../gitea-api/repo-rules.js'
import { setupCollabRepo } from '../../collab-repo/rules.js'
import { setupOtherRepo } from '../../other-repos/rules.js'
import { organizationSourceOf } from '../../other-repos/fetch/clone-new-repos.js'
import { noticeLeadsChanged } from '../events/leads-changed.js'
import { cloneOrganization, organizationOfUrl, type OrganizationCloned } from './clone-organization.js'
import { createProjectRepo } from './create.js'
import { argsOf, openProjectAt, registerCommand, remoteAuthUsage, remoteProjectAt, repoAndNameOf, repoOf, repoOfArgs, repoUsage, type PluginServices } from '../../commands.js'

/** 克隆完组织之后的一步失败时，报错里写明前面已经做到哪一步；那些都不回退 */
function clonedSoFarOf(cloned: OrganizationCloned): string {
  return `已把组织的仓（${cloned.repos.join('、')}）克隆进 ${cloned.projectDir}，本 home 的身份码已加进协作仓 ${cloned.repo} 的 site/people.json 里 ${cloned.person} 那一项`
}

/** collab.repo.setup：name 是协作仓（目录名大小写不论）就交给协作仓的规矩，不然交给别的仓的规矩 */
async function setupRepoByName(project: RemoteProject, http: GiteaHttp, name: string, leads: string[] | undefined) {
  if (leads !== undefined) requireLeadNames(leads)
  if (name.toLowerCase() === path.basename(project.repo).toLowerCase()) return setupCollabRepo(project, http, leads)
  return setupOtherRepo(project, http, name, leads)
}

/** 人要求时才做的：打开、克隆、加入与加减项目、设项目的 QQ 命令，在组织里新建仓，照规矩配好一个仓 */
export function registerOrganizationSetupCommands(services: PluginServices, openExternal: (url: string) => Promise<void>): void {
  const { commands, gitea, docsite, sites, events, qqTaskGroups } = services
  registerCommand(
    commands,
    {
      name: 'collab.project.open',
      effect: 'external',
      description: '用 VS Code 打开列表里项目的整个文件夹（包含协作仓与其他仓）',
      usage: '{ repo }：已加入项目列表的协作仓根绝对路径。打开其上一级项目文件夹，通过系统注册的 vscode:// 协议交给 VS Code；不要求站点在运行，不改文件。系统没有注册 VS Code 时回失败。回 { projectDir }',
    },
    async (args) => {
      const repo = repoOfArgs(args)
      if (!events.listed().projects.some((listed) => sameRepo(listed, repo))) throw new CollabRejected('项目还没加入列表')
      const projectDir = projectDirOfCollabRepo(repo)
      await openExternal(`vscode://file${pathToFileURL(projectDir).pathname}`)
      return { projectDir }
    },
  )

  registerCommand(
    commands,
    {
      name: 'collab.project.clone',
      effect: 'write',
      description: '用 gwb-gitea 的令牌克隆整个组织（一个项目）的全部仓，把本 home 的身份码加进协作仓的人员列表、加进项目列表、装好站点依赖；不经 Windows 凭据管理器',
      usage:
        '{ url, parent }：url 是组织地址 https://<主机>/<组织>，要在 gwb-gitea 配的那个 Gitea 上，给仓的地址直接拒绝；parent 是把项目文件夹放在哪个目录下的绝对路径，要已经存在（问人放在哪）。' +
        '在 <parent>/<组织>/ 新建项目文件夹（已存在就拒绝），经 gwb-gitea 列出组织的全部仓，逐个用令牌 git clone 进去，文件夹名就是仓名；中途某个仓克隆失败就停下，报出已经克隆了哪些、哪个失败、git 的原话。' +
        '带 collab/ 与 site/people.json 的仓是协作仓，要正好一个，没有或不止一个就报错并写明是哪些仓。' +
        '令牌的 Gitea 账号不在 site/people.json 里时到这里为止，listed 为 false：请负责人加上，在协作仓里 git pull 拿到之后再调 collab.project.join 与 collab.project.add。' +
        '在里面就照 collab.project.join 把本 home 的身份码加进自己那一项，照 collab.project.add 加进列表，再在 site/ 里运行 pnpm install，装完在后台启动站点、常驻；身份码那一行改动要 collab.submit 提交审核。' +
        '加进列表或装依赖失败时，报错写明前面已经做到哪一步，那些都不回退；pnpm 失败附 pnpm 的原话。在 VS Code 里直接打开项目文件夹就是整个项目。' +
        '回 { projectDir, repo, person, listed, joined, repos, installOutput }：repo 是协作仓的仓根；person 是令牌的账号；joined 是这次有没有改 site/people.json（listed 为 false 时也是 false）；repos 是项目文件夹里的全部仓；installOutput 是 pnpm 输出的最后几行，没装为 null',
    },
    async (args) => {
      const { url, parent } = argsOf(args, ['url', 'parent'])
      if (typeof url !== 'string' || url.trim() === '') throw new CollabRejected(`url 要是组织地址 https://<主机>/<组织>，收到 ${JSON.stringify(url)}`)
      if (typeof parent !== 'string' || !path.isAbsolute(parent)) throw new CollabRejected(`parent 要是把项目文件夹放在哪个目录下的绝对路径，收到 ${JSON.stringify(parent)}`)
      const { organization, organizationUrl } = organizationOfUrl(url)
      const account = await gitea.account()
      requireOnGitea(organizationUrl, account.baseUrl, '组织地址')
      const cloned = await cloneOrganization(path.resolve(parent), organizationSourceOf(gitea.http, organization, organizationUrl), account.login, gitRemoteOf(account))
      if (!cloned.listed) return { ...cloned, joined: false, installOutput: null }
      const { changed: joined } = await joinProject(cloned.repo, account.login, (siteDir, person) => docsite.join(siteDir, person))
      try {
        await events.add(cloned.repo)
      } catch (error) {
        if (!(error instanceof CollabRejected)) throw error
        throw new CollabRejected(`${clonedSoFarOf(cloned)}；加进项目列表失败，前面这些不回退：\n${error.message}`)
      }
      try {
        const installed = await installSiteDependencies(await openProjectAt(services, cloned.repo), sites, pnpmInstall)
        return { ...cloned, joined, installOutput: installed.outputTail }
      } catch (error) {
        if (!(error instanceof CollabRejected)) throw error
        throw new CollabRejected(`${clonedSoFarOf(cloned)}，已加进项目列表；在 site/ 里装依赖失败，前面这些不回退：\n${error.message}`)
      }
    },
  )

  registerCommand(
    commands,
    {
      name: 'collab.project.join',
      effect: 'write',
      description: '把本 home 的身份码加进协作仓 site/people.json 里自己那一项（按 gwb-gitea 令牌的账号认人）：站点与插件靠它认出「我是谁」',
      usage:
        `${repoUsage}。经 gwb-gitea 读令牌的 Gitea 账号，在工作区的 site/people.json 里找 id 是这个账号的那一项，把本 home 的身份码（gwb-docsite 的设置 identity-code）加进它的 codes；` +
        '一个人可以有几台电脑、几个 home，各有各的码。码已经在里面就不改文件；账号不在列表里就拒绝，加人只有负责人能做。' +
        '只写工作区：改了就用 collab.submit 提交审核（执行器允许每个人只改自己那一项的 codes）。collab.project.clone 克隆时已经做过这一步；换了电脑、换了身份码、自己克隆的仓用它。回 { person, changed }',
    },
    async (args) => {
      const repo = repoOfArgs(args)
      const account = await gitea.account()
      return joinProject(repo, account.login, (siteDir, person) => docsite.join(siteDir, person))
    },
  )

  registerCommand(
    commands,
    {
      name: 'collab.project.add',
      effect: 'write',
      description: '把一个项目仓加进协作窗格的项目列表，之后实时推送来了就刷新它、站点常驻',
      usage: `{ repo }：repo 是协作仓（带 collab/ 与 site/people.json 的仓）的仓根的绝对路径，本 home 的身份码要已在 site/people.json 里（不在就先 collab.project.join）；origin 的主人要是 Gitea 上的组织（经 gwb-gitea 查 /orgs/<主人>），仓要放在以组织命名的项目文件夹里（collab.project.clone 就是这样放的），不然拒绝。写进本插件的设置 projects；加进去后开始盯协作仓的文件与别的仓的 HEAD，把站点交给 gwb-docsite 常驻（site/ 没装依赖、检查不过就只记下原因，窗格里显示），约 2 秒后完整刷新一次，刷新完把它的组织加进实时推送的订阅。回 { repo }`,
    },
    async (args) => events.add(repoOfArgs(args)),
  )

  registerCommand(
    commands,
    {
      name: 'collab.project.remove',
      effect: 'write',
      description: '把一个项目仓移出协作窗格的项目列表，不再刷新，停掉它的站点；仓本身不动',
      usage: '{ repo }：列表里的项目仓根。不再盯它的仓，这次加载里读到的、算出通知用的东西（自动同步记录、负责人、合并请求与 issue、规矩的问题、出错）一起忘掉；站点在运行就停掉；它在本 home 的 QQ 命令一起删掉、QQ 任务组撤掉。回 { repo }',
    },
    async (args) => events.remove(repoOfArgs(args)),
  )

  registerCommand(
    commands,
    {
      name: 'collab.project.qq-command',
      effect: 'write',
      description: '给列表里的项目设本 home 的「QQ 命令」（如 /mmc）：设了就经 gwb-qq-bot 把这个项目注册成 QQ 任务组，私聊机器人发「/mmc 任务」就由 gwb-qq-bot 交给 claude-agent 在项目文件夹里做；给 null 撤掉',
      usage:
        '{ repo, command }：repo 是列表里的协作仓根的绝对路径，不在列表里就拒绝；command 是 QQ 命令或 null（撤掉）。设 QQ 命令要同 home 装着 gwb-qq-bot，没装就拒绝（撤掉不要求）；命令名经 gwb-qq-bot 的服务方法 commandNameProblem 查，和注册任务组同一条规则：以 / 开头、不含空白，去掉斜杠后汉字算 2、其余算 1，总长不超过 16，/帮助、/状态、/新会话 是保留命令；本 home 别的项目已经用着它也拒绝；不合就拒绝、什么都不改。' +
        `存在本 home 的数据文档 ${qqCommandsDocKey} 里，不写进协作仓（每个人的机器人、命令各不相同）。` +
        '设了 QQ 命令的项目注册一个任务组：命令就是它，名字是站名，工作区是项目文件夹（协作仓的上一级），由 gwb-qq-bot 交给 claude-agent 做（模型是 claude-agent 的设置 default-model），任务组要求只写项目名、协作仓路径和先读说明书 collab；项目列表、QQ 命令或站名变了，gwb-qq-bot 装上或卸掉，都撤掉旧的、按现状重新注册。' +
        '回 { repo, taskGroup }：taskGroup 是 { command, registered, error }，registered 为 false 时 error 写明原因（没装 gwb-qq-bot、和别的插件或 qq-bot.group.add 登记的组重名等，原话照 qq-bot 的报错）；collab.projects 每个项目的 qqTaskGroup 也是这个形状',
    },
    async (args) => {
      const fields = argsOf(args, ['repo', 'command'])
      const repo = repoOf(fields)
      const command = fields['command']
      if (command !== null && typeof command !== 'string') throw new CollabRejected(`command 要是 QQ 命令（如 /mmc），撤掉给 null，收到 ${JSON.stringify(command)}`)
      return { repo, taskGroup: await qqTaskGroups.setCommand(repo, command) }
    },
  )

  registerCommand(
    commands,
    {
      name: 'collab.repo.create',
      effect: 'external',
      description: '在协作仓所在的组织里建一个私有仓，负责人是自己：照 collab.repo.setup 的规矩配好协作者、合并方式与 main 的保护，再克隆进项目文件夹',
      usage:
        '{ repo, name, description? }：repo 是项目仓根（协作仓）的绝对路径；name 是新仓名，只含字母、数字与 _ . -，项目文件夹里已经有同名的文件或文件夹就拒绝；description 是仓的简介，可不给。' +
        `${remoteAuthUsage}。` +
        '经 gwb-gitea 依次：在协作仓 origin 所在的组织里建私有仓（默认分支 main，带一个初始提交）；再做和 collab.repo.setup 一样的配置，负责人是本机身份：合并方式只留「合并提交」与「仅快进」，' +
        '把本机身份加成协作者（管理），main 的推送与合并只许本机身份、不写团队，禁止强制推送，删掉别的协作者；再用令牌把它克隆进项目文件夹（组织里别的还没克隆的新仓一起克隆，和刷新时一样）。' +
        '令牌缺权限时 Gitea 回 403，原话里写着缺哪一项，原样报出。建出来以后某一步失败，报错写明前面已经做到哪一步，那些都不回退：调 collab.repo.setup 补齐设置，或者删掉这个仓再来。' +
        '之后负责人直接推这个仓的 main，别人推自己的分支、开合并请求，负责人收到「等你审阅」的通知；要加减负责人调 collab.repo.setup。' +
        '配好以后往组织的推送 topic 发一条 leads changed，别的成员的插件收到就重读这个仓（Gitea 建仓时推来的消息比配负责人早）。' +
        '回 { name, url, dir, leads, leadsChanged }：url 是仓在 Gitea 上的网页，dir 是克隆到的目录，leads 是负责人（就是本机身份）；leadsChanged 是 sent，或 { failed } 写明没发出去的原因（仓已经建好配好，别人要等下一次完整刷新才看到负责人）',
    },
    async (args) => {
      const { repo, name, fields } = repoAndNameOf(args, ['description'])
      const description = fields['description']
      if (description !== undefined && typeof description !== 'string') throw new CollabRejected(`description 要是字符串，收到 ${JSON.stringify(description)}`)
      const project = await remoteProjectAt(services, repo)
      const created = await createProjectRepo(project, gitea.http, organizationSourceOf(gitea.http, project.gitea.owner, project.gitea.ownerUrl), name, description ?? '')
      return { ...created, leadsChanged: await noticeLeadsChanged(gitea, project.gitea.owner, name) }
    },
  )

  registerCommand(
    commands,
    {
      name: 'collab.repo.setup',
      effect: 'external',
      description: '照规矩配好项目文件夹里的一个仓（协作仓也行）：负责人就是协作者；别的仓 main 的推送与合并只许负责人，协作仓 main 谁都不能直接推、只许 bots 合并；禁止强制推送；补齐设置、换负责人都用它',
      usage:
        '{ repo, name, leads? }：repo 是项目仓根（协作仓）的绝对路径；name 是项目文件夹里 git 仓的文件夹名，协作仓自己的文件夹名也行（大小写不论），不是项目文件夹里的 git 仓就拒绝；' +
        'leads 是负责人的 Gitea 用户名数组（至少一个、不重复，只含字母、数字与 _ . -），不给就用这个仓现有的协作者，现有也没有就拒绝、写明要给 leads。' +
        `${remoteAuthUsage}。` +
        '规矩：一个仓的负责人就是它在 Gitea 上的协作者（权限「管理」），所有仓一样；不许强制推送。别的仓 main 的推送与合并只许负责人，不写团队，别人照旧有写权限，推自己的分支、开合并请求，等负责人合并；' +
        '协作仓 main 谁都不能直接推（关掉推送），合并只许团队 bots（执行器的机器人，不算负责人），负责人也不在推送与合并许可里：所有改动都经 collab.submit 用 AGit 推成合并请求、由执行器检查后合并，负责人改只有负责人能改的内容也一样，执行器查到作者是负责人就放行。' +
        '协作仓按打开项目时的 origin 找到 Gitea 上的仓，别的仓按那个仓的 origin 找，先核对：还没有 main（空仓）就拒绝，先推一个提交到 main；本机身份不是这个仓的管理员就拒绝（协作者与分支保护只有管理员能改），写明请负责人或组织管理员来配；这两样拒绝时什么都不改。' +
        '再经 gwb-gitea 依次：合并方式关掉压缩、变基与显式变基，只留「合并提交」与「仅快进」，默认「合并提交」；把 leads 逐个加成协作者（管理，已经是协作者的改成管理）；' +
        'main 已有保护就改、没有就建：别的仓推送许可与合并许可都只写 leads，协作仓关掉推送、合并许可只写团队 bots，都禁止强制推送；最后删掉不在 leads 里的协作者（放在最后，调用者自己不在 leads 里时也改得完）。' +
        '某一步失败，报错写明前面已经做到哪一步，那些都不回退，附 Gitea 的原话：照报错改好再调一次（每一步都可以重做）。建仓、补齐设置、换负责人都是它；「没按规矩配好」那条通知，问清负责人后调它。' +
        '配好以后往这个组织的推送 topic 发一条 leads changed（标题 <组织>/<仓>）：Gitea 换协作者不发 webhook，各成员的插件（包括自己的）靠这一条重读这个仓、再核对规矩；在 Gitea 网页上直接改协作者不会发，要等各人下一次完整刷新，所以换负责人一律用这条命令。' +
        '回 { name, leads, giteaOwner, giteaRepo, leadsChanged }：name 原样，leads 是配好之后的负责人，giteaOwner、giteaRepo 是它在 Gitea 上的位置；leadsChanged 是 sent，或 { failed } 写明没发出去的原因（配置已经改好，别人要等下一次完整刷新才看到新负责人）',
    },
    async (args) => {
      const { repo, name, fields } = repoAndNameOf(args, ['leads'])
      const leads = fields['leads']
      if (leads !== undefined && !(Array.isArray(leads) && leads.every((lead) => typeof lead === 'string'))) {
        throw new CollabRejected(`leads 要是负责人的 Gitea 用户名数组，收到 ${JSON.stringify(leads)}`)
      }
      const setUp = await setupRepoByName(await remoteProjectAt(services, repo), gitea.http, name, leads)
      return { name, leads: setUp.leads, giteaOwner: setUp.location.owner, giteaRepo: setUp.location.repo, leadsChanged: await noticeLeadsChanged(gitea, setUp.location.owner, setUp.location.repo) }
    },
  )
}
