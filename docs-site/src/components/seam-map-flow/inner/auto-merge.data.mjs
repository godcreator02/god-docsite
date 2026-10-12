/**
 * 「执行器与自动合并」那一页的接缝图：一个合并请求从成员推送到进 main，经过 Gitea、NAS 上的执行器、合并检查包。
 * 执行器与合并检查包是这套工具的两块（有颜色），Gitea、协作仓 main、成员的插件在框外。坐标在 auto-merge.layout.ts。
 */
import { defineSeamGraph } from '@godcreator/docsite-explainer/seam-graph';

/** @type {import('@godcreator/docsite-explainer/seam-graph').SeamModule[]} */
const modules = [
  {
    id: 'plugin',
    name: '成员的工作台',
    pkg: 'gwb-collab',
    role: null,
    outside: true,
    blurb: '成员的 AI 调 collab.submit：把 collab/ 的记录与 site/ 的页面改动一起提交，推送前在本机按合并检查的第二条查一遍只有负责人能改的内容（经 Gitea 读协作仓的协作者，看自己是不是项目负责人），用 AGit 推到 refs/for/main，主题是自己的身份，再等执行器的结论。合并这一步插件不参与：合并了就回执，被打回就把改动退回成员的工作区。',
    caps: [{ id: 'submit', name: '提交审核', ident: 'collab.submit' }],
  },
  {
    id: 'gitea',
    name: 'Gitea',
    pkg: 'git.tianshen02.online:28377',
    role: null,
    outside: true,
    blurb: '收下 AGit 推送、开合并请求；按协作仓 main 上的工作流给执行器派任务，连同组织密钥一起交过去；执行器以机器人账号 collab-bot 调它的接口读协作仓的协作者（项目负责人）、合并，或者留言再关掉合并请求。合并检查包也发在它的 npm 源上，不登录就能装。',
    caps: [
      { id: 'actions', name: 'Actions 派任务', ident: 'pull_request_target' },
      { id: 'pulls', name: '合并请求', ident: 'refs/pull/<编号>/head' },
      { id: 'api', name: '合并请求接口', ident: '/pulls/<编号>' },
      { id: 'secret', name: '组织密钥', ident: 'COLLAB_BOT_TOKEN' },
      { id: 'npm', name: 'npm 源', ident: '@godcreator/collab-merge-check' },
    ],
  },
  {
    id: 'repo',
    name: '协作仓 main',
    pkg: '<组织>/collab',
    role: null,
    outside: true,
    blurb: '合并规则以协作仓 main 上的文件为准：工作流文件决定怎么检查、怎么合并、用哪一版合并检查包，site/package.json 里功能包那一项决定每个人电脑上运行的网站代码，人员列表决定谁能在网站上写。三样都只有项目负责人（Gitea 上协作仓的协作者，不记在仓里）能改：别人提交的、改了它们的合并请求被打回，项目负责人自己提交的放行。例外是人员列表里自己那一项（gitea 是提交人）的身份码 codes，谁都能给自己加减。site/package.json 里别的依赖谁都能加、能升级。',
    caps: [
      { id: 'workflow', name: '工作流', ident: 'collab-auto-merge.yaml' },
      { id: 'dep', name: '功能包版本', ident: 'site/package.json' },
      { id: 'people', name: '人员列表', ident: 'site/people.json' },
    ],
  },
  {
    id: 'runner',
    name: 'NAS 执行器',
    pkg: 'teamhub · gitea-runner',
    role: 'violet',
    outside: false,
    blurb: 'NAS 上 teamhub 项目里的 gitea-runner 容器，只登记了主机方式的标签 nas：任务直接在这个容器里运行。它不停向 Gitea 要任务，领到就照工作流执行。谁的电脑都不用开着。',
    caps: [
      { id: 'job', name: '检查并合并', ident: 'runs-on: nas' },
      { id: 'node', name: '按需装 Node', ident: 'apk add nodejs npm' },
      { id: 'cache', name: '检查工具', ident: '~/.cache 里按版本装' },
    ],
  },
  {
    id: 'site',
    name: '合并检查包',
    pkg: '@godcreator/collab-merge-check',
    role: 'blue',
    outside: false,
    blurb: '只查两条安全上的事：和 main 有没有冲突、有没有改只有负责人能改的内容。只运行 git、只看路径、site/package.json 的键与 site/people.json 里改了哪几项，只依赖数据模型包里项目仓的布局（collab/、site/ 两个路径）；gwb-collab 推送前在本机查的是同一个函数。记录格式与站点由成员提交前在本机查，这里不查。工作流模板也随这个包发布。',
    caps: [
      { id: 'cli', name: '合并检查', ident: 'collab-merge-check · checkMerge' },
      { id: 'model', name: '冲突', ident: 'git merge-tree' },
      { id: 'sitecheck', name: '只有负责人能改的', ident: 'leadOnlyProblems' },
    ],
  },
];

