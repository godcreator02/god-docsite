/**
 * JudgeCases（「code-pin：钉码」那一页）的全部数据，画面（judge-cases.tsx）只读这一份。
 * 一处钉贯穿六种情况：文档钉在 src/greet.ts 第 3–5 行（greet 函数），确认时记下了这三行的段哈希与整文件的 blob 名；
 * 之后文件被改成各种样子，核对按四步走，在哪一步下结论、结论是什么、确认时怎么处理。
 * 文件内容是为讲解编的例子；四步的顺序与每种结论照 compare.ts 与 pinner.ts 写。
 */

/** 行段判定的四步，前一步能下结论就不往下走 */
/* ref file="../packages/code-pin/src/core/compare.ts" lines="5-11" hash="5871ca1c593a" blob="f456193d7860" */
export const stepNames = ['段哈希对得上', 'blob 名对得上', '取旧内容映到今天', '整个文件里滑窗找'];

export const pinnedFile = 'src/greet.ts';

/** 确认时的整文件：钉的是第 3–5 行 */
export const confirmedLines = [
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
export const confirmedSpan = [3, 5];

const insertedAbove = [
  "import { people } from './people'",
  "import { log } from './log'",
  '',
  "const DEFAULT_NAME = '朋友'",
  '',
  'export function greet(name: string): string {',
  '  return `你好，${name}`',
  '}',
  '',
  'export function farewell(name: string): string {',
  '  return `再见，${name}`',
  '}',
];

const editedInside = [
  "import { people } from './people'",
  '',
  'export function greet(name: string): string {',
  '  return `你好，${name}！欢迎回来`',
  '}',
  '',
  'export function farewell(name: string): string {',
  '  return `再见，${name}`',
  '}',
];

const deletedSpan = [
  "import { people } from './people'",
  '',
  'export function farewell(name: string): string {',
  '  return `再见，${name}`',
  '}',
];

/**
 * 每种情况：今天的文件（lines）、核对交回的位置（span，缺失时是 null）、四步各走成什么样（trail），
 * 结论（status / reason）、确认时的动作（action）与写不写回（written）。
 * trail 的 state：yes 在这一步下结论，no 这一步下不了结论、往下走，skip 没走到这一步。
 * history：确认时那份整文件能不能从 git 对象库取回来。
 */
export const cases = [
  {
    id: 'same',
    label: '原地没动',
    text: '第 3–5 行还是确认时那三行，段哈希等于记录，第一步就是新鲜，行号不动。确认时什么都不写。',
    lines: confirmedLines,
    span: [3, 5],
    history: true,
    trail: [
      { state: 'yes', note: '第 3–5 行的段哈希等于记录' },
      { state: 'skip', note: '' },
      { state: 'skip', note: '' },
      { state: 'skip', note: '' },
    ],
    status: 'fresh',
    reason: null,
    action: 'unchanged',
    written: '不写',
  },
  {
    id: 'moved',
    label: '上面加了几行',
    text: '文件开头加了三行，greet 挪到了第 6–8 行。第 3–5 行现在是别的内容，整文件的 blob 名也变了；从 git 取回确认时的整文件，按新旧两份的差异把旧的第 3–5 行映到今天的第 6–8 行，那里的段哈希对得上，还是新鲜。确认时把记号改写成新行号。',
    lines: insertedAbove,
    span: [6, 8],
    history: true,
    trail: [
      { state: 'no', note: '第 3–5 行现在是别的内容' },
      { state: 'no', note: '整文件改过，blob 名不同' },
      { state: 'yes', note: '旧的 3–5 行映到今天的 6–8 行，段哈希对得上' },
      { state: 'skip', note: '' },
    ],
    status: 'fresh',
    reason: null,
    action: 'moved',
    written: '记号改写成 lines="6-8"，记上新的 blob 名',
  },
  {
    id: 'changed',
    label: '段里改了一行',
    text: 'greet 的返回值改了。映到今天还是第 3–5 行，但段哈希对不上：有变动（黄灯），核对结果带着旧段与逐行对比。确认时不带 --accept 不写，等人复核正文还成不成立；带上 --accept 才按今天的内容重新记。',
    lines: editedInside,
    span: [3, 5],
    history: true,
    trail: [
      { state: 'no', note: '段哈希对不上' },
      { state: 'no', note: 'blob 名不同' },
      { state: 'yes', note: '映到今天的 3–5 行，段哈希仍对不上：有变动，带旧段与对比' },
      { state: 'skip', note: '' },
    ],
    status: 'changed',
    reason: 'changed',
    action: 'needs-accept',
    written: '不写；人复核后带 --accept 才写（动作是 accepted）',
  },
  {
    id: 'vanished',
    label: '整段删光',
    text: 'greet 整个删掉了。旧的第 3–5 行映到今天没有对应的行：缺失（红灯），理由是整段已被删光。确认拒绝这一处，要改写正文或删掉这处引用。',
    lines: deletedSpan,
    span: null,
    history: true,
    trail: [
      { state: 'no', note: '第 3–5 行现在是 farewell' },
      { state: 'no', note: 'blob 名不同' },
      { state: 'yes', note: '旧的 3–5 行在今天没有对应的行' },
      { state: 'skip', note: '' },
    ],
    status: 'missing',
    reason: 'vanished',
    action: 'refused',
    written: '不写；改写正文或删掉这处引用',
  },
  {
    id: 'window-found',
    label: '取不到旧内容·找到了',
    text: '和「上面加了几行」一样的改动，但确认时的整文件取不回来（确认之后、提交之前又改过文件，那个 blob 就没进对象库）。没有差异可映，就在整个文件里找段哈希等于记录、同样长短的三行，找到第 6–8 行：还是新鲜，确认时同样改写行号。',
    lines: insertedAbove,
    span: [6, 8],
    history: false,
    trail: [
      { state: 'no', note: '第 3–5 行现在是别的内容' },
      { state: 'no', note: 'blob 名不同' },
      { state: 'no', note: '对象库里没有这个 blob，取不到旧内容' },
      { state: 'yes', note: '第 6–8 行的段哈希等于记录' },
    ],
    status: 'fresh',
    reason: null,
    action: 'moved',
    written: '记号改写成 lines="6-8"，记上新的 blob 名',
  },
  {
    id: 'unlocated',
    label: '取不到旧内容·找不到',
    text: '和「段里改了一行」一样的改动，旧内容也取不回来。滑窗找不到段哈希等于记录的三行：有变动，理由是位置不明。站上不摆代码，只留一句说明——旧行号上现在是什么不知道，摆出来只会误导。重读源码后带 --accept 确认。',
    lines: editedInside,
    span: [3, 5],
    history: false,
    trail: [
      { state: 'no', note: '段哈希对不上' },
      { state: 'no', note: 'blob 名不同' },
      { state: 'no', note: '取不到旧内容' },
      { state: 'yes', note: '整个文件里找不到这一段：位置不明' },
    ],
    status: 'changed',
    reason: 'unlocated',
    action: 'needs-accept',
    written: '不写；重读源码后带 --accept 才写',
  },
];
