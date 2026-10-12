/**
 * 「两个人的改动在 git 里怎么合」（RecordMerge）的全部讲解数据：画面（record-merge.tsx）与机读版规则（record-merge.ai.mjs）都只读这一份。
 * bob 的改动已经合进 main；carol 也改了，运行 collab.submit：在本地 main 上提交之后落后 main，推送前把 origin/main 合进来。
 * 每种情况写两边各改了什么、合 main 时终端里看到什么、carol 工作区里的文件变成什么样、数据模型包从中读出什么。
 * git 的合并输出只写到能看出结果的那几行；插件的报错与数据模型包的报错照源码逐字写。
 */

/**
 * 一边的改动：新建一个文件，或改了某个文件的某一行
 * @typedef {{ kind: 'new', file: string } | { kind: 'edit', file: string, line: number, old: string, now: string }} Change
 */

/**
 * 读出来的一条：tone 是 good（读出了记录）或 bad（列进 problems）
 * @typedef {{ tone: 'good' | 'bad', text: string }} ReadOut
 */

/**
 * @typedef {{
 *   id: string, label: string, text: string,
 *   mine: Change, theirs: Change,
 *   terminal: { text: string, kind: 'cmd' | 'out' | 'ok' | 'err' }[],
 *   file: { path: string, lines: string[], highlight: [number, number] | null, changed: number[] } | { path: string, list: string[] },
 *   readOut: ReadOut[]
 * }} MergeCase
 */

const TASK_ID = '20260926090000-t7m2p9c';
const TASK_FILE = `collab/records/${TASK_ID}.json`;
const BOB_NEW_TASK_ID = '20260928143012-k3f9x2a';
const CAROL_NEW_TASK_ID = '20260928151005-m4n8v2d';
const BOB_NEW_TASK_FILE = `collab/records/${BOB_NEW_TASK_ID}.json`;
const CAROL_NEW_TASK_FILE = `collab/records/${CAROL_NEW_TASK_ID}.json`;

/** 两人共同的基准：main 上这条任务原来的样子，第 5 行起是 status、title、owner、due */
export const baseTask = [
  '{',
  `  "id": "${TASK_ID}",`,
  '  "type": "task",',
  '  "author": "bob",',
  '  "status": "todo",',
  '  "title": "整定 PR 参数",',
  '  "owner": "carol",',
  '  "due": "2026-10-10"',
  '}',
];

const MERGE = 'git merge --no-edit origin/main';

/* ref file="../packages/collab-model/src/task-model/records.ts" lines="40-52" hash="b94eab964121" blob="e77a18193cd2" */
/* ref file="../packages/collab-model/src/task-model/records.ts" lines="144-155" hash="8bd33de19474" blob="e77a18193cd2" */
/* ref file="../plugins/collab/src/collab-repo/submit/submit.ts" lines="67-76" hash="d2509f0cfd81" blob="92a88843de16" */
/** @type {MergeCase[]} */
export const cases = [
  {
    id: 'separate',
    label: '各写各的记录',
    text: 'bob 和 carol 各在任务页上新建了一条任务。一条记录一个文件，两边新建的是两个不同的文件，git 自动合并，不需要人处理。人再多、写得再勤也一样：只要不是同一条记录，就不会冲突。',
    mine: { kind: 'new', file: BOB_NEW_TASK_FILE },
    theirs: { kind: 'new', file: CAROL_NEW_TASK_FILE },
    terminal: [
      { text: MERGE, kind: 'cmd' },
      { text: "Merge made by the 'ort' strategy.", kind: 'out' },
      { text: ` ${BOB_NEW_TASK_FILE} | 7 +++++++`, kind: 'out' },
      { text: ' 1 file changed, 7 insertions(+)', kind: 'ok' },
    ],
    file: { path: 'collab/records/', list: [`${TASK_ID}.json`, `${BOB_NEW_TASK_ID}.json`, `${CAROL_NEW_TASK_ID}.json`] },
    readOut: [
      { tone: 'good', text: `任务 ${BOB_NEW_TASK_ID}（bob 建的）` },
      { tone: 'good', text: `任务 ${CAROL_NEW_TASK_ID}（carol 建的）` },
      { tone: 'good', text: `任务 ${TASK_ID}，没动` },
    ],
  },
  {
    id: 'apart',
    label: '同一条任务，隔着几行',
    text: 'bob 是任务的作者，把截止日改到 10 月 17 日（第 8 行）；carol 是负责人，把状态改成进行中（第 5 行）。两处中间隔着 title、owner 两行没动，git 认为互不相干，自动合成一个文件，两处改动都在。每个字段单独一行，正是为了让改不同字段的两个人尽量不冲突。',
    mine: { kind: 'edit', file: TASK_FILE, line: 8, old: baseTask[7], now: '  "due": "2026-10-17"' },
    theirs: { kind: 'edit', file: TASK_FILE, line: 5, old: baseTask[4], now: '  "status": "doing",' },
    terminal: [
      { text: MERGE, kind: 'cmd' },
      { text: `Auto-merging ${TASK_FILE}`, kind: 'out' },
      { text: "Merge made by the 'ort' strategy.", kind: 'out' },
      { text: ' 1 file changed, 1 insertion(+), 1 deletion(-)', kind: 'ok' },
    ],
    file: {
      path: TASK_FILE,
      lines: [...baseTask.slice(0, 4), '  "status": "doing",', ...baseTask.slice(5, 7), '  "due": "2026-10-17"', '}'],
      highlight: null,
      changed: [5, 8],
    },
    readOut: [{ tone: 'good', text: `任务 ${TASK_ID}「整定 PR 参数」：进行中，负责人 carol，截止 2026-10-17` }],
  },
  {
    id: 'adjacent',
    label: '同一条任务，挨着的两行',
    text: 'bob 改了标题（第 6 行），carol 改了状态（第 5 行），两处挨着。git 分不清这是两件事还是一件事，报冲突，把两边的版本连同冲突标记一起留在文件里，插件不推送、不中止合并、不替人挑。数据模型包读这个文件时先找冲突标记，报出它们在第几行，这条任务暂时读不出来：看板上没有它，网站顶部的通知栏里多一条「记录读不对」。改好之后再运行 collab.submit，那次提交完成这次合并。',
    mine: { kind: 'edit', file: TASK_FILE, line: 6, old: baseTask[5], now: '  "title": "整定 PR 参数，对一遍仿真",' },
    theirs: { kind: 'edit', file: TASK_FILE, line: 5, old: baseTask[4], now: '  "status": "doing",' },
    terminal: [
      { text: MERGE, kind: 'cmd' },
      { text: '把 origin/main 合进来有冲突，没有推送；冲突标记留在这些文件里（网站顶部的提示栏也会列出来）：', kind: 'err' },
      { text: TASK_FILE, kind: 'err' },
      { text: '让 AI 按两边的意思改好，再运行 collab.submit', kind: 'err' },
    ],
    file: {
      path: TASK_FILE,
      lines: [
        ...baseTask.slice(0, 4),
        '<<<<<<< HEAD',
        '  "status": "doing",',
        '  "title": "整定 PR 参数",',
        '=======',
        '  "status": "todo",',
        '  "title": "整定 PR 参数，对一遍仿真",',
        '>>>>>>> origin/main',
        ...baseTask.slice(6),
      ],
      highlight: [5, 11],
      changed: [],
    },
    readOut: [{ tone: 'bad', text: `records/${TASK_ID}.json：git 合并冲突没解决完（第 5、8、11 行是冲突标记）：让 AI 按两边的意思改好这条记录` }],
  },
];
