/**
 * 「一页的 md 怎么来、怎么取」的全部讲解数据：画面（md-output.tsx）与机读版规则（md-output.ai.mjs）都只读这一份。
 * 例子跟钉码页是同一个仓：content/docs/a.mdx 钉 src/greet.ts 第 2–3 行，外加一个 Note 组件。
 * 构建时那几步照 fumadocs-mdx 的 remarkPostprocess、docfirst-workflow 的 remark 插件、名册打标与序列化回调；
 * 请求时那几种照站的 src/proxy.ts、llms 路由与 fumadocs-core 的 isMarkdownPreferred。
 * md 的样子（标题行后两个空行、来源注释、引用块）照本站实际取回的 md。
 *
 * @typedef {{ id: string, title: string, text: string, source: [number, number] | null, tree: 'parsed' | 'pinned' | 'stamped',
 *   treeHighlight: [number, number] | null, md: 'none' | 'body' | 'export' | 'file', mdHighlight: [number, number] | null }} BuildStep
 * @typedef {'suffix' | 'accept' | 'none' | 'skip'} ProxyRule
 *   suffix：命中「/docs/…​.md」改写；accept：按 Accept 改写；none：两条都不命中、原样放行；skip：不是 /docs 开头，proxy 不管
 * @typedef {{ id: string, label: string, text: string, command: string, rule: ProxyRule, ruleNote: string, route: string,
 *   status: number, type: string, result: 'md' | 'html' | 'index' | 'full' | 'missing', body: string[] }} ServeCase
 */

export const files = { page: 'content/docs/a.mdx', code: 'src/greet.ts', url: '/docs/a' };

export const sourceLines = [
  '---',
  'title: greet',
  'description: 打招呼的函数',
  '---',
  '',
  'greet 返回一句问候：',
  '',
  '{/* ref file="src/greet.ts" lines="2-3" hash="3eb99c2e88e2" blob="c134a7ab15a9" */}',
  '',
  '<Note>',
  '  名字为空时照样拼出来。',
  '</Note>',
];

/** 语法树在各步的样子：只列这篇用到的节点 */
export const trees = {
  parsed: [
    'root',
    '├ yaml  title: greet · description: 打招呼的函数',
    '├ paragraph  "greet 返回一句问候："',
    '├ mdxFlowExpression  /* ref file="src/greet.ts" lines="2-3" … */',
    '└ mdxJsxFlowElement  Note',
    '   └ paragraph  "名字为空时照样拼出来。"',
  ],
  pinned: [
    'root',
    '├ yaml  title: greet · description: 打招呼的函数',
    '├ paragraph  "greet 返回一句问候："',
    '├ code  lang="ts"',
    '│   meta  title="src/greet.ts:2-3" lineNumbers=2 data-dot="green"',
    '│   data.docfirst  来源 src/greet.ts:2-3 · 新鲜 · 今天的这两行',
    '└ mdxJsxFlowElement  Note',
    '   └ paragraph  "名字为空时照样拼出来。"',
  ],
  stamped: [
    'root',
    '├ yaml  title: greet · description: 打招呼的函数',
    '├ paragraph  "greet 返回一句问候："',
    '├ code  lang="ts"',
    '│   meta  title="src/greet.ts:2-3" lineNumbers=2 data-dot="green"',
    '│   data.docfirst  来源 src/greet.ts:2-3 · 新鲜 · 今天的这两行',
    '└ mdxJsxFlowElement  Note',
    '    data.docfirstAi  引用块 "[note] 名字为空时照样拼出来。"',
    '   └ paragraph  "名字为空时照样拼出来。"',
  ],
};

/** 序列化出的正文（不带标题行） */
export const mdBody = [
  'greet 返回一句问候：',
  '',
  '<!-- 来源 src/greet.ts:2-3 · 新鲜 -->',
  '',
  '```ts',
  'export function greet(name: string) {',
  '  return `hello, ${name}`;',
  '```',
  '',
  '> \\[note] 名字为空时照样拼出来。',
];

/** 路由加上标题行之后的整份 md：标题行后面是两个空行 */
export const mdFile = [`# greet (${files.url})`, '', '', ...mdBody];

export const mdPaths = {
  export: 'export const _markdown = "…"（这一页的编译产物）',
  file: '.next/server/app/llms.mdx/docs/a/content.md.body',
};

