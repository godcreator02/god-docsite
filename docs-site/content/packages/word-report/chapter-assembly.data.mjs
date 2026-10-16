/**
 * ChapterAssembly（「word-report：报告」那一页）的全部数据，画面（chapter-assembly.tsx）只读这一份。
 * 例子由 packages/word-report/test/assemble.test.ts 里四条测试拼成，结果按 assemble.ts 的规则算出，
 * 并用构建产物的 assembleDocument 实际组装核对过（整份 complete 一次、单独组装 b 的 standalone 一次）。
 */

/** 三个文件的内容：… 表示省略的必填字段（format、schemaVersion、metadata、图的 caption 与 alt） */
/* ref file="../packages/word-report/test/assemble.test.ts" lines="4-8" hash="40a0afbb5279" blob="2f259762f178" */
/* ref file="../packages/word-report/test/assemble.test.ts" lines="26-29" hash="3c23a57fad5d" blob="2f259762f178" */
export const rootLines = [
  '{ "id": "root", "metadata": { "title": "root", … },',
  '  "blocks": [',
  '    { "type": "include", "src": "a/content.json" },',
  '    { "type": "include", "src": "b/content.json" } ] }',
];

/* ref file="../packages/word-report/test/assemble.test.ts" lines="40-43" hash="ba5173ca97c0" blob="2f259762f178" */
export const aLines = [
  '{ "id": "a", "blocks": [',
  '  { "type": "section", "id": "sa", "numbering": "decimal", "children": [',
  '    { "type": "equation", "id": "target", "latex": "x", "numbered": true },',
  '    { "type": "figure", "id": "fa", "src": "assets/image.png", … } ] } ] }',
];

/* ref file="../packages/word-report/test/assemble.test.ts" lines="53-56" hash="bb1e5c0b56da" blob="2f259762f178" */
export const bLines = [
  '{ "id": "b", "blocks": [',
  '  { "type": "section", "id": "sb", "numbering": "decimal", "children": [',
  '    { "type": "equation", "id": "eq_b", "latex": "y=2", "numbered": true },',
  '    { "type": "paragraph", "id": "p", "content": [',
  '      { "type": "ref", "id": "ref", "target": "target", "display": "label",',
  '        "externalLabel": "建模章中的公式" } ] },',
  '    { "type": "figure", "id": "fb", "src": "assets/image.png", … } ] } ] }',
];

/** 第 5 步（单独组装 b）的结果：编号从 1 起、引用换成文字并记一条提示；不写 externalLabel 时的报错原话 */
/* ref file="../packages/word-report/test/assemble.test.ts" lines="30-33" hash="d988d4b48d67" blob="2f259762f178" */
/* ref file="../packages/word-report/test/assemble.test.ts" lines="44-49" hash="9a7d23499ff4" blob="2f259762f178" */
export const aloneResult = {
  groups: [
    {
      rows: [
        { key: 'sb', value: '第 1 节', chapter: 'b' },
        { key: 'eq_b', value: '式（1-1）', chapter: 'b', strong: true },
        { key: 'fb', value: '图 1-1', chapter: 'b' },
        { key: 'assets', value: '只有 assets/b/image.png ← b/assets/image.png' },
        { key: '段落 p', value: '换成文字「建模章中的公式」' },
      ],
    },
  ],
  warning: 'External reference: 建模章中的公式（位置 b/content.json /blocks/0/children/1/content/0）',
  errorWithoutExternalLabel: 'b/content.json:/blocks/0/children/1/content/0: ref: Unknown reference target: target',
};

/** 五步：每步的标题与讲解文字、三张文件卡片的高亮与调淡、标题栏的胶囊、「组装结果」卡片里的小表 */
export const steps = [
  {
    title: '展开 include',
    text: '从入口 content.json 读起，碰到 include 就读那个文件，路径相对引入它的文件；读到的章把自己的顶层块整串接进来。同一个文件引入两次、绕回自己、文件不在都直接报错。整份的标题与封面字段只取入口的，各章的不进来。',
    highlights: { root: [3, 4], a: null, b: null },
    dim: [],
    extra: {},
    groups: [
      {
        rows: [
          { key: 'blocks', value: 'sa（出自 a）→ sb（出自 b）' },
          { key: 'dependencies', value: 'content.json、a/content.json、b/content.json' },
          { key: 'metadata.title', value: 'root' },
        ],
      },
    ],
  },
  {
    title: '登记 id，图片按章改名',
    text: '每个带 id 的东西登记一次，记下它出自哪个文件的哪个位置，重名就报错。图片路径改成 assets/<章的文档 id>/<文件名>，两章各有一张 assets/image.png 也不会撞。',
    highlights: { root: null, a: [4, 4], b: [7, 7] },
    dim: [],
    extra: { a: '图片 → assets/a/', b: '图片 → assets/b/' },
    groups: [
      {
        title: 'sources（每个 id 出自哪）',
        rows: [
          { key: 'target', value: 'a/content.json · /blocks/0/children/0' },
          { key: 'eq_b', value: 'b/content.json · /blocks/0/children/0' },
          { key: 'ref', value: 'b/content.json · /blocks/0/children/1/content/0' },
        ],
      },
      {
        title: 'assets（新路径 ← 原路径）',
        rows: [
          { key: 'assets/a/image.png', value: '← a/assets/image.png' },
          { key: 'assets/b/image.png', value: '← b/assets/image.png' },
        ],
      },
    ],
  },
  {
    title: '编号',
    text: '顶层的节依次编 1、2；图、编号表格、编号公式按所在的顶层章各自从 1 编，写成「章号-n」。a 章的公式是式（1-1）、图是图 1-1，b 章的是式（2-1）、图 2-1。',
    highlights: { root: null, a: [2, 4], b: [2, 7] },
    dim: [],
    extra: {},
    groups: [
      {
        rows: [
          { key: 'sa', value: '第 1 节', chapter: 'a' },
          { key: 'sb', value: '第 2 节', chapter: 'b' },
          { key: 'target', value: '式（1-1）', chapter: 'a' },
          { key: 'eq_b', value: '式（2-1）', chapter: 'b', strong: true },
          { key: 'fa', value: '图 1-1', chapter: 'a' },
          { key: 'fb', value: '图 2-1', chapter: 'b' },
        ],
      },
    ],
  },
  {
    title: '解引用',
    text: 'b 章那句话引用的是 a 章公式的 id。整份组装时目标在，显示成它的编号「式（1-1）」。externalLabel 只在目标不在时才用，输出里删掉。',
    highlights: { root: null, a: [3, 3], b: [5, 6] },
    dim: [],
    extra: {},
    groups: [
      {
        rows: [
          { key: '段落 p', value: '显示「式（1-1）」，链接到 #target' },
          { key: 'ref', value: '输出里不再带 externalLabel' },
          { key: '提示', value: '没有' },
        ],
      },
    ],
  },
  {
    title: '单独组装 b',
    text: '检查会把每一章单独组装一次。只有 b 时，b 的节是第 1 节、公式变成式（1-1）、图变成图 1-1：编号变了，id 没变。引用的目标不在，写了 externalLabel 就换成「建模章中的公式」并记一条提示；没写就报错。',
    highlights: { root: null, a: null, b: [5, 6] },
    dim: ['root', 'a'],
    extra: { root: '单独组装 b，不读', a: '单独组装 b，不读' },
    ...aloneResult,
  },
];
