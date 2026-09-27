/**
 * 边界规则图（BoundaryRules）的全部内容：画面（boundary-rules.tsx）与机读版规则（boundary-rules.ai.mjs）都只读这一份。
 * 事实的正本是 tests/boundary.test.ts：每类规则对应它文件头注释里的一类约束，禁止什么、为什么照它的注释写，
 * 失败的 test 名照抄；允许的边照各包 package.json 的依赖字段与 workflow 各目录真实的 import 画。
 * 坐标不在这里，在 boundary-rules.tsx 的布局表里：这份只描述谁能依赖谁。
 */

/**
 * @typedef {'blue' | 'violet' | 'emerald' | 'amber' | 'rose' | 'cyan' | 'slate'} Role
 * @typedef {{ id: string, name: string, short: string, ident: string, role: Role | null, parent: string | null }} BoundaryNode
 */

/**
 * 图上的节点。role 与系统地图接缝图（seam-map.data.mjs）里同一个包的角色色一致；
 * role 为 null 的是仓外或包外的东西（站、宿主、别的模块），画成灰色细框。parent 不为 null 的是 workflow 命令行那一侧的目录，
 * 画在 workflow 的虚线框里；fumadocs 适配也是 workflow 包里的目录（src/fumadocs/），它是站那一侧，单独画在框外、站的正下方。
 * @type {BoundaryNode[]}
 */
/* tree dir="../packages/docfirst-workflow/src" depth="1" hash="678b25f13fa3" */
export const nodes = [
  { id: 'plugin', name: '工作台插件', short: '插件', ident: 'plugins/docfirst', role: 'cyan', parent: null },
  { id: 'site', name: '文档站', short: 'docs-site', ident: 'docs-site', role: null, parent: null },
  { id: 'explain', name: '讲解播放器', short: 'explainer-player', ident: 'explainer-player', role: 'slate', parent: null },
  { id: 'fumadocs', name: 'fumadocs 适配', short: 'fumadocs/', ident: 'docfirst-workflow/fumadocs', role: 'amber', parent: null },
  { id: 'workflow', name: '命令行与项目', short: 'workflow', ident: 'docfirst-workflow', role: 'emerald', parent: null },
  { id: 'marker', name: 'marker/', short: 'marker/', ident: '记号写法', role: 'emerald', parent: 'workflow' },
  { id: 'reference', name: 'reference/', short: 'reference/', ident: '引用与清单', role: 'emerald', parent: 'workflow' },
  { id: 'mdx', name: 'mdx/', short: 'mdx/', ident: 'mdx 格式', role: 'emerald', parent: 'workflow' },
  { id: 'code', name: 'code/', short: 'code/', ident: '组件格式', role: 'emerald', parent: 'workflow' },
  { id: 'pinning', name: 'pinning/', short: 'pinning/', ident: '钉码编排', role: 'emerald', parent: 'workflow' },
  { id: 'project', name: 'project/', short: 'project/', ident: '项目装配', role: 'emerald', parent: 'workflow' },
  { id: 'cli', name: 'cli/', short: 'cli/', ident: '命令行', role: 'emerald', parent: 'workflow' },
  { id: 'cards', name: 'cards/', short: 'cards/', ident: '卡格式', role: 'emerald', parent: 'workflow' },
  { id: 'node', name: 'node/', short: 'node/', ident: 'Node 实现', role: 'emerald', parent: 'workflow' },
  { id: 'pin', name: '钉码', short: 'code-pin', ident: 'code-pin', role: 'blue', parent: null },
  { id: 'trajectory', name: '星轨盘', short: 'trajectory-disk', ident: 'trajectory-disk', role: 'violet', parent: null },
  { id: 'host', name: '站的宿主', short: '宿主', ident: 'fumadocs · next · react', role: null, parent: null },
  { id: 'crypto', name: 'node:crypto', short: 'node:crypto', ident: 'Node 内置模块', role: null, parent: null },
  { id: 'others', name: '别的模块', short: '别的模块', ident: 'npm 包 · 别的 node: 内置', role: null, parent: null },
];

