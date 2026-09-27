/**
 * 「引用能指向哪几类东西」的全部讲解数据：画面（ref-kinds.tsx）与机读版规则（ref-kinds.ai.mjs）都只读这一份。
 * 例子跟钉码页是同一个仓：content/docs/a.mdx 引用 src/greet.ts，src/ 下有 greet.test.ts、greet.ts、index.ts。
 * 记号写法照 docfirst-workflow 的 marker/index.ts；比什么照 code-pin 的 compare.ts；命令行那一行照 docfirst-workflow 的 cli/run.ts
 * 与 code-pin types.ts 里的 REASON_TEXT；站上长什么样照 docfirst-workflow 的 src/fumadocs/blocks.ts 与 pre.tsx。
 * hash 与 blob 是用 code-pin 的 span.ts 对这版 greet.ts 与这张名字表真算出来的。
 *
 * @typedef {'fresh' | 'changed' | 'missing' | 'unconfirmed'} Status
 * @typedef {{ type: 'code', title: string, start: number | null, lines: string[] }} CodeSite
 *   普通代码块；start 是 lineNumbers，null 表示不带行号
 * @typedef {{ type: 'diff', title: string, lines: Array<[' ' | '-' | '+', string]> }} DiffSite
 *   旧行新行显示在同一块里，不带行号
 * @typedef {{ type: 'tree', root: string, names: string[], gone: boolean }} TreeSite
 * @typedef {CodeSite | DiffSite | TreeSite} Site
 * @typedef {{ id: string, status: Status, blocking?: true, when: string, cli: string, site: Site }} Outcome
 *   blocking：黄灯且被钉的东西在本仓有未提交改动，check 按红算（站上仍按 status 显示）
 * @typedef {{ attr: string, recorded: string, today: string }} CompareRow
 * @typedef {{ title: string, lines: string[], highlight: [number, number] | null }} Observe
 * @typedef {{ id: string, label: string, text: string, formal: string[], written: string[], writtenNote: string,
 *   compare: CompareRow[], rule: string, observe: Observe, outcomes: Outcome[] }} RefKind
 */

export const files = { doc: 'content/docs/a.mdx', ref: 'src/greet.ts', dir: 'src' };

const GREET = ['// 打招呼', 'export function greet(name: string) {', '  return `hello, ${name}`;', '}'];
const NAMES = ['greet.test.ts', 'greet.ts', 'index.ts'];
const NAMES_PLUS = ['farewell.ts', 'greet.test.ts', 'greet.ts', 'index.ts'];

const BLOCKING_TAIL = '——在同一个提交里复核，再 docfirst confirm content/docs/a.mdx --accept';
const NORMALIZE = '算之前先归一化：换行统一成 LF、去掉每行行尾空白、去掉末尾空行；缩进和注释照算。';

