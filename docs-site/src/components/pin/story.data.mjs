/**
 * 「一条引用的一生」的全部讲解数据：画面（story.tsx）与机读版规则（pin.ai.mjs）都只读这一份。
 * 例子里的指纹与 blob 名是按 docfirst-pin 的算法对这几版 greet.ts 真算出来的：
 * 段指纹 = 归一化后 sha256 前 12 位，blob 名 = git blob 对象名前 12 位。
 */

const V0 = ['// 打招呼', 'export function greet(name: string) {', '  return `hello, ${name}`;', '}'];
const V1 = ['// 打招呼', '// 用法：greet("世界")', '// 返回一句问候', 'export function greet(name: string) {', '  return `hello, ${name}`;', '}'];
const V2 = ['// 打招呼', '// 用法：greet("世界")', '// 返回一句问候', 'export function greet(name: string) {', '  return `hi, ${name}`;', '}'];
const V3 = ['// 打招呼', '// 用法：greet("世界")', '// 返回一句问候'];

const DOC = 'content/docs/a.mdx';
const REF = 'src/greet.ts';

/**
 * 每一步只变一件事。
 *   code      这一步 greet.ts 的全部行
 *   span      被钉的行（1 起、闭区间），画高亮用；null 表示这段已经不在文件里
 *   added     这一步新出现的行号，changed 这一步内容变了的行号
 *   marker    文档里那一行记号此刻的样子
 *   status    fresh / changed / missing / unconfirmed
 *   blocking  黄灯是本仓未提交的改动引起的，check 按红处理
 *   cli       命令行这一步输出的那一行
 *   diff      有变动时页面上给的旧行与新行
 *   removed   段没了时，页面上显示的文档写下时的那几行
 *
 * @typedef {'fresh' | 'changed' | 'missing' | 'unconfirmed'} Status
 * @typedef {{ title: string, code: string[], span: [number, number] | null, added?: number[], changed?: number[],
 *   marker: string, status: Status, blocking?: boolean, command: string, cli: string,
 *   diff?: { old: string, now: string }, removed?: string[], text: string }} Step
 * @type {Step[]}
 */
export const steps = [
  {
    title: '写下草稿记号',
    code: V0,
    span: [2, 3],
    marker: `@@docfirst ref ${REF}:2-3 @@`,
    status: 'unconfirmed',
    command: 'pnpm docfirst check',
    cli: `⚪ ${DOC}  ${REF}:2-3  未确认，等作者确认`,
    text: '在文档里单独起一行，写草稿记号指向 greet.ts 的第 2–3 行。check 认得它、也读得到这两行，但记号上还没有确认时的记录，所以是空心的「未确认」。',
  },
  {
    title: '确认：记下指纹',
    code: V0,
    span: [2, 3],
    marker: `{/* ref file="${REF}" lines="2-3" hash="3eb99c2e88e2" blob="c134a7ab15a9" */}`,
    status: 'fresh',
    command: 'pnpm docfirst confirm',
    cli: `✅ ${DOC}  ${REF}:2-3  已确认，草稿记号已换成正式记号`,
    text: 'confirm 把草稿换成正式记号，并写上两个数：hash 是这两行的指纹，blob 是此刻整个 greet.ts 的 git 对象名。记号里没有代码，页面上那块代码是构建时现读的。',
  },
  {
    title: '上面插了两行：还是绿',
    code: V1,
    span: [4, 5],
    added: [2, 3],
    marker: `{/* ref file="${REF}" lines="2-3" hash="3eb99c2e88e2" blob="c134a7ab15a9" */}`,
    status: 'fresh',
    command: 'pnpm docfirst check',
    cli: `🟢 ${DOC}  ${REF}:2-3  新鲜`,
    text: '函数上面加了两行注释，被钉的两行整体下移到 4–5 行，内容没变。check 按 blob 从 git 取回确认时的文件，照着这次的改动把旧的 2–3 行对到今天的 4–5 行，指纹一致，所以还是绿。',
  },
  {
    title: 'confirm 写回新行号',
    code: V1,
    span: [4, 5],
    marker: `{/* ref file="${REF}" lines="4-5" hash="3eb99c2e88e2" blob="58b32ed1c69e" */}`,
    status: 'fresh',
    command: 'pnpm docfirst confirm',
    cli: `✅ ${DOC}  ${REF}:2-3  内容没变、挪到了 4-5，已写回新行号`,
    text: '再跑一次 confirm，行号改成 4-5、blob 换成今天的文件，指纹不变。这一步不需要人判断，记号上的数字不用人维护。',
  },
  {
    title: '改了被钉的代码：变黄，而且拦下提交',
    code: V2,
    span: [4, 5],
    changed: [5],
    marker: `{/* ref file="${REF}" lines="4-5" hash="3eb99c2e88e2" blob="58b32ed1c69e" */}`,
    status: 'changed',
    blocking: true,
    command: 'pnpm docfirst check',
    cli: `🔴 ${DOC}  ${REF}:4-5  有变动，是本仓还没提交的改动引起的——在同一个提交里复核，再 docfirst confirm ${DOC} --accept`,
    diff: { old: '  return `hello, ${name}`;', now: '  return `hi, ${name}`;' },
    text: '把 hello 改成 hi。这两行的指纹对不上了，状态是「有变动」（黄），页面上把旧行和新行放在一起。改动还没提交，说明就是这次改的，check 把它按红处理、退 1，让改代码的人在同一个提交里把文档对上。',
  },
  {
    title: '复核后 --accept：回绿',
    code: V2,
    span: [4, 5],
    marker: `{/* ref file="${REF}" lines="4-5" hash="9a083fec7547" blob="eeec5ca2bd8f" */}`,
    status: 'fresh',
    command: `pnpm docfirst confirm ${DOC} --accept`,
    cli: `✅ ${DOC}  ${REF}:4-5  已按今天的内容重新记下`,
    text: '读一遍文档里讲这段代码的那句话。还成立，就点名这一页 --accept，按今天的内容重新记下指纹；不成立就先改那句话。代码、文档和新指纹放进同一个提交。',
  },
  {
    title: '删掉这段：红',
    code: V3,
    span: null,
    marker: `{/* ref file="${REF}" lines="4-5" hash="9a083fec7547" blob="eeec5ca2bd8f" */}`,
    status: 'missing',
    command: 'pnpm docfirst check',
    cli: `🔴 ${DOC}  ${REF}:4-5  缺失，引用指向空气（整段已被删光）`,
    removed: ['export function greet(name: string) {', '  return `hi, ${name}`;', '}'],
    text: '函数删掉了，被钉的两行在今天的文件里找不到了，状态是「缺失」（红），check 退 1。页面上这一块改成显示文档写下时的那两行，好让人知道原来引的是什么。要么改写这处引用，要么连同那句话一起删掉。',
  },
];

/** @type {{ status: Status, name: string, meaning: string }[]} */
export const legend = [
  { status: 'fresh', name: '新鲜', meaning: '被钉的内容跟确认时一样，位置变了也算' },
  { status: 'changed', name: '有变动', meaning: '内容变了，等人读一遍文档再确认' },
  { status: 'missing', name: '缺失', meaning: '被钉的东西不在了' },
  { status: 'unconfirmed', name: '未确认', meaning: '还没记下确认时的指纹' },
];

export const files = { doc: DOC, ref: REF };
