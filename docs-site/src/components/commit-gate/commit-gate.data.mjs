/**
 * 「提交门禁拦什么、什么算红」的全部讲解数据：画面（commit-gate.tsx）与机读版规则（commit-gate.ai.mjs）都只读这一份。
 * 例子跟钉码页（pin/story.data.mjs）是同一个 greet.ts：文档 content/docs/a.mdx 钉住它的第 4–5 行，
 * 记号上的 hash 与 blob 取自那份数据（按 code-pin 的算法真算出来的）。
 * 命令行输出照 docfirst-workflow 的 cli/run.ts 实际打印的格式逐字写；项目根是 ~/repo/docs-site，git 仓根是 ~/repo，
 * 所以 git status 列出的路径带 docs-site/ 前缀，引用里写的路径不带。
 */

const DOC = 'content/docs/a.mdx';
const REF = 'src/greet.ts';
const OTHER_REF = '../../greet-lib/src/greet.ts';

const MARKER_BEFORE = `{/* ref file="${REF}" lines="4-5" hash="3eb99c2e88e2" blob="58b32ed1c69e" */}`;
const MARKER_AFTER = `{/* ref file="${REF}" lines="4-5" hash="9a083fec7547" blob="eeec5ca2bd8f" */}`;

/* ref file="../packages/docfirst-workflow/src/cli/run.ts" lines="296-303" hash="23ad1504ef64" blob="ff2e6b7ae7d3" */
const BLOCKING_LINE = `🔴 ${DOC}  ${REF}:4-5  有变动，是本仓还没提交的改动引起的——在同一个提交里复核，再 docfirst confirm ${DOC} --accept`;

export const files = { doc: DOC, ref: REF, cwd: '~/repo/docs-site' };

/** 门禁在本仓是怎么落实的：没有 git 钩子、没有 CI，是仓根 AGENTS.md「门禁」里的一条规矩 */
export const gateNote =
  '本仓没有装 git 钩子，也没有 CI：「docs-site 里 pnpm docfirst check 通过才提交」是仓根 AGENTS.md 门禁里的一条，由提交的人照做。';

/** 门禁三种状态在画面上的说法 */
export const gateLabel = {
  blocked: 'check 退出码 1：不能提交',
  open: 'check 退出码 0：可以提交',
  pending: '文档改了：先重跑 check',
};

/** check 计入红的几类，退出码只看它们的总数 */
/* ref file="../packages/docfirst-workflow/src/cli/run.ts" lines="311-332" hash="efcb24752ad5" blob="418434ff646c" */
/* ref file="../packages/docfirst-workflow/src/cli/run.ts" lines="219-237" hash="f70391e16cf2" blob="418434ff646c" */
export const redSources = [
  { name: '缺失的引用', rule: '被钉的行段、文件、目录不在了；提没提交都算' },
  { name: '拦提交的黄', rule: '状态是「有变动」，且被钉文件在文档所在的仓里有未提交的改动' },
  { name: '名册外组件', rule: 'mdx 里用了 docfirst.config.mjs 的 components 里没有的组件' },
  { name: '不新鲜的生成物', rule: 'outputs 映射里写了的落点：文件还不存在、跟正本重新渲染的结果不一致、正本头部缺点名的字段、正本渲染不了' },
  { name: '轨迹卡的病', rule: 'content/trajectory/ 下的卡缺必填字段，或字段格式不对' },
];

/** 只打印、不计入红的几种行 */
export const notRed = ['🟢 新鲜', '⚪ 未确认', '🟡 有变动但不是本仓未提交的改动引起的'];