/**
 * 允许的依赖，也就是图上平时画出来的箭头。key 写成「起点>终点」；kind 写这条依赖落在哪里。
 * 包之间的边都是 package.json 里实际写着的依赖；workflow 目录之间只画相邻两层之间实际的 import（cli → project → pinning → mdx、code → marker、reference，cli → cards → marker，project → node、cli → node），
 * 上层还直接 import 更下层的目录（cli 与 project 用 marker、mdx、reference，pinning 用 reference，cards 也用 node），禁止表都允许，图上不画。
 * @typedef {{ key: string, kind: string }} AllowedEdge
 * @type {AllowedEdge[]}
 */
export const allowedEdges = [
  { key: 'site>fumadocs', kind: '站的 dependencies，import ./fumadocs 开头的出口' },
  { key: 'site>workflow', kind: '站的 dependencies，运行命令行 docfirst、docfirst.config.mjs import ./mdx' },
  { key: 'site>trajectory', kind: '站的 dependencies' },
  { key: 'site>explain', kind: '站的 dependencies' },
  { key: 'fumadocs>pin', kind: 'dependencies，只 import 类型' },
  { key: 'fumadocs>trajectory', kind: 'dependencies，按包名再导出 ./disk 与样式' },
  { key: 'fumadocs>workflow', kind: '按包名 import 本包的 .、./mdx、./cards' },
  { key: 'fumadocs>host', kind: '可选 peer：fumadocs-core、fumadocs-ui、react，只有 fumadocs/ 用' },
  { key: 'workflow>pin', kind: 'dependencies' },
  { key: 'workflow>trajectory', kind: 'dependencies' },
  { key: 'trajectory>host', kind: '可选 peer：react，只给 ./disk 用' },
  { key: 'explain>host', kind: '必需 peer：react' },
  { key: 'pin>crypto', kind: '源码 import' },
  { key: 'marker>pin', kind: '源码 import，只 import 类型' },
  { key: 'reference>pin', kind: '源码 import，只 import 类型' },
  { key: 'cli>project', kind: '目录间 import' },
  { key: 'project>pinning', kind: '目录间 import' },
  { key: 'pinning>mdx', kind: '目录间 import' },
  { key: 'pinning>code', kind: '目录间 import' },
  { key: 'mdx>marker', kind: '目录间 import' },
  { key: 'mdx>reference', kind: '目录间 import，只 import 类型' },
  { key: 'code>marker', kind: '目录间 import' },
  { key: 'code>reference', kind: '目录间 import，只 import 类型' },
  { key: 'cli>cards', kind: '目录间 import' },
  { key: 'cards>marker', kind: '目录间 import' },
  { key: 'project>node', kind: '目录间 import' },
  { key: 'cli>node', kind: '目录间 import' },
];

/**
 * 每类规则一个按钮。label 与 text 由 CasePicker 显示：text 写这一类为什么要守。
 * allowed：这一类守着的允许方向，画面上实线高亮；forbidden：这一类禁止的方向，画成红色虚线并打叉，
 * 每项的 edges 写成「起点>终点」（单向禁止）或「甲~乙」（两个方向都禁止），同一对节点上已有允许的边时加「:后缀」另起一条线。
 * tests：违反时会失败的 test，name 照抄 tests/boundary.test.ts，checks 写它读的是什么。
 * @typedef {{ edges: string[], what: string }} Forbidden
 * @typedef {{ name: string, checks: string }} GuardTest
 * @typedef {{ id: string, label: string, text: string, allowed: string[], forbidden: Forbidden[], tests: GuardTest[] }} BoundaryRule
 * @type {BoundaryRule[]}
 */
