/**
 * AutoMergeRun（「实时推送与执行器」那一页）与 AutoMergeCases（执行器实测的五种合并请求）的全部数据：画面（auto-merge.tsx）与机读版规则（auto-merge.ai.mjs）都只读这一份。
 * runSteps：一个合并请求从 bob 推送到进 main，八步，例子是 bob 在 MMC 协作仓提交一条任务、开出合并请求 #7；命令与输出照现在的源码写。
 * cases：2026-09-30 在 MMC 协作仓上实测的五种情况，那时检查只有三条（measuredCheckNames）；合并请求编号、用时、留言都是那次的原样，不跟着源码改。
 * 每一步标出它对应那一页「执行器：每一步由谁负责」表里的哪几步（seams）。
 */

/**
 * @typedef {{ kind: 'term', title: string, lines: { text: string, kind: 'cmd' | 'out' | 'ok' | 'err' }[] }
 *   | { kind: 'code', title: string, lines: string[], highlight: [number, number] }
 *   | { kind: 'checks', command: string, checks: { text: string, state: 'ok' | 'bad' | 'skip' }[], output: string }
 *   | { kind: 'merge', request: string[], result: string }} Artifact
 * @typedef {{ title: string, text: string, place: string, seams: number[], artifact: Artifact }} RunStep
 */

/** 那一页「执行器：每一步由谁负责」表里的八步，runSteps 的 seams 写的是这里的步号（从 1 起） */
export const stepNames = ['推成合并请求', '派任务', '读工作流', '取代码', '装检查工具', '合并检查', '合并或打回', '等结论'];

export const example = { person: 'bob', lead: 'godcreator', pull: 7, repo: 'hybrid-mmc/collab', range: '^0.1.0' };

/** 图上的三列：bob 的电脑、Gitea、NAS 执行器。每一方在整页里固定一种颜色 */
export const columns = [
  { id: 'member', title: 'bob 的电脑', role: 'blue' },
  { id: 'gitea', title: 'Gitea', role: 'amber' },
  { id: 'nas', title: 'NAS 执行器', role: 'violet' },
];

export const places = [
  { id: 'submit', column: 'member', name: 'gwb-collab', detail: 'collab.submit' },
  { id: 'pull', column: 'gitea', name: `合并请求 #${example.pull}`, detail: 'AGit 开的' },
  { id: 'actions', column: 'gitea', name: 'Actions', detail: '按 main 上的工作流派任务' },
  { id: 'main', column: 'gitea', name: 'main', detail: '合并提交' },
  { id: 'job', column: 'nas', name: 'gitea-runner', detail: '标签 nas · 主机方式' },
  { id: 'check', column: 'nas', name: 'collab-merge-check', detail: 'collab 包的命令行' },
];

/** 现在检查的两条：有冲突时第二条不再查。记录格式与站点由成员提交前在本机查，执行器不查 */
/* ref file="../packages/collab/src/node/merge-check.ts" lines="181-194" hash="d187b8e75c98" blob="9b414afa970e" */
export const checkNames = ['和 main 没有冲突', '没改只有负责人能改的内容'];

/** 2026-09-30 实测时检查的三条，只给 cases 用：那时前一条不过，后面的不再查 */
export const measuredCheckNames = ['和 main 没有冲突', '合并后只改了 collab/', '合并后没有新的格式问题'];

/* ref file="../plugins/collab/src/collab-repo/submit/submit.ts" lines="35-39" hash="2e408d45cad7" blob="92a88843de16" */
/* ref file="../plugins/collab/src/collab-repo/submit/submit.ts" lines="50-52" hash="169b02d46d48" blob="92a88843de16" */
/* ref file="../plugins/collab/src/collab-repo/submit/submit.ts" lines="155-155" hash="770f3420697e" blob="969e98c0a648" */
const submitLines = [
  { text: 'git add --all -- collab site', kind: 'cmd' },
  { text: `git commit -m "${example.person} 的协作记录" -- collab site`, kind: 'cmd' },
  { text: `git push origin HEAD:refs/for/main -o topic=${example.person} -o "title=${example.person} 的协作记录"`, kind: 'cmd' },
  { text: `Gitea：新建合并请求 #${example.pull}`, kind: 'ok' },
];