/**
 * 每一步是一个固定状态。
 *   repos     每个相关 git 仓此刻 `git status --porcelain` 的输出；lines 为空表示没有未提交改动；hit 是探针认出的那一行路径
 *   change    这一步动了哪个文件（git diff 的旧行与新行）；没有就是 null
 *   probe     check 对这处引用的判定：逐个问题的回答与结论；这一步跑的不是 check、或是汇总，就是 null
 *   sources   这一步画「红从哪里来」
 *   command   终端里敲的命令，output 是它打印的行，exit 是它的退出码
 *   gate      门禁：blocked 被拦、open 通过、pending 还要重跑 check
 *
 * @typedef {'good' | 'warn' | 'bad' | 'pending' | 'info'} Tone
 * @typedef {{ text: string, kind: 'out' | 'ok' | 'err' }} OutLine
 * @typedef {{ path: string, note: string, lines: string[], hit: string | null }} RepoStatus
 * @typedef {{ file: string, role: 'blue' | 'violet', label: string, old: string[], now: string[] }} Change
 * @typedef {{ ask: string, answer: 'yes' | 'no' | 'skip', detail: string }} ProbeRow
 * @typedef {{ rows: ProbeRow[], verdict: { tone: Tone, text: string } }} Probe
 * @typedef {'blocked' | 'open' | 'pending'} Gate
 * @typedef {{ title: string, text: string, repos: RepoStatus[], change: Change | null, probe: Probe | null,
 *   sources: boolean, command: string, output: OutLine[], exit: 0 | 1, gate: Gate }} Step
 * @type {Step[]}
 */
