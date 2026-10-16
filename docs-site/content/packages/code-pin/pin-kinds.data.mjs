/**
 * PinKinds（「一处钉：目标加记录」一节）的数据：三种目标各记什么、确认前后标记那一行怎么变。
 * 贯穿例子照 judge-cases 同一份 src/greet.ts；标记那一行的写法照 marker.ts 的 formalOf 拼，
 * 哈希与 blob 名是 12 位十六进制示意值（形状照 marker.ts 的 HEX12），不是真实算出的值；
 * 目录树的名字表是为讲解拼的一份（真实的按 .gitignore 过滤、排序，目录带尾斜杠）。
 * 记录的字段名照 core/types.ts：行段与整文件的记录是 hash 与 blob（ContentRecord），目录树只有 hash（TreeRecord）。
 */

export const pinnedFile = 'src/greet.ts';

/** src/greet.ts 的第 3–5 行：行段钉钉住的就是这三行 */
export const spanLines = ['export function greet(name: string): string {', '  return `你好，${name}`', '}'];

/** src/greet.ts 整份：整文件钉钉住全部九行 */
export const fileLines = [
  "import { people } from './people'",
  '',
  'export function greet(name: string): string {',
  '  return `你好，${name}`',
  '}',
  '',
  'export function farewell(name: string): string {',
  '  return `再见，${name}`',
  '}',
];

/** 目录树钉的名字表：拼的一份，depth 1 只列直接子项，目录带尾斜杠、按名字排序 */
export const treeNames = ['code-pin/', 'comments/', 'doc-export/', 'docfirst/', 'explainer/', 'identity/'];

export const kinds = [
  {
    id: 'lines',
    label: '行段',
    text: '行段记两个字段：hash 是那几行归一化后的段哈希，blob 是确认时整个文件的 blob 名。确认前后只多了这两个属性，行号没动。',
    paneTitle: 'src/greet.ts 第 3–5 行',
    code: spanLines,
    start: 3,
    highlight: [3, 5],
    before: '{/* ref file="../src/greet.ts" lines="3-5" */}',
    after: '{/* ref file="../src/greet.ts" lines="3-5" hash="b9a8c7d6e5f4" blob="0f1e2d3c4b5a" */}',
  },
  {
    id: 'file',
    label: '整文件',
    text: '整文件同样记 hash 与 blob，hash 换成整份归一化后的段哈希；文件末尾追加一行也算变。',
    paneTitle: 'src/greet.ts 整份',
    code: fileLines,
    start: 1,
    highlight: [1, 9],
    before: '{/* ref file="../src/greet.ts" */}',
    after: '{/* ref file="../src/greet.ts" hash="8a7b6c5d4e3f" blob="2b3c4d5e6f7a" */}',
  },
  {
    id: 'tree',
    label: '目录树',
    text: '目录树只记一个字段 hash：名字表的哈希。depth 1 只列直接子项，不看内容。',
    paneTitle: '../packages 下有哪些名字（depth 1）',
    code: treeNames,
    start: 1,
    highlight: null,
    before: '{/* tree dir="../packages" depth="1" */}',
    after: '{/* tree dir="../packages" depth="1" hash="5e4d3c2b1a09" */}',
  },
];
