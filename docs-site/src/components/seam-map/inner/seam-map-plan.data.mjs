/**
 * 在途方案「接缝图进讲解播放器」做完之后的接缝图：spec 页 <SeamMap module="seam-map-plan" /> 画的就是它。
 * 只画接缝图这一件事：站留下的几份文件、讲解播放器里新加的两个文件、它们用到的零件、颜色名、样式表与 react；
 * 讲解播放器原有的三种外壳与控制条这次不动，不画，现状看模块页那张图。
 * 坐标在 seam-map-plan.layout.ts。方案做完、模块页那张图改成现状之后，这两个文件跟 spec 页一起删掉。
 */
import { defineSeamGraph } from '../graph.mjs';

export const seamMapPlanGraph = defineSeamGraph({
  id: 'seam-map-plan',
  title: '接缝图进讲解播放器（方案做完之后）',
  intro:
    '方案做完之后接缝图的接缝：虚线框是讲解播放器包里的文件，灰色实线框是包外的站与 react。站只留每张图的内容与坐标，加上按 module 属性挑图的一层薄壳与它的机读规则；定义图、画图、悬停与点击、机读文字、样式都在讲解播放器里。定义图与机读文字在不 import 任何东西的 ./seam-graph 出口，站在 Node 里生成机读版时加载它；画图在客户端出口 .。讲解播放器原有的三种外壳与控制条这次不动，不画。',
  frameLabel: '文件',
  modules: [
    {
      id: 'site',
      name: '站的接缝图文件',
      pkg: 'docs-site/src/components/seam-map/',
      role: null,
      outside: true,
      blurb:
        '站只留这几样：每张图的内容 *.data.mjs 与坐标 *.layout.ts；seam-map.tsx 按 module 属性从一张表里挑出图与坐标交给 SeamDiagram；seam-map.ai.mjs 是组件名册里 SeamMap 的机读规则，挑出同一张图交给 seamGraphText。图标照旧由站选，用站自己装的 lucide-react。',
      caps: [
        { id: 'layout-data', name: '坐标与图标', ident: '*.layout.ts' },
        { id: 'wrap', name: '按 module 挑图', ident: 'seam-map.tsx' },
        { id: 'graph-data', name: '图的内容', ident: '*.data.mjs' },
        { id: 'ai', name: '机读规则', ident: 'seam-map.ai.mjs' },
      ],
    },
    {
      id: 'diagram',
      name: '画接缝图',
      pkg: 'seam-diagram.tsx · 出口 .',
      role: 'blue',
      outside: false,
      blurb:
        '从 docs-site 的 diagram.tsx 原样搬来：虚线框是模块，方块是能力，带编号的线是接缝，实线是代码调用、虚线是读写磁盘；鼠标停在编号或模块框上浮出说明，点击固定高亮它连着谁；图例与提示文字也在这里。从主入口导出 SeamDiagram、布局类型 SeamLayout 与按固定高度建方块的 cap。',
      caps: [
        { id: 'layout-type', name: '布局', ident: 'SeamLayout · cap(x, y, w)' },
        { id: 'draw', name: '画图', ident: 'SeamDiagram' },
      ],
    },
    {
      id: 'graph',
      name: '定义图与机读文字',
      pkg: 'seam-graph.ts · 出口 ./seam-graph',
      role: 'cyan',
      outside: false,
      blurb:
        '从 docs-site 的 graph.mjs 搬来并改成 TypeScript：defineSeamGraph 检查 id 重复、接缝两端与入口指向不存在的能力，交回带索引的图；seamGraphText 把一张图写成一段段文字（图例与入口、每个模块、每条接缝），就是 seam-map.ai.mjs 现在拼的那几段。只 import 颜色名的类型，产物零 import、不带 "use client"，单独构建。',
      caps: [
        { id: 'define', name: '定义图', ident: 'defineSeamGraph' },
        { id: 'text', name: '机读文字', ident: 'seamGraphText' },
      ],
    },
    {
      id: 'parts',
      name: '零件',
      pkg: 'parts.tsx',
      role: 'emerald',
      outside: false,
      blurb: '讲解播放器原有的零件，不动。接缝说明浮层里两端的能力画成胶囊，按模块的角色色上色。',
      caps: [{ id: 'pill', name: '胶囊', ident: 'Pill' }],
    },
    {
      id: 'colors',
      name: '颜色名',
      pkg: 'colors.ts',
      role: 'amber',
      outside: false,
      blurb: '讲解播放器原有的颜色名，不动。模块的 role 就是角色色 Role，图的定义与零件用同一组名字。',
      caps: [{ id: 'role', name: '角色色', ident: 'Role' }],
    },
    {
      id: 'styles',
      name: '样式表',
      pkg: 'styles/explain.css',
      role: 'amber',
      outside: false,
      blurb:
        '站的 seam-map.css 并进来，接在外壳与零件的样式后面。颜色全取 .dx 上的变量，深浅两套照旧由这份样式表切换；站在全局样式里引入一次样式表，讲解组件与接缝图都有了，不再另引。',
      caps: [
        { id: 'seam-css', name: '接缝图样式', ident: '.seam-map .sm-*' },
        { id: 'vars', name: '颜色变量', ident: '.dx · [data-role]' },
      ],
    },
    {
      id: 'react',
      name: 'react',
      pkg: 'peer',
      role: null,
      outside: true,
      blurb: '必需的 peer，照旧用站装的那一份。画图只用 useState 记住浮层指着谁、点击固定了谁。',
      caps: [{ id: 'react', name: 'react', ident: 'useState' }],
    },
  ],
  entries: [],
  seams: [
    {
      n: 1,
      name: '坐标',
      a: ['layout-data'],
      b: ['layout-type'],
      iface: 'import { cap } from "@godcreator/explainer-player"；SeamLayout：view · caps · groups · seamPaths · entries · moduleIcons · entryIcons',
      convention: false,
      via: 'code',
      text: '站的每张图各写一份坐标：画布大小、每个能力方块的位置（用 cap 按固定高度建）、模块框、接缝走线与编号圆点、入口箭头、模块与入口的图标。键都是图里的 id，缺一个画到它时报错。图标是任意一个收 SVG 属性的组件，包不 import 图标库。',
    },
    {
      n: 2,
      name: '画图',
      a: ['wrap'],
      b: ['draw'],
      iface: '<SeamDiagram graph={seamGraph} layout={seamLayout} />',
      convention: false,
      via: 'code',
      text: '站的 SeamMap 按 module 属性从自己的表里挑出一张图与它的坐标，交给 SeamDiagram 画。不带 module 画全局图，带了但表里没有就报错。一个站有几张图、叫什么，都是站的事。',
    },
    {
      n: 3,
      name: '定义图',
      a: ['graph-data'],
      b: ['define'],
      iface: 'import { defineSeamGraph } from "@godcreator/explainer-player/seam-graph"；defineSeamGraph({ id, title, intro, frameLabel, modules, entries, seams }) → SeamGraph',
      convention: false,
      via: 'code',
      text: '每张图的内容写成一个 defineSeamGraph 调用：模块（名字、包名、角色色、在不在框外、一句话说明、能力）、入口、接缝（编号、名字、两端的能力、接口、是不是约定、代码调用还是读写磁盘、说明）。id 重复、两端或入口指向不存在的能力，加载时当场报错。数据文件从 ./seam-graph 取它，所以画面与机读规则都能加载同一份。',
    },
    {
      n: 4,
      name: '读图',
      a: ['draw'],
      b: ['define'],
      iface: 'import type { SeamGraph } from "./seam-graph.ts"',
      convention: false,
      via: 'code',
      text: '画图只 import 图的类型，用 defineSeamGraph 交回的索引（能力归哪个模块、一个模块连着哪些接缝）画高亮与浮层，不自己再算一遍。客户端产物里没有 ./seam-graph 的代码。',
    },
    {
      n: 5,
      name: '机读文字',
      a: ['ai'],
      b: ['text'],
      iface: 'seamGraphText(graph) → string[]；SeamMap(node, { paragraph, attr }) → seamGraphText(graph).map(paragraph)',
      convention: false,
      via: 'code',
      text: '站的机读规则挑出同一张图交给 seamGraphText，拿回一段段文字：图的说明与入口、每个模块一段、每条接缝一段（编号名称、说明、两端、接口、线型），每段再包成段落。docfirst.config.mjs 在 Node 里加载这条规则，./seam-graph 零 import，所以能直接运行。',
    },
    {
      n: 6,
      name: '胶囊与角色色',
      a: ['draw'],
      b: ['pill', 'role'],
      iface: '<Pill role={module.role ?? "slate"}>…</Pill>；Role = "blue" | "violet" | … | "slate"',
      convention: false,
      via: 'code',
      text: '接缝说明浮层里，两端的能力画成胶囊，颜色是它所在模块的角色色；约定与代码接口用语气色的胶囊区分。模块的 role 就是讲解播放器的 Role，定义图时写错名字，类型检查就不过。',
    },
    {
      n: 7,
      name: '样式',
      a: ['draw'],
      b: ['seam-css', 'vars'],
      iface: 'className="dx seam-map not-prose" · sm-frame · sm-cap · sm-seam · sm-tip；data-role → --dx-c',
      convention: false,
      via: 'code',
      text: '图的根元素带 dx 与 seam-map 两个类，颜色变量在 dx 上；模块框、能力方块、接缝、编号、浮层各有 sm- 开头的类名，模块按 data-role 取角色色 --dx-c，高亮的接缝用 rose。样式都在 explain.css 里，站不再另写。',
    },
    {
      n: 8,
      name: '状态',
      a: ['draw'],
      b: ['react'],
      iface: 'useState：shown（浮层指着谁）· pinned（点击固定了谁）',
      convention: false,
      via: 'code',
      text: '浮层与高亮是两份互不影响的状态：鼠标停着就显示浮层，挪开就收起；点击固定高亮，再点一次取消。',
    },
  ],
});
