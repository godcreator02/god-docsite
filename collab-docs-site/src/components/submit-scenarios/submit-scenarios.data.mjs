/**
 * 「各种情况下怎么协作」的全部讲解数据：画面（submit-scenarios.tsx）与机读版规则（submit-scenarios.ai.mjs）都只读这一份。
 * 人物：bob、carol 是成员，admin 是项目负责人（协作仓在 Gitea 上的协作者）；协作仓的合并请求由 NAS 上的执行器立刻合并或打回，
 * 提交人的 collab.submit 一直等到这个结论。
 * 每种情况是按时间排的一串事件，一步一个；每一步记下各台机器（Gitea、bob 与 carol 的电脑）上分支指向哪个提交、
 * 开着哪些合并请求、工作区里有没有没提交的改动，画面按它画出每台机器此刻的提交图。会冲突的那种另给出冲突的记录文件。
 * 事件里的 git 命令、回执、留言、通知的短句与窗格标签照插件、数据模型包、功能包、合并检查包与工作流模板的源码逐字写；提交只取能看出结构的那几个。
 */

/**
 * 事件里合并请求变成的状态，画面按 state 选颜色：rejected 是执行器留言后关掉的，closed 是提交人的插件等不到结论关掉的，
 * review 是别的仓（没有执行器）开着等那个仓的负责人审阅的
 * @typedef {{ n: number, state: 'open' | 'merged' | 'rejected' | 'closed' | 'review', note: string }} PullChange
 */

/**
 * 一台机器此刻的状态：Gitea 上的 main 与开着的合并请求（编号 → 指向的提交）；电脑上的本地 main、上次取回的 origin/main、
 * 工作区里没提交的改动（一句话）。一步里的变化写同样的形状，值为 null 是去掉（合并请求合了或关了、工作区干净了）
 * @typedef {'gitea' | 'a' | 'b'} Machine
 * @typedef {{ main?: string, origin?: string, pulls?: Record<number, string>, work?: string }} MachineState
 * @typedef {Partial<Record<Machine, MachineState>>} MachineStates
 * @typedef {Partial<Record<Machine, { main?: string | null, origin?: string | null, pulls?: Record<number, string | null>, work?: string | null }>>} StateChange
 */

/**
 * showFile 为 true 的那一步旁边给出冲突的记录文件
 * @typedef {{ who: 'a' | 'b' | 'lead' | 'runner', what: string, cmd?: string, pull?: PullChange, at?: StateChange, showFile?: boolean }} Event
 */

/**
 * 提交按出现的先后排，画面里新的在上面；by 是谁做的（圆点的颜色），message 是写在右边的提交说明
 * @typedef {{ id: string, by: 'base' | 'bob' | 'carol' | 'admin' | 'bot', parents: string[], message: string }} Commit
 */

/**
 * repo 是别的仓的名字，没有就是协作仓
 * @typedef {{ title: string, lines: string[], highlight: [number, number] }} FileView
 * @typedef {{ id: string, label: string, text: string, outcome: 'clean' | 'conflict' | 'rejected' | 'timeout' | 'broken' | 'lead-only' | 'review', machines: Machine[], commits: Commit[], events: Event[], repo?: string, file?: FileView }} Case
 */

/**
 * 事件里的四方，每方在整页里固定一种颜色：bob 蓝、carol 绿、admin（项目负责人）紫、执行器琥珀
 * @type {Record<Event['who'], { name: string, id: string, role: import('@godcreator/docfirst-explainer').Role }>}
 */
export const actors = {
  a: { name: 'bob', id: 'bob', role: 'blue' },
  b: { name: 'carol', id: 'carol', role: 'emerald' },
  lead: { name: 'admin', id: 'admin', role: 'violet' },
  runner: { name: '执行器', id: 'NAS', role: 'amber' },
};

/** @type {Record<Case['outcome'], { label: string, tone: import('@godcreator/docfirst-explainer').Tone }>} */
export const outcomes = {
  clean: { label: '不冲突', tone: 'good' },
  conflict: { label: '真冲突：人配合 AI 改', tone: 'bad' },
  rejected: { label: '被打回：改动回到工作区', tone: 'warn' },
  timeout: { label: '执行器没给结论：告诉项目负责人', tone: 'warn' },
  broken: { label: '站点会出问题：本机就拦下', tone: 'bad' },
  'lead-only': { label: '只有负责人能改：本机就拦下', tone: 'warn' },
  review: { label: '要负责人人工审阅', tone: 'warn' },
};

/** @type {Record<PullChange['state'], import('@godcreator/docfirst-explainer').Tone>} */
export const pullTones = { open: 'info', merged: 'good', rejected: 'bad', closed: 'pending', review: 'warn' };

const A = actors.a.id;

/* ref file="../plugins/collab/src/git/status.ts" lines="5-7" hash="ce785a158ed4" blob="ab187515783f" */
/**
 * 每台机器一张提交图，颜色与人物一致。协作仓只用 main 一条分支：电脑上的本地 main 写成「人/main」，上次取回的写 origin/main
 * @type {Record<Machine, { title: string, role: import('@godcreator/docfirst-explainer').Role, main: string }>}
 */
export const machines = {
  gitea: { title: 'Gitea', role: 'cyan', main: 'main' },
  a: { title: `${actors.a.name} 的电脑`, role: 'blue', main: `${actors.a.name}/main` },
  b: { title: `${actors.b.name} 的电脑`, role: 'emerald', main: `${actors.b.name}/main` },
};

/** 提交圆点的颜色：谁做的这个提交 */
export const authorRoles = { base: 'slate', bob: 'blue', carol: 'emerald', admin: 'violet', bot: 'cyan' };

const conflictedRecord = 'collab/records/20260926101500-k2m9q4t.json';

/* ref file="../plugins/collab/src/collab-repo/submit/submit.ts" lines="35-39" hash="2e408d45cad7" blob="92a88843de16" */
/* ref file="../plugins/collab/src/collab-repo/submit/submit.ts" lines="51-52" hash="a57e0ab0cb9d" blob="92a88843de16" */
/* ref file="../plugins/collab/src/collab-repo/submit/submit.ts" lines="67-76" hash="d2509f0cfd81" blob="92a88843de16" */
/* ref file="../plugins/collab/src/collab-repo/submit/submit.ts" lines="95-97" hash="cca79745b72a" blob="92a88843de16" */
/* ref file="../plugins/collab/src/collab-repo/submit/submit.ts" lines="153-153" hash="770f3420697e" blob="92a88843de16" */
/* ref file="../plugins/collab/src/collab-repo/sync/sync.ts" lines="41-41" hash="d1ff438528dd" blob="b434a84b1ae2" */
/* ref file="../packages/collab-merge-check/templates/collab-auto-merge.yaml" lines="91-91" hash="e7cca7b57816" blob="38412d8b2e58" */
const cmd = {
  commitBoth: `git commit -m "${A} 的协作记录与页面改动" -- collab site`,
  push: `git push origin HEAD:refs/for/main -o topic=${A}`,
  mergeMain: 'git merge --no-edit origin/main',
  finishMerge: 'git commit --no-edit',
  returnToWork: 'git reset --mixed <推送时的 origin/main>',
  fastForward: 'git merge --ff-only origin/main',
  check: (author) => `collab-merge-check --base main --head refs/collab/pull --author ${author} --leads ${actors.lead.id}`,
};