/* ref file="../packages/docfirst-workflow/src/fumadocs/remark-plugin.ts" lines="26-32" hash="ac17d35141a4" blob="0723b1e3439d" */
/* ref file="../packages/docfirst-workflow/src/fumadocs/blocks.ts" lines="64-77" hash="ad638e9c6e35" blob="705792ee655d" */
/* ref file="../packages/docfirst-workflow/src/mdx/roster.ts" lines="115-128" hash="f7aab65c4ab2" blob="a8241fff7170" */
/* ref file="../packages/docfirst-workflow/src/fumadocs/roster.ts" lines="13-14" hash="e7f78550c886" blob="e605fbea15a7" */
/* ref file="../packages/docfirst-workflow/src/fumadocs/markdown.ts" lines="24-45" hash="a74a112c335a" blob="0f8adb086fd4" */
/* ref file="src/lib/source.ts" lines="35-37" hash="b41af54c6c86" blob="5ee282b98601" */
/* ref file="src/lib/source.ts" lines="92-96" hash="8836756f3ab1" blob="5ee282b98601" */
/* ref file="src/app/llms.mdx/docs/[[...slug]]/route.ts" hash="e33991a4355f" blob="4cb4ae7b88fc" */
/** @type {BuildStep[]} */
export const buildSteps = [
  {
    id: 'parse',
    title: '解析成语法树',
    text: 'next build 编译这一页时，fumadocs 的 mdx 加载器把正本解析成 mdast 语法树：frontmatter 是 yaml 节点，引用记号是 mdxFlowExpression，Note 组件是 mdxJsxFlowElement。页面和 md 都从这一棵树出来。',
    source: [1, 12],
    tree: 'parsed',
    treeHighlight: [1, 6],
    md: 'none',
    mdHighlight: null,
  },
  {
    id: 'pin',
    title: '引用换成代码块',
    text: 'remark 链末尾的 docfirst 插件认出记号，交钉码编排核对（这处是新鲜），把记号节点换成一个 code 节点。同一个节点带两份：meta 给页面画标题栏、行号与状态点；data.docfirst 给 md，记着来源、状态和不带 diff 标记的代码。',
    source: [8, 8],
    tree: 'pinned',
    treeHighlight: [4, 6],
    md: 'none',
    mdHighlight: null,
  },
  {
    id: 'stamp',
    title: '按名册打标',
    text: '插件接着查组件名册：Note 组件的规则把它压成一个引用块「[note] …」，这组替换节点挂在 data.docfirstAi 上。名册里找不到的组件当场报错，这一页编译失败，站构建不过。',
    source: [10, 12],
    tree: 'stamped',
    treeHighlight: [7, 9],
    md: 'none',
    mdHighlight: null,
  },
  {
    id: 'serialize',
    title: '序列化成 md',
    text: '现状区的集合开了 includeProcessedMarkdown，fumadocs 用 remarkLLMs 把同一棵树序列化成 md，每个节点先问 docfirst 的回调：带 docfirstAi 的换成替换节点，带 data.docfirst 的代码块写成一行来源注释加一块干净代码，别的照默认。frontmatter 不进 md。',
    source: null,
    tree: 'stamped',
    treeHighlight: [3, 9],
    md: 'body',
    mdHighlight: [1, 10],
  },
  {
    id: 'export',
    title: '编进页面产物',
    text: '这段 md 作为 _markdown 导出，编进这一页的编译产物；同一棵树接着编成页面，代码块画出标题栏和绿点，Note 画成站的 Note 组件。md 和页面出自同一次编译，不会一个新一个旧。',
    source: null,
    tree: 'stamped',
    treeHighlight: null,
    md: 'export',
    mdHighlight: null,
  },
  {
    id: 'prerender',
    title: '预渲染成静态文件',
    text: 'next build 再运行 md 路由：generateStaticParams 列出现状区每一页，路由用 getText("processed") 取出 _markdown，前面加一行「# 标题 (网址)」，写成 content.md.body。路由写了 revalidate = false，请求来了直接读这个文件，不再编译。',
    source: null,
    tree: 'stamped',
    treeHighlight: null,
    md: 'file',
    mdHighlight: [1, 1],
  },
];

