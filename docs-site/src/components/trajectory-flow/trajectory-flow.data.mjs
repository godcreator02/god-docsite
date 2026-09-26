/**
 * 「一批轨迹卡文件怎么变成星轨盘」的全部讲解数据：画面（trajectory-flow.tsx）与机读版规则（trajectory-flow.ai.mjs）都只读这一份。
 * 例子里的校验结果、模型、树、布局落点与两段命令行输出，是把下面五个卡文件放进一个临时项目
 * （docfirst.config.mjs 是一个空对象，没有现状区文档），实际运行 `docfirst check`、`docfirst trajectory`、
 * `buildTrajectory` 与 `new RingsLayout(model)` 得到的；包的输出格式变了要重新运行一遍再抄。
 */

const ROOT = '2026-06-01-docfirst';
const MARKER = '{/* ref file="../packages/docfirst-trajectory/src/parse.ts" lines="1-12" hash="da66cb5417e4" blob="f4b46a71d249" */}';

export const files = {
  dir: 'content/trajectory',
  cwd: '~/repo/docs-site',
  page: 'src/app/(trajectory-disk)/trajectory/page.tsx',
};

/**
 * 流水线的六段，第 i 步点亮第 i 段。role 是这段代码所在的包在整页里的颜色：
 * 卡文件 amber、docfirst-workflow blue、docfirst-trajectory violet、站 cyan；docfirst-fumadocs 只在第 6 步的画面里出现，用 emerald。
 * @typedef {'files' | 'read' | 'parse' | 'model' | 'layout' | 'page'} StageId
 * @typedef {{ id: StageId, name: string, pkg: string, exports: string, role: 'amber' | 'blue' | 'violet' | 'cyan' }} Stage
 * @type {Stage[]}
 */
export const stages = [
  { id: 'files', name: '卡文件', pkg: 'docs-site', exports: 'content/trajectory/*.mdx', role: 'amber' },
  { id: 'read', name: '读卡目录', pkg: 'docfirst-workflow/cards', exports: 'scanCardDir', role: 'blue' },
  { id: 'parse', name: '解析与校验', pkg: 'docfirst-trajectory', exports: 'scanCards → parseCardFile', role: 'violet' },
  { id: 'model', name: '建树、挑主干', pkg: 'docfirst-trajectory', exports: 'buildTrajectory', role: 'violet' },
  { id: 'layout', name: '布局', pkg: 'docfirst-trajectory', exports: 'RingsLayout', role: 'violet' },
  { id: 'page', name: '站上渲染', pkg: 'docs-site /trajectory', exports: 'loadTrajectory → StarDisk', role: 'cyan' },
];

/** 卡字段，顺序照 parse.ts 的 CARD_KEYS */
export const cardKeys = ['type', 'born-at', 'parent', 'label', 'domain'];

/**
 * 例子里的五个卡文件。code 是画面上的短代号，id 是卡身份（文件名去掉后缀）。
 * fields 按文件里的顺序写，lines 由 fields 与 body 拼出，和临时项目里的文件逐字相同。
 * @typedef {'R' | 'A' | 'B' | 'S' | 'D'} CardCode
 * @typedef {{ code: CardCode, id: string, label: string, fields: Array<[string, string]>, body: string[] }} CardSource
 * @typedef {CardSource & { file: string, lines: string[] }} ExampleCard
 * @type {CardSource[]}
 */
