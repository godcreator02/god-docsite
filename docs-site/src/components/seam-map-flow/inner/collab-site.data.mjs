/**
 * 功能包 @godcreator/collab-site 的包内接缝图（功能包首页用），用数据流的画法（flow-seam-diagram.tsx）：<SeamMap module="collab-site" />。
 * 线表示谁把什么交给谁；数据模型包与 site-data.ts 不送东西，画成格式约定。
 * 坐标、送什么、箭头方向在 collab-site.layout.ts。
 */
import { defineSeamGraph } from '@godcreator/docsite-explainer/seam-graph';

/** @type {import('@godcreator/docsite-explainer/seam-graph').SeamModule[]} */
const modules = [
  {
    id: 'gwb-collab',
    name: 'gwb-collab',
    pkg: '插件',
    role: null,
    outside: true,
    blurb: '插件不直接调这个包：通知与项目负责人经基础插件 gwb-docsite 推给站点，建站时经 gwbDocsite.init 把它的范围写进新站。',
    caps: [
      { id: 'hosting', name: '站点托管', ident: 'CollabSites' },
      { id: 'submit', name: '提交审核', ident: 'submit-checks.ts' },
    ],
  },
  {
    id: 'docsite',
    name: '基础包',
    pkg: '@godcreator/docsite-kit',
    role: null,
    outside: true,
    blurb: '文档站基础包与基础插件 gwb-docsite：站点骨架的模板与初始化（骨架经初始化生成的 app/site/ 引入这个包的 ./routes、./site、./site-server），推送通道（插件推、站点收）、按本 home 的身份码在 people.json 里认人。功能包把基础包与各能力包写成 peer 依赖，由站点自己装。',
    caps: [
      { id: 'feed', name: '推送通道', ident: 'siteFeedOf · useSiteFeed' },
      { id: 'identity', name: '身份与人员', ident: 'siteIdentity · sitePeople' },
    ],
  },
  {
    id: 'server',
    name: '服务端函数',
    pkg: 'src/server/',
    role: 'blue',
    outside: false,
    blurb: '出口 ./server：布局数据与路由模块的 loader、action 调的函数。站点目录是进程的当前目录，协作仓是它的上一级；读 collab/records/ 算出任务与模块，读推送通道里 gwb-collab 推来的那一份，写任务与模块只经数据模型包的写入规则。',
    caps: [
      { id: 'sitedata', name: '协作数据', ident: 'collabSiteData' },
      { id: 'write', name: '写任务与模块', ident: 'collabRecordResponse' },
      { id: 'mentions', name: '日志里的进展', ident: 'recordJournalMentions' },
    ],
  },
  {
    id: 'feature',
    name: '交给基础包',
    pkg: 'src/ · src/routes/',
    role: 'amber',
    outside: false,
    blurb: '照基础包的功能包约定交给站点骨架的东西：./routes 的路由表指向包里的路由模块 src/routes/，./site 给侧栏的「任务」「日历」、MDX 组件、包住整个布局的 Provider 与正文上面的通知栏，./site-server 给整站布局的 loader 读协作数据；template/ 里只有日志页的集合，初始化时复制进站点。路由模块只把请求转给服务端函数、把数据交给界面组件，自己不写逻辑；骨架本身由基础包的模板写，不在这个包里。',
    caps: [
      { id: 'layout', name: '布局数据 · 外壳', ident: './site-server · ./site' },
      { id: 'routes', name: '路由模块', ident: './routes → src/routes/' },
      { id: 'mdx', name: 'MDX 组件', ident: './site 的 mdxComponents' },
      { id: 'journalcoll', name: '日志页集合', ident: 'template/…/journal.ts' },
    ],
  },
  {
    id: 'ui',
    name: '界面',
    pkg: 'src/ui/',
    role: 'violet',
    outside: false,
    blurb: '出口 ./ui，在浏览器里运行：把布局交来的协作数据放进 CollabDataProvider，任务页、任务与模块那一页、日历与日志页的顶栏、通知栏、RecordLink 都从它取；写任务与模块经 /api/collab。',
    caps: [
      { id: 'provider', name: '协作数据', ident: 'CollabDataProvider' },
      { id: 'writer', name: '写任务', ident: 'useCollabWriter' },
      { id: 'pages', name: '任务页 · 日历', ident: 'TasksPage · CalendarPage' },
      { id: 'bar', name: '通知栏', ident: 'NotificationBar' },
      { id: 'recordlink', name: '引用任务', ident: 'RecordLink' },
    ],
  },
  {
    id: 'journal',
    name: '日志页',
    pkg: 'journal*.ts',
    role: 'cyan',
    outside: false,
    blurb: '读站点 journal/ 下一天一篇的日志页：有哪些日子、每天的原文、引用了某条记录的段落（日志里的进展），以及文件名合不合规矩。',
    caps: [
      { id: 'journalfiles', name: '读日志页', ident: 'journalSourcesOf' },
      { id: 'journalmention', name: '反向链接', ident: 'journalMentionsOf' },
      { id: 'journalcheck', name: '文件名检查', ident: 'journalProblemsOf' },
    ],
  },
  {
    id: 'collab-model',
    name: '数据模型包',
    pkg: '@godcreator/collab-model',
    role: 'violet',
    outside: true,
    blurb: '功能包把它写成普通依赖。它定了 gwb-collab 推给站点的数据（通知列表与项目负责人）和 collab/records/ 里记录文件的格式；服务端函数用它的写入规则读写记录，界面用它的通知短句、去处与计数。',
    caps: [{ id: 'models', name: '通知 · 任务与模块', ident: '定 ①②③④ 的格式' }],
  },
  {
    id: 'site-data',
    name: '两侧的约定',
    pkg: 'site-data.ts',
    role: 'blue',
    outside: false,
    blurb: '不送东西，定了服务端与界面之间送的东西长什么样：布局交给界面的 CollabSiteData、写任务的接口地址与 action。服务端函数照着返回，界面照着读；只在这个包里用。',
    caps: [{ id: 'contract', name: '协作数据 · 写入请求', ident: '定 ⑦⑧⑨⑩ 的格式' }],
  },
  {
    id: 'collabrepo',
    name: '协作仓',
    pkg: '本机克隆',
    role: null,
    outside: true,
    blurb: '本机的协作仓：collab/records/ 里一条任务或一个模块一个 JSON 文件；site/ 是站点目录，journal/ 里是日志页。',
    caps: [
      { id: 'records', name: 'collab/records/', ident: '任务 · 模块' },
      { id: 'journaldir', name: 'site/journal/', ident: '<日期>.mdx' },
    ],
  },
];