/** 不是插件做的：bob 让 AI 把 site/package.json 退回 main 上的样子 */
const restorePackageJson = 'git restore -- site/package.json';

/** bob 加的库：pnpm add 写进 dependencies 的是普通版本号范围 */
const chartLibrary = { name: 'echarts', range: '^5.6.0' };

/* ref file="../packages/collab-merge-check/src/check.ts" lines="185-185" hash="bbd8e6c99b06" blob="c0f8c11da687" */
/** 合并检查的原话：推送后 main 又动了、合不进 */
const conflictProblem = `和 main 有冲突：${conflictedRecord}；把 main 合进来、按两边的意思改好冲突的文件，再提交`;

/* ref file="../packages/collab-merge-check/src/check.ts" lines="98-98" hash="41db04982d7e" blob="c0f8c11da687" */
/* ref file="../packages/collab-merge-check/src/check.ts" lines="161-161" hash="6eaa070c5a16" blob="c0f8c11da687" */
/** 合并检查第二条的原话：每处改动一条，这里是改了 site/package.json 的 scripts */
const scriptsChange = 'site/package.json 的 scripts';
const leadOnlyProblem = (changes) => `改了只有负责人能改的内容：${changes.join('、')}；这类改动交给负责人（协作仓的协作者）提交`;

/* ref file="../plugins/collab/src/collab-repo/submit/submit.ts" lines="151-151" hash="bef797b0a856" blob="92a88843de16" */
/** collab.submit 推送前在本机查到只有负责人能改的内容时回的失败 */
const submitLeadOnly = (problem) => `没有推送，改动留在工作区（没提交）：${problem}`;

/* ref file="../packages/collab-merge-check/templates/collab-auto-merge.yaml" lines="109-112" hash="6d049fdbf338" blob="38412d8b2e58" */
/* ref file="../packages/collab-merge-check/templates/collab-auto-merge.yaml" lines="114-118" hash="ae6fdd3a338f" blob="38412d8b2e58" */
/* ref file="../packages/collab-merge-check/templates/collab-auto-merge.yaml" lines="129-129" hash="a183cc957424" blob="38412d8b2e58" */
/** 执行器打回时在合并请求上的留言（压成一行），留完就关掉合并请求；合并请求已经关了的任务不处理 */
const rejectComment = (problem) => `没有合并（检查的是提交 …）：- ${problem} 这个合并请求已关闭，改动已退回提交人的工作区；改好后重新提交审核。`;

/* ref file="../plugins/collab/src/collab-repo/submit/submit.ts" lines="33-33" hash="2edd7fcd1d95" blob="92a88843de16" */
/* ref file="../plugins/collab/src/collab-repo/submit/submit.ts" lines="161-171" hash="1b71d9f90dfc" blob="92a88843de16" */
/** collab.submit 推送后每 2 秒查一次合并请求，最多等 3 分钟；被打回、等不到结论时回的失败 */
const submitRejected = (n) => `没有合并：合并请求 #${n} 被关闭，改动退回工作区（没提交）。原因：`;
const submitTimedOut = (n) => `执行器 180 秒内没有给结论，NAS 上的执行器可能没在运行：已关掉合并请求 #${n}，改动退回工作区（没提交）。告诉负责人去看执行器，好了再提交审核`;
/* ref file="../plugins/collab/src/collab-repo/submit/submit.ts" lines="73-75" hash="34e0e2a97753" blob="92a88843de16" */
const mergeConflicted = `把 origin/main 合进来有冲突，没有推送；冲突标记留在这些文件里（网站顶部的提示栏也会列出来）：${conflictedRecord} 让 AI 按两边的意思改好，再运行 collab.submit`;

/* ref file="../plugins/collab/src/collab-repo/sync/sync.ts" lines="14-21" hash="93531a0be8ef" blob="b434a84b1ae2" */
/** 自动同步只快进，不能快进时网站提示栏里列出的原因 */
const syncBlockedByMerge = '提交审核时把 main 合进来出了冲突，还没改好：让 AI 改好冲突、再提交审核';

/* ref file="../plugins/collab/src/pane/browser/projects.ts" lines="35-45" hash="1e6aad6a993c" blob="e64a309a01c7" */
/** 协作窗格里一个项目那一行的通知标签：各组几条和网站顶部的提示栏一样，协作仓组有通知标红，只有另两组的标黄 */
const paneChip = {
  collabRepo: (n) => `协作仓 ${n} 条`,
  otherRepos: (n) => `别的仓 ${n} 条`,
};

/**
 * 提交图里的提交说明：插件提交审核时按带了什么写（同 cmd 里的提交命令）；把 main 合进来时是 git 的默认说明；
 * 执行器在 Gitea 上合并时是 Gitea 的合并说明（后面还跟着「from <主题> into main」，图里省掉），其中的标题是 Gitea 建合并请求时
 * 取推上来的那个提交说明的第一行（推送没带 title 选项），所以推上去的是合 main 的合并提交时，标题就是 git 的合并说明
 */
const msg = {
  base: 'main 上原有的提交',
  records: (who) => `${who} 的协作记录`,
  pages: (who) => `${who} 的页面改动`,
  both: (who) => `${who} 的协作记录与页面改动`,
  pullMerge: (title, n) => `Merge pull request '${title}' (#${n})`,
  mainMerge: "Merge remote-tracking branch 'origin/main'",
};

/** 项目里别的仓（资料库）没有执行器：成员从 main 开分支改、推这条分支，再经 gitea.http 开合并请求，负责人合并之后快进 main */
const otherRepoName = 'datasheets';
const otherRepoBranch = 'manual-note';
const otherRepoCommit = '补一处手册说明';
const otherRepo = {
  name: otherRepoName,
  commit: otherRepoCommit,
  pull: 'git pull --ff-only',
  switchBranch: `git switch -c ${otherRepoBranch}`,
  push: `git push -u origin ${otherRepoBranch}`,
  openPull: `POST /repos/<主人>/${otherRepoName}/pulls {"head":"${otherRepoBranch}","base":"main","title":"${otherRepoCommit}"}`,
};

/* ref file="../packages/collab-model/src/notification-model/notification-text.ts" lines="16-18" hash="9cc6c21f0a2e" blob="db1dda751140" */
/* ref file="../packages/collab-model/src/notification-model/notification-text.ts" lines="20-21" hash="b838344072f3" blob="db1dda751140" */
/* ref file="../packages/collab-model/src/notification-model/notification-text.ts" lines="22-23" hash="6bff63130321" blob="db1dda751140" */
/* ref file="../packages/collab-model/src/notification-model/notification-text.ts" lines="24-25" hash="5745de528858" blob="db1dda751140" */
/* ref file="../packages/collab-model/src/notification-model/notification-text.ts" lines="30-31" hash="05bd1a260c3b" blob="db1dda751140" */
/* ref file="../packages/collab-model/src/notification-model/notification-text.ts" lines="34-37" hash="9a1c9232249f" blob="db1dda751140" */
/* ref file="../packages/collab-model/src/notification-model/notification-text.ts" lines="40-41" hash="a01e2f4d09e7" blob="db1dda751140" */
/**
 * 网站顶部提示栏里通知的短句（数据模型包的通知模型按 kind 写）：协作仓组的没提交审核的文件、合 main 的冲突、提交审核失败、没能自动同步、
 * 记录读不对；别的仓组的未推送、未拉取，以及负责人那里等审阅的合并请求（仓、编号、合并请求的标题、开它的人的显示名）
 */