const cardSources = [
  {
    code: 'R',
    id: ROOT,
    label: 'docfirst',
    fields: [
      ['type', 'root'],
      ['born-at', '2026-06-01'],
      ['label', 'docfirst'],
    ],
    body: ['## 里程碑', '', '- 2026-06-05｜卡格式定下来｜frontmatter 改为逐行解析'],
  },
  {
    code: 'A',
    id: '2026-06-03-yaml-frontmatter',
    label: '用 YAML 库读 frontmatter',
    fields: [
      ['born-at', '2026-06-03T10:00'],
      ['parent', `[${ROOT}]`],
      ['label', '用 YAML 库读 frontmatter'],
      ['domain', '卡格式'],
    ],
    body: [],
  },
  {
    code: 'B',
    id: '2026-06-05-line-parser',
    label: '逐行解析 frontmatter',
    fields: [
      ['born-at', '2026-06-05T16:20'],
      ['parent', `[${ROOT}]`],
      ['label', '逐行解析 frontmatter'],
      ['domain', '卡格式'],
    ],
    body: ['supersedes:: [用 YAML 库读 frontmatter](2026-06-03-yaml-frontmatter.md)'],
  },
  {
    code: 'S',
    id: '2026-06-09-star-disk',
    label: '星轨盘',
    fields: [
      ['born-at', '2026-06-09T11:00'],
      ['parent', `[${ROOT}]`],
      ['label', '星轨盘'],
      ['domain', '盘面'],
    ],
    body: ['pivots-from:: [逐行解析 frontmatter](2026-06-05-line-parser.md)'],
  },
  {
    code: 'D',
    id: '2026-06-12-pin-in-card',
    label: '卡里钉一段 parse.ts',
    fields: [
      ['born-at', '2026/06/12'],
      ['parent', `[${ROOT}]`],
      ['label', '卡里钉一段 parse.ts'],
      ['domain', '卡格式'],
    ],
    body: [MARKER],
  },
];

/** @type {ExampleCard[]} */
export const cards = cardSources.map((card) => ({
  ...card,
  file: `${card.id}.mdx`,
  lines: ['---', ...card.fields.map(([key, value]) => `${key}: ${value}`), '---', ...(card.body.length > 0 ? ['', ...card.body] : [])],
}));

/**
 * 卡身份 → 短代号；不认识的身份直接报错
 * @param {string} id
 */
export function codeOf(id) {
  const card = cards.find((c) => c.id === id);
  if (card === undefined) throw new Error(`例子里没有身份为 ${id} 的卡`);
  return card.code;
}

/**
 * 短代号 → 卡；不认识的代号直接报错
 * @param {string} code
 */
export function cardOf(code) {
  const card = cards.find((c) => c.code === code);
  if (card === undefined) throw new Error(`例子里没有代号为 ${code} 的卡`);
  return card;
}

/**
 * scanCardDir 里依次发生的调用。role 标出函数在哪个包：blue 是 docfirst-workflow，violet 是 docfirst-trajectory。
 * @type {Array<{ call: string, role: 'blue' | 'violet', what: string }>}
 */
export const readCalls = [
  { call: 'readdir(dir)', role: 'blue', what: '列出目录这一层；目录不存在或读不了，整个函数返回 { cards: [], sick: [] }' },
  { call: 'pickCardFiles(names)', role: 'violet', what: '只留 .md 与 .mdx；同一个身份两种后缀都有时只留 .mdx' },
  { call: 'readFile + stat', role: 'blue', what: '并发读每个文件的全文与修改时间 mtimeMs' },
  { call: 'scanCards(files)', role: 'violet', what: '逐个解析与校验，再看整个目录的根卡（第 3 步），交回 { cards, sick }' },
  { call: 'checkDocfirstRefs(body)', role: 'blue', what: '对每张卡去掉 frontmatter 的正文逐行查引用记号，病追加进 sick' },
];

/** card-refs.ts 认的两种记号形态 */
export const refForms = ['@@docfirst ref … @@（整行草稿记号）', '{/* ref …、{/* tree …、{/* has … 这类正式记号'];

/**
 * 解析时的几道校验。钉码记号那一道在 docfirst-workflow 的 card-refs.ts 里，其余在 docfirst-trajectory 里：
 * 根卡那一道要看整个卡目录，在 scan.ts 的 crossFileProblems 里，其余逐张卡在 parseCardFile 里查。
 * @typedef {'presence' | 'shape' | 'root' | 'relation' | 'docfirst'} CheckId
 * @type {Array<{ id: CheckId, name: string, role: 'violet' | 'blue', rule: string }>}
 */
