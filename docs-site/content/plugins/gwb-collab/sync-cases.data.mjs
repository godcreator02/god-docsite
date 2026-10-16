/**
 * SyncCases（「gwb-collab：协作站插件」那一页「自动同步：只快进」一节）的全部数据，画面（sync-cases.tsx）只读这一份。
 * 取回之后 autoSyncCollab 先按固定顺序判不能快进的原因、都不是才 git merge --ff-only：这里摆六种情况各停在哪、
 * 停下后仓的样子与网站提示栏里出现什么。判定顺序照 status.ts 的 fastForwardObstacleOf，四条原因与 ff-only 失败的
 * 原话照 sync.ts 抄（ff-blocked 的原文后面还跟着 git 的报错原文，这里只抄第一句）；通知短句照 notification-text.ts 抄，
 * 哪些情况不列「没能自动同步」照 notifications-of.ts。分支名 draft、提交数 2、pin-test.mdx 是为讲解拼的例子，
 * 冲突的记录文件沿用提交审核组件的贯穿例子。
 */

/** 判定格从上往下问，停在这一格就不再往下；判定顺序与 fastForwardObstacleOf 一致 */

/* ref file="../plugins/collab/src/git/status.ts" lines="108-121" hash="bda5a5600d5f" blob="6b8e9eee9ade" */
export const gates = [
  { id: 'off-main', question: '不在 main 上？' },
  { id: 'no-origin-main', question: '仓里没有 origin/main？' },
  { id: 'conflict-unresolved', question: '合 main 的冲突还没改好？' },
  { id: 'local-ahead', question: '本地 main 领先于 origin/main？' },
]

/** 判定都过了走到底部这一格 */
export const mergeCommand = 'git merge --ff-only origin/main'

/** 快进进来动了哪些文件才算动了依赖、动了依赖先做什么 */

/* ref file="../plugins/collab/src/collab-repo/sync/sync.ts" lines="8-8" hash="b340874db258" blob="64df3cef406d" */
export const siteDependencyFiles = ['site/package.json', 'site/pnpm-lock.yaml']

/* ref file="../plugins/collab/src/site-process/dependencies.ts" lines="61-72" hash="51a30a664b34" blob="7911e32e3d15" */
export const dependencyNote = '快进进来的改动动了 site/package.json 或 site/pnpm-lock.yaml：站点在运行就先停，在 site/ 里 pnpm install，装完按常驻的规矩再启动（装失败站点保持停着，报错里写明怎么启动）'

/** 四条原因的原话，照 sync.ts 的 whyNotFastForward 抄 */

/* ref file="../plugins/collab/src/collab-repo/sync/sync.ts" lines="10-21" hash="7742da2155c8" blob="64df3cef406d" */
export const reasons = {
  offMain: '当前在分支 draft 上：协作仓只用 main 一条分支，只在 main 上自动同步',
  noOriginMain: '仓里没有 origin/main：检查取回失败过，再运行一次 collab.check',
  merging: '提交审核时把 main 合进来出了冲突，还没改好：让 AI 改好冲突、再提交审核',
  localAhead: '本地 main 上有还没进 main 的提交：提交审核正在等执行器，或者上次提交审核中途断了，再运行一次 collab.submit',
}

/** ff-only 失败只剩一种可能，原因原话照 sync.ts 抄（后面跟的 git 报错原文这里不列） */

/* ref file="../plugins/collab/src/collab-repo/sync/sync.ts" lines="41-45" hash="c401da85bf46" blob="64df3cef406d" */
export const ffBlockedReason = '工作区里没提交的改动和 main 上的新改动碰到了同一个文件：提交审核时会把 main 合进来，冲突由人配合 AI 改好'

/** 通知短句照 notification-text.ts 抄 */

/* ref file="../packages/collab/src/core/notifications/notification-text.ts" lines="21-29" hash="541e52cfe6fd" blob="d8d56dd65fa0" */
export const noticeSentences = {
  conflicts: '提交审核合 main 出了冲突，1 个文件还没改好',
  syncProblem: '没能自动同步 main 上的新改动',
  offMain: '协作仓在分支 draft 上，不在 main',
}

/** 冲突没改好时只列冲突、不在 main 时不列「没能自动同步」——两条规矩在 notifications-of.ts */

/* ref file="../plugins/collab/src/notifications/notifications-of.ts" lines="29-47" hash="6d600c19c472" blob="7e945c82036a" */
export const suppressionNote = '「上次提交审核没成功」「没能自动同步」都不列——它们说的都是冲突这一件事'

export const conflictFile = 'collab/records/20260925130000-ddddddd.json'

const pass = (answer) => ({ state: 'pass', answer })
const dim = { state: 'dim', answer: null }

