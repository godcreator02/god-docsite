/**
 * RenderPipeline（「doc-export：生成物」那一页）的全部数据，画面（render-pipeline.tsx）只读这一份。
 * 例子是包测试 node-outputs.test.ts 里那个项目：正本 docs/a.mdx、被钉的 src/greet.ts、三个落点。
 * 正本 13 行 = 测试 SOURCE 的 10 行加三行写法的 <Note>（块级组件，在名册里走引用块）；
 * 写出的正文用 renderMachineMarkdown 配 fumadocs 名册实际跑过一遍核对。
 */

/** 被钉的 src/greet.ts 与正本 docs/a.mdx：第 9 行是确认后带上记录的样子（hash、blob 的值画面写省略号） */
/* ref file="../packages/doc-export/test/node-outputs.test.ts" lines="15-16" hash="d6749ba482ba" blob="df55a8c1af91" */
export const greetLines = [
  '// greet',
  'export function greet(name: string): string {',
  '  return `hello ${name}`;',
  '}',
];
export const sourceLines = [
  '---',
  'name: block-note',
  'description: 块笔记怎么用',
  'secret: 不该随行',
  '---',
  '',
  '# 摆放',
  '',
  '{/* ref file="src/greet.ts" lines="2-3" hash="…" blob="…" */}',
  '',
  '<Note>',
  '提示',
  '</Note>',
];

/** 第 1 步：正本解析出的节点——头部成一个 yaml 节点，钉码标记与组件各是一个节点 */
export const parsedNodes = [
  'yaml · 第 1–5 行',
  'heading · 第 7 行',
  '钉码标记 · 第 9 行',
  'mdxJsxFlowElement <Note> · 第 11–13 行',
];

/** 第 2 步：核对结论 */
export const pinPill = '新鲜 · 今天第 2–3 行';

/** 第 3 步查的五种渲染不了的东西，这一篇里都没有 */
/* ref file="../packages/doc-export/src/core/render.ts" lines="23-23" hash="6c136f4ecf9e" blob="eb8bab74efe6" */
export const refusalChecks = [
  { name: '没确认的钉', result: '没有' },
  { name: '缺失的钉', result: '没有' },
  { name: '名册外组件', result: '没有（Note 在名册里）' },
  { name: 'mdx 表达式', result: '没有' },
  { name: 'import / export', result: '没有' },
];

/** 第 3 步的两句反例：正本里真有这些时，报错原句长这样 */
/* ref file="../packages/doc-export/src/core/render.ts" lines="41-41" hash="06d35289d69c" blob="eb8bab74efe6" */
/* ref file="../packages/doc-export/test/outputs.test.ts" lines="53-53" hash="dcf494e354b7" blob="cbb7c3b5b48e" */
export const refusalExamples = [
  '第 9 行的钉还没确认，先确认再生成',
  '第 11 行有名册外组件 <Note>，先在名册里给它写机读规则',
];

/** 第 4 步：写出的正文（PLAIN.md 的全文，SKILL.md 是它前面加头部），按着色分三段 */
/* ref file="../packages/doc-export/test/node-outputs.test.ts" lines="41-41" hash="09e680f0e7fd" blob="df55a8c1af91" */
/* ref file="../packages/doc-export/src/core/fumadocs-roster.ts" lines="9-9" hash="0421e3e92078" blob="eb1eb078637b" */
export const bodySegments = [
  { tone: null, lines: ['# 摆放', ''] },
  { tone: 'info', lines: ['```ts title="src/greet.ts:2-3"', 'export function greet(name: string): string {', '  return `hello ${name}`;', '```'] },
  { tone: 'good', lines: ['', '> \\[note] 提示'] },
];

/** 第 5 步：三个落点。SKILL.md 的头部（name 在前、description 在后）照跑出来的结果 */
/* ref file="../packages/doc-export/test/node-outputs.test.ts" lines="66-66" hash="3c84193ec2a9" blob="df55a8c1af91" */
export const placementViews = {
  skill: {
    title: 'skills/x/SKILL.md',
    headLines: ['---', 'name: block-note', 'description: 块笔记怎么用', '---', '# 摆放'],
    highlight: [2, 3],
  },
  plain: { title: 'PLAIN.md', firstLine: '# 摆放' },
  bad: { title: 'BAD.md', pill: 'no-frontmatter · 缺 nope · 不写' },
  more: '下面同第 4 步的正文',
};