export const checks = [
  { id: 'presence', name: '存在性', role: 'violet', rule: 'born-at、label 所有卡必填；parent 非根卡必填' },
  { id: 'shape', name: '形状', role: 'violet', rule: 'born-at 是 YYYY-MM-DD 或 YYYY-MM-DDTHH:mm' },
  {
    id: 'root',
    name: '根卡',
    role: 'violet',
    rule: '根卡多于一张，每张各报一条；根卡不写 parent；其余的卡 parent 只写那张根卡的身份，目录里没有根卡时写了 parent 就报',
  },
  { id: 'relation', name: '关系行', role: 'violet', rule: '行首是 supersedes:: 或 pivots-from:: 的行，整行必须是「字段:: 一条链接」' },
  { id: 'docfirst', name: '钉码记号', role: 'blue', rule: '正文里不许出现 docfirst 的草稿或正式记号' },
];

/** @type {Partial<Record<CardCode, CheckId[]>>} 没过的校验；没列出的卡全部通过 */
export const failedChecks = { D: ['shape', 'docfirst'] };

/** scanCardDir 交回的 sick：病按文件归拢，path 相对卡目录 */
export const sick = [
  {
    path: '2026-06-12-pin-in-card.mdx',
    problems: [
      { field: 'born-at', value: '2026/06/12', reason: 'born-at 格式须 YYYY-MM-DD 或 YYYY-MM-DDTHH:mm' },
      { field: 'docfirst', value: MARKER, reason: '卡正文里出现 docfirst 正式记号 {/* ref ... */}，轨迹分区冻结、不钉活代码' },
    ],
  },
];

/** 解析顺带从正文里取出的东西：关系边还没对卡集合求解，里程碑只有根卡有 */
export const parsedExtras = [
  'B.relations  = [{ kind: "supersede", target: "2026-06-03-yaml-frontmatter" }]',
  'S.relations  = [{ kind: "pivot", target: "2026-06-05-line-parser" }]',
  'R.milestones = [{ date: "2026-06-05", name: "卡格式定下来", desc: "frontmatter 改为逐行解析" }]',
];

/** buildTrajectory 交回的 { cards, sick, model }（只列讲到的字段） */
export const result = {
  /** 全部卡，原样交出，含病卡 */
  cards: [ROOT, '2026-06-03-yaml-frontmatter', '2026-06-05-line-parser', '2026-06-09-star-disk', '2026-06-12-pin-in-card'],
  sickFiles: ['2026-06-12-pin-in-card'],
};

/** 盘的模型：root 是盘心的根卡，cards 是盘上的卡 */
export const model = {
  root: { id: ROOT, label: 'docfirst' },
  cards: ['2026-06-03-yaml-frontmatter', '2026-06-05-line-parser', '2026-06-09-star-disk'],
  /** 关系边：from 是被取代的旧卡或转向的起点，to 是写这条关系的卡 */
  edges: /** @type {Array<{ from: string, to: string, kind: 'supersede' | 'pivot' }>} */ ([
    { from: '2026-06-03-yaml-frontmatter', to: '2026-06-05-line-parser', kind: 'supersede' },
    { from: '2026-06-05-line-parser', to: '2026-06-09-star-disk', kind: 'pivot' },
  ]),
  supersededIds: ['2026-06-03-yaml-frontmatter'],
  domains: ['卡格式', '盘面'],
  tree: {
    spine: ['2026-06-03-yaml-frontmatter', '2026-06-05-line-parser'],
    sublines: [['2026-06-09-star-disk']],
    birth: '2026-06-03T10:00',
  },
  isolated: [],
  broken: [],
};

/**
 * new RingsLayout(model) 算出的落点（世界坐标）：rLin 是半径，angBase 是角度（0 度指 12 点、顺时针），
 * pos 是槽号（0 是主干，1 起是支线）。treeBox 是这棵树分到的扇区。
 */
export const layout = {
  hubWorldR: 170,
  maxR: 1200,
  places: [
    { id: '2026-06-03-yaml-frontmatter', day: '06-03', rLin: 190, angBase: 275.638, pos: 0 },
    { id: '2026-06-05-line-parser', day: '06-05', rLin: 510, angBase: 275.638, pos: 0 },
    { id: '2026-06-09-star-disk', day: '06-09', rLin: 1150, angBase: 282.503, pos: 1 },
  ],
  treeBox: { th0: 270, th1: 288.141, rMin: 190, rMax: 1150 },
};

