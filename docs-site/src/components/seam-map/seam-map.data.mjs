/**
 * 系统地图接缝图的全部内容：画面（seam-map.tsx）与机读版规则（seam-map.ai.mjs）都只读这一份。
 * 接缝的正本就在这里，system-map.mdx 里只有 <SeamMap /> 标签。
 * 模块按包分：四个 npm 包加工作台插件各一个虚线框，框里的方块是能力；使用方的站、使用方的仓、fumadocs 本体在框外。
 * 每条接缝写明两端的能力、接口、是不是约定（没有代码接口，只靠文件名、目录名、配置键对上）、经代码调用还是经磁盘上的文件。
 * 坐标不在这里，在 seam-map.tsx 的布局表里：这份只描述系统是什么样。
 */

/**
 * @typedef {'blue' | 'violet' | 'emerald' | 'amber' | 'rose' | 'cyan' | 'slate'} Role
 * @typedef {{ id: string, name: string, ident: string }} Capability
 * @typedef {{ id: string, name: string, pkg: string, role: Role | null, outside: boolean, blurb: string, caps: Capability[] }} Module
 */

/** @type {Module[]} */
export const modules = [
  {
    id: 'fumadocs',
    name: 'fumadocs 适配',
    pkg: '@godcreator/docfirst-fumadocs',
    role: 'amber',
    outside: false,
    blurb: '调用链从 fumadocs 或 Next 开始的部分：mdx 加载器编译页面时调的 remark 插件、机读版、页面渲染时的组件、名册规则、卡集合、星轨盘服务端组件。认识另外三个包，谁都不认识它。',
    caps: [
      { id: 'remark', name: 'remark 插件', ident: 'docfirstMdxOptions' },
      { id: 'markdown', name: '机读版', ident: 'markdown.ts' },
      { id: 'pre', name: '状态点与术语组件', ident: './pre · ./term' },
      { id: 'roster', name: '组件名册规则', ident: './roster' },
      { id: 'cardset', name: '卡集合', ident: 'cardSchema' },
      { id: 'disk-server', name: '星轨盘服务端组件', ident: './trajectory' },
    ],
  },
  {
    id: 'workflow',
    name: '命令行与项目',
    pkg: '@godcreator/docfirst-workflow',
    role: 'emerald',
    outside: false,
    blurb: '调用链从 docfirst 命令开始的部分：命令行、项目装配（读盘、git、生成物、磁盘读卡）、mdx 格式。认识两个核心，不认识任何站的宿主。',
    caps: [
      { id: 'cli', name: '命令行', ident: 'docfirst' },
      { id: 'mdx', name: 'mdx 格式', ident: './mdx' },
      { id: 'project', name: '项目装配', ident: 'loadProject' },
      { id: 'io', name: '读盘与 git', ident: 'Reader · History' },
      { id: 'placement', name: '生成物写入', ident: 'placement.ts' },
      { id: 'card-dir', name: '磁盘读卡', ident: 'scanCardDir' },
    ],
  },
  {
    id: 'pin',
    name: '钉码核心',
    pkg: '@godcreator/docfirst-pin',
    role: 'blue',
    outside: false,
    blurb: '引用模型、记号语法、比较器、编排服务。只用 node:crypto，不读文件、不启动子进程、不认识任何文档格式，运行要的格式、读取器、旧内容来源都从构造参数传进来。',
    caps: [
      { id: 'marker', name: '记号语法', ident: 'marker.ts' },
      { id: 'service', name: '编排服务', ident: 'createService' },
      { id: 'compare', name: '比较与跟随', ident: 'compare.ts' },
    ],
  },
  {
    id: 'trajectory',
    name: '轨迹核心',
    pkg: '@godcreator/docfirst-trajectory',
    role: 'violet',
    outside: false,
    blurb: '卡片格式与校验、建模、布局、缩略图，另有星轨盘画布 ./disk。主入口的产物里一条 import 都没有，卡片文件由调用方读好传进来。',
    caps: [
      { id: 'model', name: '卡片与建模', ident: 'scanCards' },
      { id: 'thumbs', name: '布局与缩略图', ident: 'launcherThumbs' },
      { id: 'disk', name: '星轨盘画布', ident: './disk' },
    ],
  },
  {
    id: 'plugin',
    name: '工作台插件',
    pkg: '@godcreator/gwb-docfirst-workflow',
    role: 'cyan',
    outside: false,
    blurb: '不进 npm 的依赖网，只在桌面工作台里给 agent 提供两条建站命令和七份说明书。对四个包零依赖：不 import、不运行它们的命令行。',
    caps: [
      { id: 'skills', name: '七份说明书', ident: 'skills/' },
      { id: 'create', name: '建站命令与模板', ident: 'docfirst.create' },
    ],
  },
  {
    id: 'fumadocs-core',
    name: 'fumadocs 本体',
    pkg: 'peer 依赖，用站自己装的那份',
    role: null,
    outside: true,
    blurb: 'fumadocs-mdx 编译 mdx、fumadocs-ui 提供代码块与目录树组件。不属于这个仓，fumadocs 适配按它的形状接上去。',
    caps: [{ id: 'fumadocs-core', name: 'fumadocs 本体', ident: 'fumadocs-mdx · fumadocs-ui' }],
  },
  {
    id: 'site',
    name: '使用方的站',
    pkg: 'Next 站的接线代码',
    role: null,
    outside: true,
    blurb: '装了这几个包的站：src/lib/source.ts 接集合，src/components/mdx.tsx 换组件，星轨整页调用星轨盘。本仓的 docs-site/ 就是这样一个站。',
    caps: [{ id: 'wiring', name: '站的接线代码', ident: 'source.ts · mdx.tsx' }],
  },
  {
    id: 'repo',
    name: '使用方的仓',
    pkg: '磁盘上的文件',
    role: null,
    outside: true,
    blurb: '站所在的仓：项目根的配置与内容、被钉的源码与 git 历史、仓根的生成物。四个包只经约定读写它们。',
    caps: [
      { id: 'root', name: '站的项目根', ident: 'docfirst.config.mjs · content/' },
      { id: 'source', name: '被钉的源码与 git 历史', ident: '源码 · .git' },
      { id: 'outputs', name: '仓根生成物', ident: 'README · AGENTS · CLAUDE' },
    ],
  },
];

