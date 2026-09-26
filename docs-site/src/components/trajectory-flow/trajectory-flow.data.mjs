/**
 * 「一批轨迹卡文件怎么变成星轨盘」的全部讲解数据：画面（trajectory-flow.tsx）与机读版规则（trajectory-flow.ai.mjs）都只读这一份。
 * 例子里的校验结果、盘清单、树、布局落点与两段命令行输出，都是把下面五个卡文件放进一个临时项目
 * （docfirst.config.mjs 只写 `formats: []`，没有现状区文档），用 docfirst-workflow 0.3.1 与 docfirst-trajectory 0.1.1
 * 实际运行 `docfirst check`、`docfirst trajectory`、`buildTrajectory` 与 `new RingsLayout(model)` 得到的。
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
  { id: 'model', name: '分盘、建树', pkg: 'docfirst-trajectory', exports: 'buildTrajectory', role: 'violet' },
  { id: 'layout', name: '布局与缩略图', pkg: 'docfirst-trajectory', exports: 'RingsLayout · launcherThumbs', role: 'violet' },
  { id: 'page', name: '站上渲染', pkg: 'docs-site /trajectory', exports: 'loadTrajectory → StarDisk', role: 'cyan' },
];

/** 卡字段，顺序照 parse.ts 的 CARD_KEYS */
export const cardKeys = ['type', 'born-at', 'parent', 'merged-in', 'label', 'domain'];

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
      ['type', 'root'],
      ['born-at', '2026-06-09T11:00'],
      ['parent', `[${ROOT}]`],
      ['merged-in', `[${ROOT}]`],
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
  { call: 'scanCards(files)', role: 'violet', what: '逐个解析与校验（第 3 步），交回 { cards, sick }' },
  { call: 'checkDocfirstRefs(body)', role: 'blue', what: '对每张卡去掉 frontmatter 的正文逐行查引用记号，病追加进 sick' },
];

/** card-refs.ts 认的三种记号形态 */
export const refForms = ['@@docfirst ref … @@（整行草稿记号）', '<!-- ref …、<!-- tree … 这类 md 正式记号', '{/* ref …、{/* tree … 这类 mdx 正式记号'];

/**
 * 解析时的几道校验。前四道在 docfirst-trajectory 的 parseCardFile 里，最后一道在 docfirst-workflow 的 card-refs.ts 里。
 * @typedef {'presence' | 'shape' | 'consistency' | 'relation' | 'docfirst'} CheckId
 * @type {Array<{ id: CheckId, name: string, role: 'violet' | 'blue', rule: string }>}
 */