/* ref file="src/proxy.ts" hash="73ac5d9cd1d7" blob="dff0e8b5a267" */
/* ref file="src/lib/shared.ts" lines="4-6" hash="a4428f6f221a" blob="a28f8519960d" */
/** @type {ServeCase[]} */
export const serveCases = [
  {
    id: 'browser',
    label: '浏览器打开页面',
    text: '路径不以 .md 结尾；浏览器的 Accept 里没有 md 类型，只有 text/html 与 */*，proxy 原样放行，页面路由出 HTML。',
    command: 'curl -H "Accept: text/html,application/xhtml+xml,*/*;q=0.8" http://127.0.0.1:4310/docs/a',
    rule: 'none',
    ruleNote: '后缀规则不命中；Accept 里 md 类型的权重是 0，不改写',
    route: '/docs/[[...slug]]（页面路由）',
    status: 200,
    type: 'text/html',
    result: 'html',
    body: ['<!DOCTYPE html><html lang="zh-CN"><head>…', '<title>greet</title>…'],
  },
  {
    id: 'accept',
    label: 'agent 带 Accept: text/markdown',
    text: '同一个网址，请求头要 md：text/markdown、text/x-markdown、text/plain 算 md，text/html、text/*、*/* 算 HTML，md 的权重不低于 HTML 就改写到这一页的 content.md，返回构建时预渲染好的 md。',
    command: 'curl -H "Accept: text/markdown" http://127.0.0.1:4310/docs/a',
    rule: 'accept',
    ruleNote: 'isMarkdownPreferred 为真：/docs/a → /llms.mdx/docs/a/content.md',
    route: '/llms.mdx/docs/[[...slug]]（md 路由，预渲染的静态文件）',
    status: 200,
    type: 'text/markdown; charset=utf-8',
    result: 'md',
    body: mdFile,
  },
  {
    id: 'suffix',
    label: '网址后加 .md',
    text: '不用改请求头，网址后面加 .md 就行。proxy 先查这条后缀规则，命中就改写，不看 Accept。',
    command: 'curl http://127.0.0.1:4310/docs/a.md',
    rule: 'suffix',
    ruleNote: '后缀规则命中：/docs/a.md → /llms.mdx/docs/a/content.md',
    route: '/llms.mdx/docs/[[...slug]]（md 路由，预渲染的静态文件）',
    status: 200,
    type: 'text/markdown; charset=utf-8',
    result: 'md',
    body: mdFile,
  },
  {
    id: 'direct',
    label: '页面上的 Copy Markdown',
    text: '页面标题下的 Copy Markdown 与 Open 两个按钮，直接请求这一页的 md 路由。路径不以 /docs 开头，proxy 不改写。',
    command: 'curl http://127.0.0.1:4310/llms.mdx/docs/a/content.md',
    rule: 'skip',
    ruleNote: '不是 /docs 开头，两条规则都不命中',
    route: '/llms.mdx/docs/[[...slug]]（md 路由，预渲染的静态文件）',
    status: 200,
    type: 'text/markdown; charset=utf-8',
    result: 'md',
    body: mdFile,
  },
  {
    id: 'index',
    label: '/llms.txt',
    text: '整个现状区的目录：按侧栏分组，每页一行，写标题、网址和 description。agent 先读它，再按网址取要看的那几页。',
    command: 'curl http://127.0.0.1:4310/llms.txt',
    rule: 'skip',
    ruleNote: '不是 /docs 开头，proxy 不管',
    route: '/llms.txt（docsLlms.index()）',
    status: 200,
    type: 'text/plain; charset=UTF-8',
    result: 'index',
    body: ['# Docs', '', '- [docfirst](/docs): 把文档里的话钉在真实源码上……', '- 钉码', '  - [钉码核心 code-pin](/docs/pin): 通用包，把文字钉在代码上……', '- [greet](/docs/a): 打招呼的函数'],
  },
  {
    id: 'full',
    label: '/llms-full.txt',
    text: '现状区每一页的 md 依次拼在一起，每页照样以「# 标题 (网址)」开头。一次取全站，本站约 27 万字。',
    command: 'curl http://127.0.0.1:4310/llms-full.txt',
    rule: 'skip',
    ruleNote: '不是 /docs 开头，proxy 不管',
    route: '/llms-full.txt（docsLlms.full()）',
    status: 200,
    type: 'text/plain; charset=UTF-8',
    result: 'full',
    body: ['# 讲解组件包 docfirst-explainer (/docs/docfirst-explainer)', '', '', '包 `@godcreator/docfirst-explainer`，源码在……', '……', `# greet (${files.url})`, '……'],
  },
  {
    id: 'other-zone',
    label: '维护区、未来区、轨迹区的页',
    text: '只有现状区 content/docs 的集合开了 includeProcessedMarkdown，proxy 也只改写 /docs 开头的路径。维护区是给改这个仓的人看的，有意不进机读版；这三区加 .md 是 404，带 Accept 头照样是 HTML。',
    command: 'curl http://127.0.0.1:4310/maintain/agents.md',
    rule: 'skip',
    ruleNote: '不是 /docs 开头，proxy 不管',
    route: '没有这条路由',
    status: 404,
    type: 'text/html',
    result: 'missing',
    body: ['404: This page could not be found.'],
  },
];