/** @type {import('@godcreator/docsite-explainer/seam-graph').SeamEntry[]} */
const entries = [{ id: 'member', name: '成员 · 浏览器', to: 'ui' }];

/** @type {import('@godcreator/docsite-explainer/seam-graph').SeamInput[]} */
const seams = [
  /* ref file="../plugins/collab/src/site-process/collab-sites.ts" lines="94-108" hash="a1a8e51d3c73" blob="9c89664fae82" */
  {
    n: 1,
    name: '推数据',
    a: ['hosting'],
    b: ['feed'],
    iface: "gwbDocsite.push(siteDir, 'collab', { notifications, projectLeads })",
    convention: false,
    via: 'code',
    text: '通知或项目负责人一变，gwb-collab 就把整份交给 gwb-docsite，推进站点推送通道的频道 collab；站点没在运行就先记着，启动后补推。',
  },
  /* ref file="../packages/collab-site/src/server/index.server.ts" lines="20-42" hash="a268f706dc56" blob="c92ed3baa954" */
  {
    n: 2,
    name: '服务端读推来的数据与身份',
    a: ['feed', 'identity'],
    b: ['sitedata', 'write'],
    iface: "siteFeedOf('collab') · siteIdentity(siteDir) · sitePeople(siteDir)",
    convention: false,
    via: 'code',
    text: '服务端函数从推送通道取最新的一份，按数据模型包的 siteFeedOf 逐项查形状，还没推来时通知与负责人为 null；本机身份与人员列表由基础包按身份码认。',
  },
  /* ref file="../packages/collab-site/src/ui/collab-data.tsx" lines="14-22" hash="9e8fcc3d2b49" blob="1f1f384c53dc" */
  {
    n: 3,
    name: '界面收推送',
    a: ['feed'],
    b: ['provider'],
    iface: "useSiteFeed<SiteFeed>('collab') → revalidate()",
    convention: false,
    via: 'code',
    text: '浏览器里推来新的一份，CollabDataProvider 先用上它的通知与负责人，再让布局的 loader 重新读一遍，别人合进 main 的任务这样也会出现。',
  },
  /* ref file="../packages/collab-site/src/server/index.server.ts" lines="1-4" hash="fd48c10a435d" blob="c92ed3baa954" */
  /* ref file="../packages/collab-site/src/server/index.server.ts" lines="81-90" hash="1c30dd45fa51" blob="c92ed3baa954" */
  {
    n: 4,
    name: '读写记录',
    a: ['sitedata', 'write', 'mentions'],
    b: ['records'],
    iface: 'readCollabSnapshot · createRecord · updateRecord · deleteRecords（task-model/node）',
    convention: false,
    via: 'disk',
    text: '读：整份 collab/ 交给 collabState 算出任务与模块的当前状态。写：带上本机身份交给写入规则，删除时再带上项目负责人，通过了才写文件，拒绝回 422 与原话。',
  },
  /* ref file="../packages/collab-model/src/project-model/journal-files.ts" lines="5-6" hash="0ea152a2999b" blob="0da0c6852c9d" */
  /* ref file="../packages/collab-site/template/skeleton/app/lib/journal.ts" lines="3-4" hash="6f0253e17dc0" blob="d87a31d6e36e" */
  {
    n: 5,
    name: '日志页文件',
    a: ['journaldir'],
    b: ['journalfiles', 'journalcoll'],
    iface: 'site/journal/<YYYY-MM-DD>.mdx',
    convention: false,
    via: 'disk',
    text: '一天一篇的日志页。功能包读原文算日子与反向链接；模板复制进站点的 journal 集合把同一批文件编译成页面，路由模块 journal.tsx 在 /calendar/<日期> 显示。',
  },
  /* ref file="../packages/collab-site/src/server/index.server.ts" lines="45-51" hash="fc84c2db5ade" blob="c92ed3baa954" */
  {
    n: 6,
    name: '读日志页',
    a: ['journalfiles', 'journalmention'],
    b: ['sitedata', 'mentions'],
    iface: 'journalDatesOf · journalSourcesOf · journalMentionsOf',
    convention: false,
    via: 'code',
    text: '协作数据里带上有日志的日子；一条任务或一个模块那一页要「日志里的进展」时，按原文找出引用它的段落，段里引用的记录换成当前的标题。',
  },
  /* ref file="../packages/collab-site/src/site-server.ts" lines="4-7" hash="df4a9f5b8b56" blob="eb1cd9b165f0" */
  /* ref file="../packages/collab-site/src/routes/record.tsx" lines="7-22" hash="109be55f108e" blob="4757d0e747fe" */
  {
    n: 7,
    name: '交给路由',
    a: ['sitedata', 'mentions'],
    b: ['layout', 'routes'],
    iface: 'layoutData({ pages }) → collabSiteData(pages) → CollabSiteData · recordJournalMentions(recordId)',
    convention: false,
    via: 'code',
    text: '基础包骨架里整站布局的 loader 每次都调 layoutData 读一份协作数据（站里的页面清单由骨架交进来，任务链接页面时从里面选）；任务与模块那一页的路由模块 record.tsx 的 loader 另读日志里的进展。',
  },
  /* ref file="../packages/collab-site/src/site.tsx" lines="9-24" hash="243156ad2f3e" blob="6c553c81495b" */
  {
    n: 8,
    name: '交给界面',
    a: ['layout'],
    b: ['provider'],
    iface: 'Provider = <CollabDataProvider data> · PageTop = NotificationBar',
    convention: false,
    via: 'code',
    text: '基础包骨架的整站布局把 layoutData 读出的数据交给 ./site 的 Provider，它用 CollabDataProvider 包住整个页面；PageTop 的通知栏放在每一页正文上面。下面所有页面经 useCollabData 取同一份。',
  },
  /* ref file="../packages/collab-site/src/ui/requests.ts" lines="4-12" hash="4fb43bb49fb4" blob="af9a9066ae0a" */
  {
    n: 9,
    name: '写任务',
    a: ['writer'],
    b: ['routes'],
    iface: 'POST /api/collab { action: create | update | delete, record }',
    convention: false,
    via: 'code',
    text: '任务页与记录页写任务、模块时发这个请求；被拒时抛出原话显示在表单下面。写完等布局的 loader 重新读完才返回。',
  },
  /* ref file="../packages/collab-site/src/routes/collab.ts" lines="3-8" hash="9b6072b77dfa" blob="62b4eb4d3943" */
  {
    n: 10,
    name: '交给服务端写',
    a: ['routes'],
    b: ['write'],
    iface: 'collabRecordResponse(request) → Response',
    convention: false,
    via: 'code',
    text: '路由模块 src/routes/collab.ts 的 action 原样转交请求，回成 200、400、403、405、422 由服务端函数定。这条路由放在整站布局外面，不出页面。',
  },
  /* ref file="../packages/collab-site/src/ui/record-link.tsx" lines="95-96" hash="ce7b80764105" blob="edf0b6e2a1a2" */
  /* ref file="../packages/collab-site/src/site.tsx" lines="20-20" hash="450df78c09ce" blob="6c553c81495b" */
  {
    n: 11,
    name: 'MDX 组件',
    a: ['recordlink'],
    b: ['mdx'],
    iface: 'collabMdxComponents = { RecordLink }',
    convention: false,
    via: 'code',
    text: '经 ./site 的 mdxComponents 交给基础包骨架，并进 fumadocs 的 MDX 组件，内容页、日志页、评论正文里不用 import 就能写 <RecordLink id="…" />。',
  },
  /* ref file="../packages/collab-model/src/project-model/journal-files.ts" lines="9-20" hash="7eaac12ea424" blob="0da0c6852c9d" */
  {
    n: 12,
    name: '日志页的文件名',
    a: ['journalcheck'],
    b: ['submit'],
    iface: 'journalProblemsOf(siteDir) → string[]',
    convention: false,
    via: 'code',
    text: 'journal/ 里只能是 <真实日期>.mdx，不放子文件夹与别的文件：布局的 loader 读有日志的日子时按它报错，不合规矩整站打不开。提交审核前 gwb-collab 查它，有问题就不提交；站点的其余问题由 gwb-docsite 启动时查。',
  },
];

export const collabSiteGraph = defineSeamGraph({
  id: 'collab-site',
  title: '功能包内部的接缝图',
  intro:
    '功能包 @godcreator/collab-site 里谁把什么交给谁。左边是 gwb-collab 插件与基础包，中间是服务端函数与交给基础包骨架的出口、路由模块、日志页集合，右边浅底里是在浏览器里运行的界面；下面是日志页与本机协作仓。虚线框是包里的目录或文件，实线框是包外的东西；线带方向，线旁写送的是什么。数据模型包与 site-data.ts 不送东西，它们引出的点线接到自己定了格式的那几条线上。',
  frameLabel: '目录',
  modules,
  entries,
  seams,
});
