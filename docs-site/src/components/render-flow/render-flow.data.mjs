/**
 * 「生成物怎么从 mdx 正本渲染出来」的全部讲解数据：画面（render-flow.tsx）与机读版规则（render-flow.ai.mjs）都只读这一份。
 * 示例正本、生成物、命令行输出都是在一个临时项目里用 docfirst-workflow 0.3.1 的命令行实际运行得到的：
 * 配置只有下面这一条 outputs，正本先写草稿记号再 confirm，记号上的 hash / blob 是 confirm 写回的。
 */

export const files = {
  source: 'content/docs/outputs/skills/greet.mdx',
  code: '../src/greet.ts',
  output: '../skills/greet/SKILL.md',
  config: 'docfirst.config.mjs',
  cwd: '~/repo/docs-site',
};

/** docfirst.config.mjs 里 outputs 的那一条 */
export const configLines = [
  'outputs: {',
  `  '${files.source}': [`,
  `    { to: '${files.output}', frontmatter: ['name', 'description'] },`,
  '  ],',
  '}',
];

/** 被钉的源码 ../src/greet.ts 全文，正本钉的是第 2–4 行 */
export const codeLines = ['// 打招呼', 'export function greet(name: string) {', '  return `hello, ${name}`;', '}'];
export const codeSpan = /** @type {[number, number]} */ ([2, 4]);

/** 正本全文（confirm 之后） */
export const sourceLines = [
  '---',
  'title: greet',
  'name: greet',
  'description: 要给人打招呼时读',
  '---',
  '',
  '# 打招呼',
  '',
  '传一个名字，拿回一句问候：',
  '',
  '{/* ref file="../src/greet.ts" lines="2-4" hash="5d0f95c9bd80" blob="c134a7ab15a9" */}',
  '',
  '返回的问候不带句号。',
];

/** 正本里几块的行号（1 起、闭区间） */
export const sourceParts = {
  frontmatter: /** @type {[number, number]} */ ([1, 5]),
  /** 紧跟 frontmatter 的空行：renderAi 去掉 frontmatter 后面的一个换行，剩下的这个开头空行在写入落点之前去掉 */
  blankAfterFrontmatter: 6,
  keptFields: [3, 4],
  droppedFields: [2],
  marker: 11,
};

/** 写到 ../skills/greet/SKILL.md 的生成物全文 */
export const outputLines = [
  '---',
  'name: greet',
  'description: 要给人打招呼时读',
  '---',
  '',
  '# 打招呼',
  '',
  '传一个名字，拿回一句问候：',
  '',
  '```ts title="../src/greet.ts:2-4"',
  'export function greet(name: string) {',
  '  return `hello, ${name}`;',
  '}',
  '```',
  '',
  '返回的问候不带句号。',
];

/** check 那一段里，有人直接在生成物里把最后一行改成这样 */
export const handEditedLast = '返回的问候不带句号，也不带空格。';

/** 渲染不了的那一段：在正本末尾加上这几行（第 14–21 行） */
export const refusalLines = [
  '',
  '@@docfirst ref ../src/greet.ts:1-1 @@',
  '',
  '{/* ref file="../src/bye.ts" lines="1-3" hash="5d0f95c9bd80" blob="c134a7ab15a9" */}',
  '',
  '<Callout>只传一个名字</Callout>',
  '',
  '一共 {1 + 1} 种写法。',
];
/** 上面几行里渲染不了的那几行的行号 */
export const refusalBadLines = [15, 17, 19, 21];
export const refusalMessage =
  `🔴 ${files.source} → ${files.output}  正本渲染不了：第 15 行是草稿记号，先 docfirst confirm；` +
  '第 17 行的引用缺失（file-missing），先修好；第 19 行有组件 <Callout>，生成正本只写 markdown；' +
  '第 21 行有 mdx 表达式 {1 + 1}，生成正本只写 markdown——改好再 render';

/**
 * 终端里每一行出现的时刻：at 是本段进度（0–1）里开始出现的那一刻，命令按字符逐个出现，输出一次出现。
 * @typedef {{ text: string, kind: 'cmd' | 'out' | 'ok' | 'err', at: number }} TimedLine
 * @type {Record<'render' | 'check' | 'refuse', TimedLine[]>}
 */