/**
 * 各种组件在 md 里变成什么：正本里怎么写、名册里给的规则、序列化出的 md。
 * md 照「机读版示例」那一页（content/docs/fumadocs/markdown-sample.mdx）构建出的真实 md；自包含讲解组件那段照钉码页的 md。
 * @typedef {{ id: string, label: string, text: string, source: string[], ruleTitle: string, rule: string[],
 *   md: string[] | null, error: string | null }} ComponentCase
 */
/* ref file="../packages/docfirst-workflow/src/mdx/roster.ts" lines="9-13" hash="5f32c20ae455" blob="a8241fff7170" */
/* ref file="../packages/docfirst-workflow/src/mdx/roster.ts" lines="91-107" hash="09207f8b31fa" blob="a8241fff7170" */
/* ref file="../packages/docfirst-workflow/src/fumadocs/roster.ts" lines="12-19" hash="ad2aa594110a" blob="e605fbea15a7" */
/* ref file="src/components/tabs/tabs.ai.mjs" lines="7-13" hash="4ac462d9c8e3" blob="b5179bb18970" */
/* ref file="src/components/seam-map/seam-map.ai.mjs" lines="24-30" hash="2bcdfbfe5455" blob="bee761f6c2f8" */
/* ref file="../packages/docfirst-workflow/src/fumadocs/blocks.ts" lines="136-151" hash="0646b249c32b" blob="705792ee655d" */
/* ref file="../packages/docfirst-workflow/src/cli/commands.ts" lines="166-166" hash="1c53b74fcb01" blob="937001d7a349" */
/** @type {ComponentCase[]} */
export const componentCases = [
  {
    id: 'explainer',
    label: '自包含的讲解组件',
    text: '正本里只有一个标签。机读规则跟画面读同一份数据，把图写成一段段文字：图的说明、每个模块一段、每条接缝一段。标签里一个字没写的内容，md 里是全的。',
    source: ['<SeamMap module="pin" />'],
    ruleTitle: 'src/components/seam-map/seam-map.ai.mjs',
    rule: [
      'export function SeamMap(node, { paragraph, attr }) {',
      "  const moduleId = attr(node, 'module');",
      '  …（按 module 挑出同一张图）',
      '  return seamGraphText(graph).map((text) => paragraph(text));',
      '}',
    ],
    md: [
      '钉码核心内部接缝图：虚线框是包里的文件，框里的方块是它对外给的函数……',
      '',
      '框外「调用方」（@godcreator/docfirst-workflow）：workflow 装配项目时……',
      '',
      '文件「核对与确认」（pinner.ts）：createPinner 收下读取器与旧内容来源两样……',
      '',
      '……每条接缝一段',
    ],
    error: null,
  },
  {
    id: 'children',
    label: '只留子内容',
    text: '术语标注是构建时的插件自动包上的：正文里命中术语表的词包成一个 Term，站上悬停出定义。规则写 "children"，md 里去掉外壳，只剩原词，句子不断。',
    source: ['下面讲到「钉码编排」的地方', '（构建时自动包成：下面讲到「<Term def="…">钉码编排</Term>」的地方）'],
    ruleTitle: 'docfirst.config.mjs 的 components',
    rule: ['Term: "children",'],
    md: ['下面讲到「钉码编排」的地方'],
    error: null,
  },
  {
    id: 'nested',
    label: '排版组件与嵌套',
    text: '排版组件包的是作者写的正文。嵌套的组件各走各的规则：外壳 Tabs 只留子内容，每个 Tab 用 title 出一个三级标题，后面接它自己的子内容。',
    source: ['<Tabs>', '  <Tab title="命令行">', '    运行 `docfirst check`。', '  </Tab>', '  <Tab title="站构建">', '    next build 时同样核对。', '  </Tab>', '</Tabs>'],
    ruleTitle: 'src/components/tabs/tabs.ai.mjs',
    rule: ['export const Tabs = "children";', '', 'export function Tab(node, { attr, heading, children }) {', '  return [heading(3, attr(node, "title") ?? "标签"), ...children()];', '}'],
    md: ['### 命令行', '', '运行 `docfirst check`。', '', '### 站构建', '', 'next build 时同样核对。'],
    error: null,
  },
  {
    id: 'inline',
    label: '块级与行内',
    text: '组件单独占一段时是块级节点（写在一行里也算），夹在句子中间时是行内节点。规则看 h.inline：块级交回一个引用块，行内交回一段文字，不把句子拆断。序列化时 md 里的方括号前面会加一个反斜杠。',
    source: ['<Note>名字为空时照样拼出来。</Note>', '', '改完先 <Note>保存</Note> 再运行。'],
    ruleTitle: '@godcreator/docfirst-workflow/fumadocs/roster',
    rule: [
      'Note: (node, h) =>',
      '  h.inline',
      '    ? h.text(`[note] ${h.textOf(node).trim()}`)',
      '    : h.quote(`[note] ${h.textOf(node).trim()}`),',
    ],
    md: ['> \\[note] 名字为空时照样拼出来。', '', '改完先 \\[note] 保存 再运行。'],
    error: null,
  },
  {
    id: 'drop',
    label: '整个不要',
    text: '规则写 "drop"，这个组件在 md 里整个去掉：打的是 fumadocs 自家的标 _stringify: { text: "" }，原位置只留下几个空行。适合只有装饰作用、没有内容的组件；本站现在没有用到，下面的 Divider 是示例。',
    source: ['第一段。', '', '<Divider />', '', '第二段。'],
    ruleTitle: 'docfirst.config.mjs 的 components',
    rule: ['Divider: "drop",'],
    md: ['第一段。', '', '', '', '第二段。'],
    error: null,
  },
  {
    id: 'tree-ref',
    label: '引用注入的文件树',
    text: '目录树引用在站上换成 fumadocs 的 Files 组件，md 那份的标在换节点时就写好了：一行来源注释加一块名字表。打标时看到已经有标，不去名册里找它，也不往里走。',
    source: ['{/* tree dir="src" hash="8f9bf9539c42" */}'],
    ruleTitle: '不查名册（换节点时已经写好）',
    rule: ['data.docfirstAi = [{ type: "code", lang: "text", value: 名字表 }]'],
    md: ['<!-- 来源 src/ · 新鲜 -->', '', '```text', 'greet.test.ts', 'greet.ts', 'index.ts', '```'],
    error: null,
  },
  {
    id: 'unknown',
    label: '名册外组件',
    text: '名册里没有规则的组件，打标时当场报错，这一页编译失败、站构建不过；docfirst check 也报成红，不用等构建。fumadocs 默认组件表里的 Callout、Card 这些也不在自带的规则里，要用先在 docfirst.config.mjs 给一条规则。',
    source: ['<Callout>先备份。</Callout>'],
    ruleTitle: 'docfirst.config.mjs 的 components',
    rule: ['（没有 Callout）'],
    md: null,
    error: '🔴 content/docs/a.mdx  第 7 行 <Callout>  名册外组件，docfirst.config.mjs 里没给它压平规则',
  },
];

const STEP_KEYS = ['id', 'title', 'text', 'tree', 'md'];
const CASE_KEYS = ['id', 'label', 'text', 'command', 'rule', 'ruleNote', 'route', 'status', 'type', 'result', 'body'];
for (const step of buildSteps) {
  for (const key of STEP_KEYS) if (step[key] === undefined || step[key] === '') throw new Error(`md-output 数据缺项：${step.id ?? '？'}.${key}`);
  if (!(step.tree in trees)) throw new Error(`md-output：${step.id} 的语法树「${step.tree}」认不出`);
}
for (const item of serveCases) {
  for (const key of CASE_KEYS) if (item[key] === undefined || item[key] === '') throw new Error(`md-output 数据缺项：${item.id ?? '？'}.${key}`);
}