export const cases = [
  {
    id: 'off-main',
    label: '在别的分支上',
    text: 'bob 在分支 draft 上试东西。协作仓只用 main 一条分支，自动同步只在 main 上做：什么都不动。提示栏不列「没能自动同步」——「不在 main」那条已经说明自动同步停着。',
    gates: [{ state: 'stop', answer: '在分支 draft 上' }, dim, dim, dim],
    merge: { state: 'dim', note: null },
    repo: [
      { label: '当前分支', value: 'draft', tone: 'bad' },
      { label: 'HEAD 与 origin/main', value: '同一处', tone: 'pending' },
    ],
    noticeBar: { pills: [noticeSentences.offMain], note: null, original: null },
  },
  {
    id: 'no-origin-main',
    label: '没有 origin/main',
    text: '在 main 上，但仓里没有 origin/main 这个引用——上次取回失败过，服务器上有没有新提交无从知道。不动，原因记下来，取回成功后的下一次检查再试。',
    gates: [pass('在 main 上'), { state: 'stop', answer: '没有（取回失败过）' }, dim, dim],
    merge: { state: 'dim', note: null },
    repo: [
      { label: '当前分支', value: 'main', tone: 'good' },
      { label: 'HEAD 与 origin/main', value: '没有 origin/main 可比', tone: 'bad' },
    ],
    noticeBar: { pills: [noticeSentences.syncProblem], note: null, original: [reasons.noOriginMain] },
  },
  {
    id: 'conflict-unresolved',
    label: '冲突还没改好',
    text: '上次提交审核把 origin/main 合进来时出了冲突，文件里的冲突标记还没改好（有一个合并没完成）。不动；提示栏只列冲突，提交失败与同步不了说的都是这件事。改好后再提交审核，那次提交完成这次合并。',
    gates: [pass('在 main 上'), pass('有'), { state: 'stop', answer: '合并没完成（MERGE_HEAD 在）' }, dim],
    merge: { state: 'dim', note: null },
    repo: [
      { label: '当前分支', value: 'main', tone: 'good' },
      { label: 'HEAD 与 origin/main', value: '本地多 1 个提交（bob 的），合并停在半路', tone: 'bad' },
      { label: '工作区', value: `${conflictFile} 里有冲突标记`, tone: 'bad' },
    ],
    noticeBar: { pills: [noticeSentences.conflicts], note: suppressionNote, original: [conflictFile] },
  },
  {
    id: 'local-ahead',
    label: '本地 main 领先',
    text: '本地 main 上有还没进 main 的提交——提交审核正在等执行器，或者上次中途断了。这几种都不同步：先让提交审核走完，本地回到不领先，自动同步才继续。',
    gates: [pass('在 main 上'), pass('有'), pass('没有没完成的合并'), { state: 'stop', answer: '领先 2 个提交' }],
    merge: { state: 'dim', note: null },
    repo: [
      { label: '当前分支', value: 'main', tone: 'good' },
      { label: 'HEAD 与 origin/main', value: '本地多 2 个提交（提交审核推过的）', tone: 'bad' },
    ],
    noticeBar: { pills: [noticeSentences.syncProblem], note: null, original: [reasons.localAhead] },
  },
  {
    id: 'fast-forward',
    label: '快进了',
    text: '四样都不是、origin/main 多 2 个新提交：git merge --ff-only 把 main 快进到 origin/main，git 报「Fast-forward」。快进的改动动了依赖文件就接着装依赖；只动了 site/ 别的文件，就让站点再过一遍启动前的检查。',
    gates: [pass('在 main 上'), pass('有'), pass('没有没完成的合并'), pass('不领先')],
    merge: { state: 'pass', note: '快进了 2 个提交' },
    repo: [
      { label: '当前分支', value: 'main', tone: 'good' },
      { label: 'HEAD 与 origin/main', value: '快进后同一处', tone: 'good' },
    ],
    showDependencyNote: true,
    noticeBar: { pills: [], note: null, original: null },
  },
  {
    id: 'ff-blocked',
    label: 'ff-only 失败',
    text: '判定都过了，但工作区里没提交的改动和 main 上进来的新改动碰到了同一个文件：git merge --ff-only 失败，git 什么都没动，HEAD 与工作区原样。改动留在工作区；提交审核时会把 main 合进来，冲突由人配合 AI 改好。',
    gates: [pass('在 main 上'), pass('有'), pass('没有没完成的合并'), pass('不领先')],
    merge: { state: 'stop', note: '失败，git 什么都没动' },
    repo: [
      { label: '当前分支', value: 'main', tone: 'good' },
      { label: 'HEAD 与 origin/main', value: 'origin/main 多 1 个提交，没能快进', tone: 'bad' },
      { label: '工作区', value: 'site/content/writing/pin-test.mdx 改了没提交，main 上进来的提交也动了它', tone: 'bad' },
    ],
    noticeBar: { pills: [noticeSentences.syncProblem], note: null, original: [ffBlockedReason] },
  },
]
