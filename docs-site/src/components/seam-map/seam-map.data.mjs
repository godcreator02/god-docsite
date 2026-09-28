/**
 * 全局接缝图的全部内容：首页的 <SeamMap /> 画的就是它，接缝的正本就在这里。
 * 模块按包分：docfirst 用到的每个 npm 包（通用包与 docfirst 自己的包）与工作台插件各一个虚线框，框里的方块是能力；
 * 使用方的站、使用方的仓、fumadocs 本体在框外。讲解组件包 docfirst-explainer 只有站用，workflow 与工作台插件都不依赖它，它也不依赖别的包，不在这张图里。
 * 每条接缝写明两端的能力、接口、是不是约定（没有代码接口，只靠文件名、目录名、配置键对上）、经代码调用还是经磁盘上的文件。
 * 坐标不在这里，在 system.layout.ts：这份只描述系统是什么样。各包内部的接缝图在 inner/ 下。
 */
import { defineSeamGraph } from '@godcreator/docfirst-explainer/seam-graph';

/** @type {import('@godcreator/docfirst-explainer/seam-graph').SeamModule[]} */
const modules = [
  {
    id: 'fumadocs',
    name: 'fumadocs 适配',
    pkg: '@godcreator/docfirst-workflow/fumadocs',
    role: 'amber',
    outside: false,
    blurb: '调用链从 fumadocs 或 Next 开始的部分：mdx 加载器编译页面时调的 remark 插件、机读版、页面渲染时的组件、名册规则、卡集合、星轨盘的读卡与组件。认识命令行与项目、钉码核心、星轨盘，谁都不认识它。',
    caps: [
      { id: 'remark', name: 'remark 插件', ident: 'docfirstMdxOptions' },
      { id: 'markdown', name: '机读版', ident: 'markdown.ts' },
      { id: 'pre', name: '状态点与术语组件', ident: './fumadocs/pre · ./fumadocs/term' },
      { id: 'roster', name: '组件名册规则', ident: './fumadocs/roster' },
      { id: 'cardset', name: '卡集合', ident: 'cardSchema' },
      { id: 'disk-load', name: '星轨盘读卡', ident: './fumadocs/trajectory' },
    ],
  },
  {
    id: 'workflow',
    name: '命令行与项目',
    pkg: '@godcreator/docfirst-workflow',
    role: 'emerald',
    outside: false,
    blurb: '调用链从 docfirst 命令开始的部分：命令行、项目装配（读文件、git、生成物）、钉码编排、mdx 页面与讲解组件源码的格式、记号写法，以及 docfirst 的卡格式（读卡目录、解析与校验卡、换成星轨盘的中性输入）。认识通用包钉码核心与星轨盘，不认识任何站的宿主。',
    caps: [
      { id: 'cli', name: '命令行', ident: 'docfirst' },
      { id: 'marker', name: '记号写法', ident: 'marker/' },
      { id: 'mdx', name: 'mdx 格式', ident: './mdx' },
      { id: 'pinning', name: '钉码编排', ident: 'pinning/' },
      { id: 'project', name: '项目装配', ident: 'loadProject' },
      { id: 'io', name: '读文件与 git', ident: 'Reader · History' },
      { id: 'placement', name: '生成物写入', ident: 'placement.ts' },
      { id: 'cards', name: '卡格式', ident: './cards' },
    ],
  },
  {
    id: 'pin',
    name: '钉码核心',
    pkg: '@godcreator/code-pin',
    role: 'blue',
    outside: false,
    blurb: '通用包，不认识 docfirst，谁都能单独使用：把文字钉在代码上。只认目标与记录，核对出被钉的代码变没变、确认时算出新记录；零依赖，只用 node:crypto，不接触文档文本、不读文件、不启动子进程，读取器与旧内容来源从构造参数传进来。docfirst 用它判定每处钉码的状态。',
    caps: [
      { id: 'types', name: '目标与记录', ident: 'types.ts' },
      { id: 'pinner', name: '核对与确认', ident: 'createPinner' },
      { id: 'compare', name: '比较与跟随', ident: 'compare.ts' },
    ],
  },
  {
    id: 'trajectory',
    name: '星轨盘',
    pkg: '@godcreator/trajectory-disk',
    role: 'violet',
    outside: false,
    blurb: '通用包星轨盘，不认识 docfirst，谁都能单独使用：把一组带时间与取代、转向关系的卡画成项目方向演变的圆盘。主入口只收盘心加一组卡的中性输入，buildModel 建模、布局，另有星轨盘组件 ./disk 与样式 ./star.css；卡从哪儿来、怎么写、怎么校验归调用方。主入口的产物里一条 import 都没有。docfirst 把轨迹卡换成它的中性输入。',
    caps: [
      { id: 'model', name: '中性输入与建模', ident: 'buildModel' },
      { id: 'layout', name: '布局', ident: 'RingsLayout' },
      { id: 'disk', name: '星轨盘组件', ident: './disk' },
    ],
  },
  {
    id: 'plugin',
    name: '工作台插件',
    pkg: '@godcreator/gwb-docfirst-workflow',
    role: 'cyan',
    outside: false,
    blurb: '不在 npm 的依赖关系里，只在桌面工作台里给 agent 提供两条建站命令和说明书。对本仓的 npm 包零依赖：不 import、不运行它们的命令行。',
    caps: [
      { id: 'skills', name: '说明书', ident: 'skills/' },
      { id: 'create', name: '建站命令与模板', ident: 'docfirst.create' },
    ],
  },
  {
    id: 'fumadocs-core',
    name: 'fumadocs 本体',
    pkg: 'peer 依赖，用站自己装的那份',
    role: null,
    outside: true,
    blurb: 'fumadocs-mdx 编译 mdx、fumadocs-ui 提供代码块与目录树组件。不属于这个仓，fumadocs 适配按它的形状接入。',
    caps: [{ id: 'fumadocs-core', name: 'fumadocs 本体', ident: 'fumadocs-mdx · fumadocs-ui' }],
  },
  {
    id: 'site',
    name: '使用方的站',
    pkg: 'Next 站的接入代码',
    role: null,
    outside: true,
    blurb: '装了这几个包的站：src/lib/source.ts 接集合，src/components/mdx.tsx 换组件，星轨整页调用 loadTrajectory 与 StarDisk。本仓的 docs-site/ 就是这样一个站。',
    caps: [{ id: 'wiring', name: '站的接入代码', ident: 'source.ts · mdx.tsx' }],
  },
  {
    id: 'repo',
    name: '使用方的仓',
    pkg: '磁盘上的文件',
    role: null,
    outside: true,
    blurb: '站所在的仓：项目根的配置与内容、被钉的源码与 git 历史、仓根的生成物。docfirst 的包只经约定读写它们。',
    caps: [
      { id: 'root', name: '站的项目根', ident: 'docfirst.config.mjs · content/' },
      { id: 'source', name: '被钉的源码与 git 历史', ident: '源码 · .git' },
      { id: 'outputs', name: '仓根生成物', ident: 'README · AGENTS · CLAUDE' },
    ],
  },
];