/* ref file="../tests/boundary.test.ts" hash="81906c2cf24c" blob="b3c39878725f" */
export const rules = [
  {
    id: 'packages',
    label: '包与包的方向',
    text: '方向一破，下游的改动就会拖着上游一起发版，而且没有任何别的信号。pnpm 严格的 node_modules 只拦得住没写进依赖的 import，「该不该写进依赖」没人检查，这一类补的就是它。禁止表 PACKAGE_FORBIDDEN 按包列出它不许依赖的兄弟包，列的是禁止的、不是允许的；packages/ 下多出一个表里没有的目录，另一条测试当场失败，逼着先想清楚新包能认识谁。',
    allowed: ['workflow>pin', 'workflow>trajectory', 'fumadocs>pin', 'fumadocs>trajectory'],
    forbidden: [
      {
        edges: ['pin>workflow', 'pin>fumadocs', 'pin~trajectory'],
        what: '钉码谁都不认识，也不认识 docfirst-workflow 的任何部分：判代码变没变要的读取器、旧内容来源都由构造参数传进来。',
      },
      {
        edges: ['trajectory>workflow', 'trajectory>fumadocs'],
        what: '星轨盘不认识钉码、workflow、fumadocs 适配：它只收盘心加一组卡的中性输入，docfirst 卡格式与读卡目录在 workflow。',
      },
      {
        edges: ['explain~pin', 'explain~trajectory', 'explain~workflow', 'explain~fumadocs'],
        what: '讲解播放器跟本仓别的包互不认识：普通 fumadocs 站也用它，docfirst 的包都不用它，只有站用。',
      },
    ],
    tests: [
      { name: '包的方向：清单三类依赖字段里不许出现禁止的兄弟包', checks: '读各包 package.json 的 dependencies、peerDependencies、devDependencies' },
      { name: '包的方向：源码里也不许 import 禁止的兄弟包', checks: '读各包 src/ 下每个 .ts、.tsx 的 import' },
      { name: 'packages/ 下的包一个不多一个不少——加了新包得先想清楚它能认识谁', checks: 'packages/ 下的目录必须正好是禁止表里列出的那些' },
    ],
  },
  {
    id: 'generic',
    label: '通用包独立',
    text: '钉码、星轨盘、讲解播放器是通用包：不认识 docfirst，谁都能单独拿走用，docfirst 只是它们的一个使用者。三个包列在 GENERIC_PACKAGES 一张表里，三条检查对表里每个包都一样：清单里没有任何 @godcreator/ 包；源码与产物不 import 它们，源码的相对 import 不出自己的 src/；包目录里一个 docfirst 字样都没有，连注释也算——通用包里一旦写了「docfirst 会这样用」，下一个改它的人就会照着 docfirst 的需要改它。另外各包有自己的几条：钉码只许 node:crypto；星轨盘唯一对外的依赖是 ./disk 入口（客户端组件 StarDisk）用的 react，它是可选 peer，要按包名 import、不许打包进产物。',
    allowed: ['pin>crypto', 'trajectory>host', 'explain>host'],
    forbidden: [
      {
        edges: ['pin~trajectory', 'explain~pin', 'explain~trajectory', 'pin>workflow', 'trajectory>workflow', 'explain~workflow'],
        what: '三个通用包的清单里不许有任何 @godcreator/ 包，开发期依赖也算；源码与产物不许 import 它们，源码的相对 import 不许出自己的 src/；源码、产物、样式、构建配置与清单里不许出现 docfirst 字样。',
      },
      {
        edges: ['pin>others'],
        what: '钉码的 dependencies 与 peerDependencies 必须是空的，源码只许 import 自己的文件和 node:crypto；源码与产物里也不许出现 mdx、记号写法、引用、清单这些文档文本那一侧的名字。',
      },
      {
        edges: ['trajectory>others'],
        what: '星轨盘的 . 入口产物一条 import 都不许有，连 node: 内置也不行；.ts 源码只许相对 import，建模 src/model/ 只许 import 自己目录里的文件；整个包里不许出现关系行、frontmatter 字段名这些 docfirst 卡文件的写法；./disk 的产物头一行是 "use client"，只许 import react，react 本体不许打包进来。',
      },
    ],
    tests: [
      { name: '通用包独立：清单三类依赖字段里没有任何 @godcreator/ 包', checks: '读三个通用包 package.json 的 dependencies、peerDependencies、devDependencies' },
      { name: '通用包独立：源码与产物不 import 任何 @godcreator/ 包，源码的相对 import 不出自己的 src/', checks: '读三个通用包 src/ 下每个文件与 dist/ 下每份产物的 import' },
      { name: '通用包不认识 docfirst：源码、产物、样式、构建配置与清单里一个 docfirst 字样都没有', checks: '逐行读三个通用包目录下除 node_modules 以外的全部文件' },
      { name: 'pin 零依赖：清单里没有 dependencies / peerDependencies，源码只 import 自己和 node:crypto', checks: '读钉码的 package.json 与 src/ 的 import' },
      { name: '钉码核心不接触文档文本：源码与产物里没有 mdx、记号写法、格式接口、引用与清单', checks: '读钉码的 src/ 与产物 index.mjs、index.d.mts 的全文' },
      { name: 'trajectory 的 `.` 入口零 import：产物一条 import 都没有，连 node: 也没有', checks: '读产物 dist/index.mjs 与 package.json 的 dependencies' },
      { name: 'trajectory 的 `.ts` 源码只有相对 import——`.tsx` 是 `./disk` 入口，由下一条按产物查', checks: '读 src/ 下每个 .ts 的 import' },
      { name: 'trajectory 的建模 `src/model/` 只 import 自己目录里的文件——布局、画布、组件都在它下游', checks: '读 src/model/ 下每个文件的 import' },
      { name: 'trajectory 不认识 docfirst 卡格式：整个包（源码、产物、样式）里没有关系行、frontmatter 字段名这些卡文件的写法', checks: '读星轨盘包目录下除 node_modules 以外的全部文件' },
      { name: 'trajectory 的 `./disk`：客户端指令在头一行，只 import react、不内联 react', checks: '读产物 dist/disk.mjs 的头一行、import 行与正文' },
    ],
  },
  {
    id: 'workflow-dirs',
    label: 'workflow 目录方向',
    text: '这几个目录在同一个包里，编译器不拦跨目录的 import：mdx/ 里写一句 import "../project/load.ts" 不会报错，mdx 格式从此就跟读盘、git 绑在一起。禁止表 WORKFLOW_DIRS 列的是禁止的目录：写成允许的目录的话，加一个新目录会默默地什么都不许，加错地方反而更难发现；src/ 下多出一个表里没有的目录，另一条测试当场失败。图上只画相邻两层之间的 import：cli 与 project 还直接用 marker、mdx、reference，pinning 也直接用 reference，禁止表都允许。cards 是 docfirst 卡格式，卡里不许钉码要认记号，所以只认识 marker，只有 cli 用它。fumadocs/ 是站那一侧：不用相对路径进任何目录，只按包名用本包的 .、./mdx、./cards，命令行那一侧的目录都不认识它，站构建时加载的产物才不会带上命令行代码。',
    allowed: ['cli>project', 'project>pinning', 'pinning>mdx', 'pinning>code', 'mdx>marker', 'mdx>reference', 'code>marker', 'code>reference', 'marker>pin', 'reference>pin', 'cli>cards', 'cards>marker', 'project>node', 'cli>node', 'fumadocs>workflow'],
    forbidden: [
      {
        edges: ['marker~reference', 'marker>mdx:back', 'reference>code:back'],
        what: 'marker 是记号写法，reference 是引用与清单的类型，两个都谁都不认识：marker 只从 @godcreator/code-pin import 类型，reference 只认识 @godcreator/code-pin。',
      },
      { edges: ['mdx>pinning:back', 'mdx>project'], what: 'mdx 格式认引用、写回、渲染，不认识钉码编排的先后顺序，也不认识项目怎么装配、不碰磁盘与 git。' },
      {
        edges: ['mdx~code', 'code>pinning:back'],
        what: '组件格式只认识 marker 与 reference：跟 mdx 格式互不认识，也不认识钉码编排、project 与 cli。两种格式由钉码编排按文件选。',
      },
      { edges: ['pinning>project:back'], what: '钉码编排不认识 project，也不认识记号属性怎么写：记号写法在两种格式后面。' },
      { edges: ['cards>pinning', 'cards>cli:back'], what: '卡格式只认识 marker：不认识钉码编排、项目装配，也不认识 cli。' },
      { edges: ['project>cli:back', 'pinning>cli'], what: 'cli 是入口，认识另外几个目录，谁都不认识它。' },
      { edges: ['node>project:back', 'mdx>node'], what: 'node 是 Node 实现：包里只有它碰 node:fs、git 子进程与系统临时目录，不认识 docfirst 的任何格式，所以包里谁都不认识；只有 project、cards、cli 用它，记号、格式、钉码编排都不碰磁盘。' },
      { edges: ['workflow>fumadocs'], what: '命令行那一侧的目录都不许引用 fumadocs/，也不许按包名引用本包；fumadocs/ 不许用相对路径出自己的目录，按包名只许用 .、./mdx、./cards。' },
      {
        edges: ['workflow>host'],
        what: '除了 fumadocs/，workflow 不认识站的宿主：源码与产物 index.mjs / cli.mjs / mdx.mjs / cards.mjs 连同它们引的 chunk 里都不许出现 fumadocs、next、react、react-dom。',
      },
    ],
    tests: [
      { name: 'workflow 目录方向：marker 与 reference 谁都不认识，mdx 不认识钉码编排与 project，都不认识 cli', checks: '读 src/<目录>/ 下每个文件的相对 import，看它落进哪个目录' },
      { name: 'workflow 目录方向：reference 只认识 @godcreator/code-pin', checks: '读 src/reference/ 下每个文件的 import' },
      { name: 'workflow 目录方向：code 只认识 marker、reference 与 @godcreator/code-pin', checks: '读 src/code/ 下每个文件的 import，看相对 import 落进哪个目录' },
      { name: 'workflow 目录方向：marker 只从 @godcreator/code-pin import 类型，别的只许是目录里的相对路径', checks: '读 src/marker/ 下每条 import 语句的整行' },
      { name: 'workflow 目录方向：目录一个不少、一个不多——加了新目录得先想清楚它能认识谁', checks: 'src/ 下的目录必须正好是禁止表里列出的那些' },
      { name: 'workflow 的 fumadocs 目录：相对 import 不出 src/fumadocs/，本包只按包名用 `.`、`./mdx`、`./cards`；别的目录不按包名引用本包', checks: '读 src/ 下每个文件的 import，看相对 import 落在哪、按包名引用了本包的哪个出口' },
      { name: 'workflow 除了 src/fumadocs/ 不认识任何站的宿主：源码与命令行那一侧的产物一个 fumadocs / react / next import 都没有', checks: '读 src/fumadocs/ 以外的源码与产物 index.mjs、cli.mjs、mdx.mjs、cards.mjs' },
    ],
  },
  {
    id: 'host-peer',
    label: '宿主只能是可选 peer',
    text: 'fumadocs 与 react 用的是消费方项目装的那份，只有 fumadocs/ 用，只运行命令行的项目不装它们，所以标可选。宿主被打包进产物，就是两份 React 各运行一套，现象是预渲染时莫名其妙的 hooks 报错。客户端组件 pre 的 "use client" 要留在产物头一行，不然 Next 不认；星轨盘按包名 import @godcreator/trajectory-disk/disk，那份产物头一行的 "use client" 才管得住 StarDisk。./fumadocs/roster 由命令行读 docfirst.config.mjs 时加载，命令行那一侧没有宿主。',
    allowed: ['fumadocs>host', 'fumadocs>pin', 'fumadocs>trajectory', 'fumadocs>workflow'],
    forbidden: [
      {
        edges: ['fumadocs>host:bundled'],
        what: 'fumadocs-core、fumadocs-ui、react 必须声明成 peer 并标 optional，不许进 dependencies；fumadocs-*.mjs 产物里宿主、兄弟包与本包别的出口只许按包名 import，不许打包进来；./fumadocs/roster 的产物连同它引的 chunk 不许 import 宿主。',
      },
    ],
    tests: [
      { name: 'workflow 的宿主只能是可选的 peer，不许进 dependencies', checks: '读 package.json 的 peerDependencies、peerDependenciesMeta、dependencies' },
      { name: 'fumadocs 子入口的产物：宿主、兄弟包与本包的别的出口只许按包名 import，不许打包进产物；pre 的客户端指令在头一行', checks: '读 fumadocs-*.mjs 各份产物的 //#region 来源、头一行与 import 行' },
      { name: 'fumadocs 子入口的 `./fumadocs/roster`：命令行读 docfirst.config.mjs 时会加载它，产物不许 import 宿主', checks: '读产物 fumadocs-roster.mjs 与源码 fumadocs/roster.ts 的 import' },
    ],
  },
  {
    id: 'plugin',
    label: '包不认识插件',
    text: '插件跟包在同一个工作区。包一旦认识插件，哪怕只是一条 devDependency，这几个包就不能再发布了：装它们的人不该连带装上整个桌面工作台生态。反方向（插件不许依赖本仓 packages/ 下的任何一个包，包名从各包清单现读）不在这个文件里，由插件自己的 tests/artifact.test.ts 检查，两边互不认识。说明书与建站模板也随插件发：包只发 dist 与样式，包里不许再有 skills/、template/。',
    allowed: [],
    forbidden: [
      {
        edges: ['pin>plugin', 'trajectory>plugin', 'workflow>plugin', 'fumadocs>plugin', 'explain>plugin'],
        what: '各包的依赖字段（运行时、peer、开发期）与源码里都不许出现工作台插件，也不许出现任何 @godcreator/gwb-*。',
      },
    ],
    tests: [
      { name: 'npm 包的依赖字段里不许出现工作台插件，也不许出现任何 @godcreator/gwb-*', checks: '读各包 package.json 的三类依赖字段' },
      { name: 'npm 包的源码里一行 @godcreator/gwb-* 都没有', checks: '读各包 src/ 下每个文件的 import' },
      { name: '包只发 dist 与样式：skills 与 template 跟着插件走了，包里连目录都不该再有', checks: '读各包 package.json 的 files，并查包目录里有没有 skills/、template/' },
    ],
  },
  {
    id: 'explain',
    label: '讲解播放器的两个入口',
    text: '讲解播放器的 . 出口是客户端组件，产物头一行必须是 "use client"；./text 把各帧的说明转成机读版文字，站在 Node 里生成机读版时加载它（docfirst 站由 docfirst.config.mjs 加载），源码与产物都零 import、不带客户端指令。它不依赖任何 @godcreator/ 包，由「通用包独立」那一类查。',
    allowed: ['explain>host', 'site>explain'],
    forbidden: [
      {
        edges: ['explain>others'],
        what: '没有 dependencies，peer 只有 react 而且是必需的；. 出口的产物只许 import react，react 与别的模块都不许打包进来。',
      },
      { edges: ['plugin>explain'], what: '工作台插件也不许依赖它。' },
    ],
    tests: [
      { name: 'explainer-player 清单：没有 dependencies，react 只作必需 peer；工作台插件不依赖它', checks: '读讲解播放器与工作台插件的 package.json' },
      { name: 'explainer-player 的 `.`：客户端指令在头一行，只 import react，没有把 react 或别的模块打包进来', checks: '读产物 dist/index.mjs 的头一行、import 行、//#region 来源与正文' },
      { name: 'explainer-player 的 `./text`：docfirst.config.mjs 在 Node 里加载它，产物零 import、不带客户端指令', checks: '读产物 dist/text.mjs 与源码 text.ts' },
    ],
  },
];