/* ref file="../packages/collab/templates/collab-auto-merge.yaml" lines="10-25" hash="5e4587e3e470" blob="2f8884f0ba6c" */
const workflowLines = [
  'on:',
  '  pull_request_target:',
  '    types: [opened, synchronize, reopened]',
  '',
  'env:',
  `  MERGE_CHECK_RANGE: '${example.range}'`,
  '',
  'jobs:',
  '  merge:',
  "    if: github.event.pull_request.base.ref == 'main'",
  '    runs-on: nas',
];

/* ref file="../packages/collab/templates/collab-auto-merge.yaml" lines="24-24" hash="0d6665dd505c" blob="2f8884f0ba6c" */
/* ref file="../packages/collab/templates/collab-auto-merge.yaml" lines="42-42" hash="ff3ef7a918c7" blob="2f8884f0ba6c" */
const tokenLines = [
  { text: 'command -v node >/dev/null || apk add --no-cache nodejs npm', kind: 'cmd' },
  { text: `令牌是 collab-bot 的，看得到 ${example.repo}`, kind: 'ok' },
];

/* ref file="../packages/collab/templates/collab-auto-merge.yaml" lines="58-61" hash="61d08cec3df8" blob="2f8884f0ba6c" */
const fetchLines = [
  { text: 'git init -q -b collab-check repo', kind: 'cmd' },
  { text: `git fetch <Gitea>/${example.repo}.git main refs/pull/${example.pull}/head`, kind: 'cmd' },
  { text: 'refs/collab/pull 就是 Gitea 报的那个提交', kind: 'ok' },
];

/* ref file="../packages/collab/templates/collab-auto-merge.yaml" lines="70-91" hash="bff46e6bef46" blob="2f8884f0ba6c" */
const installLines = [
  { text: `MERGE_CHECK_RANGE=${example.range}`, kind: 'out' },
  { text: `npm install @godcreator/collab@${example.range}`, kind: 'cmd' },
  { text: '装在 ~/.cache/collab-merge-check/ 下，下次直接用', kind: 'ok' },
];

/* ref file="../packages/collab/src/cli/merge-check.ts" lines="44-44" hash="25ca53edf681" blob="8627d7878e62" */
const mergeableOutput = '可以合并：没有冲突，没改只有负责人能改的内容';

/** 实测那次能合并时命令行的原话 */
const measuredMergeableOutput = '可以合并：没有冲突，只改了 collab/，没有新的格式问题';

/** 执行器运行检查的那一行：提交合并请求的人作为 --author、协作仓的协作者（项目负责人）作为 --leads 传进去 */
/* ref file="../packages/collab/templates/collab-auto-merge.yaml" lines="91-91" hash="e7cca7b57816" blob="2f8884f0ba6c" */
export const checkCommand = `collab-merge-check --base main --head refs/collab/pull --author ${example.person} --leads ${example.lead}`;

/* ref file="../packages/collab/templates/collab-auto-merge.yaml" lines="121-121" hash="bbab227fb135" blob="2f8884f0ba6c" */
const mergeRequest = [`POST /api/v1/repos/${example.repo}/pulls/${example.pull}/merge`, '{', '  "Do": "merge",', '  "head_commit_id": "<检查过的那个提交>"', '}'];