const notificationSentences = {
  unsubmittedRecords: (n) => `本机有 ${n} 个文件还没提交审核（记录 ${n} 个）`,
  conflicts: (n) => `提交审核合 main 出了冲突，${n} 个文件还没改好`,
  submitFailure: '上次提交审核没成功',
  syncProblem: '没能自动同步 main 上的新改动',
  recordProblem: (file) => `${file} 读不对`,
  unpushed: (repo, n) => `${repo} 有 ${n} 个提交还没推送`,
  unpulled: (repo, n) => `${repo} 服务器上有 ${n} 个新提交还没拉下来`,
  otherRepoPull: (repo, n, pullTitle) => `${repo} #${n}「${pullTitle}」等你审阅（${actors.a.name} 开的）`,
};

/* ref file="../plugins/collab/src/collab-repo/submit/submit.ts" lines="56-61" hash="869f4ceed6ed" blob="92a88843de16" */
/* ref file="../plugins/collab/src/collab-repo/submit/submit-checks.ts" lines="25-29" hash="50b1deefe8fe" blob="0ba0d2de239f" */
/* ref file="../packages/collab-site/src/journal-files.ts" lines="9-20" hash="d1fd8ca9c9a1" blob="e2fd9853a7ad" */
/** 站点检查查到日志页的文件名不是真实存在的日期时，collab.submit 回的失败 */
const siteRejected = 'site/ 的站点检查不过，没有提交：\nsite/  journal/2026-09-31.mdx：2026-09-31 不是真实存在的日期';

/* ref file="../packages/collab-model/src/task-model/records.ts" lines="40-50" hash="e3475e02d0b4" blob="e77a18193cd2" */
/* ref file="../packages/collab-model/src/task-model/records.ts" lines="144-147" hash="56c289f533b2" blob="e77a18193cd2" */
const conflictFile = {
  title: conflictedRecord,
  lines: [
    '{',
    '  "id": "20260926101500-k2m9q4t",',
    '  "type": "task",',
    `  "author": "${actors.b.id}",`,
    '<<<<<<< HEAD',
    '  "status": "done",',
    '=======',
    '  "status": "doing",',
    '>>>>>>> origin/main',
    '  "title": "核算纹波",',
    `  "owner": "${A}"`,
    '}',
  ],
  highlight: [5, 9],
};

/** 提交，按出现的先后排；by 决定圆点的颜色：base 是 main 上原有的，bot 是执行器 collab-bot 合的 */
const commit = (id, by, parents, message) => ({ id, by, parents, message });
const base = commit('a1', 'base', [], msg.base);
const bob = actors.a.id;
const carol = actors.b.id;
const admin = actors.lead.id;

/** 每种情况开始时：Gitea 的 main、两人的本地 main 与 origin/main 都在 a1，工作区干净 */
const start = { gitea: { main: 'a1' }, a: { main: 'a1', origin: 'a1' }, b: { main: 'a1', origin: 'a1' } };

/** 给一串事件逐条配上这一步各台机器的变化：几种情况事件不同、git 的变化相同时共用一份 */
const withChanges = (events, changes) => events.map((event, index) => ({ ...event, at: changes[index] }));

/**
 * carol 先合并 #6；bob 提交时落后 main，先把 main 合进来、推这个合并提交，执行器合并 #7；两人的工作台都快进到 main。
 * 两人各提交一次、改的不是同一个文件的几种情况都是这样变的
 */
const twoSubmitters = {
  machines: ['gitea', 'a', 'b'],
  commits: [
    base,
    commit('q6', 'carol', ['a1'], msg.records(carol)),
    commit('m6', 'bot', ['a1', 'q6'], msg.pullMerge(msg.records(carol), 6)),
    commit('p7', 'bob', ['a1'], msg.records(bob)),
    commit('s7', 'bob', ['p7', 'm6'], msg.mainMerge),
    commit('m7', 'bot', ['m6', 's7'], msg.pullMerge(msg.mainMerge, 7)),
  ],
  changes: [
    { b: { main: 'q6' }, gitea: { pulls: { 6: 'q6' } } },
    { gitea: { main: 'm6', pulls: { 6: null } } },
    { a: { main: 's7', origin: 'm6' } },
    { gitea: { pulls: { 7: 's7' } } },
    { gitea: { main: 'm7', pulls: { 7: null } } },
    { a: { main: 'm7', origin: 'm7' }, b: { main: 'm7', origin: 'm7' } },
  ],
};

