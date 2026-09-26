/**
 * 首页「一眼看懂钉码」的全部讲解数据：画面（glance.tsx）与机读版规则（glance.ai.mjs）都只读这一份。
 * 例子跟钉码页（pin/story.data.mjs）是同一个 greet.ts：文档钉住第 2–3 行、确认时写下了 hash 与 blob，之后代码发生四种变化。
 * hash 与 blob 是按 docfirst-pin 的算法对这版 greet.ts 真算出来的，命令行输出照 `docfirst check` 的真实输出写。
 *
 * @typedef {'fresh' | 'changed' | 'missing' | 'unconfirmed'} Status
 * @typedef {{ id: string, label: string, text: string, code: string[], span: [number, number] | null,
 *   added?: number[], changed?: number[], status: Status, cli: string }} GlanceCase
 */

export const files = { doc: 'content/docs/a.mdx', ref: 'src/greet.ts' };

/** 文档里那一行记号：确认时写下了第 2–3 行的 hash 与整个文件的 blob，四种情况里它都没变 */
export const marker = '{/* ref file="src/greet.ts" lines="2-3" hash="3eb99c2e88e2" blob="c134a7ab15a9" */}';

const V0 = ['// 打招呼', 'export function greet(name: string) {', '  return `hello, ${name}`;', '}'];

/** @type {GlanceCase[]} */
export const cases = [
  {
    id: 'same',
    label: '代码没动',
    text: '这两行跟确认时一模一样，算出的 hash 等于记号上的：绿。',
    code: V0,
    span: [2, 3],
    status: 'fresh',
    cli: '🟢 content/docs/a.mdx  src/greet.ts:2-3  新鲜',
  },
  {
    id: 'moved',
    label: '上面插了两行',
    text: '被钉的两行整体下移到第 4–5 行，内容没变。check 按 blob 从 git 取回确认时的文件，照着改动把旧行号对到新位置，那两行的 hash 没变：还是绿。下一次 confirm 把行号写回成 4-5。',
    code: ['// 打招呼', '// 用法：greet("世界")', '// 返回一句问候', 'export function greet(name: string) {', '  return `hello, ${name}`;', '}'],
    span: [4, 5],
    added: [2, 3],
    status: 'fresh',
    cli: '🟢 content/docs/a.mdx  src/greet.ts:2-3  新鲜',
  },
  {
    id: 'edited',
    label: '改了内容',
    text: '把 hello 改成 hi，算出的 hash 跟记号上的不同了：黄，等人读一遍文档里那句话再确认。这个改动如果还没提交，就是这次改的，check 按红处理、拦下提交。',
    code: ['// 打招呼', 'export function greet(name: string) {', '  return `hi, ${name}`;', '}'],
    span: [2, 3],
    changed: [3],
    status: 'changed',
    cli: '🟡 content/docs/a.mdx  src/greet.ts:2-3  有变动，等作者复核',
  },
  {
    id: 'deleted',
    label: '删掉了',
    text: '函数删掉了，今天的文件里找不到这两行：红，check 退 1。页面上改成显示文档写下时的那两行。',
    code: ['// 打招呼'],
    span: null,
    status: 'missing',
    cli: '🔴 content/docs/a.mdx  src/greet.ts:2-3  缺失，引用指向空气（整段已被删光）',
  },
];

export const statusName = { fresh: '新鲜', changed: '有变动', missing: '缺失', unconfirmed: '未确认' };