/**
 * 从系统外面进来的入口，画成灰色箭头，不编号、不算接缝。to 是进来的那个能力或模块。
 * @type {import('@godcreator/docfirst-explainer/seam-graph').SeamEntry[]}
 */
const entries = [
  { id: 'agent', name: 'agent · 工作台命令总线', to: 'plugin' },
  { id: 'next', name: 'Next 构建', to: 'remark' },
  { id: 'human', name: '人 · git hook · CI', to: 'cli' },
];

/**
 * 接缝。a、b 是两端的能力 id；via 为 code 是代码调用（实线），disk 是读写磁盘上的文件（虚线）。
 * name 与 text 显示在浮层里，text 写连接谁、交换什么、由谁负责。
 * @type {import('@godcreator/docfirst-explainer/seam-graph').SeamInput[]}
 */
const seams = [
  {
    n: 1,
    name: '目标与记录',
    a: ['marker', 'mdx'],
    b: ['types'],
    iface: 'import type { Target, MemoRecord, Status, Reason } from "@godcreator/code-pin"；REASON_TEXT',
    convention: false,
    via: 'code',
    text: 'workflow 的记号写法、两种格式与钉码核心的类型之间。记号写法把记号的属性解析成钉码核心定义的目标与记录（没有记录属性的，记录是 null），写记号时反过来；mdx 页面与讲解组件的源码用的是同一套属性，只有外面的注释不同。这几处只从钉码核心 import 类型。按原文渲染拒绝缺失的引用、命令行打印细分理由时，中文说法取 REASON_TEXT。目标、记录与理由的取值由钉码核心负责，钉码核心不认识任何记号写法与文档格式。',
  },
  {
    n: 2,
    name: '文件与旧内容',
    a: ['io'],
    b: ['compare'],
    iface: 'Reader：read / list；History：oldText / hunks',
    convention: false,
    via: 'code',
    text: '读文件与 git 和钉码核心的比较器之间。比较器要看的当前文件、目录的名字表从 Reader 取；确认时的旧文件（按 blob 名）与两份文本之间的 hunk 表从 History 取。workflow 用 createReader 与 createGitHistory 实现这两个接口，装配项目时传给 createPinner。取不到旧内容时 oldText 给 null，比较器改为在整个文件里找段 hash 跟记号上的 hash 相同的那几行。',
  },
  {
    n: 3,
    name: '钉码',
    a: ['pinning', 'project'],
    b: ['pinner'],
    iface: 'createPinner({ reader, history }) → Pinner；check(pins) → Verdict[]；confirm(verdicts, { accept }) → Step[]',
    convention: false,
    via: 'code',
    text: 'workflow 的钉码编排与钉码核心之间。loadProject 用接缝 2 的两个实现建出钉码核心，交给钉码编排 createPinning，放在 Project.pinning 上；命令行的 check、confirm、render 与 fumadocs 适配的 remark 插件都经钉码编排核对。钉码编排把一个文件里认出的每处引用拆成目标与记录交进来，结果与传入顺序一一对应，由它配回文件路径与行号；确认时交回的每一步带着要写回的新记录，写回交给这个文件所属的格式。判定全部在钉码核心。',
  },
  {
    n: 4,
    name: '中性输入',
    a: ['cards', 'cli'],
    b: ['model'],
    iface: 'DiskInput { center: { id, label, bornAt, kind, milestones } | null, cards: { id, bornAt, label, domain, kind, relations }[] }；buildModel(input) → TrajectoryModel；validBornAt(v)',
    convention: false,
    via: 'code',
    text: 'workflow 与星轨盘之间。星轨盘不读文件，也不认识 docfirst 的卡怎么写：卡格式读轨迹卡目录，解析 frontmatter、关系行与里程碑，做全部校验（一个卡目录只有一张根卡、其余卡的 parent 只写根卡身份、卡里不许钉码），把画得出来的卡换成中性输入，根卡恰好一张时它是盘心。born-at 合不合格，卡格式与建模用同一个 validBornAt。命令行的 check 把病卡打印成行、计进红，docfirst trajectory 调用 buildModel 打印这张盘的主干。中性输入的形状与建模规则由星轨盘负责，卡的写法与校验规则由卡格式负责。',
  },
  {
    n: 5,
    name: '星轨盘组件',
    a: ['disk-load'],
    b: ['disk'],
    iface: './disk 的 StarDisk（data 收中性输入）、./star.css',
    convention: false,
    via: 'code',
    text: 'fumadocs 适配与星轨盘之间。./fumadocs/trajectory 按包名从 ./disk 再导出客户端组件 StarDisk，Next 才认得出客户端边界；./fumadocs/trajectory.css 引入 star.css。StarDisk 的 data 就是 loadTrajectory 交回的中性输入，组件在浏览器里自己调 buildModel。站画星轨盘只经过 fumadocs 适配，不直接依赖星轨盘包；fumadocs 适配也不从星轨盘包的主入口取任何东西。组件的形状由星轨盘负责。',
  },
  {
    n: 6,
    name: '项目',
    a: ['project', 'pinning', 'mdx', 'cards'],
    b: ['remark', 'disk-load', 'cardset'],
    iface: '主入口的 loadProject（pinning、roster、docIdOf）与 Listing 等类型；./mdx 的 recognize、stamp 等语法树函数；./cards 的 scanCardDir、CARD_KEYS、cardIdFromHref',
    convention: false,
    via: 'code',
    text: 'workflow 与 fumadocs 适配之间。站构建时 remark 插件调用 loadProject 装配一次项目，拿到钉码编排与组件名册，用 ./mdx 的 recognize 在语法树上认记号、交给钉码编排的 checkReferences 核对、用 stamp 按名册标上机读文字，认记号用的是和命令行同一份代码。./fumadocs/trajectory 的 loadTrajectory 就是 ./cards 的 scanCardDir，交回中性输入加病卡、不建模；卡集合的 cardSchema 用 CARD_KEYS 判断一页算不算卡，remarkTrajectoryLinks 用 cardIdFromHref 从链接认出卡身份。卡格式只从 ./cards 取、不从主入口取，免得把命令行与配置加载带进 Next 的服务端构建。两边在同一个包 docfirst-workflow 里，fumadocs 适配只按包名用这几个出口，不用相对路径引用命令行那一侧的目录。出口由 workflow 负责。',
  },
  {
    n: 7,
    name: '接入 fumadocs',
    a: ['remark', 'markdown', 'pre'],
    b: ['fumadocs-core'],
    iface: 'applyMdxPreset 的参数形状、postprocess、rehypeCode 的 meta 白名单、CodeBlock、Files',
    convention: false,
    via: 'code',
    text: 'fumadocs 适配与 fumadocs 本体之间。docfirstMdxOptions 的返回值按形状对上 applyMdxPreset 的参数，把 remark 插件放在链末尾；docfirstMarkdownOptions 交给 postprocess 生成机读版；parseMetaString 让 rehypeCode 保留状态点的 data-dot；状态点代码块用 fumadocs-ui 的 CodeBlock，目录树用它的 Files。fumadocs 是 peer 依赖，它改了这些形状，要改的是 fumadocs 适配。',
  },
  {
    n: 8,
    name: '站接入',
    a: ['remark', 'markdown', 'pre', 'roster', 'cardset', 'disk-load'],
    b: ['wiring', 'root'],
    iface: 'docfirstMdxOptions、docfirstMarkdownOptions、cardSchema、remarkTrajectoryLinks；./fumadocs/pre、./fumadocs/term、./fumadocs/trajectory、样式表；./fumadocs/roster',
    convention: false,
    via: 'code',
    text: 'fumadocs 适配与使用方站的接入代码之间。站的 src/lib/source.ts 把前四个出口用在现状集合与轨迹卡集合上，mdx.tsx 把 pre 换成会画状态点的 DocfirstPre、登记 Term，星轨整页调用 loadTrajectory、渲染 StarDisk，样式表 light.css、term.css、trajectory.css 由站引入；docfirst.config.mjs 展开 ./fumadocs/roster 的 fumadocsRoster。出口名由 fumadocs 适配负责，改名要同时改站的接入代码和接缝 12 的模板。',
  },
  {
    n: 9,
    name: '项目根',
    a: ['project'],
    b: ['root'],
    iface: '配置键 content / components / outputs；内容根下 trajectory/、future/ 两个名字固定',
    convention: true,
    via: 'disk',
    text: '项目装配与使用方的项目根之间，没有代码接口。loadProject 在项目根找 docfirst.config.mjs，只认这几个配置键，出现别的键当场报错并说明该怎么改；内容根（默认 content/）下 trajectory/ 是轨迹卡、future/ 是未来区，其余 .mdx 文档都是现状区、都进 check；项目根下 src/components/ 里的 .ts、.tsx、.mjs（讲解组件的源码）也进 check。约定由项目装配定，使用方照着写。',
  },
  {
    n: 10,
    name: '仓里的文件',
    a: ['io'],
    b: ['source'],
    iface: '按相对项目根的路径读文件、列目录；git 按 blob 取旧文件、算差异、查未提交改动',
    convention: true,
    via: 'disk',
    text: '读文件与 git 和使用方仓里被钉的源码、git 历史之间。读取器按相对项目根的路径读文件、列目录（在 git 仓里按 .gitignore 过滤）；旧内容来源找到文件所在的仓，从对象库按 blob 名取确认时的内容；check 另问被钉的文件在本仓有没有未提交的改动，有的话那处黄灯算红。确认时的文件进过 git，旧内容才取得回来。',
  },
  {
    n: 11,
    name: '生成物',
    a: ['placement'],
    b: ['outputs'],
    iface: 'outputs 映射：mdx 正本 → 落点路径，可指定保留的 frontmatter 字段',
    convention: true,
    via: 'disk',
    text: '生成物写入与使用方仓根的生成物之间。placement.ts 把 outputs 映射左边的 mdx 正本渲染成 md，写到右边的每个落点（README、AGENTS、CLAUDE、插件里的 SKILL.md）；check 只核对磁盘上那份是不是最新。落点上的文件是生成物：改正本，再 render。',
  },
  {
    n: 12,
    name: '模板',
    a: ['create'],
    b: ['wiring', 'root'],
    iface: '模板 import 的出口都在 docfirst-workflow 的 /fumadocs 与 /fumadocs/roster、/fumadocs/pre、/fumadocs/light.css、/fumadocs/trajectory 里；站依赖表 src/deps.ts',
    convention: true,
    via: 'disk',
    text: '工作台插件与它建出来的站之间。docfirst.create 把模板写成新站的 source.ts、mdx.tsx、docfirst.config.mjs 等文件，并把 docfirst-workflow 按精确版本写进站的依赖。插件不依赖这个包，模板里的包名和出口名只能靠约定对上：插件的 tests/create.test.ts 检查模板引用的出口都在这个包的清单里、依赖表的版本等于工作区里各包的版本。',
  },
];

export const systemGraph = defineSeamGraph({
  id: 'system',
  title: 'docfirst 的模块、能力与接缝',
  intro:
    '接缝图：虚线框是模块（docfirst 用到的 npm 包与工作台插件），框里的方块是能力，跨模块的线带编号就是接缝；实线是代码调用，虚线是读写磁盘上的文件；系统之外的东西画在框外。',
  frameLabel: '模块（包）',
  modules,
  entries,
  seams,
});
