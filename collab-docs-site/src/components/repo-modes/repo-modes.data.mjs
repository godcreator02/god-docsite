/**
 * 「同一周在两个仓里干活」的分步讲解数据：画面（repo-modes.tsx）与机读版规则（repo-modes.ai.mjs）都只读这一份。
 * 一个例子贯穿全程：bob 在同一周里既改协作站的一页，又给别的仓 fpga-hil 提一处改动、等它的负责人 carol 审阅。
 * 每一步两个面板并排：左边是协作仓 collab，右边是 fpga-hil，各写 bob 电脑上这个仓此刻的样子与 bob 的提示栏里有什么。
 * 提交名是示意：协作仓 C0、M1…，fpga-hil F0、F1…；bob 自己的提交小写，p1、p2。
 */

/** 两个面板，颜色在整页固定：协作仓蓝、别的仓紫 */
export const lanes = [
  { id: 'collab', title: '协作仓 collab', role: 'blue', note: '按协作站的流程：只用 main，交给插件与执行器' },
  { id: 'plain', title: '别的仓 fpga-hil', role: 'violet', note: '按普通 git 仓：分支由各人定，插件只取回、只出通知' },
];

/**
 * 每个面板里逐行列出的几样，顺序固定
 * @type {{ key: 'branch' | 'main' | 'origin' | 'pull' | 'work' | 'sees', label: string }[]}
 */
export const fields = [
  { key: 'branch', label: '当前分支' },
  { key: 'main', label: '本地 main' },
  { key: 'origin', label: 'origin/main' },
  { key: 'pull', label: '合并请求' },
  { key: 'work', label: '工作区' },
  { key: 'sees', label: 'bob 在网页上看到' },
];

/* ref file="../plugins/collab/src/other-repos/fetch/update.ts" lines="11-14" hash="efb8ab0e4fc8" blob="6f759149920f" */
const updateRefusedOnBranch = '没有更新 fpga-hil：当前在分支 fix-pll 上：只更新 main，切回 main 才会更新';

const pullTitle = 'PLL 改成 125 MHz';

/* ref file="../packages/collab-model/src/notification-model/notification-text.ts" lines="16-18" hash="9cc6c21f0a2e" blob="db1dda751140" */
/* ref file="../packages/collab-model/src/notification-model/notification-text.ts" lines="22-23" hash="6bff63130321" blob="db1dda751140" */
/* ref file="../packages/collab-model/src/notification-model/notification-text.ts" lines="34-37" hash="9a1c9232249f" blob="db1dda751140" */
/* ref file="../packages/collab-model/src/notification-model/notification-text.ts" lines="40-41" hash="a01e2f4d09e7" blob="db1dda751140" */
/* ref file="../packages/collab-model/src/notification-model/notification-text.ts" lines="44-47" hash="811e6c34a434" blob="db1dda751140" */
/** 提示栏里通知的短句，照数据模型包的通知模型逐字写；人名是显示名 */
const sentence = {
  unsubmittedPages: (n) => `本机有 ${n} 个文件还没提交审核（站点文件 ${n} 个）`,
  submitFailure: '上次提交审核没成功',
  unpushed: (n) => `fpga-hil 有 ${n} 个提交还没推送`,
  unpulled: (n) => `fpga-hil 服务器上有 ${n} 个新提交还没拉下来`,
  pullToReview: `fpga-hil #5「${pullTitle}」等你审阅（bob 开的）`,
  commented: `carol 评论了 fpga-hil #5「${pullTitle}」（你开的合并请求）`,
};

/**
 * @typedef {{ branch: string, main: string, origin: string, pull: string, work: string, sees: string, by: string, cmd?: string[] }} Lane
 * @typedef {{ when: string, title: string, text: string, collab: Lane, plain: Lane }} Step
 */