/** @type {RefKind[]} */
/* ref file="../packages/docfirst-workflow/src/marker/index.ts" lines="19-49" hash="a65b6baa8846" blob="7b1527430cf9" */
/* ref file="../packages/code-pin/src/span.ts" lines="21-39" hash="8d9f8b1618fa" blob="23033c685517" */
/* ref file="../packages/code-pin/src/compare.ts" lines="65-113" hash="74b12acad0bd" blob="f5272b0530fa" */
/* ref file="../packages/docfirst-workflow/src/node/fs-reader.ts" lines="1-7" hash="d7f39c660a9c" blob="5b1604322176" */
/* ref file="../packages/docfirst-workflow/src/cli/run.ts" lines="38-44" hash="9ebfdcac2bf1" blob="418434ff646c" */
/* ref file="../packages/docfirst-workflow/src/cli/run.ts" lines="275-280" hash="a11866d4fa45" blob="418434ff646c" */
/* ref file="../packages/docfirst-workflow/src/cli/run.ts" lines="296-303" hash="23ad1504ef64" blob="ff2e6b7ae7d3" */
/* ref file="../packages/code-pin/src/types.ts" lines="80-85" hash="70feff6a62c9" blob="32a0167e8d8f" */
/* ref file="../packages/docfirst-workflow/src/fumadocs/blocks.ts" lines="24-37" hash="c3224ec6e495" blob="19f00626cf69" */
/* ref file="../packages/docfirst-workflow/src/fumadocs/blocks.ts" lines="47-61" hash="8a889ba101b1" blob="19f00626cf69" */
/* ref file="../packages/docfirst-workflow/src/fumadocs/blocks.ts" lines="156-185" hash="48c366c0543b" blob="19f00626cf69" */
export const kinds = [
  {
    id: 'span',
    label: '行段',
    text: '钉住文件里的几行。记号上记两样：这几行的 hash，和确认时整个文件的 blob 名。check 先比这几行的 hash；对不上，再按 blob 从 git 取回确认时的文件，把行号对到今天的位置再比一次——上面插了行还是绿，confirm 写回新行号。',
    formal: ['{/* ref file="src/greet.ts" lines="2-3" hash="3eb99c2e88e2" blob="c134a7ab15a9" */}'],
    written: ['{/* ref file="src/greet.ts" lines="2-3" */}'],
    writtenNote: '只写 file 与 lines',
    compare: [
      { attr: 'hash', recorded: '3eb99c2e88e2', today: '今天第 2–3 行 sha256 的前 12 位' },
      { attr: 'blob', recorded: 'c134a7ab15a9', today: '不直接比：hash 对不上时按它从 git 取回确认时的文件，把第 2–3 行对到今天的位置再比 hash' },
    ],
    rule: NORMALIZE,
    observe: { title: 'src/greet.ts（今天）· 高亮的两行拿去算 hash', lines: GREET, highlight: [2, 3] },
    outcomes: [
      {
        id: 'unconfirmed',
        status: 'unconfirmed',
        when: '记号上还没有记录属性，没有记录可比',
        cli: '⚪ content/docs/a.mdx  src/greet.ts:2-3  未确认，等作者确认',
        site: { type: 'code', title: 'src/greet.ts:2-3 · 未确认', start: 2, lines: GREET.slice(1, 3) },
      },
      {
        id: 'same',
        status: 'fresh',
        when: '这两行算出的 hash 等于记号上的；或者上面插了行，对到新位置后 hash 仍相等',
        cli: '🟢 content/docs/a.mdx  src/greet.ts:2-3  新鲜',
        site: { type: 'code', title: 'src/greet.ts:2-3', start: 2, lines: GREET.slice(1, 3) },
      },
      {
        id: 'changed',
        status: 'changed',
        when: '对到今天的位置后 hash 不同：内容真改了（hello 改成 hi）',
        cli: '🟡 content/docs/a.mdx  src/greet.ts:2-3  有变动，等作者复核',
        site: {
          type: 'diff',
          title: 'src/greet.ts:2-3',
          lines: [[' ', 'export function greet(name: string) {'], ['-', '  return `hello, ${name}`;'], ['+', '  return `hi, ${name}`;']],
        },
      },
      {
        id: 'unlocated',
        status: 'changed',
        when: '取不到确认时的文件（确认后没提交又改了），整个文件里也找不到 hash 相同的两行',
        cli: '🟡 content/docs/a.mdx  src/greet.ts:2-3  有变动，等作者复核（取不到确认时的内容，这段也找不到了，位置不明——重读源码后 --accept）',
        site: {
          type: 'code',
          title: 'src/greet.ts:2-3 · 有变动，位置不明',
          start: null,
          lines: ['（取不到确认时的内容，这段也找不到了，位置不明——重读源码后 docfirst confirm <页> --accept）'],
        },
      },
      {
        id: 'blocking',
        status: 'changed',
        blocking: true,
        when: '黄灯，而且 src/greet.ts 在本仓有未提交的改动：是这次改动引起的，check 按红算、退出码 1；站上仍是黄',
        cli: `🔴 content/docs/a.mdx  src/greet.ts:2-3  有变动，是本仓还没提交的改动引起的${BLOCKING_TAIL}`,
        site: {
          type: 'diff',
          title: 'src/greet.ts:2-3',
          lines: [[' ', 'export function greet(name: string) {'], ['-', '  return `hello, ${name}`;'], ['+', '  return `hi, ${name}`;']],
        },
      },
      {
        id: 'vanished',
        status: 'missing',
        when: '这两行整段删掉了，今天的文件里对不到位置',
        cli: '🔴 content/docs/a.mdx  src/greet.ts:2-3  缺失（整段已被删光）',
        site: { type: 'code', title: '文档写下时这段是（src/greet.ts:2-3）', start: null, lines: GREET.slice(1, 3) },
      },
      {
        id: 'file-missing',
        status: 'missing',
        when: 'src/greet.ts 整个文件删了',
        cli: '🔴 content/docs/a.mdx  src/greet.ts:2-3  缺失（文件不在了）',
        site: { type: 'code', title: '文档写下时这段是（src/greet.ts:2-3）', start: null, lines: GREET.slice(1, 3) },
      },
    ],
  },
  {
    id: 'file',
    label: '整文件',
    text: '钉住整个文件。记号跟行段一样记 hash 与 blob，只是 hash 算的是整个文件：任何一处改动都黄，末尾追加一行也算（这时钉第 2–3 行的行段引用还是绿）。文件没有位置可挪，blob 只用来取回确认时的文件，让站上给出旧行与新行。',
    formal: ['{/* ref file="src/greet.ts" hash="32cfd95b425c" blob="c134a7ab15a9" */}'],
    written: ['{/* ref file="src/greet.ts" */}'],
    writtenNote: '只写 file，不带 lines',
    compare: [
      { attr: 'hash', recorded: '32cfd95b425c', today: '今天整个文件 sha256 的前 12 位' },
      { attr: 'blob', recorded: 'c134a7ab15a9', today: '不参与判定：hash 对不上时按它取回确认时的文件，给站上的旧行新行对照' },
    ],
    rule: NORMALIZE,
    observe: { title: 'src/greet.ts（今天）· 整个文件拿去算 hash', lines: GREET, highlight: [1, 4] },
    outcomes: [
      {
        id: 'unconfirmed',
        status: 'unconfirmed',
        when: '记号上还没有记录属性，没有记录可比',
        cli: '⚪ content/docs/a.mdx  src/greet.ts:all  未确认，等作者确认',
        site: { type: 'code', title: 'src/greet.ts · 未确认', start: 1, lines: GREET },
      },
      {
        id: 'same',
        status: 'fresh',
        when: '整个文件算出的 hash 等于记号上的（只差行尾空白、换行符、末尾空行不算变）',
        cli: '🟢 content/docs/a.mdx  src/greet.ts:all  新鲜',
        site: { type: 'code', title: 'src/greet.ts', start: 1, lines: GREET },
      },
      {
        id: 'changed',
        status: 'changed',
        when: '任何一处改动都黄：这里是末尾追加了一行',
        cli: '🟡 content/docs/a.mdx  src/greet.ts:all  有变动，等作者复核',
        site: {
          type: 'diff',
          title: 'src/greet.ts',
          lines: [...GREET.map((line) => /** @type {[' ', string]} */ ([' ', line])), ['+', 'export const defaultName = "世界";']],
        },
      },
      {
        id: 'blocking',
        status: 'changed',
        blocking: true,
        when: '黄灯，而且 src/greet.ts 在本仓有未提交的改动：check 按红算、退出码 1；站上仍是黄',
        cli: `🔴 content/docs/a.mdx  src/greet.ts:all  有变动，是本仓还没提交的改动引起的${BLOCKING_TAIL}`,
        site: {
          type: 'diff',
          title: 'src/greet.ts',
          lines: [...GREET.map((line) => /** @type {[' ', string]} */ ([' ', line])), ['+', 'export const defaultName = "世界";']],
        },
      },
      {
        id: 'file-missing',
        status: 'missing',
        when: 'src/greet.ts 删了',
        cli: '🔴 content/docs/a.mdx  src/greet.ts:all  缺失（文件不在了）',
        site: { type: 'code', title: '文档写下时这段是（src/greet.ts）', start: null, lines: GREET },
      },
    ],
  },
  {
    id: 'tree',
    label: '目录树',
    text: '钉住一个目录下有哪些名字：depth 默认 1 只列直接子项，glob 只留名字匹配的。记号只记名字表的 hash，不存旧名字表：多了、少了、改名都只知道「变了」，站上显示今天的名字表。文件内容不参与。',
    formal: ['{/* tree dir="src" depth="1" hash="8f9bf9539c42" */}'],
    written: ['{/* tree dir="src" */}'],
    writtenNote: '可带 depth="2"、glob="*.test.ts"',
    compare: [{ attr: 'hash', recorded: '8f9bf9539c42', today: '今天的名字表按行拼起来 sha256 的前 12 位' }],
    rule: '名字是相对 src 的路径，目录带尾斜杠、排好序；被 .gitignore 忽略的不进表。',
    observe: { title: 'src/ 的名字表（今天）· 按行拼起来算 hash', lines: NAMES, highlight: [1, 3] },
    outcomes: [
      {
        id: 'unconfirmed',
        status: 'unconfirmed',
        when: '记号上还没有记录属性，没有记录可比',
        cli: '⚪ content/docs/a.mdx  tree src depth=1  未确认，等作者确认（3 项）',
        site: { type: 'tree', root: 'src/', names: NAMES, gone: false },
      },
      {
        id: 'same',
        status: 'fresh',
        when: '名字表没变；文件里的内容怎么改都不影响',
        cli: '🟢 content/docs/a.mdx  tree src depth=1  新鲜（3 项）',
        site: { type: 'tree', root: 'src/', names: NAMES, gone: false },
      },
      {
        id: 'changed',
        status: 'changed',
        when: '名字多了、少了或改了：这里是新建了 src/farewell.ts',
        cli: '🟡 content/docs/a.mdx  tree src depth=1  有变动，等作者复核（4 项）',
        site: { type: 'tree', root: 'src/', names: NAMES_PLUS, gone: false },
      },
      {
        id: 'blocking',
        status: 'changed',
        blocking: true,
        when: '黄灯，而且 src/ 下有未提交的改动：check 按红算、退出码 1；站上仍是黄',
        cli: `🔴 content/docs/a.mdx  tree src depth=1  有变动，是本仓还没提交的改动引起的（4 项）${BLOCKING_TAIL}`,
        site: { type: 'tree', root: 'src/', names: NAMES_PLUS, gone: false },
      },
      {
        id: 'dir-missing',
        status: 'missing',
        when: 'src/ 整个目录不在了',
        cli: '🔴 content/docs/a.mdx  tree src depth=1  缺失（目录不在了）',
        site: { type: 'tree', root: 'src/', names: ['（目录不在了）'], gone: true },
      },
    ],
  },
];