/** @type {RunStep[]} */
export const runSteps = [
  {
    title: 'bob 提交审核',
    place: 'submit',
    seams: [1],
    text: `bob 让 AI 调 collab.submit：插件在 bob 的本地 main 上把 collab/ 与 site/ 的改动一起提交，用 AGit 推到 refs/for/main，主题是 bob 的身份。这次只有一条任务，提交说明是「${example.person} 的协作记录」；带了 site/ 的改动（页面、评论）时写「${example.person} 的页面改动」或「${example.person} 的协作记录与页面改动」。合并插件不参与：推完它每 2 秒查一次合并请求，等执行器合并或打回。`,
    artifact: { kind: 'term', title: 'bob · main', lines: submitLines },
  },
  {
    title: 'Gitea 开合并请求',
    place: 'pull',
    seams: [1],
    text: `推到 refs/for/main 的提交不进任何分支，Gitea 用它开合并请求 #${example.pull}。执行器对它立刻给出结论：合并，或者留言写明原因再关掉，不会开着等人。`,
    artifact: {
      kind: 'code',
      title: `合并请求 #${example.pull}`,
      lines: [`标题  ${example.person} 的协作记录`, `来自  ${example.person}（AGit，主题 ${example.person}）`, '合进  main', '改动  collab/records/20260928143012-k3f9x2a.json'],
      highlight: [2, 2],
    },
  },
  {
    title: 'Gitea 派任务',
    place: 'actions',
    seams: [2, 3],
    text: '合并请求一开出来，Gitea 就去读协作仓 main 上的工作流，排一个任务，只派给带 nas 标签的执行器。读的是 main 上那份，合并请求里改了它也不算数；组织密钥 COLLAB_BOT_TOKEN 随任务交过去。',
    artifact: { kind: 'code', title: '.gitea/workflows/collab-auto-merge.yaml（main 上）', lines: workflowLines, highlight: [2, 2] },
  },
  {
    title: '执行器领到任务',
    place: 'job',
    seams: [2],
    text: 'NAS 上的执行器一直在向 Gitea 要任务，领到就在自己的容器里照工作流执行。先确认有 Node（容器重建后第一次要装），再用密钥里的令牌问 Gitea「我是谁、看不看得到这个仓」，不对就写明原因、停在这一步。',
    artifact: { kind: 'term', title: 'gitea-runner', lines: tokenLines },
  },
  {
    title: '取代码',
    place: 'job',
    seams: [4],
    text: `在一个临时目录里取回 main 和合并请求 #${example.pull} 的提交，不碰任何人的工作区。main 取到本地同名分支，留言里写的就是「main」。`,
    artifact: { kind: 'term', title: 'gitea-runner · 临时目录', lines: fetchLines },
  },
  {
    title: '装检查工具',
    place: 'check',
    seams: [5],
    text: '检查用哪一版 collab 包，写在工作流文件的 MERGE_CHECK_RANGE 里：这个文件只有负责人能改，升版本就是改这一行，和成员网站 site/package.json 里写的版本无关。只装 collab 包，npm 连带装上它依赖的本仓包，站点页面要的 react 等可选 peer 不装；按版本范围装进缓存目录，第一次约半分钟，之后几乎不花时间。',
    artifact: { kind: 'term', title: 'gitea-runner · 缓存', lines: installLines },
  },
  {
    title: '合并检查',
    place: 'check',
    seams: [6],
    text: `先用 collab-bot 的令牌读协作仓的协作者，就是项目负责人（这里是 ${example.lead}），和提交人 bob 一起交给命令行。在内存里算出合进 main 之后的样子再查两条：没有冲突；没改只有负责人能改的内容（bob 在 --leads 里时那几处也放行）。记录格式与站点由 bob 的插件提交前在本机查过，执行器不查；也不查谁改了谁的记录、有没有删记录。两条都过，退出码 0。`,
    artifact: { kind: 'checks', command: checkCommand, checks: checkNames.map((text) => ({ text, state: 'ok' })), output: mergeableOutput },
  },
  {
    title: '以 collab-bot 合并',
    place: 'main',
    seams: [7],
    text: `执行器用机器人账号 collab-bot 的令牌调合并接口，带上检查过的提交号：检查之后又推了新提交，Gitea 拒绝这次合并，交给新提交触发的那一次。main 上多一个合并人是 collab-bot 的合并提交。实测从推送到进 main 7 到 11 秒。bob 的 collab.submit 下一次查到 #${example.pull} 已合并，回执带上它的编号与链接。`,
    artifact: { kind: 'merge', request: mergeRequest, result: `#${example.pull} 已合并 · 合并人 collab-bot` },
  },
];