/** 节点 id → 节点 @type {Map<string, BoundaryNode>} */
export const nodeById = new Map(nodes.map((n) => [n.id, n]));

/**
 * 把边的 key 拆开：「起点>终点」单向，「甲~乙」双向，「:后缀」只用来区分同一对节点上的另一条线。
 * 两端必须都是 nodes 里的 id，写错直接报错。
 * @param {string} key
 * @returns {{ key: string, from: string, to: string, both: boolean }}
 */
export function parseEdge(key) {
  const match = /^([a-z-]+)([>~])([a-z-]+)(?::[a-z-]+)?$/.exec(key);
  if (match === null) throw new Error(`边的写法不对：「${key}」，应写成「起点>终点」或「甲~乙」，可带「:后缀」`);
  const [, from, sign, to] = match;
  for (const id of [from, to]) {
    if (!nodeById.has(id)) throw new Error(`边「${key}」里的「${id}」不是图上的节点`);
  }
  return { key, from, to, both: sign === '~' };
}

/** 允许的边按 key 查 @type {Map<string, AllowedEdge>} */
export const allowedByKey = new Map(allowedEdges.map((e) => [e.key, e]));

for (const rule of rules) {
  for (const key of rule.allowed) {
    if (!allowedByKey.has(key)) throw new Error(`规则「${rule.label}」高亮的「${key}」不在 allowedEdges 里`);
  }
  for (const item of rule.forbidden) item.edges.forEach(parseEdge);
}
for (const edge of allowedEdges) parseEdge(edge.key);

/**
 * 一条边读成文字：「pin → workflow」或「explainer-player ↔ pin」
 * @param {string} key
 */
export function edgeText(key) {
  const { from, to, both } = parseEdge(key);
  return `${nodeById.get(from).short} ${both ? '↔' : '→'} ${nodeById.get(to).short}`;
}