/** 第 6 步：第一次写出三个落点的状态（SKILL.md 开头的断言也在同一段测试里） */
/* ref file="../packages/doc-export/test/node-outputs.test.ts" lines="68-75" hash="3219924333a2" blob="df55a8c1af91" */
export const firstWriteRows = [
  { when: '第一次写出', to: 'skills/x/SKILL.md', status: 'placed', tone: 'good' },
  { when: '第一次写出', to: 'PLAIN.md', status: 'placed', tone: 'good' },
  { when: '第一次写出', to: 'BAD.md', status: 'no-frontmatter', tone: 'bad' },
];

/** 第 6 步：再写出与核对——内容没变是 unchanged；核对 fresh；手改生成物后 stale；删掉后 missing */
/* ref file="../packages/doc-export/test/node-outputs.test.ts" lines="49-59" hash="4a836fe95e1b" blob="df55a8c1af91" */
export const recheckRows = [
  { when: '再写出一次', to: 'skills/x/SKILL.md', status: 'unchanged', tone: 'good' },
  { when: '再写出一次', to: 'PLAIN.md', status: 'unchanged', tone: 'good' },
  { when: '核对', to: 'skills/x/SKILL.md', status: 'fresh', tone: 'good' },
  { when: '手改 SKILL.md 后核对', to: 'skills/x/SKILL.md', status: 'stale', tone: 'warn' },
  { when: '删掉 SKILL.md 后核对', to: 'skills/x/SKILL.md', status: 'missing', tone: 'bad' },
];

/** 六步：每步的标题、讲解文字、正本里要标出的行段（marks）、右块画什么（artifact 的 kind） */
export const steps = [
  {
    title: '读正本',
    text: 'remark 按 gfm、frontmatter、数学公式、mdx 解析，换行先统一成 LF，正文里裸写的网址换回原文那一段（这一篇没有）。头部成了一个 yaml 节点，第 9 行的钉码标记和第 11–13 行的组件各是一个节点。',
    marks: [
      { lines: [1, 5], tone: 'pending', note: 'yaml 节点' },
      { lines: [9, 9], tone: 'info', note: '钉码标记' },
      { lines: [11, 13], tone: 'good', note: '组件节点' },
    ],
    artifact: { kind: 'nodes' },
  },
  {
    title: '钉换成代码',
    text: '钉码标记换成 codePin 节点，交给调用方传进来的核对函数（docfirst 传的是读工作区、从 git 取旧内容的那个）。这处钉新鲜，greet 今天还在第 2–3 行。',
    marks: [{ lines: [9, 9], tone: 'info', note: '换成 codePin 节点' }],
    artifact: { kind: 'pin' },
  },
  {
    title: '先查能不能生成',
    text: '没确认或缺失的钉、名册外组件、mdx 表达式、import / export，有一处就整篇不生成，问题一次列全。这一篇都没有：钉已确认，Note 在 fumadocs 名册里。',
    marks: [],
    artifact: { kind: 'refusals' },
  },
  {
    title: '写出正文',
    text: 'frontmatter 不写；钉写成一块代码，标题是路径加今天的行号，内容是今天那两行；Note 按名册写成引用块。别的文字照原样写出，开头的空行去掉。',
    marks: [
      { lines: [1, 5], tone: 'pending', note: '不写' },
      { lines: [9, 9], tone: 'info', note: '写成代码块' },
      { lines: [11, 13], tone: 'good', note: '写成引用块' },
    ],
    artifact: { kind: 'markdown' },
  },
  {
    title: '每个落点加头部',
    text: '正文只算这一次。SKILL.md 点名了 name、description，按点名的顺序把那两行原样抄到头部，secret 不带；PLAIN.md 就是正文；BAD.md 点名的 nope 正本里没有，这个落点不写。',
    marks: [
      { lines: [2, 3], tone: 'pending', note: '点名了' },
      { lines: [4, 4], tone: 'bad', note: '没点名，不带' },
    ],
    artifact: { kind: 'placements' },
  },
  {
    title: '写出与核对',
    text: '内容有变的落点才写，第二次写出全是 unchanged。核对只读：和正本一致是 fresh；有人手改了生成物是 stale；文件不在了是 missing。',
    marks: [],
    artifact: { kind: 'disk' },
  },
];
