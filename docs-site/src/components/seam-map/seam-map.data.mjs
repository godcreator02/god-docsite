/**
 * 全局接缝图的全部内容：首页的 <SeamMap /> 画的就是它，接缝的正本就在这里。
 * 模块按包分：docfirst 用到的每个 npm 包（通用包与 docfirst 自己的包）与工作台插件各一个虚线框，框里的方块是能力；
 * 文档站基础包、fumadocs 本体、使用方的仓在框外。讲解组件包 docfirst-explainer 只有站自己的组件用，别的包与工作台插件都不依赖它，它也不依赖别的包，不在这张图里。
 * 每条接缝写明两端的能力、接口、是不是约定（没有代码接口，只靠文件名、目录名、配置键对上）、经代码调用还是经磁盘上的文件。
 * 坐标不在这里，在 system.layout.ts：这份只描述系统是什么样。各包内部的接缝图在 inner/ 下。
 */
import { defineSeamGraph } from '@godcreator/explainer';

/** @type {import('@godcreator/docsite-explainer/seam-graph').SeamModule[]} */
const modules = [
  {
    id: 'docsite-docfirst',
    name: '站的功能包',
    pkg: '@godcreator/docsite-docfirst',
    role: 'rose',
    outside: false,
    blurb:
      '建在文档站基础包上的 docfirst 站用的功能包：构建页面时的 remark 插件（现状区做术语标注、钉码投影、给钉码代码块包上带状态点的外层，轨迹卡目录改写关系行与卡链接）、侧栏入口「轨迹」与页面里不用 import 的组件 Term 和文件树、星轨盘与卡页两条路由、轨迹卡集合的模板、样式。认识 workflow、fumadocs 适配与星轨盘，谁都不认识它。',
    caps: [
      { id: 'site-content', name: 'remark 插件', ident: './content' },
      { id: 'site-mdx', name: '侧栏入口与组件', ident: './site' },
      { id: 'site-cards', name: '轨迹卡集合', ident: 'template/' },
      { id: 'site-css', name: '样式', ident: './styles.css' },
      { id: 'site-routes', name: '星轨盘与卡页', ident: './routes' },
    ],
  },
  {
    id: 'fumadocs',
    name: 'fumadocs 适配',
    pkg: '@godcreator/docfirst-workflow/fumadocs',
    role: 'amber',
    outside: false,
    blurb:
      '调用链从 fumadocs 的 mdx 编译开始的部分：钉码投影的 remark 插件、术语标注、轨迹卡正文的链接改写、状态点与术语标注的样式表，另有 ./fumadocs/roster（fumadocs 自带组件的名册规则，docfirst.config.mjs 展开它）。站的功能包用其中的 remark 插件与样式表；集合选项、meta 白名单、状态点组件、机读版回调、读卡等其余出口给还没迁到文档站基础包的 Next 站。认识命令行与项目、钉码核心、星轨盘。',
    caps: [
      { id: 'remark', name: 'remark 接入', ident: 'remarkDocfirstHost' },
      { id: 'glossary', name: '术语标注', ident: 'remarkGlossary' },
      { id: 'cardset', name: '卡链接改写', ident: 'remarkTrajectoryLinks' },
      { id: 'styles', name: '样式表', ident: './fumadocs/*.css' },
      { id: 'other', name: '其余出口', ident: 'docfirstMdxOptions · DocfirstPre' },
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
    blurb: '不在 npm 的依赖关系里，只在桌面工作台里给 agent 提供建站命令、托管站点的命令和说明书；建站命令建出的站接的是 fumadocs 适配，不是站的功能包。对本仓的 npm 包零依赖：不 import、不运行它们的命令行。',
    caps: [
      { id: 'skills', name: '说明书', ident: 'skills/' },
      { id: 'create', name: '建站命令与模板', ident: 'docfirst.create' },
    ],
  },
  {
    id: 'docsite-kit',
    name: '文档站基础包',
    pkg: '@godcreator/docsite-kit',
    role: null,
    outside: true,
    blurb: '基于 fumadocs（React Router 框架模式与 Vite）的文档站基础包：站点骨架与初始化、功能包的约定。站点 package.json 的 docsite.features 列出用到的功能包，初始化照它生成骨架里引用功能包的几个文件。不属于这个仓，站的功能包按它的约定接入。',
    caps: [{ id: 'kit', name: '文档站基础包', ident: '@godcreator/docsite-kit' }],
  },
  {
    id: 'fumadocs-core',
    name: 'fumadocs 本体',
    pkg: 'peer 依赖，用站自己装的那份',
    role: null,
    outside: true,
    blurb: 'fumadocs-mdx 编译 mdx、定义集合，@fumadocs/base-ui 提供代码块、文件树与文档页的组件。不属于这个仓，fumadocs 适配与站的功能包按它的形状接入。',
    caps: [{ id: 'fumadocs-core', name: 'fumadocs 本体', ident: 'fumadocs-mdx · @fumadocs/base-ui' }],
  },
  {
    id: 'repo',
    name: '使用方的仓',
    pkg: '磁盘上的文件',
    role: null,
    outside: true,
    blurb: '站所在的仓：项目根的配置、package.json、内容与轨迹卡目录，被钉的源码与 git 历史，仓根的生成物。docfirst 的包只经约定读写它们。',
    caps: [
      { id: 'root', name: '站的项目根', ident: 'docfirst.config.mjs · content/' },
      { id: 'source', name: '被钉的源码与 git 历史', ident: '源码 · .git' },
      { id: 'outputs', name: '仓根生成物', ident: 'README · AGENTS · CLAUDE' },
    ],
  },
];

/**
 * 从系统外面进来的入口，画成灰色箭头，不编号、不算接缝。to 是进来的那个能力或模块。
 * @type {import('@godcreator/docsite-explainer/seam-graph').SeamEntry[]}
 */
const entries = [
  { id: 'agent', name: 'agent · 工作台命令总线', to: 'plugin' },
  { id: 'build', name: '站点构建 · 开发服务', to: 'kit' },
  { id: 'human', name: '人 · git hook · CI', to: 'cli' },
];

/**
 * 接缝。a、b 是两端的能力 id；via 为 code 是代码调用（实线），disk 是读写磁盘上的文件（虚线）。
 * name 与 text 显示在浮层里，text 写连接谁、交换什么、由谁负责。
 * @type {import('@godcreator/docsite-explainer/seam-graph').SeamInput[]}
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
    a: ['site-routes', 'styles', 'other'],
    b: ['disk'],
    iface: "import { StarDisk } from '@godcreator/trajectory-disk/disk'（data 收中性输入）；@import '@godcreator/trajectory-disk/star.css'",
    convention: false,
    via: 'code',
    text: '站的功能包、fumadocs 适配与星轨盘之间。功能包的星轨盘路由按包名从 ./disk 取客户端组件 StarDisk，data 就是 scanCardDir 交回的中性输入，组件在浏览器里自己调 buildModel；fumadocs 适配的 ./fumadocs/trajectory.css 引入 star.css，功能包的样式表再引入它。./fumadocs/trajectory 另外按包名再导出 StarDisk，给还没迁到文档站基础包的 Next 站。两边都不从星轨盘包的主入口取任何东西。组件的形状由星轨盘负责。',
  },
  {
    n: 6,
    name: '项目',
    a: ['project', 'pinning', 'mdx', 'cards'],
    b: ['remark', 'cardset', 'other'],
    iface: '主入口的 loadProject（pinning、roster、docIdOf）与 Listing 等类型；./mdx 的 recognize、stamp 等语法树函数；./cards 的 scanCardDir、CARD_KEYS、cardIdFromHref',
    convention: false,
    via: 'code',
    text: 'workflow 与 fumadocs 适配之间。remarkDocfirstHost 在构建页面时调用 loadProject 装配一次项目，拿到钉码编排与组件名册，用 ./mdx 的 recognize 在语法树上认记号、交给钉码编排的 checkReferences 核对、用 stamp 按名册标上机读文字，认记号用的是和命令行同一份代码。remarkTrajectoryLinks 用 ./cards 的 cardIdFromHref 从链接认出卡身份；其余出口里的 cardSchema 用 CARD_KEYS 判断一页算不算卡，loadTrajectory 就是 scanCardDir。两边在同一个包 docfirst-workflow 里，fumadocs 适配只按包名用 .、./mdx、./cards 这几个出口，不用相对路径引用命令行那一侧的目录。出口由 workflow 负责。',
  },
  {
    n: 7,
    name: '接入 fumadocs',
    a: ['remark', 'other'],
    b: ['fumadocs-core'],
    iface: 'remark 插件 (tree, file) => void；名为 Files / Folder / File 的节点；applyMdxPreset 的参数形状、rehypeCode 的 meta 白名单、postprocess、CodeBlock',
    convention: false,
    via: 'code',
    text: 'fumadocs 适配与 fumadocs 本体之间。remark 插件是 fumadocs-mdx 编译每一篇时调用的 (tree, file)，从 file.path 认出是哪一篇；目录树引用投影成名为 Files 的节点，由站的组件表对到文件树组件。其余出口按形状对上 fumadocs 的 applyMdxPreset、rehypeCode 的 meta 白名单、postprocess 与 CodeBlock。fumadocs 是 peer 依赖，它改了这些形状，要改的是 fumadocs 适配。',
  },
  {
    n: 8,
    name: '功能包用适配',
    a: ['site-content', 'site-css'],
    b: ['remark', 'glossary', 'cardset', 'styles'],
    iface: "remarkDocfirstHost({ root })、remarkGlossary({ terms, skipFile })、remarkTrajectoryLinks({ hrefBase })；@import '@godcreator/docfirst-workflow/fumadocs/light.css' · term.css · trajectory.css",
    convention: false,
    via: 'code',
    text: '站的功能包与 fumadocs 适配之间。功能包的 remark 插件按文件所在的区分别调用：现状区依次是术语标注（配置里有 glossary 时）与钉码投影，轨迹卡目录用卡链接改写，hrefBase 是星轨盘的地址 /trajectory。功能包的样式表引入适配的三份样式表（目录树的状态点、术语标注、星轨盘），钉码代码块的状态点由功能包自己的样式画。适配改了这几个函数的参数，要同时改功能包。',
  },
  {
    n: 9,
    name: '项目根',
    a: ['project'],
    b: ['root'],
    iface: '配置键 content / components / outputs / trajectory / glossary；内容根下 future/ 名字固定，轨迹卡目录不配置时是内容根下 trajectory/',
    convention: true,
    via: 'disk',
    text: '项目装配与使用方的项目根之间，没有代码接口。loadProject 在项目根找 docfirst.config.mjs，只认这五个配置键，出现别的键当场报错并说明该怎么改；内容根（默认 content/）下 future/ 是未来区，轨迹卡目录由 trajectory 指定（相对项目根），不写时是内容根下 trajectory/，其余 .mdx 文档都是现状区、都进 check；项目根下 src/components/ 里的 .ts、.tsx、.mjs（讲解组件的源码）也进 check。名册里 fumadocs 自带组件的规则，由配置展开 fumadocs 适配的 ./fumadocs/roster。约定由项目装配定，使用方照着写。',
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
    b: ['root'],
    iface: '模板 import 的出口都在 docfirst-workflow 的 /fumadocs 与 /fumadocs/roster、/fumadocs/pre、/fumadocs/light.css、/fumadocs/trajectory 里；站依赖表 src/deps.ts',
    convention: true,
    via: 'disk',
    text: '工作台插件与它建出来的站之间。docfirst.create 把模板写成新站的集合、组件表、docfirst.config.mjs 等文件，接的是 fumadocs 适配的出口，并把 docfirst-workflow 按精确版本写进站的依赖。插件不依赖这个包，模板里的包名和出口名只能靠约定对上：插件的 tests/create.test.ts 检查模板引用的出口都在这个包的清单里、依赖表的版本等于工作区里各包的版本。建在文档站基础包上的站不经这个插件建。',
  },
  {
    n: 13,
    name: '功能包用项目',
    a: ['site-content', 'site-routes'],
    b: ['project', 'cards'],
    iface: 'loadProject(process.cwd()) → Project：config.glossary · docIdOf · contentDir · trajectoryDir；scanCardDir(project.trajectoryDir) → CardScan',
    convention: false,
    via: 'code',
    text: '站的功能包与 workflow 之间。功能包以站点目录 process.cwd() 当项目根调用 loadProject：remark 插件按项目的内容根与轨迹卡目录判断一篇在哪个区，按配置的 glossary 读术语表、用 docIdOf 认出不标注的文档；星轨盘路由的 loader 用 scanCardDir 读轨迹卡目录，交回中性输入加病卡。配置与卡格式由 workflow 负责。',
  },
  {
    n: 14,
    name: '基础包',
    a: ['site-content', 'site-mdx', 'site-routes', 'site-cards'],
    b: ['kit'],
    iface: 'FeatureContent { remarkPlugins } · FeatureSite { routeLinks, mdxComponents } · FeatureRoutes { routes } · FeatureSiteServer；别名 @site/lib/source · mdx-components · trajectory',
    convention: false,
    via: 'code',
    text: '站的功能包与文档站基础包之间。站点 package.json 的 docsite.features 列出功能包，初始化照它生成骨架里引用功能包的文件，并把功能包 template/ 下的轨迹卡集合定义写进站点。骨架的 source.config.ts 把 ./content 的 remark 插件接在 fumadocs 默认插件后面；./site 的侧栏入口与组件、./routes 的路由表由骨架读进整站；路由模块经别名 @site 读骨架里的 source、mdx-components 与轨迹卡集合。出口的形状由基础包定。',
  },
  {
    n: 15,
    name: '站点目录',
    a: ['site-content', 'site-cards'],
    b: ['root'],
    iface: "项目根 = process.cwd()；glossary.terms 指的模块导出 terms；集合 dir: 'trajectory' 与配置 trajectory 指同一个目录",
    convention: true,
    via: 'disk',
    text: '站的功能包与使用方的项目根之间，没有代码接口。站点构建与开发服务都在站点目录里运行，功能包把 process.cwd() 当项目根；remark 插件 import 配置 glossary.terms 指的术语表模块，要求它导出数组 terms；模板写进站点的轨迹卡集合读站点根下的 trajectory/，配置的 trajectory 要指同一个目录，否则卡页与星轨盘读到的不是同一批卡。',
  },
  {
    n: 16,
    name: 'fumadocs 组件',
    a: ['site-mdx', 'site-routes', 'site-cards'],
    b: ['fumadocs-core'],
    iface: '@fumadocs/base-ui 的 Files · Folder · File、DocsPage · DocsBody · DocsTitle、ThemeSwitch；fumadocs-mdx/macro 的 defineCollections',
    convention: false,
    via: 'code',
    text: '站的功能包与 fumadocs 本体之间。目录树引用投影成的 Files、Folder、File 交给 @fumadocs/base-ui 的文件树组件；卡页用它的 DocsPage 等组件放进整站布局，星轨盘页用 DocsBody 排卡正文、ThemeSwitch 切换深浅色；轨迹卡集合用 fumadocs-mdx 的 defineCollections 定义，正文按需加载。@fumadocs/base-ui 是 peer 依赖，用站点装的那份。',
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
