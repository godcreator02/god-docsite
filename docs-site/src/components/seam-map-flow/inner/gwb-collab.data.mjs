/**
 * 插件 gwb-collab 的包内接缝图（插件首页用），用数据流的画法（flow-seam-diagram.tsx）：<SeamMap module="gwb-collab" />。
 * 左边一列是协作仓那一套（collab-repo/），右边一列是别的仓那一套（other-repos/），中间是组织级的与共用的；上面是 Gitea 与 ntfy，下面是本机的仓。
 * 坐标、送什么、箭头方向在 gwb-collab.layout.ts。
 * 只封装外部系统的底层目录（git/、gitea-api/）与装配不送东西，不画；项目登记 project/ 只画它与 QQ 机器人、gwb-docsite 之间的两条。
 */
import { defineSeamGraph } from '@godcreator/docsite-explainer/seam-graph';

/** 一个目录或文件在图里只画一块能力方块（不画外框）时用：名字是它管的事，ident 是目录或文件的路径 */
const directory = (id, name, dir, role, blurb) => ({ id, name, pkg: dir, role, outside: false, blurb, caps: [{ id, name, ident: dir }] });

/** @type {import('@godcreator/docsite-explainer/seam-graph').SeamModule[]} */
const modules = [
  {
    id: 'collabremote',
    name: 'Gitea · 协作仓',
    pkg: '远端',
    role: null,
    outside: true,
    blurb: 'Gitea 上的协作仓：合并请求经 AGit 开出，由执行器检查后合并；main 的保护与合并方式；它的协作者就是项目负责人。',
    caps: [
      { id: 'collabprs', name: '合并请求', ident: 'refs/for/main' },
      { id: 'collabmain', name: 'main', ident: '推送只许负责人' },
      { id: 'collabprotect', name: '保护与合并方式', ident: 'branch_protections' },
      { id: 'collaborators', name: '协作者', ident: '＝项目负责人' },
    ],
  },
  {
    id: 'org',
    name: 'Gitea · 组织',
    pkg: '一个项目一个',
    role: null,
    outside: true,
    blurb: '一个项目就是一个私有组织：组织上配一个 webhook，把组织里所有仓的事发到 ntfy；组织里有哪些仓、新建仓也在这一层。',
    caps: [
      { id: 'orghook', name: '组织 webhook', ident: '/orgs/…/hooks' },
      { id: 'orgrepos', name: '组织里的仓', ident: '/orgs/…/repos' },
    ],
  },
  {
    id: 'otherremote',
    name: 'Gitea · 别的仓',
    pkg: '远端',
    role: null,
    outside: true,
    blurb: 'Gitea 上协作仓以外的仓：成员推自己的分支、开合并请求，负责人审；每个仓的 main 只许它的负责人推送与合并。',
    caps: [
      { id: 'otherbranches', name: '各仓的分支', ident: 'refs/heads/*' },
      { id: 'otherprs', name: 'PR · issue', ident: '/pulls · /issues' },
      { id: 'otherprotect', name: '保护', ident: 'branch_protections' },
    ],
  },
  { id: 'ntfy', name: 'ntfy', pkg: 'NAS', role: null, outside: true, blurb: '和 Gitea 在同一台 NAS 上的推送服务，每个组织一个 topic。', caps: [{ id: 'ntfytopic', name: 'ntfy', ident: 'collab-<组织>' }] },

  directory('submit', '提交审核', 'collab-repo/submit/', 'blue', '只对协作仓：本机先查记录格式、站点、类型检查，经 Gitea 读协作者查只有负责人能改的内容；在 main 上提交 collab/ 与 site/，合进 origin/main，用 AGit 推成合并请求，等执行器的结论。合 main 出冲突就停在半路、冲突标记留在文件里；推送前拦下、推送失败、被打回或超时，就退回推送时的 origin/main、改动回到工作区。失败原因交给通知。'),
  directory('sync', '自动同步', 'collab-repo/sync/', 'blue', '只对协作仓：取回 origin，能快进就自动快进；快进进来的改动动了 site/ 的依赖，就经站点进程先停站点、装依赖、再启动。监视本机协作仓的文件，算出还没提交审核的文件、冲突、在不在 main 上。快进不了的原因交给通知。'),
  directory('collabrules', '协作仓的规矩', 'collab-repo/rules.ts', 'blue', '协作仓在 Gitea 上该怎么配：负责人就是协作者，main 谁都不能直接推（负责人也走提交审核），合并只许机器人所在的团队 bots，禁止强制推送，合并方式。本机身份是管理员时核对（不核对合并方式），结果交给通知；collab.repo.setup 时按规矩配好。'),
  directory('leads', '读负责人', 'collab-repo/leads.ts', 'blue', '读协作仓在 Gitea 上的协作者，就是项目负责人。刷新与收到 leads changed 时重读、记下，随通知一起推给网站；删任务与模块时每次现读，交给任务与待办命令。'),
  directory('records', '任务与待办', 'collab-repo/records/', 'blue', '任务与模块的读写命令、我的待办，只读写本机协作仓的工作区、不提交；写入规则在数据模型包，删别人的任务与模块要的项目负责人由读负责人给。待办读 collab/ 的任务、site/people.json 与 site/comments/ 里的评论串（评论只读，写评论归 gwb-docsite），也交给通知。'),

  directory('fetch', '取回与快进', 'other-repos/fetch/', 'emerald', '只对别的仓：逐个取回组织里的别的仓，组织里新加的仓克隆进项目文件夹；人要求时才快进；监视各仓的 HEAD，和服务器同名分支比，未推送、未拉取、分叉交给通知。'),
  directory('review', '等我处理的', 'other-repos/review.ts', 'emerald', '只对别的仓：我是负责人时读等我审阅的合并请求、轮到负责人回的 issue；不论是不是负责人，读我开的合并请求被要求修改或有了新评论、我提的 issue 有负责人回了。都交给通知。收到某个仓的合并请求、issue、评论的消息，就只重读那一个仓。'),
  directory('otherrules', '别的仓的规矩', 'other-repos/rules.ts', 'emerald', '别的仓在 Gitea 上该怎么配：负责人就是协作者，main 的推送与合并只许负责人，禁止强制推送，合并方式。本机身份是那个仓的管理员时核对（不核对合并方式），结果交给通知；collab.repo.setup、collab.repo.create 时按规矩配好。'),

  directory('events', '仓里的事', 'organization/events/', 'amber', '全部项目共用一条长连接，订阅各项目组织的 ntfy topic；认出位置消息说的是哪个仓、哪种事，分给协作仓或别的仓那一套。每次连上，对全部项目完整刷新一次：两边各刷新，再核对组织 webhook。项目列表的加减也在这里：加进来就开始监视两边的仓、让站点常驻。组织 webhook 也归这里：管理员核对，collab.org.setup 配好。'),
  directory('setup', '建项目', 'organization/setup/', 'amber', '人要求时才做的操作：克隆整个组织成一个项目、把本 home 的身份码加进人员列表、加入或移出项目列表、在组织里新建一个仓、照规矩配好一个仓、用 VS Code 打开项目文件夹。新建仓与配好仓之后往组织的 topic 发一条 leads changed，各成员的插件随即重读。配规矩、克隆、加身份码、装站点依赖、维护项目列表都调别的目录。'),

  {
    id: 'notifications',
    name: '通知',
    pkg: 'notifications/',
    role: 'violet',
    outside: false,
    blurb: '把协作仓那一套、别的仓那一套、组织 webhook 与刷新出错此刻的状态写成一条条通知（字段与短句在数据模型包的通知模型），连同项目负责人组成推给网站的整份数据。哪个目录的状态变了就调 changed(repo)：交给站点进程推一次；做完过一次完整刷新后，把此刻的全部通知交给接口 B。协作窗格与交给 AI 要用时现算。',
    caps: [{ id: 'compute', name: '算通知', ident: 'notificationsOf' }],
  },
  /* ref file="../plugins/collab/src/site-process/collab-sites.ts" lines="26-38" hash="7edd71eab0aa" blob="cb30a59e92cd" */
  {
    id: 'site-process',
    name: '站点',
    pkg: 'site-process/',
    role: 'violet',
    outside: false,
    blurb: '项目站点交给 gwb-docsite 初始化与托管，这里只多三件事：collab.site.init 初始化时把功能包范围写成插件打包时带的那一版；托管之前查站点协议号与站点检查（人员列表、评论、日志页的文件名），不过就不托管、记下原因；通知一变就把整份数据经 gwb-docsite 推到站点的频道 collab。装站点依赖、提交前的类型检查也在这里运行 pnpm。',
    caps: [{ id: 'keep', name: '初始化 · 查过再托管', ident: 'collab.site.*' }],
  },
  directory('pane', '协作窗格', 'pane/', 'violet', '外壳里的「协作站」窗格，node 侧与浏览器侧放在同一个目录：一个项目一行，项目名、身份、通知各组几条、站点链接、「交给 AI 处理」、「用 VS Code 打开」、Gitea 页面。'),
  directory('project', '项目登记', 'project/', 'violet', '打开项目：本 home 的身份码在 site/people.json 里认出身份，collab.project.join 把身份码加进自己那一项。项目列表（设置 projects）与每个项目在本 home 的 QQ 命令（数据文档 qq-task-group-commands，collab.project.qq-command 设）：起了 QQ 命令的项目注册成 QQ 任务组，项目列表、QQ 命令、站名一变，gwb-qq-bot 装上或卸掉，都撤掉旧的、按现状重新注册。令牌核对这些别的目录都用、不送东西，不另画。'),
  {
    id: 'ai-handoff',
    name: '交给 AI',
    pkg: 'ai-handoff/',
    role: 'violet',
    outside: false,
    blurb: '把一个项目此刻的通知按 kind 写成提示词（要写命令名与参数，所以留在插件里），经接口 A 交出去。',
    caps: [{ id: 'handoff', name: '写提示词', ident: 'collab.ai.handoff' }],
  },

  {
    id: 'collablocal',
    name: '本机 · 协作仓',
    pkg: '项目文件夹里',
    role: null,
    outside: true,
    blurb: '本机的协作仓，只用 main；git 历史只有提交审核与自动同步动。collab/ 里是任务与模块的记录文件，site/ 是站点，人员列表 site/people.json 与评论 site/comments/ 也在里面。',
    caps: [
      { id: 'worktree', name: 'main 工作区', ident: 'collab/ · site/' },
      { id: 'collabdir', name: '记录与评论', ident: 'collab/ · site/comments/' },
    ],
  },
  {
    id: 'otherlocal',
    name: '本机 · 别的仓',
    pkg: '项目文件夹里',
    role: null,
    outside: true,
    blurb: '本机的别的仓，分支与没提交的改动都由人自己管。',
    caps: [{ id: 'otherwt', name: '各自的工作区', ident: '分支 · HEAD' }],
  },

  {
    id: 'docsite',
    name: 'gwb-docsite',
    pkg: 'gwbDocsite',
    role: null,
    outside: true,
    blurb: 'gwb 基础插件 gwb-docsite 的服务：照基础包与功能包的模板初始化站点，托管站点的开发服务（常驻、重启、照它的设置 site-window 打开窗口），往站点的推送通道推数据，保管本 home 的身份码、把它加进站点的人员列表。行为由它定，见基础包仓的自述站。',
    caps: [
      { id: 'hosting', name: '初始化 · 托管', ident: 'init · keep' },
      { id: 'identity', name: '身份码', ident: 'identityCode · join' },
    ],
  },
  {
    id: 'qq',
    name: 'QQ 机器人',
    pkg: 'gwbQqBot',
    role: null,
    outside: true,
    blurb: 'gwb-qq-bot 的服务。接口 B 的实现：经它私聊本人，按通知 id 只发新出现的，还没提交审核的文件不发（notifications/qq-private-chat.ts）。另收项目登记注册的任务组：私聊发「<QQ 命令> 任务」就交给 ZCode 在那个项目文件夹里做。',
    caps: [{ id: 'qqgroups', name: '任务组', ident: 'registerTaskGroup' }],
  },
  { id: 'otherchannel', name: '别的渠道', pkg: '以后接', role: null, outside: true, blurb: '还没有实现：别的消息渠道照接口 B 的形状写一个，接在 QQ 旁边或换掉它。', caps: [] },
  { id: 'zcode', name: 'ZCode', pkg: 'gwbZcode', role: null, outside: true, blurb: '在 ZCode 里新建一条会话读提示词（ai-handoff/zcode.ts 里的实现）。', caps: [] },
  { id: 'claude', name: 'Claude Code', pkg: '新开终端', role: null, outside: true, blurb: '新开一个 pwsh 窗口运行 Claude Code 读提示词（ai-handoff/claude-terminal.ts 里的实现）。', caps: [] },
];