/** @type {Step[]} */
export const steps = [
  {
    when: '周一 10:00',
    title: '起点：两个仓都和服务器一样',
    text: 'bob 电脑上两个仓都在 main 上，本地 main 和 origin/main 是同一个提交，工作区干净，提示栏里没有通知。下面两个仓从这里同时往前走。',
    collab: { branch: 'main', main: 'C0', origin: 'C0', pull: '没有', work: '干净', sees: '提示栏里没有通知', by: '—' },
    plain: { branch: 'main', main: 'F0', origin: 'F0', pull: '没有', work: '干净', sees: '提示栏里没有 fpga-hil', by: '—' },
  },
  {
    when: '周一 10:05',
    title: '各改一处',
    text: `协作仓里，bob 让 AI 照一条评论改了 design/overview 这一页，改动就在 main 的工作区里，不开分支。fpga-hil 这件事要等 carol 审，bob 先从 main 开一条本地分支 fix-pll，在上面改好 pll.v、提交。插件比的是 HEAD 和服务器上的同名分支：服务器上还没有 fix-pll，p1 哪个服务器分支上都没有，提示栏「别的仓」组里就出现「${sentence.unpushed(1)}」。`,
    collab: { branch: 'main', main: 'C0', origin: 'C0', pull: '没有', work: '改了 1 页，没提交', sees: `提示栏「协作仓」：${sentence.unsubmittedPages(1)}`, by: 'AI 改页面' },
    plain: {
      branch: 'fix-pll',
      main: 'F0',
      origin: 'F0',
      pull: '没有',
      work: '干净（p1 提交在 fix-pll 上）',
      sees: `提示栏「别的仓」：${sentence.unpushed(1)}`,
      by: 'bob 运行 git',
      cmd: ['git switch -c fix-pll', `git commit -am "${pullTitle}"`],
    },
  },
  {
    when: '周一 10:06',
    title: '把改动交出去',
    text: `协作仓里 bob 说「提交审核」，AI 调 collab.submit：在本地 main 上提交，推到 refs/for/main，Gitea 开出合并请求 #12，命令一直等执行器的结论；提交以后工作区干净，「协作仓」那一条消失。fpga-hil 里 bob 推 fix-pll 这条分支，服务器上有了同名分支，「别的仓」那一条也消失；再让 AI 经 gitea.http 开一个合到 main 的合并请求 #5。开合并请求推来这个仓的消息，fpga-hil 的负责人 carol 的插件重读这个仓，她的提示栏里出现「${sentence.pullToReview}」，等她审。`,
    collab: { branch: 'main', main: 'C0 + p1', origin: 'C0', pull: '#12 等执行器', work: '干净', sees: '提示栏里没有通知（collab.submit 还在等）', by: 'AI 调 collab.submit' },
    plain: {
      branch: 'fix-pll',
      main: 'F0',
      origin: 'F0',
      pull: '#5 等 carol 审阅',
      work: '干净',
      sees: '提示栏里没有 fpga-hil',
      by: 'bob 运行 git，AI 开合并请求',
      cmd: ['git push -u origin fix-pll', `POST /repos/<主人>/fpga-hil/pulls {"head":"fix-pll","base":"main","title":"${pullTitle}"}`],
    },
  },
  {
    when: '周一 10:06 过十几秒',
    title: '一边十几秒有结论，一边要等几天',
    text: '执行器检查 #12：没有冲突、没改只有负责人能改的内容，以合并提交并进 main。合并推来协作仓的 push 消息，插件取回协作仓、把 bob 的本地 main 快进到 M1，collab.submit 返回。fpga-hil 没有执行器，#5 还开着，bob 的 main 一直是 F0，不受这次等待影响。',
    collab: { branch: 'main', main: 'M1', origin: 'M1', pull: '#12 已合并', work: '干净', sees: '提示栏里没有通知', by: '执行器合并，插件快进' },
    plain: { branch: 'fix-pll', main: 'F0', origin: 'F0', pull: '#5 等 carol 审阅', work: '干净', sees: '提示栏里没有 fpga-hil', by: '—' },
  },
  {
    when: '周二',
    title: '等审阅的这几天，别人也在改',
    text: `协作仓里 carol 合进来两条评论，插件十秒左右就把 bob 的本地 main 快进到 M2，bob 什么都不用做。fpga-hil 里 carol 合了别人的一个修复，origin/main 走到 F1：推来这个仓的 push 消息，插件只取回它，不切分支、不快进，bob 的 main 和 fix-pll 都不动。bob 现在在 fix-pll 上，比的是它和服务器上的 fix-pll，两边一样，提示栏里没有这个仓：main 往前走不算，这时不用更新，切回 main 时再拉。在 fix-pll 上调 collab.repos.update 会被拒绝：「${updateRefusedOnBranch}」。要同时做另一件事，就从 origin/main 再开一条分支、另开一个合并请求，两个合并请求互不相干。`,
    collab: { branch: 'main', main: 'M2', origin: 'M2', pull: '没有', work: '干净', sees: '网页整页刷新一次，出现 carol 的两条评论', by: '插件自动同步' },
    plain: { branch: 'fix-pll', main: 'F0', origin: 'F1', pull: '#5 等 carol 审阅', work: '干净', sees: '提示栏里没有 fpga-hil', by: '插件只取回' },
  },
  {
    when: '周三',
    title: '被打回 / 被要求重改',
    text: `协作仓里 bob 让 AI 改一页，AI 顺手改了站点的 vite.config.ts，这是只有项目负责人能改的文件：collab.submit 推送前在本机就拦下，本地 main 退回 origin/main，改动回到工作区，提示栏「协作仓」组里有「${sentence.submitFailure}」（下面是原话，写明是哪一处）和「${sentence.unsubmittedPages(2)}」。fpga-hil 里 carol 在 #5 下评论，要求改接口：评论推来这个仓的消息，bob 的插件重读 fpga-hil，提示栏「别的仓」组里出现「${sentence.commented}」。bob 在 fix-pll 上再改一次、提交、推这条分支，#5 更新成两个提交；再让 AI 起草一条回复，bob 确认后发在 #5 下，最后一条评论是 bob 自己的，这一条消失。main 照旧不受影响。`,
    collab: {
      branch: 'main',
      main: 'M2',
      origin: 'M2',
      pull: '没有推送',
      work: '1 页与 vite.config.ts 改了，没提交',
      sees: `提示栏「协作仓」：${sentence.submitFailure}；${sentence.unsubmittedPages(2)}`,
      by: '插件自动退回',
    },
    plain: {
      branch: 'fix-pll',
      main: 'F0',
      origin: 'F1',
      pull: '#5 更新：p1、p2',
      work: '干净',
      sees: `提示栏「别的仓」：${sentence.commented}；bob 回复以后消失`,
      by: 'bob 运行 git，AI 回复评论',
      cmd: ['git commit -am "PLL 接口改成 AXI-Lite"', 'git push', 'POST /repos/<主人>/fpga-hil/issues/5/comments {"body":"已改成 AXI-Lite"}'],
    },
  },
  {
    when: '周四',
    title: '合并以后跟上服务器',
    text: `协作仓这边，AI 把 vite.config.ts 改回 main 上的样子（真要改就交给项目负责人），再提交审核那一页，十几秒后合并，「协作仓」组里那两条随之消失；本地 main 一直跟着服务器，不用拉取。fpga-hil 里 carol 审完同意，她的 AI 以合并提交合并了 #5，origin/main 走到 F2。bob 切回 main，这时 main 比服务器上的 main 少 F1、p1、p2 和合并提交 F2 四个，提示栏「别的仓」组里出现「${sentence.unpulled(4)}」；拉取以后 main 快进到 F2，这一条消失，fix-pll 上的工作已经在 main 里，删掉这条分支。合并方式只开了「合并提交」和「仅快进」，bob 的提交原样进了 main，所以这一步一定是快进。`,
    collab: { branch: 'main', main: 'M3', origin: 'M3', pull: '#13 已合并', work: '干净', sees: '提示栏里没有通知', by: 'AI 改回那一处，再调 collab.submit' },
    plain: {
      branch: 'main',
      main: 'F2',
      origin: 'F2',
      pull: '#5 已合并',
      work: '干净',
      sees: `切回 main 时：${sentence.unpulled(4)}；拉取以后消失`,
      by: 'bob 运行 git（或切回 main 后交给 AI 调 collab.repos.update）',
      cmd: ['git switch main', 'git pull --ff-only', 'git branch -d fix-pll'],
    },
  },
];