/**
 * 从系统外面进来的三条入口，画成灰色箭头，不编号、不算接缝。to 是进来的那个能力或模块。
 * @type {{ id: string, name: string, to: string }[]}
 */
export const entries = [
  { id: 'agent', name: 'agent · 工作台命令总线', to: 'plugin' },
  { id: 'next', name: 'Next 构建', to: 'remark' },
  { id: 'human', name: '人 · git hook · CI', to: 'cli' },
];

/**
 * 十二条接缝。a、b 是两端的能力 id；via 为 code 是代码调用（实线），disk 是读写磁盘上的文件（虚线）。
 * label 与 text 给 CasePicker：label 是「编号 名称」，text 写连接谁、交换什么、由谁负责。
 * @typedef {{ id: string, n: number, name: string, label: string, a: string[], b: string[], iface: string, convention: boolean, via: 'code' | 'disk', text: string }} Seam
 * @type {Seam[]}
 */
export const seams = [
  {
    n: 1,
    name: '记号格式',
    a: ['mdx'],
    b: ['marker', 'service'],
    iface: 'Format：name / claims / parse / write / marker',
    convention: false,
    via: 'code',
    text: 'mdx 格式与钉码核心之间。钉码核心定义 Format 接口，编排服务经它认领文档、从文本里认出引用、把新记录写回记号那一行；mdx 格式实现这几个方法，写正式记号时调用钉码核心记号语法里的 formalOf。接口正本在钉码核心，mdx 格式负责实现。命令行另要的名册检查与渲染由 workflow 的 DocFormat 扩展，不进这个接口。',
  },
  {
    n: 2,
    name: '文件与旧内容',
    a: ['io'],
    b: ['compare'],
    iface: 'Reader：read / list / kindOf；History：oldText / hunks',
    convention: false,
    via: 'code',
    text: '读盘与 git 和钉码核心的比较器之间。比较器要看的当前文件、目录的名字表、路径是文件还是目录，从 Reader 取；确认时的旧文件（按 blob 名）与两份文本之间的 hunk 表，从 History 取。workflow 用 createReader 与 createGitHistory 实现这两个接口，装配项目时传给 createService。取不到旧内容时 oldText 给 null，比较器改为在整个文件里按指纹找。',
  },
  {
    n: 3,
    name: '编排服务',
    a: ['project'],
    b: ['service'],
    iface: 'createService({ formats, reader, history }) → resolve / resolveRefs / confirm / formatFor，结果是 Listing',
    convention: false,
    via: 'code',
    text: '项目装配与钉码核心的编排服务之间。loadProject 用配置里的格式和接缝 2 的两个实现调用 createService，把交回的服务放在 Project.service 上；命令行的 check、confirm、render 与 fumadocs 适配的 remark 插件都经它核对。resolve 与 resolveRefs 只核对、不写回，confirm 决定每处记号写不写回、写成什么。判定全部在钉码核心，调用方只读交回的 Listing。',
  },
  {
    n: 4,
    name: '卡片记录',
    a: ['card-dir', 'cli'],
    b: ['model'],
    iface: 'CardFile（name、text、mtime）→ scanCards → 卡与病卡；buildTrajectory → 盘、树、主干',
    convention: false,
    via: 'code',
    text: 'workflow 与轨迹核心之间。轨迹核心不读盘：scanCardDir 读轨迹卡目录，把每张卡的文件名、全文、修改时间交给 scanCards，拿回卡与病卡，再补查卡里不许钉码。命令行的 check 把病卡打印成行、计进红，docfirst trajectory 再调用 buildTrajectory 列出盘、树与主干。卡片字段与校验规则由轨迹核心负责。',
  },
  {
    n: 5,
    name: '星轨盘与卡集合',
    a: ['disk-server', 'cardset'],
    b: ['model', 'thumbs', 'disk'],
    iface: 'buildTrajectory、launcherThumbs、./disk 的 StarDisk、star.css；卡集合用 CARD_KEYS',
    convention: false,
    via: 'code',
    text: 'fumadocs 适配与轨迹核心之间。星轨盘服务端组件读完卡调用 buildTrajectory 建模、launcherThumbs 画启动器缩略图，交给客户端组件 StarDisk 显示；StarDisk 按包名从 ./disk 取，Next 才认得出客户端边界。卡集合的 cardSchema 按 CARD_KEYS 判断哪些字段算卡，与命令行校验卡是同一条判据。本站的星轨整页也直接从轨迹核心取 StarDisk、launcherThumbs 和样式表 star.css。模型与画布的形状由轨迹核心负责。',
  },
  {
    n: 6,
    name: '项目',
    a: ['project', 'mdx', 'card-dir'],
    b: ['remark', 'disk-server'],
    iface: '主入口的 loadProject（service、roster、docIdOf）；./mdx 的 recognize、stamp 等语法树函数；./cards 的 scanCardDir',
    convention: false,
    via: 'code',
    text: 'workflow 与 fumadocs 适配之间。站构建时 remark 插件调用 loadProject 装配一次项目，拿到编排服务与组件名册，用 ./mdx 的 recognize 在语法树上认记号、用 stamp 按名册打标记，认记号用的是和命令行同一份代码。星轨盘服务端组件只从 ./cards 取 scanCardDir，不从主入口取，免得把命令行与配置加载带进 Next 的服务端构建。出口由 workflow 负责。',
  },
  {
    n: 7,
    name: 'fumadocs 接线',
    a: ['remark', 'markdown', 'pre'],
    b: ['fumadocs-core'],
    iface: 'applyMdxPreset 的参数形状、postprocess、rehypeCode 的 meta 白名单、CodeBlock、Files',
    convention: false,
    via: 'code',
    text: 'fumadocs 适配与 fumadocs 本体之间。docfirstMdxOptions 的返回值按形状对上 applyMdxPreset 的参数，把 remark 插件放在链尾；docfirstMarkdownOptions 交给 postprocess 生成机读版；parseMetaString 让 rehypeCode 放行状态点的 data-dot；状态点代码块套 fumadocs-ui 的 CodeBlock，目录树用它的 Files。fumadocs 是 peer 依赖，它改了这些形状，要改的是 fumadocs 适配。',
  },
  {
    n: 8,
    name: '站接入',
    a: ['remark', 'markdown', 'pre', 'roster', 'cardset', 'disk-server'],
    b: ['wiring', 'root'],
    iface: 'docfirstMdxOptions、docfirstMarkdownOptions、cardSchema、remarkTrajectoryLinks；./pre、./term、./trajectory、样式表；./roster',
    convention: false,
    via: 'code',
    text: 'fumadocs 适配与使用方站的接线代码之间。站的 src/lib/source.ts 把前四个出口接到现状集合与轨迹卡集合上，mdx.tsx 把 pre 换成会画状态点的 DocfirstPre、登记 Term，星轨整页调用 loadTrajectory，样式表 light.css、term.css 由站引入；docfirst.config.mjs 展开 ./roster 的 fumadocsRoster。出口名由 fumadocs 适配负责，改名要同时改站的接线代码和接缝 12 的模板。',
  },
  {
    n: 9,
    name: '项目根',
    a: ['project'],
    b: ['root'],
    iface: '配置键 formats / content / components / outputs；内容根下 trajectory/、future/ 两个名字固定',
    convention: true,
    via: 'disk',
    text: '项目装配与使用方的项目根之间，没有代码接口。loadProject 在项目根找 docfirst.config.mjs，只认四个配置键，出现别的键当场报错并说明该怎么改；内容根（默认 content/）下 trajectory/ 是轨迹卡、future/ 是未来区，其余由格式认领的文档都是现状区、都进 check。约定由项目装配定，使用方照着写。',
  },
  {
    n: 10,
    name: '仓里的文件',
    a: ['io'],
    b: ['source'],
    iface: '按相对项目根的路径读文件、列目录；git 按 blob 取旧文件、算差异、查未提交改动',
    convention: true,
    via: 'disk',
    text: '读盘与 git 和使用方仓里被钉的源码、git 历史之间。读取器按相对项目根的路径读文件、列目录（在 git 仓里按 .gitignore 过滤）；旧内容来源找到文件所在的仓，从对象库按 blob 名取确认时的内容；check 另问被钉的文件在本仓有没有未提交的改动，有的话那处黄灯算红。确认时的文件进过 git，旧内容才取得回来。',
  },
  {
    n: 11,
    name: '生成物',
    a: ['placement'],
    b: ['outputs'],
    iface: 'outputs 映射：mdx 正本 → 落点路径，可指定保留的 frontmatter 字段',
    convention: true,
    via: 'disk',
    text: '生成物写入与使用方仓根的生成物之间。placement.ts 把 outputs 映射左边的 mdx 正本渲染成 md，写到右边的每个落点（README、AGENTS、CLAUDE、插件里的 SKILL.md）；check 只核对盘上那份是不是最新。落点上的文件是生成物：改正本，再 render。',
  },
  {
    n: 12,
    name: '模板',
    a: ['create'],
    b: ['wiring', 'root'],
    iface: '模板只能 import docfirst-workflow/mdx、docfirst-fumadocs 与它的 /roster、/pre、/light.css；站依赖表 src/deps.ts',
    convention: true,
    via: 'disk',
    text: '工作台插件与它建出来的站之间。docfirst.create 把模板写成新站的 source.ts、mdx.tsx、docfirst.config.mjs 等文件，并把 workflow 与 fumadocs 两个包按精确版本写进站的依赖。插件不依赖这几个包，模板里的包名和出口名只能靠约定对上：插件的 tests/create.test.ts 检查模板引用的出口都在这两个包的清单里、依赖表的版本等于工作区里各包的版本。',
  },
].map((seam) => ({ ...seam, id: String(seam.n), label: `${seam.n} ${seam.name}` }));

/** 能力 id → 它所在的模块 @type {Map<string, Module>} */
export const moduleOfCap = new Map(modules.flatMap((m) => m.caps.map((c) => /** @type {[string, Module]} */ ([c.id, m]))));

/** 能力 id → 能力 @type {Map<string, Capability>} */
export const capById = new Map(modules.flatMap((m) => m.caps.map((c) => /** @type {[string, Capability]} */ ([c.id, c]))));

/**
 * 跟一个模块有关的接缝：任一端落在这个模块的能力上
 * @param {string} moduleId
 * @returns {Seam[]}
 */
export function seamsOfModule(moduleId) {
  return seams.filter((s) => [...s.a, ...s.b].some((cap) => moduleOfCap.get(cap)?.id === moduleId));
}