export const statusName = { fresh: '新鲜', changed: '有变动', missing: '缺失', unconfirmed: '未确认' };

/** 站上那一处是哪种东西 */
export const siteKindName = { code: '代码块', diff: '代码块（旧行新行）', tree: '文件树' };

/** 一种结果的名字：拦提交的黄叫「按红算」 */
export function outcomeName(outcome) {
  return outcome.blocking === true ? '有变动 · 按红算' : statusName[outcome.status];
}

/** 站上显示成什么，写成一句话，给机读版用 */
export function siteSummary(site) {
  switch (site.type) {
    case 'code':
      return `代码块，标题「${site.title}」，${site.start !== null ? `行号从 ${site.start} 起` : '不带行号'}：${site.lines.map((line) => line.trim()).join(' / ')}`;
    case 'diff':
      return `代码块，标题「${site.title}」，旧行新行在同一块里、不带行号：${site.lines.map(([side, line]) => `${side === ' ' ? '' : `${side} `}${line.trim()}`).join(' / ')}`;
    case 'tree':
      return site.gone
        ? `文件树，根文件夹「${site.root}」禁用，里面只有一项「${site.names.join('')}」`
        : `文件树，根文件夹「${site.root}」展开：${site.names.join('、')}`;
    default:
      throw new Error(`ref-kinds：认不出的站上显示类型「${site.type}」`);
  }
}

const KIND_KEYS = ['id', 'label', 'text', 'formal', 'written', 'writtenNote', 'compare', 'rule', 'observe', 'outcomes'];
const OUTCOME_KEYS = ['id', 'status', 'when', 'cli', 'site'];

for (const kind of kinds) {
  for (const key of KIND_KEYS) {
    if (kind[key] === undefined || kind[key] === '') throw new Error(`ref-kinds 数据缺项：${kind.id ?? '？'}.${key}`);
  }
  for (const outcome of kind.outcomes) {
    for (const key of OUTCOME_KEYS) {
      if (outcome[key] === undefined || outcome[key] === '') throw new Error(`ref-kinds 数据缺项：${kind.id}.${outcome.id ?? '？'}.${key}`);
    }
    if (!(outcome.status in statusName)) throw new Error(`ref-kinds：${kind.id}.${outcome.id} 的状态「${outcome.status}」认不出`);
    siteSummary(outcome.site);
  }
}
