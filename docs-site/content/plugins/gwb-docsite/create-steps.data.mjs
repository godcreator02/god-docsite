/**
 * CreateSteps（「gwb-docsite：文档站插件」那一页）的全部数据，画面（create-steps.tsx）只读这一份。
 * 讲 docfirst.create 怎么把一个空目录变成 docfirst 站：前四步就是普通的 init（docsite.site.init 同样走这四步），
 * 第 5 步起是 docfirst.create 多做的。
 * 站名沿用正文例子的「文档站」；版本号取本仓各包 package.json 的当前版本（docfirst 0.1.0、code-pin 0.2.1、
 * trajectory 0.1.0、explainer 0.1.1）——docfirst.create 实际写的是「插件旁边装着的那一版」的 ^<版本>。
 * 终端里 Local: 一行的格式照 dev-server 的 localUrlOf 认的写法；终端里的说明行（「GET / → 200」那类）是为讲解拼的，不是命令输出。
 */

/** init 写进站点的 people.json 第一项（也是唯一一项），逐字照抄 create.ts 的 initialPeople */
/* ref file="../plugins/docsite/src/scaffold/create.ts" lines="27-28" hash="431330bcc18b" blob="4b12283124e4" */
export const initialPeopleEntry = { id: 'claude', name: 'Claude', agent: true }

/** init 的四步：复制模板、pnpm install、补基础功能、起服务检查首页 */
/* ref file="../plugins/docsite/src/scaffold/create.ts" lines="30-51" hash="b8c4b29e4251" blob="4b12283124e4" */

/** docfirst.create 的全部步骤：init → 叠起始物 → 写脚本 → 逐个加功能包 */
/* ref file="../plugins/docsite/src/docfirst/docfirst-site.ts" lines="93-108" hash="20149c93d1a3" blob="13d704e93d26" */

/** 写进站点 package.json 的 doc 系列脚本，逐字照抄 DOCFIRST_SCRIPTS */
/* ref file="../plugins/docsite/src/docfirst/docfirst-site.ts" lines="17-21" hash="33b3d832abaf" blob="e8cc22e938c5" */
export const docfirstScripts = {
  doc: 'docfirst check',
  'doc:confirm': 'docfirst confirm',
  'doc:render': 'docfirst render',
}

/** 叠到站点根的 docfirst 起始物（相对站点根），照 packages/docfirst/template/ 的实际文件 */
export const docfirstTemplateFiles = [
  'docfirst.config.mjs',
  'content/docs/meta.json',
  'content/docs/outputs/agents.mdx',
  'content/docs/outputs/claude.mdx',
  'content/docs/outputs/readme.mdx',
  'content/future/meta.json',
  'content/future/overview.mdx',
  'trajectory/2026-01-01-site-born.md',
]

/**
 * 站目录的树：按最终长好的样子先序排列，step 是它第几步出现；每步的画面只显示 step 不大于当前步的节点，
 * 当前步出现的标 good。package.json 在第 6、7 步被改写（不是新文件），标「改」。
 */