/** @type {import('@godcreator/docsite-explainer/seam-graph').SeamEntry[]} */
const entries = [{ id: 'ai', name: '成员的 AI', to: 'submit' }];

/** @type {import('@godcreator/docsite-explainer/seam-graph').SeamInput[]} */
const seams = [
  {
    n: 1,
    name: '推成合并请求',
    a: ['submit'],
    b: ['pulls'],
    iface: 'git push origin HEAD:refs/for/main -o topic=<身份> -o title=<标题>',
    convention: false,
    via: 'code',
    text: '推到 refs/for/main 的提交不进任何分支，Gitea 用它开一个合并请求，推送的输出里写着它的网页地址，插件从这里认出编号。推送之前插件已把 origin/main 合进本地 main，推上去的是和最新 main 合好的结果。',
  },
  /* ref file="../packages/collab-merge-check/templates/collab-auto-merge.yaml" lines="11-11" hash="c0c2a5f83c6e" blob="934ddc567b5a" */
  /* ref file="../packages/collab-merge-check/templates/collab-auto-merge.yaml" lines="21-21" hash="f03d8b7ce442" blob="38412d8b2e58" */
  {
    n: 2,
    name: '派任务',
    a: ['actions', 'secret'],
    b: ['job'],
    iface: 'on: pull_request_target · runs-on: nas · secrets.COLLAB_BOT_TOKEN',
    convention: false,
    via: 'code',
    text: '合并请求开出来或更新了，Gitea 按 main 上的工作流排一个任务，只派给带 nas 标签的执行器；组织密钥 COLLAB_BOT_TOKEN 随任务交过去，只在这次运行的环境变量里，日志里被遮掉。',
  },
  {
    n: 3,
    name: '读工作流',
    a: ['workflow'],
    b: ['actions'],
    iface: '.gitea/workflows/collab-auto-merge.yaml（main 上那份）',
    convention: false,
    via: 'disk',
    text: 'pull_request_target 读的永远是 main 上的工作流：合并请求里改了工作流也不生效，成员改不了检查规则，也拿不走密钥。文件照合并检查包的 templates/collab-auto-merge.yaml 放进每个协作仓。',
  },
  /* ref file="../packages/collab-merge-check/templates/collab-auto-merge.yaml" lines="60-61" hash="e86ef32d6d5a" blob="38412d8b2e58" */
  {
    n: 4,
    name: '取代码',
    a: ['job'],
    b: ['pulls'],
    iface: 'git fetch main · refs/pull/<编号>/head',
    convention: false,
    via: 'code',
    text: '执行器用机器人账号的令牌取回 main 和合并请求的提交，放在一个临时目录里，不碰任何人的工作区。取到的提交和 Gitea 报的对不上（检查前又推了新提交），这次就不做，交给新提交触发的那一次。',
  },
  /* ref file="../packages/collab-merge-check/templates/collab-auto-merge.yaml" lines="14-16" hash="8b879d77666f" blob="38412d8b2e58" */
  /* ref file="../packages/collab-merge-check/templates/collab-auto-merge.yaml" lines="70-91" hash="64585ea46400" blob="38412d8b2e58" */
  {
    n: 5,
    name: '装检查工具',
    a: ['workflow', 'npm'],
    b: ['cache'],
    iface: 'npm install @godcreator/collab-merge-check@$MERGE_CHECK_RANGE（写在工作流文件的 env 里）',
    convention: false,
    via: 'code',
    text: '检查用的合并检查包版本写在 main 上工作流文件的 MERGE_CHECK_RANGE 里，升版本就是负责人改这一行，和成员网站用的功能包版本无关。只装合并检查包（连同它依赖的数据模型包，不装功能包），按版本范围装在执行器的缓存目录里，第一次要半分钟左右，之后几乎不花时间。',
  },
  /* ref file="../packages/collab-merge-check/templates/collab-auto-merge.yaml" lines="74-91" hash="d935d8a9bfaa" blob="38412d8b2e58" */
  /* ref file="../packages/collab-merge-check/src/check.ts" lines="177-190" hash="d187b8e75c98" blob="c0f8c11da687" */
  /* ref file="../packages/collab-merge-check/src/check.ts" lines="54-66" hash="3c9728724728" blob="c0f8c11da687" */
  /* ref file="../packages/collab-merge-check/src/check.ts" lines="87-90" hash="fa8852f23b53" blob="c0f8c11da687" */
  /* ref file="../packages/collab-merge-check/src/check.ts" lines="124-150" hash="dbd0dcb5fd3f" blob="c0f8c11da687" */
  {
    n: 6,
    name: '合并检查',
    a: ['job'],
    b: ['cli'],
    iface: 'collab-merge-check --base main --head refs/collab/pull --author <提交人> --leads <协作仓的协作者，逗号分隔> → 退出码 0 能合 / 1 不能合 / 2 参数错',
    convention: false,
    via: 'code',
    text: '工作流先用机器人令牌读协作仓的协作者（项目负责人），和提交人一起交给命令行，两个参数都必填；协作仓没有协作者就报错、不合并。两条：没有冲突；没改只有负责人能改的内容（执行器工作流、人员列表 site/people.json——提交人只给自己那一项加减身份码的不算、站点的装包设置与根目录下 Node 会执行的配置文件、site/package.json 里依赖以外的键与功能包那一项、写成网址或本地路径的依赖），或者提交人在 --leads 里。有冲突就不再往下查。记录格式与站点由成员的插件提交前在本机查（合 main 之前、之后各一次），执行器不查；也不查谁改了谁的记录、有没有删记录。检查的是合并之后的结果，合并请求落后于 main 时，它缺的东西不算它删的。',
  },
  /* ref file="../packages/collab-merge-check/templates/collab-auto-merge.yaml" lines="107-130" hash="e79881df51d9" blob="38412d8b2e58" */
  /* ref file="../plugins/collab/src/collab-repo/rules.ts" lines="5-6" hash="0388cffaba4b" blob="635892e2fc80" */
  {
    n: 7,
    name: '合并或打回',
    a: ['job'],
    b: ['api'],
    iface: "GET /pulls/<编号> · POST /pulls/<编号>/merge { Do: 'merge', head_commit_id } · POST /issues/<编号>/comments · PATCH /pulls/<编号> { state: 'closed' }",
    convention: false,
    via: 'code',
    text: '先看合并请求还开不开着，已经关了（提交人那边等结论超时关掉的）就不处理。退出码 0 就以 collab-bot 按「合并提交」方式合并，带上检查过的提交号：检查之后又推了新提交，Gitea 拒绝这次合并。退出码 1、或者合并被 Gitea 拒绝，就打回：把原话留在合并请求上，再关掉它。所以协作仓的合并请求不会开着等人。collab-bot 在组织的团队 bots 里，只对协作仓有写权限；协作仓 main 的合并许可里只有团队 bots，负责人也不在里面（collab.repo.setup 配协作仓时写上）。',
  },
  /* ref file="../plugins/collab/src/collab-repo/submit/submit.ts" lines="101-110" hash="c7ad49a13e36" blob="92a88843de16" */
  /* ref file="../plugins/collab/src/gitea-api/gitea.ts" lines="136-152" hash="3895c49c189a" blob="8b0b4e575493" */
  {
    n: 8,
    name: '等结论',
    a: ['submit'],
    b: ['api'],
    iface: "GET /pulls/<编号>（每 2 秒，最多 3 分钟）· GET /issues/<编号>/comments · 到时限 PATCH /pulls/<编号> { state: 'closed' }",
    convention: false,
    via: 'code',
    text: 'collab.submit 推完不返回，经 gwb-gitea 每 2 秒查一次合并请求，直到它关闭：合并了就回执；被打回就读最后一条留言，把改动退回成员的工作区，报出留言；3 分钟还开着，插件自己关掉它、同样退回，说执行器可能没在运行。',
  },
];

export const autoMergeGraph = defineSeamGraph({
  id: 'auto-merge',
  title: '自动合并的接缝图',
  intro:
    '成员推送之后，合并这一步由 NAS 上的执行器做：Gitea 按协作仓 main 上的工作流给它派任务，它装上合并检查包，检查通过就以机器人账号 collab-bot 合并，不通过就留言再关掉合并请求；成员的插件一直等到这个结论。',
  frameLabel: '模块',
  modules,
  entries,
  seams,
});