/* ref file="../packages/docfirst-workflow/src/cli/run.ts" lines="38-44" hash="9ebfdcac2bf1" blob="418434ff646c" */
/* ref file="../packages/docfirst-workflow/src/cli/run.ts" lines="172-190" hash="89872d5416cd" blob="418434ff646c" */
/* ref file="../packages/docfirst-workflow/src/cli/run.ts" lines="335-341" hash="dcd5a37f8b61" blob="418434ff646c" */
/* ref file="../packages/docfirst-workflow/src/node/uncommitted.ts" lines="1-4" hash="4968cfab632f" blob="2ad45230cb96" */
/* ref file="../packages/docfirst-workflow/src/node/uncommitted.ts" lines="26-35" hash="8fc6d81a0264" blob="ed53157b1c06" */
/* ref file="../packages/docfirst-workflow/src/cards/card.ts" lines="69-69" hash="566d53167dfe" blob="d3338eaedca6" */
export const steps = [
  {
    title: '改了被钉的两行，还没提交',
    text:
      `把 greet.ts 里的 hello 改成 hi，还没提交。check 算出这两行的 hash 跟记号上的 3eb99c2e88e2 不同，状态是「有变动」（黄）。` +
      `接着它问 git：文档和 greet.ts 在同一个仓 ~/repo 里，这个仓的 git status 列出了 docs-site/src/greet.ts，说明这个黄是这次改动引起的。` +
      '这一行改用 🔴 打印、计入红，check 退出码 1，门禁不通过。只在工作区改了、已经 git add 进暂存区、还没跟踪的新文件，都算未提交。',
    repos: [{ path: '~/repo', note: `文档与 ${REF} 都在这个仓`, lines: [' M docs-site/src/greet.ts'], hit: 'docs-site/src/greet.ts' }],
    change: { file: REF, role: 'violet', label: '未提交', old: ['  return `hello, ${name}`;'], now: ['  return `hi, ${name}`;'] },
    probe: {
      rows: [
        { ask: '状态是「有变动」吗', answer: 'yes', detail: '第 4–5 行算出的 hash 跟记号上的 3eb99c2e88e2 不同' },
        { ask: '被钉文件跟文档在同一个 git 仓吗', answer: 'yes', detail: `${DOC} 与 ${REF} 往上找到的都是 ~/repo/.git` },
        { ask: '这个仓的 git status 列出了它吗', answer: 'yes', detail: `${REF} 在仓里的路径是 docs-site/src/greet.ts，在未提交的路径里` },
      ],
      verdict: { tone: 'bad', text: '本仓未提交的改动引起的黄：按红算' },
    },
    sources: false,
    command: 'pnpm docfirst check',
    output: [{ text: BLOCKING_LINE, kind: 'err' }],
    exit: 1,
    gate: 'blocked',
  },
  {
    title: '读一遍文档，--accept 按今天的内容重新记下',
    text:
      `打开 ${DOC}，读讲这两行的那句话。还成立，就点名这一页 confirm --accept：记号上的 hash 换成今天这两行的，blob 换成今天这个文件的，行号不变；` +
      '不成立就先改那句话再 accept。--accept 必须点名页，不点名退出码 2、什么都不动；点了名只动这一页，同仓别的页里的黄灯不替别人确认。' +
      '现在 git status 里多了 a.mdx，要重跑 check 才知道能不能提交。',
    repos: [
      {
        path: '~/repo',
        note: `文档与 ${REF} 都在这个仓`,
        lines: [' M docs-site/content/docs/a.mdx', ' M docs-site/src/greet.ts'],
        hit: null,
      },
    ],
    change: { file: DOC, role: 'blue', label: 'confirm 写回', old: [MARKER_BEFORE], now: [MARKER_AFTER] },
    probe: null,
    sources: false,
    command: `pnpm docfirst confirm ${DOC} --accept`,
    output: [
      { text: `·  按页限定：只动 ${DOC}，别的页不碰`, kind: 'out' },
      { text: `✅ ${DOC}  ${REF}:4-5  已按今天的内容重新记下`, kind: 'ok' },
    ],
    exit: 0,
    gate: 'pending',
  },
  {
    title: '代码和文档一起提交，check 退出码 0',
    text:
      '重跑 check：这两行算出的 hash 等于新记号上的 9a083fec7547，状态是「新鲜」（绿），没有红，退出码 0，门禁通过。' +
      'greet.ts 与 a.mdx 放进同一个提交：改代码和复核文档在历史里是同一次改动。',
    repos: [
      {
        path: '~/repo',
        note: '两个文件都已暂存，一起提交',
        lines: ['M  docs-site/content/docs/a.mdx', 'M  docs-site/src/greet.ts'],
        hit: null,
      },
    ],
    change: null,
    probe: {
      rows: [{ ask: '状态是「有变动」吗', answer: 'no', detail: '重新记下之后，这两行算出的 hash 跟记号上的 9a083fec7547 相同：新鲜' }],
      verdict: { tone: 'good', text: '绿：不计入红，也不再问 git' },
    },
    sources: false,
    command: 'pnpm docfirst check',
    output: [{ text: `🟢 ${DOC}  ${REF}:4-5  新鲜`, kind: 'ok' }],
    exit: 0,
    gate: 'open',
  },
  {
    title: '另一种情况：改动已经提交了',
    text:
      '同样把 hello 改成 hi，但这个改动已经在别的提交里进了 HEAD，文档没复核。check 仍然算出「有变动」，可 git status 是空的，探针回答「不是未提交的改动」。' +
      '这个黄照常用 🟡 打印、不计入红，退出码 0：它不拦接下来别的提交，等作者复核后 --accept。',
    repos: [{ path: '~/repo', note: `文档与 ${REF} 都在这个仓`, lines: [], hit: null }],
    change: null,
    probe: {
      rows: [
        { ask: '状态是「有变动」吗', answer: 'yes', detail: '第 4–5 行算出的 hash 跟记号上的 3eb99c2e88e2 不同' },
        { ask: '被钉文件跟文档在同一个 git 仓吗', answer: 'yes', detail: '都在 ~/repo' },
        { ask: '这个仓的 git status 列出了它吗', answer: 'no', detail: 'git status 没有输出：改动已经在 HEAD 里' },
      ],
      verdict: { tone: 'warn', text: '黄：只报告，不计入红' },
    },
    sources: false,
    command: 'pnpm docfirst check',
    output: [{ text: `🟡 ${DOC}  ${REF}:4-5  有变动，等作者复核`, kind: 'out' }],
    exit: 0,
    gate: 'open',
  },
  {
    title: '另一种情况：被钉文件在别的仓',
    text:
      `引用写的是 ${OTHER_REF}，它属于另一个 git 仓 ~/greet-lib，那里有未提交的改动。探针先比仓：被钉文件跟文档不在同一个仓，` +
      '改代码的提交和改文档的提交不可能是同一个，直接回答「否」，不去看那个仓的 git status。这个黄只报告，退出码 0。',
    repos: [
      { path: '~/repo', note: '文档在这个仓', lines: [], hit: null },
      { path: '~/greet-lib', note: '被钉的 greet.ts 在这个仓', lines: [' M src/greet.ts'], hit: null },
    ],
    change: null,
    probe: {
      rows: [
        { ask: '状态是「有变动」吗', answer: 'yes', detail: '被钉的两行跟记号上的 hash 不同' },
        { ask: '被钉文件跟文档在同一个 git 仓吗', answer: 'no', detail: `${DOC} 在 ~/repo，${OTHER_REF} 在 ~/greet-lib` },
        { ask: '这个仓的 git status 列出了它吗', answer: 'skip', detail: '不同仓就不问' },
      ],
      verdict: { tone: 'warn', text: '黄：只报告，不计入红' },
    },
    sources: false,
    command: 'pnpm docfirst check',
    output: [{ text: `🟡 ${DOC}  ${OTHER_REF}:4-5  有变动，等作者复核`, kind: 'out' }],
    exit: 0,
    gate: 'open',
  },
  {
    title: '缺失：提没提交都是红',
    text:
      'greet 函数删掉并提交了，被钉的两行在今天的文件里找不到，状态是「缺失」，理由 vanished 打印成「整段已被删光」。' +
      '缺失不经过探针，直接计入红，退出码 1：改动提没提交、在不在同一个仓都一样。要么改写这处引用，要么连同讲它的那句话一起删掉。',
    repos: [{ path: '~/repo', note: `文档与 ${REF} 都在这个仓`, lines: [], hit: null }],
    change: {
      file: REF,
      role: 'violet',
      label: '已提交',
      old: ['export function greet(name: string) {', '  return `hi, ${name}`;', '}'],
      now: [],
    },
    probe: {
      rows: [
        { ask: '状态是「缺失」吗', answer: 'yes', detail: '被钉的两行在今天的 greet.ts 里找不到了' },
        { ask: '要查 git status 吗', answer: 'skip', detail: '只有「有变动」才问 git，缺失直接计入红' },
      ],
      verdict: { tone: 'bad', text: '红' },
    },
    sources: false,
    command: 'pnpm docfirst check',
    output: [{ text: `🔴 ${DOC}  ${REF}:4-5  缺失（整段已被删光）`, kind: 'err' }],
    exit: 1,
    gate: 'blocked',
  },
  {
    title: '汇总：红从哪里来',
    text:
      'check 的退出码只看红的总数，大于 0 退出码就是 1。红由这几类相加：缺失的引用、拦提交的黄、名册外组件、不新鲜的生成物、轨迹卡的病。' +
      '🟢 新鲜、⚪ 未确认、不拦提交的 🟡 都只打印、不计入。加 --json 时整份报告打印成一行 JSON，退出码的算法相同。',
    repos: [{ path: '~/repo', note: '文档所在的仓', lines: [], hit: null }],
    change: null,
    probe: null,
    sources: true,
    command: 'pnpm docfirst check',
    output: [
      { text: `⚪ ${DOC}  src/bye.ts:1-3  未确认，等作者确认`, kind: 'out' },
      { text: `🟡 ${DOC}  ${OTHER_REF}:4-5  有变动，等作者复核`, kind: 'out' },
      { text: `🔴 ${DOC}  第 12 行 <Chart>  名册外组件，docfirst.config.mjs 里没给它压平规则`, kind: 'err' },
      {
        text: '🔴 content/docs/outputs/readme.mdx → ../README.md  生成物跟 mdx 源不一致（源改了没重摆，或有人直接改了生成物）——重跑 render',
        kind: 'err',
      },
      {
        text: '🔴 content/trajectory/2026-09-26-gate-demo.mdx  born-at：born-at 格式须 YYYY-MM-DD 或 YYYY-MM-DDTHH:mm（九月二十六）',
        kind: 'err',
      },
    ],
    exit: 1,
    gate: 'blocked',
  },
];