/** 站的整页路由 page.tsx 里接线的几行（原文，start 是行号） */
export const pageLines = [
  { start: 4, lines: ["import { loadTrajectory, StarDisk } from '@godcreator/docfirst-fumadocs/trajectory';"] },
  { start: 8, lines: ["  const data = await loadTrajectory(join(process.cwd(), 'content', 'trajectory'));"] },
  { start: 23, lines: ['        <StarDisk data={data} hrefBase="/trajectory" />'] },
];

/** 在站上点什么、去哪 */
export const clicks = [
  { what: '点盘上的一张卡', then: '在新标签页打开 /trajectory/<卡身份>' },
  { what: '点卡页上的「← 回到盘」', then: '回到 /trajectory' },
];

/** docfirst-fumadocs 的 src/trajectory.ts 里 loadTrajectory 的定义（原文，start 是行号） */
export const fumadocsLines = {
  start: 22,
  lines: [
    'export async function loadTrajectory(dir: string): Promise<Trajectory> {',
    '  if (!isAbsolute(dir)) {',
    '    throw new Error(`loadTrajectory 只收绝对路径，收到「${dir}」：在站里用 join(process.cwd(), "content", "trajectory") 拼好再传`);',
    '  }',
    '  return buildTrajectory(await scanCardDir(dir));',
    '}',
  ],
};

/**
 * 两段命令行输出，原样
 * @type {Record<'check' | 'trajectory', Array<{ kind: 'cmd' | 'out' | 'ok' | 'err', text: string }>>}
 */
export const terminals = {
  check: [
    { kind: 'cmd', text: 'pnpm docfirst check' },
    { kind: 'err', text: `🔴 ${files.dir}/2026-06-12-pin-in-card.mdx  born-at：born-at 格式须 YYYY-MM-DD 或 YYYY-MM-DDTHH:mm（2026/06/12）` },
    {
      kind: 'err',
      text: `🔴 ${files.dir}/2026-06-12-pin-in-card.mdx  docfirst：卡正文里出现 docfirst 正式记号 {/* ref ... */}，轨迹分区冻结、不钉活代码（${MARKER}）`,
    },
  ],
  trajectory: [
    { kind: 'cmd', text: 'pnpm docfirst trajectory' },
    { kind: 'out', text: `盘 docfirst（${ROOT}）  3 张卡` },
    { kind: 'out', text: '  主干：2026-06-03-yaml-frontmatter → 2026-06-05-line-parser' },
    { kind: 'out', text: '  支线 1 条，孤星 0 张' },
  ],
};

/**
 * 六步，和 stages 一一对应。
 * @type {Array<{ id: StageId, title: string, text: string }>}
 */