/** @type {import('@godcreator/docsite-explainer/seam-graph').SeamEntry[]} */
const entries = [];

const collabSide = ['submit', 'sync', 'collabrules', 'leads', 'records'];
const otherSide = ['fetch', 'review', 'otherrules'];

/** @type {import('@godcreator/docsite-explainer/seam-graph').SeamInput[]} */
const seams = [
  /* ref file="../plugins/collab/src/organization/events/messages.ts" lines="13-17" hash="ee2c3573bee0" blob="1b71ff896128" */
  { n: 1, name: '位置消息', a: ['ntfytopic'], b: ['events'], iface: 'GET <push-url>/<各组织的 topic，逗号分隔>/json（长连接）', convention: false, via: 'code', text: '全部项目共用一条订阅，每个组织一个 topic；断了就重连。消息标题是 <组织>/<仓>，正文只说出了什么事：push <ref>、pr|issue|comment <动作> #<编号>、repo <动作>、leads changed。' },
  { n: 2, name: '组织 webhook', a: ['orghook'], b: ['events'], iface: 'GET /orgs/{org}/hooks · POST /orgs/{org}/hooks · PATCH /orgs/{org}/hooks/{id}', convention: false, via: 'code', text: '管理员身份时核对组织 webhook 发到这个组织的 ntfy topic、模板与事件对不对；collab.org.setup 时配好。' },
  { n: 3, name: '协作仓的事', a: ['events'], b: ['sync', 'leads', 'collabrules'], iface: 'collab-repo/events.ts 的 applyCollabRepoEvent：push → 取回 + 自动同步 · leads changed → 重读负责人 + 核对规矩', convention: false, via: 'code', text: '消息说的是协作仓，交给协作仓那一套自己定做哪几步，每一步经组织这一层传进来的函数做、出错由它按步记：有推送就取回并自动同步，leads changed 就重读负责人、再核对规矩。协作仓的合并请求、issue 与评论不处理，提交审核自己等结论。' },
  { n: 4, name: '别的仓的事', a: ['events'], b: ['fetch', 'review', 'otherrules'], iface: 'other-repos/events.ts 的 applyOtherRepoEvent、applyRepoEvent：push → 取回 · pr / issue / comment → 重读 · leads changed → 重读 + 核对 · repo created → 克隆', convention: false, via: 'code', text: '消息说的是别的仓，交给别的仓那一套自己定做哪几步，步与出错同 3：有推送就只取回那个仓；合并请求、issue、评论有动静就重读它；leads changed 再核对规矩；组织里建了仓就克隆进来；删仓只记一行，本机目录不动。' },
  { n: 5, name: '提交审核', a: ['submit'], b: ['collabprs'], iface: 'git push origin HEAD:refs/for/main → GET /pulls/<编号>（等结论）', convention: false, via: 'code', text: '用 AGit 推成合并请求，等执行器合并或打回；等不到结论就自己关掉它。' },
  { n: 6, name: '取回 main', a: ['collabmain'], b: ['sync'], iface: 'git fetch origin', convention: false, via: 'code', text: '取回别人合进 main 的新提交。' },
  { n: 7, name: '协作仓的规矩', a: ['collabrules'], b: ['collabprotect'], iface: '核对 GET /repos/…（admin）· /collaborators · /branch_protections/main；配好 PATCH /repos/… · PUT/DELETE /collaborators/{login} · POST/PATCH /branch_protections', convention: false, via: 'code', text: '管理员身份时核对负责人与 main 的保护（不核对合并方式）；collab.repo.setup 时配好。' },
  { n: 8, name: '协作者', a: ['collaborators'], b: ['leads'], iface: 'GET /repos/<组织>/<协作仓>/collaborators', convention: false, via: 'code', text: '协作仓的协作者就是项目负责人。' },
  { n: 9, name: '负责人', a: ['leads'], b: ['records'], iface: 'projectLeadsOf(gitea, project) → ProjectLeads', convention: false, via: 'code', text: '删任务与模块时经 Gitea 现读项目负责人，当 projectLeads 参数传给数据模型包的写入规则。' },
  { n: 10, name: '在 main 上提交', a: ['submit'], b: ['worktree'], iface: 'git add --all · git commit -- collab site · git merge --no-edit origin/main · 失败时 git reset --mixed', convention: false, via: 'disk', text: '提交 collab/ 与 site/ 的改动，再把 origin/main 合进来。合 main 有冲突就停在半路、冲突标记留在文件里；推送前拦下、推送失败、被打回或超时，就退回推送时的 origin/main，改动回到工作区。' },
  /* ref file="../plugins/collab/src/index.ts" lines="61-62" hash="df45d6673e59" blob="23cf8898bf72" */
  { n: 11, name: '快进与本机状态', a: ['sync'], b: ['worktree'], iface: 'git merge --ff-only origin/main · git status --porcelain · 监视文件', convention: false, via: 'disk', text: '能快进就快进；文件一变（停下 300 毫秒）就重算还没提交审核的文件、冲突、在不在 main 上。' },
  { n: 12, name: '记录与评论', a: ['records'], b: ['collabdir'], iface: 'readCollabSnapshot · createRecord / updateRecord / deleteRecords · readCommentThreads(site/comments)', convention: false, via: 'disk', text: '任务与模块的命令只读写工作区，不提交，写完由人或 AI 调提交审核；待办另读人员列表与评论串，只读。' },
  { n: 13, name: '取回别的仓', a: ['otherbranches', 'orgrepos'], b: ['fetch'], iface: 'git fetch origin（每个别的仓）· GET /orgs/{org}/repos → git clone（组织里新加的仓）', convention: false, via: 'code', text: '逐个取回别的仓；组织里新加的仓克隆进项目文件夹。' },
  { n: 14, name: 'PR 与 issue', a: ['otherprs'], b: ['review'], iface: 'GET /repos/…/pulls · /pulls/{n}/reviews · /issues · /issues/{n}/comments · /collaborators', convention: false, via: 'code', text: '我是负责人时：等我审阅的合并请求、轮到负责人回的 issue；不论是不是负责人：我开的合并请求被要求修改或有新评论、我提的 issue 有负责人回了。' },
  { n: 15, name: '别的仓的规矩', a: ['otherrules'], b: ['otherprotect'], iface: '核对 GET /repos/…（admin）· /collaborators · /branch_protections/main；配好 PATCH /repos/… · PUT/DELETE /collaborators/{login} · POST/PATCH /branch_protections', convention: false, via: 'code', text: '管理员身份时核对负责人与 main 的保护（不核对合并方式）；collab.repo.setup、collab.repo.create 时配好。' },
  { n: 16, name: '快进与看 HEAD', a: ['fetch'], b: ['otherwt'], iface: 'collab.repos.update（只快进）· git rev-list --left-right --count · 监视 .git', convention: false, via: 'disk', text: '人要求时才快进；HEAD 或分支一变就重新比较本地与服务器同名分支。' },
  { n: 17, name: '协作仓的状态', a: collabSide, b: ['compute'], iface: 'collabSync.localStateOf · syncProblemOf · submitFailures.failureOf · collabRules.problemsOf · collabLeads.leadsOf · collabRecordsStateOf', convention: false, via: 'code', text: '协作仓那一套各自交出此刻的状态：还没提交审核的文件与冲突、同步问题、提交失败、规矩不对、项目负责人、记录读不对与找我的待办。各目录不认识通知，状态变了只调 changed(repo)，通知再回头现读。' },
  { n: 18, name: '别的仓的状态', a: otherSide, b: ['compute'], iface: 'otherFetch.headsOf · otherReview.reviewsOf · otherRules.problemsOf', convention: false, via: 'code', text: '别的仓那一套交出未推送、未拉取、分叉，等我审的合并请求、轮到负责人回的 issue、我开的合并请求与我提的 issue 有了回应，规矩不对。' },
  { n: 19, name: 'webhook 与出错', a: ['events'], b: ['compute'], iface: 'webhooks.problemOf · events.errorsOf · events.refreshedOnce', convention: false, via: 'code', text: '组织 webhook 配得不对、刷新各步的出错（成为 check-error 通知），以及第一次完整刷新做完没有：没做完之前不交给接口 B。推送订阅断了不进通知，只在窗格里显示。' },
  { n: 20, name: '推给网站的数据', a: ['compute'], b: ['keep'], iface: 'sites.feedChanged(repo) → notifications.feedOf(repo) → SiteFeed', convention: false, via: 'code', text: '通知或项目负责人一变就排一条队，轮到时现算那一刻最新的整份交过去，由站点这一块经 gwb-docsite 推出去（27）。' },
  /* ref file="../plugins/collab/src/site-process/collab-sites.ts" lines="12-13" hash="9609441c20a9" blob="cb30a59e92cd" */
  { n: 21, name: '站点在不在运行', a: ['keep'], b: ['pane'], iface: 'sites.stateOf(repo) → { url, running, error }', convention: false, via: 'code', text: '窗格一行里的站点链接、在不在运行（没运行时链接是 gwb-docsite 按 site/package.json 的 dev 脚本里写的端口预期的地址），以及原因：托管前检查不过（协议号对不上、站点检查不过），或 gwb-docsite 报的（没装依赖、常驻失败停下）。' },
  { n: 22, name: '计数', a: ['compute'], b: ['pane'], iface: 'notificationCountsOf(notifications.currentOf(repo).notifications)', convention: false, via: 'code', text: '窗格一行里通知各组几条，和网站提示栏收起时用同一个函数。' },
  { n: 23, name: '此刻的通知', a: ['compute'], b: ['handoff'], iface: 'notifications.currentOf(repo) → { project, notifications, nameOf }', convention: false, via: 'code', text: '交给 AI 时取这个项目此刻的全部通知，连同按用户名查显示名的函数。' },
  { n: 24, name: '列出与新建仓', a: ['setup'], b: ['orgrepos'], iface: 'GET /orgs/{org}/repos · POST /orgs/{org}/repos', convention: false, via: 'code', text: '克隆组织时列出组织里的仓；collab.repo.create 在组织里建私有仓，再照别的仓的规矩配好、克隆进来。' },
  { n: 25, name: 'leads changed', a: ['setup'], b: ['ntfytopic'], iface: 'POST <push-url>/collab-<组织>（Title <组织>/<仓>）leads changed', convention: false, via: 'code', text: '新建仓、照规矩配好一个仓之后，往组织的 topic 发一条 leads changed：各成员的插件收到就重读那个仓的负责人、核对规矩。' },
  /* ref file="../plugins/collab/src/project/qq-task-groups.ts" lines="28-37" hash="1ac368d749d4" blob="d00a2439ab7c" */
  { n: 26, name: '任务组', a: ['project'], b: ['qqgroups'], iface: 'gwbQqBot.registerTaskGroup({ command, title, workspace, agent: "zcode", instructions }) → 撤掉注册的函数', convention: false, via: 'code', text: '起了 QQ 命令的项目各注册一个任务组：命令是本 home 起的 QQ 命令，名字是站名，工作区是项目文件夹，要求只写项目名、协作仓路径和先读说明书 collab。变了就撤掉旧的再注册，qq-bot 抛错的原话记在 collab.projects 的 qqTaskGroup 里。' },
  /* ref file="../plugins/collab/src/site-process/collab-sites.ts" lines="9-10" hash="621f6ea7f475" blob="cb30a59e92cd" */
  /* ref file="../plugins/collab/src/site-process/collab-sites.ts" lines="80-89" hash="d1b31246bb86" blob="cb30a59e92cd" */
  { n: 27, name: '初始化、托管与推送', a: ['keep'], b: ['hosting'], iface: "gwbDocsite.init(<仓根>/site, { features }) · gwbDocsite.keep / forget / open / stop / status / whileStopped(<仓根>/site) · gwbDocsite.push(<仓根>/site, 'collab', feed)", convention: false, via: 'code', text: 'collab.site.init 交给 gwb-docsite 照模板写出站点或重写骨架，功能包范围写成插件打包时带的那一版；查过的站点交给 gwb-docsite 常驻；collab.site.start、collab.site.stop、装依赖时经它启动、停止；推给网站的数据推到站点推送通道的频道 collab，站点没在运行时它记着最新的一份，启动后补推。' },
  /* ref file="../plugins/collab/src/project/project.ts" lines="89-119" hash="3f314c7e2600" blob="5507995a33f1" */
  { n: 28, name: '身份码', a: ['project'], b: ['identity'], iface: 'gwbDocsite.identityCode() → personOfCode(site/people.json) · gwbDocsite.join(<仓根>/site, { id, name, gitea })', convention: false, via: 'code', text: '打开项目时取本 home 的身份码，在 site/people.json 里认出身份（就是 Gitea 用户名），不在里面就拒绝；collab.project.join 与克隆项目时经 gwb-docsite 把身份码加进令牌账号那一项。' },
];

export const gwbCollabGraph = defineSeamGraph({
  id: 'gwb-collab',
  title: 'gwb-collab 内部的接缝图',
  intro:
    'gwb-collab 里谁把什么交给谁。左边浅底是协作仓那一套（collab-repo/），右边浅底是别的仓那一套（other-repos/），每个目录只管一种仓，线只连它自己那种仓在 Gitea 上与本机上的两头；中间是组织级的（organization/）与共用的通知、站点、协作窗格、交给 AI。两边各自把此刻的状态交给通知，通知再交给站点、窗格与 AI。下边沿的半圆缺口是可以替换的接口：A 交给 AI、B 发通知。最下一排左边是 gwb-docsite：站点交给它初始化与托管、数据经它推，身份码也从它取；它右边的项目登记把起了 QQ 命令的项目注册成 QQ 机器人的任务组。虚线框与彩色方块是插件里的目录与文件，实线框是插件外的东西。',
  frameLabel: '目录',
  modules,
  entries,
  seams,
});