export const terminals = {
  render: [
    { kind: 'cmd', text: 'pnpm docfirst render', at: 0.04 },
    { kind: 'ok', text: `→  ${files.source}  摆放到 ${files.output}`, at: 0.22 },
    { kind: 'cmd', text: 'pnpm docfirst render', at: 0.52 },
    { kind: 'out', text: `·  ${files.source} → ${files.output}  没变`, at: 0.7 },
  ],
  check: [
    { kind: 'cmd', text: 'pnpm docfirst check', at: 0.02 },
    { kind: 'ok', text: `🟢 ${files.source}  ${files.code}:2-4  新鲜`, at: 0.14 },
    { kind: 'ok', text: `🟢 ${files.source} → ${files.output}  生成物跟 mdx 源一致`, at: 0.2 },
    { kind: 'cmd', text: 'pnpm docfirst check', at: 0.66 },
    { kind: 'ok', text: `🟢 ${files.source}  ${files.code}:2-4  新鲜`, at: 0.8 },
    {
      kind: 'err',
      text: `🔴 ${files.source} → ${files.output}  生成物跟 mdx 源不一致（源改了没重摆，或有人直接改了生成物）——重跑 render`,
      at: 0.86,
    },
  ],
  refuse: [
    { kind: 'cmd', text: 'pnpm docfirst render', at: 0.4 },
    { kind: 'err', text: refusalMessage, at: 0.58 },
  ],
};

/**
 * 七段，每段只变一件事。id 给画面选这一段怎么画，机读版不用它。
 * @typedef {'source' | 'strip' | 'block' | 'fields' | 'write' | 'check' | 'refuse'} SceneId
 * @typedef {{ id: SceneId, title: string, text: string, duration: number }} RenderChapter
 * @type {RenderChapter[]}
 */
export const chapters = [
  {
    id: 'source',
    title: '正本：一篇普通的 mdx',
    text:
      `正本 ${files.source} 有三部分：第 1–5 行的 frontmatter、正文、第 11 行一处确认过的正式记号，指向 ${files.code} 的第 2–4 行。` +
      `${files.config} 的 outputs 把这篇对到 ${files.output}，并点名 name、description 两个字段要带进生成物。`,
    duration: 6,
  },
  {
    id: 'strip',
    title: '去掉 frontmatter，其余逐字节照抄',
    text:
      'renderAi 先把 CRLF 换成 LF，再把整段 frontmatter 连同它后面的一个换行切掉；写入落点之前再去掉开头剩下的空行。' +
      '除了 frontmatter 和记号，正文一个字节都不改：标题、空行、句子原样留下。第 11 行的记号这时还没动。',
    duration: 7,
  },
  {
    id: 'block',
    title: '记号换成代码块',
    text:
      `正式记号换成一个代码块：内容是渲染时按记号从 ${files.code} 读出的第 2–4 行，hash 和 blob 不进生成物。` +
      `info 串是按后缀认出的语言 ts，加上 title="路径:起-止"，路径照记号里写的，行号是这段代码今天所在的位置。` +
      '围栏比内容里最长的一串反引号多一个、至少三个。exists、has 这类没有内容的记号整行去掉。',
    duration: 8,
  },
  {
    id: 'fields',
    title: '点名的字段加回头部',
    text:
      '这个落点点名了 name 和 description：这两个字段按正本里的顺序逐行照搬（不解析 YAML，多行的值连同缩进的续行一起搬），' +
      '外面补上两行 ---，空一行再接正文。title 没点名，不带。outputs 里只写一个路径字符串的落点（比如仓根 README.md）什么都不带；' +
      '点名的字段正本里没有，这个落点不写，报「frontmatter 里没有 …」。',
    duration: 7,
  },
  {
    id: 'write',
    title: '写到落点：内容变了才写',
    text:
      `落点 ${files.output} 相对项目根（放 docfirst.config.mjs 的站目录），不能落进配置里的内容根（默认 content/），一个落点只许一篇正本写。` +
      '写之前先读落点上现有的文件，换行统一后跟这次的结果比：不同才写，输出一行「摆放到」；相同就不写，输出「没变」。' +
      'confirm 写回记号之后也会渲染一遍，只输出写了的那几行。',
    duration: 7,
  },
  {
    id: 'check',
    title: 'check：再渲染一次，跟磁盘上的比',
    text:
      'check 不写文件：它用 render 同一套步骤在内存里再渲染一次，跟落点上那份比，一致才是绿。' +
      '有人直接改了生成物，或者正本、被钉的代码改了还没重新渲染，都对不上，一律按红、退出码 1；落点上还没有文件也是红。',
    duration: 9,
  },
  {
    id: 'refuse',
    title: '渲染不了：一次列全，一个文件都不写',
    text:
      '正本里出现这四样就渲染不了：草稿记号（还没 confirm）、指向的东西不在了的引用、JSX 组件、mdx 表达式（import / export 也算）。' +
      'renderAi 走完整棵语法树，把每一处连同行号一次列全再拒绝；这一篇的落点都不写，磁盘上的旧生成物原样留着，render 和 check 都报红。' +
      '代码块里写的同样文字不算：记号是在语法树上认的。',
    duration: 9,
  },
];