/** @type {Case[]} */
export const cases = [
  {
    id: 'once',
    label: '提交一次',
    outcome: 'clean',
    text: '最常见的一种。提交审核一直等到执行器给结论，合并了才回执。执行器按「合并提交」方式合并，bob 的提交原样进了 main，所以自动同步时 git 认得出它，直接快进，工作区的文件一个字不变。合并推来协作仓的 push 消息，bob 的插件取回协作仓时自动做这一步，不用让 AI 做什么。',
    machines: ['gitea', 'a'],
    commits: [base, commit('p7', 'bob', ['a1'], msg.records(bob)), commit('m7', 'bot', ['a1', 'p7'], msg.pullMerge(msg.records(bob), 7))],
    events: [
      {
        who: 'a',
        what: `在网站的任务页上把一条任务改成已完成，又建了一条新任务：collab/ 里改了一个文件、多了一个文件，还没提交。插件监视着协作仓，顶部提示栏「协作仓」组里出现「${notificationSentences.unsubmittedRecords(2)}」，提交以后消失。`,
        at: { a: { work: 'collab/ 改了 1 个文件、多了 1 个文件，没提交' } },
      },
      {
        who: 'a',
        what: `让 AI 提交审核（collab.submit）。插件先取回远端、在本机校验有没有新的格式问题，再在本地 main 上把 collab/ 与 site/ 的改动一起提交（这次只有记录，提交说明是「${msg.records(bob)}」）。本地 main 不落后 origin/main，不用把 main 合进来，直接推到 refs/for/main；Gitea 用推上来的提交建合并请求 #7。插件接着每 2 秒查一次 #7。`,
        cmd: cmd.push,
        pull: { n: 7, state: 'open', note: '开着' },
        at: { a: { main: 'p7', work: null }, gitea: { pulls: { 7: 'p7' } } },
      },
      {
        who: 'runner',
        what: 'Gitea 给执行器派任务。执行器取回 main 和 #7 的提交，运行合并检查包：没有冲突、没改只有负责人能改的内容，以 collab-bot 按「合并提交」方式合并。记录格式 bob 的插件提交前已经在本机查过，执行器不查。推送后十秒上下。',
        cmd: cmd.check(bob),
        pull: { n: 7, state: 'merged', note: '已合并' },
        at: { gitea: { main: 'm7', pulls: { 7: null } } },
      },
      {
        who: 'a',
        what: 'collab.submit 查到 #7 合并了，回执 { commit, siteFiles, siteTypecheck, pull }，pull 是 { number: 7, url }。本地 main 不在这一步动。',
      },
      {
        who: 'a',
        what: '合并推来协作仓的 push 消息，bob 的插件等 2 秒后取回协作仓，origin/main 到了 m7；自动同步只做快进，本地 main 上的提交已经在 main 里，快进到 m7。合进去了没有要处理的，提示栏里不出现。',
        cmd: cmd.fastForward,
        at: { a: { main: 'm7', origin: 'm7' } },
      },
    ],
  },
  {
    id: 'after-merge',
    label: '合并后还没自动同步又提交',
    outcome: 'clean',
    text: '合并请求合并或关闭之后再推同一个主题，Gitea 新建一个。提交审核总是先把 origin/main 合进来再推，所以先自动同步后提交、还没自动同步就提交都行，推上去的相对 main 只多还没进 main 的改动。',
    machines: ['gitea', 'a'],
    commits: [
      base,
      commit('p7', 'bob', ['a1'], msg.records(bob)),
      commit('m7', 'bot', ['a1', 'p7'], msg.pullMerge(msg.records(bob), 7)),
      commit('p8', 'bob', ['p7'], msg.records(bob)),
      commit('s8', 'bob', ['p8', 'm7'], msg.mainMerge),
      commit('m8', 'bot', ['m7', 's8'], msg.pullMerge(msg.mainMerge, 8)),
    ],
    events: [
      { who: 'a', what: '提交审核，Gitea 建 #7。', cmd: cmd.push, pull: { n: 7, state: 'open', note: '开着' }, at: { a: { main: 'p7' }, gitea: { pulls: { 7: 'p7' } } } },
      {
        who: 'runner',
        what: '合并 #7；bob 的 collab.submit 查到合并了，回执。',
        pull: { n: 7, state: 'merged', note: '已合并' },
        at: { gitea: { main: 'm7', pulls: { 7: null } } },
      },
      {
        who: 'a',
        what: '合并的推送消息还没让插件取回协作仓（比如工作台这时没连上实时推送），本地 main 还在 p7。bob 又建了一条任务，提交审核：插件先取回远端，origin/main 到了 m7；新提交接在 p7 后面，本地 main 落后 origin/main，把它合进来。p7 已经在 main 里，合出来的结果相对 main 只多新任务这一个文件。',
        cmd: cmd.mergeMain,
        at: { a: { main: 's8', origin: 'm7' } },
      },
      {
        who: 'a',
        what: '推到 refs/for/main。#7 已经关了，Gitea 新建 #8，指向这个合并提交。',
        cmd: cmd.push,
        pull: { n: 8, state: 'open', note: '开着' },
        at: { gitea: { pulls: { 8: 's8' } } },
      },
      { who: 'runner', what: '检查 #8，合并。', cmd: cmd.check(bob), pull: { n: 8, state: 'merged', note: '已合并' }, at: { gitea: { main: 'm8', pulls: { 8: null } } } },
      { who: 'a', what: 'collab.submit 回执；合并推来协作仓的 push 消息，插件取回协作仓，快进。', cmd: cmd.fastForward, at: { a: { main: 'm8', origin: 'm8' } } },
    ],
  },
  {
    id: 'behind',
    label: '别人的先合进 main',
    outcome: 'clean',
    text: '提交审核时本地 main 落后 origin/main，插件先在本地把 origin/main 合进来再推，推上去的是一个合并提交，执行器检查的就是合好的结果。提交前的本机校验只和本地 main 与 origin/main 的分叉点比：main 上本来就有的问题、bob 还没拿到的那条任务，都不算 bob 的。两人改的不是同一个文件，git 合并时互不相干。',
    machines: twoSubmitters.machines,
    commits: twoSubmitters.commits,
    events: withChanges(
      [
        { who: 'b', what: '建了一条任务，提交审核，Gitea 建 #6。', pull: { n: 6, state: 'open', note: '开着' } },
        { who: 'runner', what: '合并 #6；carol 的 collab.submit 查到合并了，回执。', pull: { n: 6, state: 'merged', note: '已合并' } },
        {
          who: 'a',
          what: '也建了一条任务，提交审核。插件先取回远端，origin/main 到了 m6；在本地 main 上提交，新提交接在 a1 后面，里面没有 carol 那条任务。本地 main 落后 origin/main，就把它合进来：改的不是同一个文件，git 合出一个合并提交，carol 的任务这时出现在 bob 的工作区。',
          cmd: cmd.mergeMain,
        },
        { who: 'a', what: '推到 refs/for/main，Gitea 建 #7，指向这个合并提交，标题取它的提交说明。插件每 2 秒查一次 #7。', cmd: cmd.push, pull: { n: 7, state: 'open', note: '开着' } },
        { who: 'runner', what: '检查 #7：合进 main 之后 carol 的任务还在，bob 只多了一条自己建的任务，合并。', cmd: cmd.check(bob), pull: { n: 7, state: 'merged', note: '已合并' } },
        {
          who: 'a',
          what: 'collab.submit 回执。合并推来协作仓的 push 消息，插件取回协作仓：本地 main 上的提交都已经在 main 里，快进。carol 的工作台收到同一条消息，也快进到 main。',
          cmd: cmd.fastForward,
        },
      ],
      twoSubmitters.changes,
    ),
  },
  {
    id: 'rejected',
    label: '推送后 main 又动了',
    outcome: 'rejected',
    text: '执行器只查两条安全上的事，记录格式与站点提交人在本机已经查过。所以打回多半是推送之后、检查之前别人的改动先进了 main，两边合进去有冲突。执行器打回一个合并请求，是在上面留言写明原因、再关掉它。提交人的 collab.submit 一直在等结论，查到关了、没合并，就把本地 main 退回推送时的 origin/main，这次的改动回到工作区、变回没提交的改动，回失败并附上那条留言。再提交审核时照常先把 main 合进来，冲突在本机改。',
    machines: ['gitea', 'a'],
    commits: [
      base,
      commit('q6', 'carol', ['a1'], msg.records(carol)),
      commit('p7', 'bob', ['a1'], msg.records(bob)),
      commit('m6', 'bot', ['a1', 'q6'], msg.pullMerge(msg.records(carol), 6)),
      commit('p8', 'bob', ['a1'], msg.records(bob)),
      commit('s8', 'bob', ['p8', 'm6'], msg.mainMerge),
      commit('m8', 'bot', ['m6', 's8'], msg.pullMerge(msg.mainMerge, 8)),
    ],
    events: [
      {
        who: 'b',
        what: 'carol 把自己建的任务「核算纹波」改成进行中（doing），提交审核，Gitea 建 #6（图里不画 carol 的电脑）。',
        pull: { n: 6, state: 'open', note: '开着' },
        at: { gitea: { pulls: { 6: 'q6' } } },
      },
      {
        who: 'a',
        what: '几乎同时 bob 把同一条任务改成已完成（done），提交审核：#6 还没合，本地 main 不落后，本机检查都过，提交、推送，Gitea 建 #7。',
        cmd: cmd.push,
        pull: { n: 7, state: 'open', note: '开着' },
        at: { a: { main: 'p7' }, gitea: { pulls: { 7: 'p7' } } },
      },
      {
        who: 'runner',
        what: '执行器先合并 #6：main 上这条任务成了 doing。',
        pull: { n: 6, state: 'merged', note: '已合并' },
        at: { gitea: { main: 'm6', pulls: { 6: null } } },
      },
      {
        who: 'runner',
        what: `再检查 #7：合进 main 时这条任务的 status 那一行冲突。执行器在 #7 上留言「${rejectComment(conflictProblem)}」，再关掉 #7。`,
        cmd: cmd.check(bob),
        pull: { n: 7, state: 'rejected', note: '已打回' },
        at: { gitea: { pulls: { 7: null } } },
      },
      {
        who: 'a',
        what: `collab.submit 查到 #7 关了、没合并，读出最后一条留言。本地 main 退回推送时的 origin/main，这次的提交不再有分支指着它，它的内容还在工作区里；回失败「${submitRejected(7)}」，后面接执行器的那条留言。插件同时记下这句原话，写成一条 submit-failure 通知推给 bob 的网站：顶部提示栏「协作仓」组里列成「${notificationSentences.submitFailure}」，下面是原话，下一次提交审核成功就消失；bob 要是放弃这次改动、把它撤掉，下一次检查自动同步之后也消失。`,
        cmd: cmd.returnToWork,
        at: { a: { main: 'a1', work: '任务的改动回到工作区，没提交' } },
      },
      {
        who: 'a',
        what: `#6 合并时推来了协作仓的 push 消息，bob 的插件那时就取回了协作仓，origin/main 到了 m6；本地 main 上还有等 #7 结论的 p7，自动同步不动，提示栏里出现「${notificationSentences.syncProblem}」，原因是本地 main 上有还没进 main 的提交。#7 关掉推来的是协作仓合并请求的消息，插件不处理。现在工作区里没提交的改动和 m6 改的是同一个文件，下一次自动同步时（别人又合进来，或调 collab.check）快进也做不了，这一条留着，原因换成「碰到了同一个文件」和 git 的原话。`,
        at: { a: { origin: 'm6' } },
      },
      {
        who: 'a',
        what: '让 AI 再提交审核：在本地 main 上提交，把 origin/main 合进来，status 那一行冲突，不推送（和「两人改了同一条」一样）。两人商量定为 done，AI 删掉冲突标记，再提交审核时完成这次合并、推送，Gitea 建 #8。',
        cmd: cmd.finishMerge,
        pull: { n: 8, state: 'open', note: '开着' },
        at: { a: { main: 's8', work: null }, gitea: { pulls: { 8: 's8' } } },
      },
      { who: 'runner', what: '检查 #8：合进 main 没有冲突，合并。', cmd: cmd.check(bob), pull: { n: 8, state: 'merged', note: '已合并' }, at: { gitea: { main: 'm8', pulls: { 8: null } } } },
      { who: 'a', what: 'collab.submit 回执；合并推来协作仓的 push 消息，插件取回协作仓，快进。', cmd: cmd.fastForward, at: { a: { main: 'm8', origin: 'm8' } } },
    ],
  },
  {
    id: 'same-record',
    label: '两人改了同一条',
    outcome: 'conflict',
    text: '两人把同一条记录的同一个字段改成了不同的值，git 按行合并时这一处冲突。冲突出在后提交的人提交审核、把 origin/main 合进来的那一步：插件不推送，冲突标记留在文件里，不替人选；人配合 AI 改好，再提交审核时完成这次合并、推上去。两人改的是同一条记录上下相邻的两个字段时，git 也这样报冲突。推送之后、执行器检查之前 main 又动了、合不进时，执行器打回，原因是「' + conflictProblem + '」，改动退回工作区，再提交审核时照样先把 main 合进来。',
    machines: ['gitea', 'a', 'b'],
    commits: [
      base,
      commit('q6', 'carol', ['a1'], msg.records(carol)),
      commit('m6', 'bot', ['a1', 'q6'], msg.pullMerge(msg.records(carol), 6)),
      commit('p7', 'bob', ['a1'], msg.records(bob)),
      commit('s7', 'bob', ['p7', 'm6'], msg.mainMerge),
      commit('m7', 'bot', ['m6', 's7'], msg.pullMerge(msg.mainMerge, 7)),
    ],
    events: [
      {
        who: 'b',
        what: '把自己建的任务「核算纹波」改成进行中（doing），提交审核，Gitea 建 #6。',
        pull: { n: 6, state: 'open', note: '开着' },
        at: { b: { main: 'q6' }, gitea: { pulls: { 6: 'q6' } } },
      },
      { who: 'runner', what: '合并 #6。', pull: { n: 6, state: 'merged', note: '已合并' }, at: { gitea: { main: 'm6', pulls: { 6: null } } } },
      {
        who: 'a',
        what: `把这条任务改成已完成（done），让 AI 提交审核。插件先取回远端，origin/main 到了 m6；本机校验只查格式，通过，在本地 main 上提交。本地 main 落后 origin/main，把它合进来：git 在这条任务的 status 那一行报冲突，冲突标记留在文件里，合并停在没做完的状态。插件不推送，回失败「${mergeConflicted}」。`,
        cmd: cmd.mergeMain,
        showFile: true,
        at: { a: { main: 'p7', origin: 'm6', work: '合并到一半：1 个文件有冲突标记' } },
      },
      {
        who: 'a',
        what: `bob 网站顶部提示栏的「协作仓」组里有三条：「${notificationSentences.unsubmittedRecords(1)}」；「${notificationSentences.conflicts(1)}」，下面列着冲突的文件；「${notificationSentences.recordProblem(conflictedRecord)}」，下面的原话写着第 5、7、9 行是冲突标记。上次提交审核的失败就是这个冲突，不另列「${notificationSentences.submitFailure}」；合并没完成时自动同步不动，原因「${syncBlockedByMerge}」也是这个冲突，不另列「${notificationSentences.syncProblem}」。协作窗格里 bob 这个项目那一行标红「${paneChip.collabRepo(3)}」，点它打开网站；点那一行的「交给 AI 处理」，这三条一起写成提示词交给 AI。`,
      },
      {
        who: 'a',
        what: '两人商量定为 done，AI 删掉冲突标记，再提交审核：插件发现上次合 main 留下的合并还没完成，就完成这次合并。合并提交里已经有 main 的全部改动，不用再合。',
        cmd: cmd.finishMerge,
        at: { a: { main: 's7', work: null } },
      },
      { who: 'a', what: '推到 refs/for/main，Gitea 建 #7，指向这个合并提交。', cmd: cmd.push, pull: { n: 7, state: 'open', note: '开着' }, at: { gitea: { pulls: { 7: 's7' } } } },
      { who: 'runner', what: '检查 #7：合进 main 没有冲突，合并。', cmd: cmd.check(bob), pull: { n: 7, state: 'merged', note: '已合并' }, at: { gitea: { main: 'm7', pulls: { 7: null } } } },
      {
        who: 'a',
        what: 'collab.submit 回执；合并推来协作仓的 push 消息，插件取回协作仓，快进。carol 的工作台收到同一条消息，也快进，任务在两边都是 done。',
        cmd: cmd.fastForward,
        at: { a: { main: 'm7', origin: 'm7' }, b: { main: 'm7', origin: 'm7' } },
      },
    ],
    file: conflictFile,
  },
  {
    id: 'two-records',
    label: '改了不同的两条',
    outcome: 'clean',
    text: '一条记录一个文件：两人改的是两条不同的记录，就是两个不同的文件，后提交的人把 main 合进来时互不相干。',
    machines: twoSubmitters.machines,
    commits: twoSubmitters.commits,
    events: withChanges(
      [
        { who: 'b', what: '把任务「拓扑再核一下」改成已完成，提交审核，Gitea 建 #6。', pull: { n: 6, state: 'open', note: '开着' } },
        { who: 'runner', what: '合并 #6。', pull: { n: 6, state: 'merged', note: '已合并' } },
        { who: 'a', what: '同时把任务「电容取多大」改成已完成，提交审核：提交后本地 main 落后 origin/main，把它合进来，改的是另一个文件，不冲突。', cmd: cmd.mergeMain },
        { who: 'a', what: '推到 refs/for/main，Gitea 建 #7。', cmd: cmd.push, pull: { n: 7, state: 'open', note: '开着' } },
        { who: 'runner', what: '检查 #7：没有冲突，合并。', cmd: cmd.check(bob), pull: { n: 7, state: 'merged', note: '已合并' } },
        { who: 'a', what: 'collab.submit 回执；合并推来协作仓的 push 消息，两人的插件都取回协作仓、快进：两条任务都是已完成。', cmd: cmd.fastForward },
      ],
      twoSubmitters.changes,
    ),
  },
  {
    id: 'new-vs-old',
    label: '建新任务时别人改了旧的',
    outcome: 'clean',
    text: '新记录写成新文件，改记录只改它自己的文件，所以「别人刚把你的任务改成已完成、你正好又建了一条」不会冲突。',
    machines: twoSubmitters.machines,
    commits: twoSubmitters.commits,
    events: withChanges(
      [
        { who: 'b', what: '把 bob 上一条任务改成已完成，提交审核，Gitea 建 #6。', pull: { n: 6, state: 'open', note: '开着' } },
        { who: 'runner', what: '合并 #6。', pull: { n: 6, state: 'merged', note: '已合并' } },
        { who: 'a', what: '同时建了一条新任务，是 collab/records/ 下的一个新文件，提交审核：提交后把 main 合进来，不冲突。', cmd: cmd.mergeMain },
        { who: 'a', what: '推到 refs/for/main，Gitea 建 #7。', cmd: cmd.push, pull: { n: 7, state: 'open', note: '开着' } },
        { who: 'runner', what: '检查 #7，合并。', cmd: cmd.check(bob), pull: { n: 7, state: 'merged', note: '已合并' } },
        { who: 'a', what: 'collab.submit 回执；两人的插件取回协作仓后都快进：旧任务已完成，新任务也在。', cmd: cmd.fastForward },
      ],
      twoSubmitters.changes,
    ),
  },
  {
    id: 'page',
    label: '加一页带组件的页面',
    outcome: 'clean',
    text: '页面、组件、评论和记录用同一条命令提交：collab.submit 把 site/ 的改动和 collab/ 一起提交。site/ 有改动时，提交前在本机做站点检查（人员列表、评论、日志页的文件名）和类型检查（页面与组件编译不编译得过），把 main 合进来之后再做一遍站点检查；执行器只查冲突与只有负责人能改的内容。页面、组件、评论谁都能改，检查通过就合并。',
    machines: ['gitea', 'a', 'b'],
    commits: [base, commit('p7', 'bob', ['a1'], msg.both(bob)), commit('m7', 'bot', ['a1', 'p7'], msg.pullMerge(msg.both(bob), 7))],
    events: [
      {
        who: 'a',
        what: '让 AI 写了一页 site/content/plan.mdx，它用的组件放在 site/content/plan/ripple-chart.tsx，又建了一条任务指向这一页。三处改动都还没提交。',
        at: { a: { work: 'site/ 多了 2 个文件、collab/ 多了 1 个，没提交' } },
      },
      {
        who: 'a',
        what: '让 AI 提交审核。site/ 有改动，插件先做站点检查，再在 site/ 里运行 typecheck 脚本（react-router typegen && tsc --noEmit），页面里的 import 找不找得到、组件的类型对不对都在这一步查出来；都过才提交，一次提交里既有记录又有页面。',
        cmd: cmd.commitBoth,
        at: { a: { main: 'p7', work: null } },
      },
      { who: 'a', what: '本地 main 不落后，推到 refs/for/main，Gitea 建 #7。', cmd: cmd.push, pull: { n: 7, state: 'open', note: '开着' }, at: { gitea: { pulls: { 7: 'p7' } } } },
      {
        who: 'runner',
        what: '执行器检查：没有冲突；改的是记录与 site/content/，谁都能改。以 collab-bot 合并。',
        cmd: cmd.check(bob),
        pull: { n: 7, state: 'merged', note: '已合并' },
        at: { gitea: { main: 'm7', pulls: { 7: null } } },
      },
      { who: 'a', what: 'collab.submit 回执，siteFiles 是 2；合并推来协作仓的 push 消息，插件取回协作仓，快进。', cmd: cmd.fastForward, at: { a: { main: 'm7', origin: 'm7' } } },
      { who: 'b', what: '同一条消息让 carol 的插件也取回协作仓、快进，新页面出现在 carol 的网站上。', cmd: cmd.fastForward, at: { b: { main: 'm7', origin: 'm7' } } },
    ],
  },
  {
    id: 'add-library',
    label: '加一个库',
    outcome: 'clean',
    text: '加库、升级库、删库谁都能改：成员在 site/ 里 pnpm add，site/package.json 的依赖里多一项普通版本号范围，锁文件跟着变，和页面一起提交审核，检查通过就合并。别人的工作台快进进来时看到依赖文件变了，自动在 site/ 里装依赖、重启站点。两人同时加库时锁文件会冲突，出在后提交的人把 main 合进来那一步，不推送：用 main 那份锁文件、在 site/ 里重新运行一次 pnpm install，再提交审核。',
    machines: ['gitea', 'a', 'b'],
    commits: [base, commit('p7', 'bob', ['a1'], msg.pages(bob)), commit('m7', 'bot', ['a1', 'p7'], msg.pullMerge(msg.pages(bob), 7))],
    events: [
      {
        who: 'a',
        what: `页面要画图，让 AI 在 site/ 里装一个图表库，再改这一页的组件 site/content/plan/ripple-chart.tsx 用它：site/package.json 的 dependencies 多了 "${chartLibrary.name}": "${chartLibrary.range}"，site/pnpm-lock.yaml 跟着变。`,
        cmd: `pnpm add ${chartLibrary.name}`,
        at: { a: { work: 'site/ 改了 3 个文件（含依赖），没提交' } },
      },
      {
        who: 'a',
        what: '提交审核：引用的包在 site/package.json 的依赖里，站点检查与类型检查都过；推送前查只有负责人能改的内容，依赖里多了一项写普通版本号的，不算。提交、推送，Gitea 建 #7。',
        cmd: cmd.push,
        pull: { n: 7, state: 'open', note: '开着' },
        at: { a: { main: 'p7', work: null }, gitea: { pulls: { 7: 'p7' } } },
      },
      {
        who: 'runner',
        what: '合并检查同样放行，以 collab-bot 合并 #7。',
        cmd: cmd.check(bob),
        pull: { n: 7, state: 'merged', note: '已合并' },
        at: { gitea: { main: 'm7', pulls: { 7: null } } },
      },
      {
        who: 'a',
        what: 'collab.submit 回执；合并推来协作仓的 push 消息，插件取回协作仓，快进。bob 自己已经装过这个库，快进前后依赖文件没变，不再装。',
        cmd: cmd.fastForward,
        at: { a: { main: 'm7', origin: 'm7' } },
      },
      {
        who: 'b',
        what: '同一条消息让 carol 的插件也取回协作仓、快进；快进进来的改动动了 site/package.json 与锁文件，接着在 site/ 里 pnpm install、重启站点，这一页在 carol 的网站上画得出图。',
        cmd: cmd.fastForward,
        at: { b: { main: 'm7', origin: 'm7' } },
      },
    ],
  },
  {
    id: 'scripts',
    label: '改了 scripts',
    outcome: 'lead-only',
    text: 'site/package.json 里依赖以外的键（scripts 等）、站点根目录下的配置文件、装包设置、执行器工作流、人员列表 site/people.json 只有项目负责人（Gitea 上协作仓的协作者）能改，每个人只给自己那一项加减身份码除外：gwb-docsite 在每个人的电脑上运行 pnpm dev，改了前几样就是在所有人的电脑上执行代码，后两样改的是合并规则。成员提交审核时，插件把 main 合进来之后、推送之前，用执行器同一项检查比一遍，改到了就不推送，改动退回工作区；项目负责人提交的，本机和执行器都放行。',
    machines: ['gitea', 'a'],
    commits: [base, commit('c7', 'admin', ['a1'], msg.pages(admin)), commit('m7', 'bot', ['a1', 'c7'], msg.pullMerge(msg.pages(admin), 7))],
    events: [
      {
        who: 'a',
        what: '想让站点换一个端口，让 AI 改了 site/package.json 里 scripts 的 dev。',
        at: { a: { work: 'site/package.json 改了，没提交' } },
      },
      {
        who: 'a',
        what: `提交审核：站点检查与类型检查都过了，在本地 main 上提交；推送前查只有负责人能改的内容，插件读协作仓的协作者，bob 不在里面，不是项目负责人。本地 main 退回推送时的 origin/main，改动回到工作区，回失败「${submitLeadOnly(leadOnlyProblem([scriptsChange]))}」。没有推送，Gitea 上没有合并请求。`,
        cmd: cmd.returnToWork,
      },
      {
        who: 'a',
        what: 'bob 让 AI 把 site/package.json 退回 main 上的样子，把要改的端口告诉项目负责人。',
        cmd: restorePackageJson,
        at: { a: { work: null } },
      },
      {
        who: 'lead',
        what: '项目负责人在自己的电脑上做同样的改动，提交审核：推送前那项检查读协作仓的协作者，admin 在里面，放行；Gitea 建 #7（图里不画项目负责人的电脑）。',
        cmd: `git push origin HEAD:refs/for/main -o topic=${admin}`,
        pull: { n: 7, state: 'open', note: '开着' },
        at: { gitea: { pulls: { 7: 'c7' } } },
      },
      {
        who: 'runner',
        what: '执行器用机器人令牌读协作仓的协作者，作为 --leads 交给合并检查；提交人 admin 在里面，第二条放行；没有别的问题，合并 #7。',
        cmd: cmd.check(admin),
        pull: { n: 7, state: 'merged', note: '已合并' },
        at: { gitea: { main: 'm7', pulls: { 7: null } } },
      },
      {
        who: 'a',
        what: '合并推来协作仓的 push 消息，bob 的插件取回协作仓，快进；快进进来的改动动了 site/package.json，接着在 site/ 里装依赖、重启站点。',
        cmd: cmd.fastForward,
        at: { a: { main: 'm7', origin: 'm7' } },
      },
    ],
  },
  {
    id: 'runner-down',
    label: '执行器没在运行',
    outcome: 'timeout',
    text: '执行器是 NAS 上的一个程序，它停了，合并请求就一直开着，Gitea 把任务排着等它。collab.submit 推送后最多等 3 分钟，到时限还没结论就自己关掉合并请求，本地 main 退回、改动回到工作区，回失败叫提交人告诉负责人去看执行器（照管执行器的是项目负责人）。执行器重新运行起来后取走还在排队的任务，那些合并请求已经关了，就不处理；执行器好了以后重新提交审核。',
    machines: ['gitea', 'a'],
    commits: [
      base,
      commit('p7', 'bob', ['a1'], msg.records(bob)),
      commit('p8', 'bob', ['a1'], msg.records(bob)),
      commit('m8', 'bot', ['a1', 'p8'], msg.pullMerge(msg.records(bob), 8)),
    ],
    events: [
      {
        who: 'a',
        what: '建了一条任务，提交审核，Gitea 建 #7；插件每 2 秒查一次 #7。',
        cmd: cmd.push,
        pull: { n: 7, state: 'open', note: '开着' },
        at: { a: { main: 'p7' }, gitea: { pulls: { 7: 'p7' } } },
      },
      { who: 'runner', what: 'NAS 上的执行器没在运行，Gitea 派下的任务一直排着，没人检查、没人合并。' },
      {
        who: 'a',
        what: `3 分钟过去 #7 还开着。插件关掉 #7，本地 main 退回推送时的 origin/main，任务回到工作区；回失败「${submitTimedOut(7)}」。`,
        cmd: cmd.returnToWork,
        pull: { n: 7, state: 'closed', note: '插件已关闭' },
        at: { a: { main: 'a1', work: '任务回到工作区，没提交' }, gitea: { pulls: { 7: null } } },
      },
      {
        who: 'lead',
        what: 'bob 告诉项目负责人。项目负责人到 NAS 上把执行器重新运行起来；执行器取到排着的 #7 的任务，看到它已经关了，不处理。',
      },
      {
        who: 'a',
        what: '再提交审核。#7 已经关了，Gitea 新建 #8。',
        cmd: cmd.push,
        pull: { n: 8, state: 'open', note: '开着' },
        at: { a: { main: 'p8', work: null }, gitea: { pulls: { 8: 'p8' } } },
      },
      { who: 'runner', what: '检查 #8，合并。', cmd: cmd.check(bob), pull: { n: 8, state: 'merged', note: '已合并' }, at: { gitea: { main: 'm8', pulls: { 8: null } } } },
      { who: 'a', what: 'collab.submit 回执；合并推来协作仓的 push 消息，插件取回协作仓，快进。', cmd: cmd.fastForward, at: { a: { main: 'm8', origin: 'm8' } } },
    ],
  },
  {
    id: 'broken',
    label: '日志页的日期写错了',
    outcome: 'broken',
    text: '日志页的文件名就是日期，日历按它列出有日志的日子；有一个文件名不是真实存在的日期，日历页就报错打不开。所以 collab.submit 在本机就查：site/ 有改动时先做站点检查（人员列表、评论、日志页的文件名），不过就不提交，回执写明是哪个文件、错在哪；页面能不能编译由接着做的类型检查管。改好再提交；本地 main 落后时，把 main 合进来之后插件还会再做一遍站点检查。执行器不查站点。',
    machines: ['gitea', 'a'],
    commits: [base, commit('p7', 'bob', ['a1'], msg.pages(bob)), commit('m7', 'bot', ['a1', 'p7'], msg.pullMerge(msg.pages(bob), 7))],
    events: [
      {
        who: 'a',
        what: '让 AI 写当天的项目日志，它把文件名写成了 site/journal/2026-09-31.mdx，九月只有 30 天。',
        at: { a: { work: 'site/journal/ 多了 1 个文件，没提交' } },
      },
      { who: 'a', what: `让 AI 提交审核，插件拒绝：「${siteRejected}」。什么都没提交，也没推送。` },
      {
        who: 'a',
        what: 'AI 把文件改名成 site/journal/2026-09-30.mdx，再提交审核：站点检查与类型检查都过，Gitea 建 #7。',
        cmd: cmd.push,
        pull: { n: 7, state: 'open', note: '开着' },
        at: { a: { main: 'p7', work: null }, gitea: { pulls: { 7: 'p7' } } },
      },
      {
        who: 'runner',
        what: '执行器检查：没有冲突、没改只有负责人能改的内容，合并。',
        cmd: cmd.check(bob),
        pull: { n: 7, state: 'merged', note: '已合并' },
        at: { gitea: { main: 'm7', pulls: { 7: null } } },
      },
      { who: 'a', what: 'collab.submit 回执；合并推来协作仓的 push 消息，插件取回协作仓，快进。', cmd: cmd.fastForward, at: { a: { main: 'm7', origin: 'm7' } } },
    ],
  },
  {
    id: 'other-repo',
    label: '给资料库提改动',
    outcome: 'review',
    text: `资料库、代码仓是别的仓，按普通 git 仓管理，没有执行器：负责人（这个仓在 Gitea 上的协作者）直接推 main；别人推自己的分支、开合并请求，等负责人审阅，同意后由他的 AI 以合并提交合并。负责人网站顶部提示栏的「别的仓」组里列着别人开的，协作窗格那一行的「${paneChip.otherRepos('N')}」也算上它们。这里资料库的负责人就是 admin。两种仓的管法差在哪、别的仓日常怎么做，见「同一周在两个仓里干活」那一页。`,
    repo: otherRepo.name,
    machines: ['gitea', 'a'],
    commits: [base, commit('p3', 'bob', ['a1'], otherRepo.commit), commit('m3', 'admin', ['a1', 'p3'], msg.pullMerge(otherRepo.commit, 3))],
    events: [
      {
        who: 'a',
        what: `在资料库 ${otherRepo.name} 的 main 上先取回到最新，从 main 开一条分支，改好一处说明、提交。main 推不上去（只有负责人能推），所以小改动也开分支；本地 main 一直和服务器一样，图里只画 main。插件比的是 HEAD 和服务器上的同名分支，这条分支服务器上还没有，推上去以前提示栏「别的仓」组里有「${notificationSentences.unpushed(otherRepo.name, 1)}」。`,
        cmd: otherRepo.switchBranch,
      },
      { who: 'a', what: '推这条分支，提示栏里那一条消失；再让 AI 经 gitea.http 开一个合到 main 的合并请求。', cmd: `${otherRepo.push} · ${otherRepo.openPull}`, pull: { n: 3, state: 'review', note: '等负责人审阅' }, at: { gitea: { pulls: { 3: 'p3' } } } },
      {
        who: 'lead',
        what: `#3 开出来，「pr opened #3」的消息经实时推送到 admin 的工作台。插件重读这个仓：admin 是它的负责人（Gitea 上的协作者），#3 是别人开的、合到 main，写成一条 pull-to-review 通知推给 admin 的网站：顶部提示栏「别的仓」组 ${otherRepo.name} 那一行出现「${notificationSentences.otherRepoPull(otherRepo.name, 3, otherRepo.commit)}」，点了打开 Gitea；admin 协作窗格那一行标黄，没有别的事时写「${paneChip.otherRepos(1)}」。`,
      },
      {
        who: 'lead',
        what: '在协作窗格那一行点「交给 AI 处理」：提示词里写好了合并接口的调用，AI 读改动、整理摘要问 admin 合不合并；admin 同意后，AI 经 gitea.http 调 POST /repos/<主人>/datasheets/pulls/3/merge（请求体 {"Do":"merge"}），以合并提交合并 #3。合并后推来 push 与「pr closed #3」两条消息，admin 的插件取回这个仓、再重读它，#3 已经不开着，提示栏里那一条消失。',
        pull: { n: 3, state: 'merged', note: '负责人同意后合并' },
        at: { gitea: { main: 'm3', pulls: { 3: null } } },
      },
      {
        who: 'a',
        what: `合并推来这个仓的 push 消息：bob 的插件只取回这个仓，origin/main 到了合并提交，本地 main 不动。bob 还在推上去的分支上，它和服务器上的同名分支一样，提示栏里没有这个仓。`,
        at: { a: { origin: 'm3' } },
      },
      {
        who: 'a',
        what: `切回 main：本地 main 比服务器上的 main 少 p3 与合并提交两个，提示栏「别的仓」组里出现「${notificationSentences.unpulled(otherRepo.name, 2)}」。在协作窗格那一行点「交给 AI 处理」，AI 查清是落后、调 collab.repos.update（或自己在终端里 git pull --ff-only）：本地 main 快进到和服务器一样，这一条消失，再问 bob 要不要删掉那条分支。`,
        cmd: otherRepo.pull,
        at: { a: { main: 'm3' } },
      },
    ],
  },
];

/**
 * 一种情况推进到第 index 步（含）时各台机器的状态：从 start 起逐步叠上每一步的变化，值为 null 的去掉
 * @param {Case} item
 * @param {number} index
 * @returns {MachineStates}
 */
export function statesAt(item, index) {
  /** @type {MachineStates} */
  const states = structuredClone(start);
  for (const event of item.events.slice(0, index + 1)) {
    for (const [machine, change] of Object.entries(event.at ?? {})) {
      const state = (states[machine] ??= {});
      for (const [key, value] of Object.entries(change)) {
        if (key === 'pulls') {
          state.pulls = { ...state.pulls };
          for (const [n, head] of Object.entries(value)) {
            if (head === null) delete state.pulls[n];
            else state.pulls[n] = head;
          }
        } else if (value === null) delete state[key];
        else state[key] = value;
      }
    }
  }
  return states;
}
