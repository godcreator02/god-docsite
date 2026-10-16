/**
 * PartsGallery（「explainer：讲解组件」那一页「零件与颜色」一节）的全部数据，画面（parts-gallery.tsx）只读这一份。
 * 六个零件的最小写法逐字取自本站页面的组件（每条上方注明出处）；渲染用的数据照抄那几个组件的数据文件：
 * Diff 的一对行、Terminal 的两行取自 collab 页 conflict-cases.data.mjs（status 行的源头是 collab 包的测试夹具；
 * git 输出是 git 2.53.0.windows.2 实跑的原文）；CodeLines 的整份文件、Pane 的四步取自 code-pin 页 judge-cases.data.mjs
 * （那里注明文件内容是为讲解编的例子）。
 */

/** 六个零件：what 讲画什么；usage 是本站页面里真实用过的最小写法，等宽字摆在格底 */
export const parts = [
  // 写法出自 code-pin 页 judge-cases.tsx 的「核对：行段判定的四步」那张卡
  { name: 'Pane', what: '带标题栏的卡片', usage: '<Pane title="核对：行段判定的四步" icon="terminal" role="violet">' },
  // 写法出自 collab 页 conflict-cases.tsx 的结论行（Verdict）
  { name: 'Terminal', what: '终端窗口', usage: '<Terminal title="git merge carol" lines={item.gitLines} />' },
  // 写法出自 collab 页 conflict-cases.tsx 的结论行（Verdict）
  { name: 'Pill', what: '胶囊标签', usage: '<Pill tone="good" dot>git 自动合上</Pill>' },
  // 写法出自 collab 页 conflict-cases.tsx 的解码报错行（Verdict）
  { name: 'Dot', what: '状态点', usage: '<Dot tone="bad" />' },
  // 写法出自 code-pin 页 judge-cases.tsx 的「确认时的文件」那张卡
  { name: 'CodeLines', what: '带行号与高亮的代码行', usage: '<CodeLines lines={confirmedLines} highlight={confirmedSpan} tone="info" />' },
  // 写法出自 collab 页 conflict-cases.tsx 的 SidePane
  { name: 'Diff', what: '新旧行对照', usage: '<Diff old={file.old ?? []} now={file.now ?? []} />' },
];

/** 语气 Tone 五种：说「这一项是什么状态」；word 是这个语气的颜色中文名 */
export const tones = [
  { name: 'good', word: '绿' },
  { name: 'warn', word: '琥珀' },
  { name: 'bad', word: '玫红' },
  { name: 'pending', word: '琥珀空心' },
  { name: 'info', word: '蓝' },
];

/** 角色色 Role 七种：说「这个东西是哪个角色」，同一个角色在整页里固定一种颜色；title 是本站页面上真用这个颜色的标题栏 */
export const roles = [
  // collab 页 conflict-cases.tsx：bob 那张卡
  { name: 'blue', title: 'bob-test 改的' },
  // collab 页 conflict-cases.tsx：carol 那张卡
  { name: 'violet', title: 'carol-test 改的' },
  // 本页接缝图的「组件出口」模块（seams.data.mjs）
  { name: 'emerald', title: '组件出口' },
  // 本页 shell-demos.tsx 的右块（机读文字那张卡）
  { name: 'amber', title: '机读文字（stepsText 交回的）' },
  // collab 页 new-problems.tsx：拦下那张卡
  { name: 'rose', title: '拦下：newProblems(before, after)' },
  // 本页接缝图的「包的样式」模块（seams.data.mjs）
  { name: 'cyan', title: '包的样式' },
  // collab 页 new-problems.tsx：before 那张卡
  { name: 'slate', title: 'before（分叉点）' },
];

/** Diff 格渲染的一对行：一条任务的状态从 todo 改成 doing（与 collab 页 conflict-cases 同一对行） */
/* ref file="../packages/collab/test/fixtures.ts" lines="14-17" hash="542600682f6e" blob="0440510224bf" */
export const diffSides = { old: ['  "status": "todo",'], now: ['  "status": "doing",'] };

/** Terminal 格渲染的两行：git 实跑输出的原文（出处见文件头） */
export const terminalLines = [
  'Auto-merging collab/records/20260925160530-t5v9w3d.json',
  "Merge made by the 'ort' strategy.",
];

/** CodeLines 格渲染的整份文件与高亮行段：照抄 code-pin 页 judge-cases.data.mjs（那里注明文件内容是为讲解编的例子） */
export const codeLines = [
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
export const codeSpan = [3, 5];

/** Pane 格渲染的四步：照抄 code-pin 页 judge-cases.data.mjs 的 stepNames */
/* ref file="../packages/code-pin/src/core/compare.ts" lines="5-11" hash="5871ca1c593a" blob="f456193d7860" */
export const paneSteps = ['段哈希对得上', 'blob 名对得上', '取旧内容映到今天', '整个文件里滑窗找'];