export const checks = [
  { id: 'presence', name: '存在性', role: 'violet', rule: 'born-at、label 所有卡必填；parent 非根卡必填' },
  { id: 'shape', name: '形状', role: 'violet', rule: 'born-at 是 YYYY-MM-DD 或 YYYY-MM-DDTHH:mm；parent、merged-in 的元素是卡身份（不带后缀、不带路径）' },
  { id: 'consistency', name: '一致性', role: 'violet', rule: 'parent 不含自身；merged-in 是 parent 的子集；非根卡不写 merged-in' },
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

/** buildTrajectory 交回的盘清单与 R 那张盘的模型（只列讲到的字段） */
export const model = {
  disks: [
    { rootId: ROOT, label: 'docfirst', memberIds: ['2026-06-03-yaml-frontmatter', '2026-06-05-line-parser', '2026-06-09-star-disk'] },
    { rootId: '2026-06-09-star-disk', label: '星轨盘', memberIds: [] },
  ],
  /** R 的盘上的关系边：from 是被取代的旧卡或转向的起点，to 是写这条关系的卡 */
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
  wormholes: [],
  broken: [],
};

/** 把 S 的 merged-in 那一行删掉再建模的结果 */
export const withoutMergedIn = {
  cards: ['2026-06-03-yaml-frontmatter', '2026-06-05-line-parser'],
  wormholes: ['2026-06-09-star-disk'],
  spine: ['2026-06-03-yaml-frontmatter', '2026-06-05-line-parser'],
  sublines: [],
  text:
    'S 在 R 的盘上变成虫洞，不再是普通卡；虫洞不进树，S 写的 pivots-from 在这张盘上不求解，树只剩主干 A → B。' +
    '盘清单改按最近活动排：S 的盘（2026-06-09）排到 R 的盘（最晚的卡是 B，2026-06-05）前面。',
};

/**
 * new RingsLayout(model) 对 R 的盘算出的落点（世界坐标）：rLin 是半径，angBase 是角度（0 度指 12 点、顺时针），
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

/** /trajectory 启动器上的两张卡片：卡数是盘上的卡，最近活动取盘上卡与虫洞里最晚的 born-at，没有就用根卡的 */
export const launcher = [
  { rootId: ROOT, label: 'docfirst', cardCount: 3, latest: '2026-06-09' },
  { rootId: '2026-06-09-star-disk', label: '星轨盘', cardCount: 0, latest: '2026-06-09' },
];

/** 站的整页路由 page.tsx 里接线的几行（第 12–14 行与第 32 行，原文） */
export const pageLines = {
  load: {
    start: 12,
    lines: [
      '  const { disk } = await searchParams;',
      "  const data = await loadTrajectory('content/trajectory');",
      '  const thumbs = launcherThumbs(data);',
    ],
  },
  render: {
    start: 32,
    lines: ['        <StarDisk data={data} hrefBase="/trajectory" mode="page" initialDisk={disk} thumbs={thumbs} />'],
  },
};

/** 在站上点什么、去哪 */
export const clicks = [
  { what: '点启动器上的一张卡片', then: '进入那张盘，地址栏写上 ?disk=<根卡身份>' },
  { what: '点盘上的一张卡', then: '在新标签页打开 /trajectory/<卡身份>' },
  { what: '点虫洞', then: '换到子项目的盘' },
];

/** docfirst-fumadocs 的 src/trajectory.tsx 里 loadTrajectory 的定义（第 19–21 行，原文） */
export const fumadocsLines = {
  start: 19,
  lines: [
    'export async function loadTrajectory(dir: string): Promise<TrajectoryData> {',
    '  return buildTrajectory(await scanCardDir(resolve(process.cwd(), dir)));',
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
    { kind: 'out', text: '  支线 1 条，孤星 0 张，虫洞 0 个' },
    { kind: 'out', text: '盘 星轨盘（2026-06-09-star-disk）  0 张卡' },
    { kind: 'out', text: '  支线 0 条，孤星 0 张，虫洞 0 个' },
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
      'frontmatter 里的卡字段（docfirst-trajectory 的 CARD_KEYS：type、born-at、parent、merged-in、label、domain）决定它是不是根卡、在哪张盘上、落在哪个时刻；' +
      '一个卡字段都没写的文件不算卡。取代与转向两种关系写在正文里：一行 supersedes:: 或 pivots-from:: 加一条指向卡身份的链接。' +
      '例子里 R 与 S 是根卡（type: root），S 的 parent 与 merged-in 都写了 R；B 取代 A；S 从 B 转向而来；D 的 born-at 用了斜杠，正文里还有一行钉码记号。点表格的一行看那个文件的原文。',
  },
  {
    id: 'read',
    title: '读卡目录：docfirst-workflow 的 scanCardDir',
    text:
      '碰磁盘的只有 docfirst-workflow 的 scanCardDir（src/project/card-dir.ts，经 ./cards 出口导出）：列出目录一层，用轨迹包的 pickCardFiles 挑出卡文件，' +
      '并发读全文与修改时间，交给轨迹包的 scanCards 解析（下一步）。拿回结果后，它对每张卡去掉 frontmatter 的正文逐行查 docfirst 引用记号（card-refs.ts 的 checkDocfirstRefs），' +
      '命中一行就报一条 field 为 docfirst 的病，追加在这张卡已有的病后面。这条规矩要认识钉码的记号，所以在 workflow 里查，轨迹包不认识记号。' +
      'D 正文里那行 {/* ref … */} 就这样报了病。目录不存在时返回空结果，不报错。',
  },
  {
    id: 'parse',
    title: '解析与校验：scanCards 逐个调 parseCardFile',
    text:
      'parseCardFile（docfirst-trajectory 的 model.ts）先用 parseFrontmatter 逐行解析 frontmatter，值一律留成字符串或字符串列表，不用 YAML 库：' +
      'YAML 库会把只写到日的 born-at 解析成 Date，格式校验跟着失效。然后逐条记下问题，不在第一条停下：存在性、形状、一致性，外加正文里写歪的关系行；' +
      '再加上一步 workflow 查出的钉码记号，病按文件归成 SickFile。born-at 不合格的卡不上任何一张盘（半径按日期算，没有日期算不出来），' +
      '其余的病只列出来、不挡绘制。docfirst check 把每条病打成一行红，退出码 1。',
  },
  {
    id: 'model',
    title: '分盘、建树、挑主干：buildTrajectory',
    text:
      'buildTrajectory（docfirst-trajectory 的 index.ts）给每张根卡建一张盘：盘是一个项目的全部卡，根卡画在盘心。parent 里含哪张盘的根卡身份，卡就上哪张盘，domain 只用来分组。' +
      '有 parent 的根卡是子项目：父盘列在它的 merged-in 里，它在父盘上当普通卡，它自己盘上的卡也并进来；没列就在父盘上画成虫洞（Wormhole，点了换到子项目的盘）。' +
      '关系边按盘求解，目标不在这张盘上的记进 broken。取代边与转向边连在一起的卡组成一棵树；主干（spine）在取代链上挑，整棵树一条取代都没有时改在转向链上挑，几条候选先比终点的 born-at 谁更晚，再比长短；' +
      '不在主干上的是支线（sublines）；两种关系都没有的卡是孤星（isolated）。R 的盘上是 A、B、S，主干 A → B，S 是支线；S 自己也有一张盘，上面没有卡。',
  },
  {
    id: 'layout',
    title: '布局与缩略图：RingsLayout、launcherThumbs',
    text:
      'buildTrajectory 不算布局。RingsLayout（docfirst-trajectory 的 layout.ts）是纯计算：半径表示时间，内旧外新，相邻两张卡的空档超过设置里的空窗阈值 gapFree 就折叠；' +
      '每棵树分到一段角度（扇区），主干在 0 号槽，支线按开始时间排进后面的槽，时间不重叠的两条支线共用一个槽；孤星按领域各打包成一条，虫洞合成一条。' +
      '浏览器里 StarDisk 每打开一张盘，就对这张盘的模型 new RingsLayout 重算一次，调设置不用再请求服务端。' +
      '服务端只有缩略图用到布局：launcherThumbs 用同一套 RingsLayout 给每张盘画亮、暗两份静态 SVG，给启动器当图片。',
  },
  {
    id: 'page',
    title: '站上渲染：/trajectory 整页',
    text:
      '站的整页路由 src/app/(trajectory-disk)/trajectory/page.tsx 在服务端调 docfirst-fumadocs/trajectory 的 loadTrajectory（就是 scanCardDir 加 buildTrajectory）与 launcherThumbs，' +
      '把结果交给 docfirst-trajectory/disk 的客户端组件 StarDisk（星轨盘组件，mode="page"、hrefBase="/trajectory"）。地址栏没有 ?disk= 时显示启动器：每张盘一张卡片，带缩略图、名字、卡数与最近活动日期。' +
      '盘上的卡链到 /trajectory/<卡身份>，那是 fumadocs 卡集合（cardSchema 做 schema、remarkTrajectoryLinks 改写正文链接）渲染的卡页。顶栏的「报病」数是 sick 里的文件数。' +
      'fumadocs 适配另有服务端组件 Trajectory，把盘和病卡清单一起渲染，给要把盘嵌进 mdx 页的站用。',
  },
];

if (steps.length !== stages.length || steps.some((step, i) => step.id !== stages[i].id)) {
  throw new Error('trajectory-flow：steps 与 stages 必须一一对应');
}