export const treeNodes = [
  { id: 'app', name: 'app/', depth: 0, dir: true, step: 1, note: '模板的 React Router 应用' },
  { id: 'features', name: 'features/', depth: 1, dir: true, step: 3 },
  { id: 'features-comments', name: 'comments/', depth: 2, dir: true, step: 3, note: '评论的接线文件' },
  { id: 'features-code-pin', name: 'code-pin/', depth: 2, dir: true, step: 7 },
  { id: 'features-trajectory', name: 'trajectory/', depth: 2, dir: true, step: 7 },
  { id: 'features-explainer', name: 'explainer/', depth: 2, dir: true, step: 7 },
  { id: 'content', name: 'content/', depth: 0, dir: true, step: 1 },
  { id: 'content-meta', name: 'meta.json', depth: 1, step: 1, note: 'title：文档站' },
  { id: 'content-start', name: 'start.mdx', depth: 1, step: 1 },
  { id: 'content-docs', name: 'docs/', depth: 1, dir: true, step: 5 },
  { id: 'content-docs-meta', name: 'meta.json', depth: 2, step: 5 },
  { id: 'content-docs-outputs', name: 'outputs/', depth: 2, dir: true, step: 5, note: 'agents · claude · readme 三份正本' },
  { id: 'content-future', name: 'future/', depth: 1, dir: true, step: 5 },
  { id: 'content-future-meta', name: 'meta.json', depth: 2, step: 5 },
  { id: 'content-future-overview', name: 'overview.mdx', depth: 2, step: 5 },
  { id: 'docfirst-config', name: 'docfirst.config.mjs', depth: 0, step: 5 },
  { id: 'docsite-json', name: 'docsite.json', depth: 0, step: 1, note: 'kind：docs' },
  { id: 'node-modules', name: 'node_modules/', depth: 0, dir: true, step: 2, note: '三个平台包装好了' },
  { id: 'package-json', name: 'package.json', depth: 0, step: 1, note: '平台依赖 ^0.1.0', modifiedSteps: [6, 7] },
  { id: 'people-json', name: 'people.json', depth: 0, step: 1, note: '只有 agent claude' },
  { id: 'workspace-yaml', name: 'pnpm-workspace.yaml', depth: 0, step: 1 },
  { id: 'trajectory', name: 'trajectory/', depth: 0, dir: true, step: 5 },
  { id: 'trajectory-first', name: '2026-01-01-site-born.md', depth: 1, step: 5, note: '第一张轨迹卡' },
  { id: 'vite-config', name: 'vite.config.ts', depth: 0, step: 1, note: 'tsconfig 等配置也来自模板' },
]

