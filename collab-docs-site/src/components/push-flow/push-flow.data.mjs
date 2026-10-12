/**
 * 「实时推送」讲解动画的全部数据：画面（push-flow.tsx）与机读版规则（push-flow.ai.mjs）都只读这一份。
 * 一件事：bob 提交审核以后，他的评论怎么在二十秒上下出现在 carol 的网站上。人物与「各种情况下怎么协作」那一页相同。
 * 每一段的 real 是这一段对应的实际时间（秒），按 2026-10-02 在 NAS 上的实测写：webhook 到订阅端同一秒、执行器 5–15 秒、
 * 收到消息到做完约 7 秒（其中等 2 秒；那次实测时插件收到消息做的是完整刷新，按消息只取协作仓的还没另外测过）。
 */

/** 消息的标题与正文：标题是 <组织>/<仓>，正文只有种类、动作、编号或分支（模板写在插件的 organization/events/webhook.ts） */
export const messageTitle = 'hybrid-mmc/collab';
export const messages = {
  opened: 'pr opened #7',
  push: 'push refs/heads/main',
  closed: 'pr closed #7',
};

/** 收到消息后等多久再去取、同一个项目的完整刷新最快多久一次（秒），照插件的常量 */
/* ref file="../plugins/collab/src/organization/events/scheduler.ts" lines="3-6" hash="796fde5bfaf3" blob="bb0e2607c8ec" */
export const debounceSeconds = 2;
export const minIntervalSeconds = 10;

/**
 * 六段。real 是 [开始, 结束] 的实际秒数，画面右上角的「实际时间」按本段进度在这两个数之间走
 * @type {{ id: 'submit' | 'opened' | 'runner' | 'merged' | 'deliver' | 'check', title: string, text: string, duration: number, real: [number, number] }[]}
 */
export const chapters = [
  {
    id: 'submit',
    title: 'bob 提交审核',
    text: 'bob 让 AI 调 collab.submit：本地 main 上提交，git push 到 refs/for/main。Gitea 收下推送，建出合并请求 #7。命令推完不返回，每 2 秒查一次 #7，等执行器的结论。',
    duration: 3,
    real: [0, 1],
  },
  {
    id: 'opened',
    title: 'Gitea 把「#7 开了」推给每个人',
    text: `组织级 webhook 经 NAS 内网把事件发给 ntfy，消息标题是「${messageTitle}」，正文只有「${messages.opened}」这一行。ntfy 立刻转给所有连着的工作台：carol 的、bob 自己的、负责人的。carol 的插件认出这是协作仓的合并请求：协作仓的合并请求由执行器当场定论，它的合并请求、issue、评论消息插件都不处理，什么都不用取。同时 Gitea 给 NAS 上的执行器派任务。`,
    duration: 4,
    real: [1, 3],
  },
  {
    id: 'runner',
    title: '执行器检查 #7',
    text: '执行器取回 main 和 #7 的提交，运行合并检查：没有冲突、没改只有负责人能改的内容；记录格式与站点 bob 的插件提交前已经在本机查过。这一步通常 5 到 15 秒。等待期间长连接上什么都不传，只有 ntfy 每 45 秒发一次保活。',
    duration: 5,
    real: [3, 12],
  },
  {
    id: 'merged',
    title: '合并进 main，又推出两条消息',
    text: `执行器以 collab-bot 合并 #7，Gitea 上的 main 往前走了一个合并提交。这一下产生两个事件：「${messages.push}」和「${messages.closed}」，几乎同时经 ntfy 推出去。bob 的 collab.submit 下一次查到 #7 已合并，回执带上 #7 的编号与链接。`,
    duration: 3,
    real: [12, 13],
  },
  {
    id: 'deliver',
    title: 'carol 收到，等 2 秒',
    text: `两条消息在 1 秒内到 carol 的工作台。消息只说位置：「${messages.push}」是协作仓有新提交，「${messages.closed}」是协作仓的合并请求关了。插件先等 ${debounceSeconds} 秒，把挨着到的几条合成一批；这一批里要做的只有一件事：取回协作仓、能快进就快进。完整刷新同一个项目最快每 ${minIntervalSeconds} 秒一次，按消息取不受这个限制。`,
    duration: 3,
    real: [13, 15],
  },
  {
    id: 'check',
    title: 'carol 取回协作仓，网站上出现 bob 的评论',
    text: '插件只取回协作仓：git fetch 取回 main，git merge --ff-only 把本地 main 快进到新的 main。bob 的评论是 site/comments/ 里新多出的文件，站点的开发服务看到评论目录里多了文件，让 carol 的网页整页刷新一次，bob 的评论就出现在页面上。从合并到这里约 10 秒，多数时间花在网络往返上。',
    duration: 6,
    real: [15, 22],
  },
];

/** carol 网站上那一页的评论，bob 的那条在快进做完、网页刷新后出现 */
export const siteComments = {
  before: ['carol：电容取多大再核一下'],
  added: 'bob：已按仿真改成 470 µF',
};

/** carol 的插件在取回那一段里依次做的几步 */
export const checkSteps = ['git fetch origin', 'git merge --ff-only origin/main', '本地 main 快进', '网页整页刷新'];
