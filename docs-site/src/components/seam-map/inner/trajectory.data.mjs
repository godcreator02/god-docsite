/**
 * 星轨盘 trajectory-disk 的内部接缝图：模块页 <SeamMap module="trajectory" /> 画的就是它。
 * 框是包里的模块（src/model/ 目录、layout.ts 与 chains.ts、canvas/ 目录、disk.tsx 与 star.css），方块是它对外给的东西；
 * 灰色实线框是包外的调用方与 react。坐标在 trajectory.layout.ts。
 */
import { defineSeamGraph } from '@godcreator/docfirst-explainer/seam-graph';

export const trajectoryGraph = defineSeamGraph({
  id: 'trajectory',
  title: '星轨盘内部的模块与接缝',
  intro:
    '星轨盘内部接缝图：虚线框是包里的模块，框里的方块是它对外给的类型、函数、组件与样式表，灰色实线框是包外的调用方与 react。星轨盘是通用包，不认识 docfirst，只收盘心加一组卡的中性输入；docfirst 是它的一个使用者，卡文件怎么写、怎么校验在 workflow 的卡格式里。',
  frameLabel: '模块',
  modules: [
    {
      id: 'workflow',
      name: '命令行与项目',
      pkg: '@godcreator/docfirst-workflow',
      role: null,
      outside: true,
      blurb:
        'workflow 的卡格式读卡目录、解析、校验，把画得出来的卡换成中性输入，校验时刻用星轨盘的 validBornAt；命令行的 docfirst trajectory 拿这份输入调 buildModel，打印主干。',
      caps: [
        { id: 'cards', name: '卡格式', ident: 'scanCards · scanCardDir' },
        { id: 'cli', name: '命令行', ident: 'docfirst trajectory' },
      ],
    },
    {
      id: 'fumadocs',
      name: 'fumadocs 适配',
      pkg: '@godcreator/docfirst-workflow/fumadocs',
      role: null,
      outside: true,
      blurb:
        './fumadocs/trajectory 按包名再导出 StarDisk，./fumadocs/trajectory.css 引入 star.css。站读卡目录走 loadTrajectory（即卡格式的 scanCardDir），把结果原样交给 StarDisk；站画星轨盘只经过这个出口。',
      caps: [
        { id: 'css', name: '盘的样式', ident: './fumadocs/trajectory.css' },
        { id: 'reexport', name: '再导出组件', ident: 'StarDisk' },
      ],
    },
    {
      id: 'model',
      name: '建模',
      pkg: 'src/model/ · 出口 .',
      role: 'violet',
      outside: false,
      blurb:
        '出口 . 只有这一块：中性输入的类型与建模。收盘心与一组卡，求关系边、树、主干、孤星、领域顺序、时间范围，里程碑裁到盘的时间范围内。输入不合格直接抛错；关系指向卡集合之外的目标放进 broken。只 import 自己目录里的文件，产物一条 import 都没有。',
      caps: [
        { id: 'input', name: '中性输入', ident: 'DiskInput · DiskCard' },
        { id: 'build', name: '建模', ident: 'buildModel · validBornAt' },
      ],
    },
    {
      id: 'disk',
      name: '星轨盘组件',
      pkg: 'disk.tsx · styles/star.css',
      role: 'blue',
      outside: false,
      blurb:
        '出口 ./disk 与 ./star.css。StarDisk 是客户端组件，头一行是 "use client"，单独构建：产物只 import react。它直接收中性输入，自己建模，只管状态、工具条、侧栏、设置面板与浮层，画布交给 StarStage。star.css 是它的样式表。',
      caps: [
        { id: 'star-css', name: '样式表', ident: './star.css' },
        { id: 'star-disk', name: '星轨盘组件', ident: 'StarDisk' },
      ],
    },
    {
      id: 'canvas',
      name: '画布',
      pkg: 'canvas/',
      role: 'rose',
      outside: false,
      blurb:
        'StarStage 在画布里建 SVG，编排 layers/ 下的各个视觉层、相机、日期竖轨与标签避让；不认识 React。settings.ts 是设置滑杆的项目表与换算；theme.ts、node-dom.ts、hud.ts 给色板、节点与图例。节点形状按卡的 kind 出，不认识的画缺省形状。',
      caps: [
        { id: 'stage', name: '画布编排', ident: 'StarStage' },
        { id: 'settings', name: '设置项', ident: 'SETTING_ITEMS' },
      ],
    },
    {
      id: 'layout',
      name: '布局',
      pkg: 'layout.ts · chains.ts',
      role: 'emerald',
      outside: false,
      blurb:
        '纯计算、不碰 DOM。RingsLayout 按模型算每张卡的半径与角度，半径表示时间、长空档折叠，step 推进焦点日与鱼眼强度的补间；gapDots 算空档折叠处画的一片小点。chains.ts 把同一棵树同一槽里的同日卡分组，算相邻日组的角度错开。',
      caps: [
        { id: 'rings', name: '半径与角度', ident: 'RingsLayout · gapDots' },
        { id: 'chains', name: '同日分组与错开', ident: 'buildChains · computeDodge' },
      ],
    },
    {
      id: 'react',
      name: 'react',
      pkg: '可选 peer 依赖',
      role: null,
      outside: true,
      blurb: '只有 ./disk 用它。peer 依赖、标成可选，只用 . 的调用方（比如 docfirst 的命令行）不必装；用的是站自己装的那份。',
      caps: [{ id: 'react', name: 'react', ident: 'useState · useRef' }],
    },
  ],
  entries: [],
  seams: [
    {
      n: 1,
      name: '中性输入',
      a: ['cards'],
      b: ['input', 'build'],
      iface: 'DiskInput { center: { id, label, bornAt, kind, milestones } | null, cards: { id, bornAt, label, domain, kind, relations }[] }；validBornAt(v)',
      convention: false,
      via: 'code',
      text: '卡格式把校验过的卡换成中性输入：根卡恰好一张时它是盘心，born-at 合格的其余卡都在 cards 里，有病但画得出来的照样送来。时刻合不合格，卡格式与建模用的是同一个 validBornAt。frontmatter、关系行、文件名这些 docfirst 的写法都停在卡格式那一侧。',
    },
    {
      n: 2,
      name: '建模（命令行）',
      a: ['cli'],
      b: ['build'],
      iface: 'buildModel(input: DiskInput) → TrajectoryModel',
      convention: false,
      via: 'code',
      text: 'docfirst trajectory 读卡目录拿到中性输入，调 buildModel 建出那张盘，打印盘心、卡数、每棵树的主干；--json 出输入与树。',
    },
    {
      n: 3,
      name: '客户端边界',
      a: ['reexport'],
      b: ['star-disk'],
      iface: 'export { StarDisk } from "@godcreator/trajectory-disk/disk"；props：data（中性输入）、hrefBase、bodies',
      convention: false,
      via: 'code',
      text: 'fumadocs 适配按包名从 ./disk 再导出 StarDisk：那份产物头一行是 "use client"，按包名引用它才原样留在调用方的产物里，Next 认得出客户端边界。props 不收函数：卡页地址由 hrefBase 拼出；bodies 是站在服务端渲染好的每张卡的正文，点节点在侧栏里显示。',
    },
    {
      n: 4,
      name: '样式表',
      a: ['css'],
      b: ['star-css'],
      iface: '@import "@godcreator/trajectory-disk/star.css"',
      convention: false,
      via: 'code',
      text: 'StarDisk 不自己引入样式；fumadocs 适配的 ./fumadocs/trajectory.css 引入 ./star.css，站引入前者。选择器都带 .star- 前缀或写在 .star-disk 容器下，不影响站的其他页面。底色、文字、边框取 fumadocs 的颜色变量，画在盘上的领域色与连线色由 JS 色板按亮暗选。',
    },
    {
      n: 5,
      name: '建模（组件）',
      a: ['star-disk'],
      b: ['build'],
      iface: 'useMemo(() => buildModel(data), [data])',
      convention: false,
      via: 'code',
      text: 'StarDisk 在浏览器里建模：服务端和客户端之间传的就是中性输入，不另有传输形状。输入变了才重建。',
    },
    {
      n: 6,
      name: '画布编排',
      a: ['star-disk'],
      b: ['stage', 'settings'],
      iface: 'new StarStage(host: StageHost, settings) · setData(model) · setTheme · setFilter · applySetting；SETTING_ITEMS · settingsOf',
      convention: false,
      via: 'code',
      text: 'StarDisk 的画布是一个空 div，交给 StarStage 在里面建 SVG；种类与里程碑都在模型里，不另传。点卡、悬停这些动作经 StageHost 的回调告诉组件，StarStage 不认识 React。设置滑杆按 SETTING_ITEMS 渲染，存在 localStorage 里的值用 settingsOf 读回。',
    },
    {
      n: 7,
      name: '布局',
      a: ['stage', 'settings'],
      b: ['rings', 'chains'],
      iface: 'new RingsLayout(model) · configure(LayoutPatch) · step · gapDots · buildChains · computeDodge',
      convention: false,
      via: 'code',
      text: 'StarStage 用 new RingsLayout(model) 取每张卡的半径与角度；设置经 applyStoredSettings 换算成 LayoutPatch 交给 configure，改完自动重算。每帧用 step 推进补间，空档层用 gapDots 画折叠处的小点，用 buildChains、computeDodge 错开同日的卡。',
    },
    {
      n: 8,
      name: 'react',
      a: ['star-disk'],
      b: ['react'],
      iface: 'useState · useEffect · useRef · useMemo · useCallback；peer react >=19，optional',
      convention: false,
      via: 'code',
      text: '包里只有 disk.tsx import react。./disk 单独构建时 react 排除在打包之外，产物里只留 import react 的那一行，运行时用站自己装的那份；边界测试按产物检查。',
    },
  ],
});
