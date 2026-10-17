import { registerCommand, remoteRepoUsage, type PluginServices, repoOfArgs } from '../../commands.js'

/** 协作仓：只经提交审核改 main；跟上 main 由检查时的自动同步做，没有单独的同步命令。网页上的一键提交与这条命令经同一个 CollabSubmits */
export function registerCollabRepoCommands(services: PluginServices): void {
  const { commands, submits } = services
  registerCommand(
    commands,
    {
      name: 'collab.submit',
      effect: 'external',
      description: '提交审核：在本地 main 上一起提交 collab/ 的记录、site/ 的页面改动、sources/ 的源数据与 .gitea/ 的执行器工作流，把 origin/main 合进来，推送到 refs/for/main，等 NAS 上的执行器合并或打回；不建分支',
      usage: `${remoteRepoUsage}。协作仓只用 main 一条分支：只在 main 上做，在别的分支上直接拒绝。提交前校验：collab/ 相对本地 main 与 origin/main 的分叉点有没有新的格式问题；site/ 有改动时，站点检查（site/journal/ 下日志页的文件名）有没有问题，site/package.json 写了 typecheck 脚本就在 site/ 里运行 pnpm run typecheck（页面能不能编译由它管）；有一样不过就不提交、报出原话。一起提交 collab/、site/、sources/ 与 .gitea/，暂存区里别的文件不带上；sources/ 是仓根下的源数据目录（页面用到的实验、出图脚本、例子代码），不做格式检查，谁都能改；.gitea/ 只有负责人能改，负责人升检查工具版本（工作流里的 MERGE_CHECK_RANGE）就是改好它再运行本命令，成员改了它会在推送前被拦下；上次提交审核合 main 出的冲突已经改好时，就完成那次合并。提交后把 origin/main 合进本地 main：有冲突就回失败、列出冲突的文件，冲突标记留在文件里，不推送，让 AI 按两边的意思改好再运行一次 collab.submit。合进来以后在本机再查一遍：合并后的 collab/ 比 origin/main 多出的格式问题，site/ 有改动时再做一遍站点检查（两个人各自没问题、凑在一起才出的），有就不推送、改动退回工作区，回失败逐条写明文件。推送用固定主题 <身份>，Gitea 建合并请求，执行器当场定论，只查两样：和 main 没有冲突、没改只有负责人能改的内容（负责人是 Gitea 上协作仓的协作者，他们自己提交的放行），都满足就合并，否则留言写明原因并关闭；记录格式与站点执行器不查，只在本机提交前查。只有负责人能改的内容是会在每个人电脑上执行代码或会改变规则的：.gitea/ 与 .github/ 下的工作流、site/people.json（每个人只改自己那一项的 codes 不算）、site/.npmrc、site/pnpm-workspace.yaml、站点身份文件 site/docsite.json（认协作仓就看它）、site 根目录下的 *.config.* 与 .postcssrc*、site/package.json 里依赖两段以外的键（scripts 等）、依赖里 @godcreator/ 下的包（加、删、改版本都算）、写成网址或本地路径的依赖；加库、升级库（依赖里的普通版本号与锁文件）、index.html、tsconfig.json、site/ 下新建的目录都谁都能改。推送前在本机也做这一项检查（经 Gitea 读协作仓的协作者），不是负责人的改到这些内容就不推送、改动退回工作区，回失败写明是哪几处，并写明要先提交别的改动就把这几处改回 main 上的样子（站点依赖的版本连同锁文件改回、再 pnpm install）。本命令一直等到结论（最多 3 分钟，执行器通常十几秒）：合并了就回执，本地 main 由合并的推送触发的检查快进；被打回就回失败、附执行器的留言；到时限还没结论就关掉合并请求、回失败，说执行器可能没在运行。打回、超时、推送失败时本地 main 都退回推送时的 origin/main，这次的改动回到工作区、变回没提交的改动，改好再提交审核。回 { commit, siteFiles, sourceFiles, workflowFiles, siteTypecheck, pull }：commit 是这次新建的提交，没有改动只推送已有提交时为 null；siteFiles、sourceFiles、workflowFiles 是这次提交里 site/、sources/、.gitea/ 下各改了几个文件；siteTypecheck 是 passed（跑过且通过）/ no-script（站点没写 typecheck 脚本），site/ 没有改动时为 null；pull 是合并了的合并请求 { number, url }。拒绝时（被打回、合 main 出冲突、推送前拦下、等不到结论等）的原话成为一条通知，推给这个项目在运行的站点、显示在网站顶部的提示栏里，之后提交审核成功一次就清掉；撤掉了改动、没有东西可提交时（collab/、site/、sources/ 没有改动、没有冲突、本地 main 不领先 origin/main），下一次检查自动同步之后也清掉。网站顶部提示栏的「一键提交」（collab/ 或 site/ 有没提交审核的改动、没有冲突与不在 main 这类事时能点；只改了 sources/ 时提示栏不显示它，由 AI 调本命令提交）走的是同一个提交审核，不经 AI；一个项目同一时刻只跑一次，正在跑（不管是网页上点的还是命令调的）时再调就拒绝。跑的时候提示栏显示进度，合并了显示合并请求的编号`,
    },
    async (args) => submits.submit(repoOfArgs(args)),
  )
}