/** 每步右侧摆的东西：这一步的命令，或写进去的内容 */
export const steps = [
  {
    title: '建站器复制模板',
    pill: false,
    pane: {
      kind: 'pane',
      title: '写进站点的东西',
      icon: 'file',
      lines: [
        { tone: 'none', text: '站名「文档站」写进 content/meta.json 的 title；' },
        { tone: 'none', text: '平台包三个依赖（god-docsite、identity、comments）写成插件旁边装着的那一版的 ^0.1.0；' },
        { tone: 'none', text: 'people.json 只有一项，是 agent：' },
        { tone: 'code', text: '[' },
        { tone: 'code', text: '  {' },
        { tone: 'code', text: '    "id": "claude",' },
        { tone: 'code', text: '    "name": "Claude",' },
        { tone: 'code', text: '    "agent": true' },
        { tone: 'code', text: '  }' },
        { tone: 'code', text: ']' },
        { tone: 'none', text: '插件接着写身份文件 docsite.json，docfirst.create 建的是文档站：' },
        { tone: 'code', text: '{ "kind": "docs", "format": 1 }' },
      ],
    },
    text: '建站器 createSite 复制平台包 template/ 的全部文件（gitignore 写回成 .gitignore），写站名、people.json、pnpm-workspace.yaml 与空的功能汇总文件；插件接着写身份文件 docsite.json（docsite.site.init 写 base）。模板文件写完就归站点，不装依赖、不起服务。',
  },
  {
    title: 'pnpm install',
    pill: false,
    pane: {
      kind: 'terminal',
      title: '站目录',
      lines: [
        { text: 'pnpm install', kind: 'cmd' },
        { text: '装上 package.json 里的三个平台包', kind: 'out' },
      ],
    },
    text: '在站点目录装依赖。第二行的说明不是 pnpm 的输出。评论的接线文件要从装好的 comments 包里取，所以下一步必须在装依赖之后。',
  },
  {
    title: '补评论这个基础功能',
    pill: false,
    pane: {
      kind: 'pane',
      title: 'app/features/comments/',
      icon: 'folder',
      lines: [
        { tone: 'code', text: 'comments.tsx · feature.tsx · routes.ts · styles.css' },
        { tone: 'none', text: '四份文件照装好的 comments 包的 template/ 补进来，' },
        { tone: 'none', text: '同时重写功能汇总文件——这是每个基础站都有的功能' },
      ],
    },
    text: 'addBaseFeatures 补评论的全站评论页、侧栏入口、样式与评论写入路由，以及身份的头像写入路由，重写功能汇总文件。重复运行只补缺的文件。',
  },
  {
    title: '启动开发服务、检查首页',
    pill: false,
    pane: {
      kind: 'terminal',
      title: '首页检查',
      lines: [
        { text: 'pnpm dev', kind: 'cmd' },
        { text: '➜  Local:   http://127.0.0.1:14001/', kind: 'out' },
        { text: 'GET / → 200，通过；新站没登记在 sites，停掉', kind: 'ok' },
      ],
    },
    text: 'checkHomePage 启动开发服务、GET / 看是不是 200：进程活着不等于站能用，缺依赖、模板有错时服务起得来、页面 500。通过后登记在 sites 里的站保持运行，没登记的停掉；没通过就报错、站点留着运行，报错在浏览器里看。',
  },
  {
    title: '叠 docfirst 起始物',
    pill: true,
    pane: {
      kind: 'pane',
      title: '叠到站点根的文件',
      icon: 'file',
      lines: [
        ...docfirstTemplateFiles.map((file) => ({ tone: 'code', text: file })),
        { tone: 'none', text: '已有的文件不覆盖；新站是空的，都叠得进来' },
      ],
    },
    text: '把 @godcreator/docfirst 的 template/ 叠到站点根：docfirst 的配置、现状区 outputs 的三份正本（README、AGENTS、CLAUDE 的来源）、未来区的起始页、第一张轨迹卡。',
  },
  {
    title: '写 doc 脚本与依赖',
    pill: true,
    pane: {
      kind: 'pane',
      title: 'package.json 新增的两段',
      icon: 'file',
      lines: [
        { tone: 'code', text: '"scripts": {' },
        { tone: 'code', text: '  "doc": "docfirst check",' },
        { tone: 'code', text: '  "doc:confirm": "docfirst confirm",' },
        { tone: 'code', text: '  "doc:render": "docfirst render"' },
        { tone: 'code', text: '},' },
        { tone: 'code', text: '"devDependencies": {' },
        { tone: 'code', text: '  "@godcreator/docfirst": "^0.1.0"' },
        { tone: 'code', text: '}' },
      ],
    },
    text: '往 package.json 写三个脚本与 devDependencies 里的 docfirst 命令行。写在加功能之前：第一次 addFeature 的 pnpm add 顺带把命令行装上，不用再装一次。站点已有同名脚本或这个依赖就报错，不替人改。',
  },
  {
    title: '加三个功能包',
    pill: true,
    pane: {
      kind: 'terminal',
      title: '站目录',
      lines: [
        { text: 'pnpm add @godcreator/code-pin@^0.2.1', kind: 'cmd' },
        { text: '补 app/features/code-pin/、重写汇总文件、启动后检查首页', kind: 'out' },
        { text: 'pnpm add @godcreator/trajectory@^0.1.0', kind: 'cmd' },
        { text: '同样：补文件、重写汇总、检查首页', kind: 'out' },
        { text: 'pnpm add @godcreator/explainer@^0.1.1', kind: 'cmd' },
        { text: '加完三个，站停在 stopped（没登记，检查完就停）', kind: 'out' },
      ],
    },
    text: '逐个调 addFeature 加 code-pin、trajectory、explainer，每个都是 pnpm add → 建站器补功能目录里缺的文件、重写汇总文件 → 启动开发服务检查首页。站点在运行时 addFeature 拒绝（要求先 docsite.site.stop）；docfirst.create 走到这里站点都不在运行——每轮首页检查结束时，没登记的站已经停掉。中途失败时前面做完的不回退，报错写明卡在哪一步。',
  },
]
