/**
 * PlacementCases（「doc-export：生成物」那一页「一篇正本、几个落点」一节）的全部数据，画面（placement-cases.tsx）只读这一份。
 * 例子是正文那个贯穿例子：正本 docs/a.mdx（frontmatter 写了 name、description、secret）、三个落点。
 * 落点写法照正文例子的 outputs 配置逐项拆开；生成物的开头几行与状态全部照 test/node-outputs.test.ts 的断言，
 * 只摆开头几行，正文全文在 RenderPipeline 第 4 步摆过。
 */

/** skill 情况：SKILL.md 的开头——点名的两个字段按点名顺序抄成头部，测试断言到「# 摆放」；代码块开头在同一段测试的另一条断言 */
/* ref file="../packages/doc-export/test/node-outputs.test.ts" lines="73-73" hash="0004d12ab0e5" blob="df55a8c1af91" */
/* ref file="../packages/doc-export/test/node-outputs.test.ts" lines="41-41" hash="09e680f0e7fd" blob="df55a8c1af91" */
export const skillHead = [
  '---',
  'name: block-note',
  'description: 块笔记怎么用',
  '---',
  '',
  '# 摆放',
  '',
  '```ts title="src/greet.ts:2-3"',
  'export function greet(name: string): string {',
  '…',
];

/** plain 情况：PLAIN.md 的开头，没有 frontmatter */
/* ref file="../packages/doc-export/test/node-outputs.test.ts" lines="74-74" hash="067bbc28093a" blob="df55a8c1af91" */
export const plainHead = ['# 摆放', '', '```ts title="src/greet.ts:2-3"', 'export function greet(name: string): string {', '…'];

/** bad 情况：点名的 nope 正本里没有，这个落点不写；原话是测试断言自己的说明 */
/* ref file="../packages/doc-export/test/node-outputs.test.ts" lines="68-75" hash="3219924333a2" blob="df55a8c1af91" */
export const badRefusal = {
  pill: 'no-frontmatter · 缺 nope',
  why: '写出一份缺 name 的 SKILL.md 比不写更糟',
};

/** 三种情况：左块摆配置里那一项，右块摆写出的开头几行或状态 */
export const cases = [
  {
    id: 'skill',
    label: 'skills/x/SKILL.md',
    text: '对象写法点名 name 与 description：同一段正文的前面，把这两行按点名的顺序原样抄成头部，没点名的 secret 不带。写出了，状态 placed。',
    config: ["{ to: 'skills/x/SKILL.md', frontmatter: ['name', 'description'] },"],
    status: 'placed · 写出',
    tone: 'good',
    artifact: { title: 'skills/x/SKILL.md', lines: skillHead, highlight: [2, 3] },
  },
  {
    id: 'plain',
    label: 'PLAIN.md',
    text: '字符串写法等于 frontmatter: []：没有头部，正文原样写出。也写了，状态同样是 placed。',
    config: ["'PLAIN.md',"],
    status: 'placed · 写出',
    tone: 'good',
    artifact: { title: 'PLAIN.md', lines: plainHead, highlight: null },
  },
  {
    id: 'bad',
    label: 'BAD.md',
    text: '点名的 nope 正本里没有：这个落点报 no-frontmatter、写明缺哪几个，不写——写出一份缺字段的 SKILL.md 比没有更糟。',
    config: ["{ to: 'BAD.md', frontmatter: ['nope'] },"],
    status: null,
    tone: 'bad',
    artifact: null,
  },
];