export const steps = [
  {
    id: 'files',
    title: '卡文件：content/trajectory/ 下一卡一文件',
    text:
      '轨迹卡是文档站 content/trajectory/ 下的 .mdx（或 .md）文件，卡身份就是文件名去掉后缀。' +
      'frontmatter 里的卡字段（docfirst-trajectory 的 CARD_KEYS：type、born-at、parent、label、domain）决定它是不是根卡、落在哪个时刻、跟哪些卡同组；' +
      '一个卡字段都没写的文件不算卡。一个卡目录只有一张根卡（type: root），其余每张卡的 parent 都写这张根卡的身份。' +
      '取代与转向两种关系写在正文里：一行 supersedes:: 或 pivots-from:: 加一条指向卡身份的链接。' +
      '例子里 R 是根卡；B 取代 A；S 从 B 转向而来；D 的 born-at 用了斜杠，正文里还有一行钉码记号。点表格的一行看那个文件的原文。',
  },
  {
    id: 'read',
    title: '读卡目录：docfirst-workflow 的 scanCardDir',
    text:
      '读文件的只有 docfirst-workflow 的 scanCardDir（src/project/card-dir.ts，经 ./cards 出口导出）：列出目录一层，用轨迹包的 pickCardFiles 挑出卡文件，' +
      '并发读全文与修改时间，交给轨迹包的 scanCards 解析（下一步）。拿回结果后，它对每张卡去掉 frontmatter 的正文逐行查 docfirst 引用记号（card-refs.ts 的 checkDocfirstRefs），' +
      '命中一行就报一条 field 为 docfirst 的病，追加在这张卡已有的病后面。这条规矩要认识钉码的记号，所以在 workflow 里查，轨迹包不认识记号。' +
      'D 正文里那行 {/* ref … */} 就这样报了病。目录不存在时返回空结果，不报错。',
  },
  {
    id: 'parse',
    title: '解析与校验：scanCards 逐个调 parseCardFile，再看根卡',
    text:
      'parseCardFile（docfirst-trajectory 的 model.ts）先用 parseFrontmatter 逐行解析 frontmatter，值一律留成字符串或字符串列表，不用 YAML 库：' +
      'YAML 库会把只写到日的 born-at 解析成 Date，格式校验跟着失效。然后逐条记下问题，不在第一条停下：存在性、形状，外加正文里写歪的关系行。' +
      '全部卡解析完，scanCards 再看整个目录的根卡：根卡多于一张每张各报一条；根卡写了 parent 报；其余的卡 parent 写了根卡以外的身份报，目录里没有根卡时写了 parent 就报。' +
      '再加上一步 workflow 查出的钉码记号，病按文件归成 SickFile。born-at 不合格的卡不上盘（半径按日期算，没有日期算不出来），' +
      '其余的病只列出来、不挡绘制。docfirst check 把每条病打成一行红，退出码 1。',
  },
  {
    id: 'model',
    title: '建树、挑主干：buildTrajectory',
    text:
      'buildTrajectory（docfirst-trajectory 的 index.ts）交回 { cards, sick, model }：cards 是全部卡，sick 是病卡，model 是那张根卡的盘。' +
      '根卡画在盘心，其余 born-at 合格的卡都在盘上，domain 只用来分组配色。' +
      '关系边在盘上求解，目标不在盘上的记进 broken。取代边与转向边连在一起的卡组成一棵树；主干（spine）在取代链上挑，整棵树一条取代都没有时改在转向链上挑，几条候选先比终点的 born-at 谁更晚，再比长短；' +
      '不在主干上的是支线（sublines）；两种关系都没有的卡是孤星（isolated）。例子的盘上是 A、B、S，主干 A → B，S 是支线；D 在 cards 与 sick 里，不在盘上。',
  },
  {
    id: 'layout',
    title: '布局：RingsLayout',
    text:
      'buildTrajectory 不算布局。RingsLayout（docfirst-trajectory 的 layout.ts）是纯计算：半径表示时间，内旧外新，相邻两张卡的空档超过设置里的空窗阈值 gapFree 就折叠；' +
      '每棵树分到一段角度（扇区），主干在 0 号槽，支线按开始时间排进后面的槽，时间不重叠的两条支线共用一个槽；孤星按领域各打包成一条。' +
      '布局只在浏览器里算：StarDisk 拿到模型后 new RingsLayout，调设置时重算，不用再请求服务端。',
  },
  {
    id: 'page',
    title: '站上渲染：/trajectory 整页',
    text:
      '站的整页路由 src/app/(trajectory-disk)/trajectory/page.tsx 从 docfirst-fumadocs/trajectory 取 loadTrajectory（就是 scanCardDir 加 buildTrajectory）与 StarDisk，' +
      '在服务端读卡建模，把结果交给客户端组件 StarDisk（星轨盘组件，hrefBase="/trajectory"），盘占满顶栏以下的整个视口；样式由路由组的 layout 引入 docfirst-fumadocs/trajectory.css。' +
      '盘上的卡链到 /trajectory/<卡身份>，那是 fumadocs 卡集合（cardSchema 做 schema、remarkTrajectoryLinks 改写正文链接）渲染的卡页。顶栏的「报病」数是 sick 里的文件数。',
  },
];

if (steps.length !== stages.length || steps.some((step, i) => step.id !== stages[i].id)) {
  throw new Error('trajectory-flow：steps 与 stages 必须一一对应');
}