/* ref file="../packages/collab/templates/collab-auto-merge.yaml" lines="114-118" hash="ae6fdd3a338f" blob="2f8884f0ba6c" */
/* ref file="../packages/collab/templates/collab-auto-merge.yaml" lines="129-129" hash="a183cc957424" blob="2f8884f0ba6c" */
/** 执行器打回时留言的开头与结尾，中间是检查的原话；留完言就关掉合并请求 */
export const commentFrame = {
  head: '没有合并（检查的是提交 <提交号>）：',
  tail: '这个合并请求已关闭，改动已退回提交人的工作区；改好后重新提交审核。',
};

/**
 * @typedef {{ id: string, label: string, text: string, pulls: { n: number, state: 'merged' | 'commented' | 'closed', note: string }[],
 *   checks: ('ok' | 'bad' | 'skip')[], output: string[], file?: { title: string, lines: string[], highlight: [number, number] } }} Case
 */

/** 实测记录：checks 按 measuredCheckNames 排，output 是那次执行器留言的原话 @type {Case[]} */
export const cases = [
  {
    id: 'new',
    label: '新加一条记录',
    text: '最常见的情况：一条新记录就是一个新文件，和别人的改动碰不到一起。三条都过，推送后 11 秒以 collab-bot 合并。',
    pulls: [{ n: 24, state: 'merged', note: '推送后 11 秒合并' }],
    checks: ['ok', 'ok', 'ok'],
    output: [measuredMergeableOutput],
  },
  {
    id: 'format',
    label: '记录格式不对',
    text: '手写了一条一行写完的记录：解码得出来，但和记录模型重新编码的结果不一样。第三条不过，留言写明是哪个文件、哪里不对，不合并。',
    pulls: [{ n: 25, state: 'commented', note: '留言，没合并' }],
    checks: ['ok', 'ok', 'bad'],
    output: ['- collab/records/20260930134000-probe0d.json  不是规范写法：键序、缩进、空白、转义或结尾换行和重新编码的结果不同'],
    file: {
      title: 'collab/records/20260930134000-probe0d.json',
      lines: ['{"id":"20260930134000-probe0d","type":"task","author":"godcreator","status":"todo","title":"格式不对的实测记录"}'],
      highlight: [1, 1],
    },
  },
  {
    id: 'outside',
    label: '改了 collab/ 以外',
    text: '合并请求里另外改了 README.md。页面、配置这类文件不自动合并：第二条不过，留言列出这些文件，留给负责人人工看，格式那一条不再查。',
    pulls: [{ n: 26, state: 'commented', note: '留言，没合并' }],
    checks: ['ok', 'bad', 'skip'],
    output: ['- 改了 collab/ 以外的文件，不自动合并：README.md'],
  },
  {
    id: 'conflict',
    label: '两人改同一行',
    text: 'bob、carol 从同一个 main 出发，改了同一条记录的同一行。先到的 #27 推送后 7 秒合并；后到的 #28 合进 main 会冲突，第一条就不过，留言写明冲突的文件，后两条不再查。carol 同步 main、让 AI 按两边的意思改好，再提交。',
    pulls: [
      { n: 27, state: 'merged', note: '推送后 7 秒合并' },
      { n: 28, state: 'commented', note: '留言：有冲突' },
    ],
    checks: ['bad', 'skip', 'skip'],
    output: ['- 和 main 有冲突：collab/records/20260930130000-probe0a.json；把 main 合进来、按两边的意思改好冲突的记录，再提交'],
    file: {
      title: 'collab/records/20260930130000-probe0a.json（#28 里的这一行）',
      lines: ['{', '  "id": "20260930130000-probe0a",', '  "type": "task",', '  "author": "godcreator",', '  "status": "todo",', '  "title": "自动合并实测（carol 也改了标题），测完删掉"', '}'],
      highlight: [6, 6],
    },
  },
  {
    id: 'delete',
    label: '删掉记录',
    text: '一个合并请求删掉三条记录。删记录、改别人的记录都不再拦：协作站范围小，人员靠人管。三条都过，推送后 7 秒合并。',
    pulls: [{ n: 29, state: 'merged', note: '推送后 7 秒合并' }],
    checks: ['ok', 'ok', 'ok'],
    output: [measuredMergeableOutput],
  },
];
