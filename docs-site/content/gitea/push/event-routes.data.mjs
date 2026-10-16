/**
 * EventRoutes（「实时推送与执行器」那一页「收到消息以后」一节）的全部数据，画面（event-routes.tsx）只读这一份。
 * Gitea 上一件事怎样变成 ntfy 里一条只带位置的消息、插件收到后按仓分给哪一套、去 Gitea 取哪一处：
 * 每种情况一条从上到下的链，五张卡分别是「Gitea 上发生的事 → webhook 请求体里起作用的字段 →
 * ntfy 收到的消息 → 插件怎么分 → 去 Gitea 取什么」。消息正文照 organization/events/webhook.ts 的模板算，
 * 各情况插件做的事照 collab-repo/events.ts 与 other-repos/events.ts（都钉在下面）；编号用本页例子的值，
 * firmware 的合并请求编号 #9 与新建仓名 motor-lib 是为讲解拼的，其余沿用正文例子。
 */

/** webhook 地址里的标题与正文模板：标题是 <组织>/<仓>，正文依次判断，评论最先认 */
/* ref file="../plugins/collab/src/organization/events/webhook.ts" lines="13-13" hash="104933e05b7e" blob="6b3eec721a00" */
/* ref file="../plugins/collab/src/organization/events/webhook.ts" lines="19-24" hash="6fccc9cd555b" blob="6b3eec721a00" */
export const templates = {
  title: '{{.repository.full_name}}',
  body: '依次判断：.ref → push <ref>；.comment → comment <动作> #<编号>；.pull_request → pr <动作> #<编号>；.issue → issue <动作> #<编号>；都没有 → repo <动作>',
};

/** 认得出的先等 2 秒合成一批：同一次合并的 push 与「合并请求已关闭」两条几乎同时到 */
/* ref file="../plugins/collab/src/organization/events/scheduler.ts" lines="3-6" hash="796fde5bfaf3" blob="bb0e2607c8ec" */
export const debounceMilliseconds = 2_000;

/** 收到消息按仓分给两边：说的是协作仓交给协作仓那一套，别的仓交给别的仓那一套，组织里建了仓补克隆 */
/* ref file="../plugins/collab/src/organization/events/project-events.ts" lines="125-138" hash="fc270c3ab371" blob="b6abd91dd16b" */
export const splitByRepo = '消息的仓名对上协作仓 → 协作仓那一套；别的仓名 → 别的仓那一套；repo 事件 → 建仓分支';

/** 协作仓那边：push 取回加自动同步，leads 重读负责人再核对规矩，合并请求、issue 与评论不处理 */
/* ref file="../plugins/collab/src/collab-repo/events.ts" lines="33-42" hash="d679f2f79d3e" blob="2f7d37c4b1e8" */
export const collabSide = '协作仓那一套只处理 push 与 leads changed';

/** 别的仓那边：push 只取回，合并请求、issue、评论有动静重读，leads 加核对；仓不在项目文件夹里只记一行 */
/* ref file="../plugins/collab/src/other-repos/events.ts" lines="52-72" hash="4c24e5cdba0c" blob="98c55e68e190" */
export const otherSide = '别的仓那一套按消息的种类取那一处';

/** 认不出的消息记一行警告，对那个组织的项目做一次完整刷新；警告的原话 */
/* ref file="../plugins/collab/src/organization/events/project-topics-subscription.ts" lines="94-98" hash="9b6e1f8a20e2" blob="b7acd81b9b42" */
export const unknownWarn = '认不出推来的消息（<topic>："<标题>" "<正文>"），对这个组织的项目做一次完整刷新';

/** 每种情况末尾那行灰字 */
export const footer = '消息只带位置，事实都由插件自己去 Gitea 取。';

/**
 * @typedef {{ title: string, lines: string[] }} ChainCard
 * @typedef {{ id: string, label: string, text: string, chain: ChainCard[] }} EventCase
 */

/** @type {EventCase[]} */
export const cases = [
  {
    id: 'collab-push',
    label: '协作仓有新提交',
    text: '执行器合并 #7，协作仓 main 有新提交：Gitea 发 push 事件，请求体里有 .ref，消息正文写 push <ref>。每个成员的插件等 2 秒合成一批——同一次合并的 push 与「合并请求已关闭」两条几乎同时到——再取回协作仓、能快进就把本地 main 快进过去。',
    chain: [
      { title: 'Gitea 上发生的事', lines: ['执行器以 collab-bot 合并了 #7', '协作仓 main 多一个合并提交，合并请求关闭'] },
      { title: 'webhook 请求体里起作用的字段', lines: ['.ref = "refs/heads/main"', '其余字段模板不用'] },
      { title: 'ntfy 收到的消息', lines: ['标题 hybrid-mmc/collab', '正文 push refs/heads/main'] },
      { title: '插件怎么分', lines: ['说的是协作仓 → 协作仓那一套', '同一次合并的两条消息 2 秒内合成一批，只做一次'] },
      { title: '去 Gitea 取什么', lines: ['取回协作仓', '能快进就把本地 main 快进过去'] },
    ],
  },
  {
    id: 'other-push',
    label: '别的仓有推送',
    text: 'firmware 有推送也一样：消息只说 firmware 的 main 有新提交，各成员的插件只取回那一个仓，不碰别的。',
    chain: [
      { title: 'Gitea 上发生的事', lines: ['firmware 的 main 有新提交（负责人合并了合并请求，或直接推的）'] },
      { title: 'webhook 请求体里起作用的字段', lines: ['.ref = "refs/heads/main"'] },
      { title: 'ntfy 收到的消息', lines: ['标题 hybrid-mmc/firmware', '正文 push refs/heads/main'] },
      { title: '插件怎么分', lines: ['说的是别的仓 → 别的仓那一套'] },
      { title: '去 Gitea 取什么', lines: ['只取回 firmware 那个仓'] },
    ],
  },
  {
    id: 'pr-opened',
    label: '开出合并请求',
    text: 'carol 在 firmware 开合并请求：请求体里有 .pull_request、没有 .comment，消息正文写 pr opened #<编号>，各成员的插件重读那个仓的合并请求与 issue。',
    chain: [
      { title: 'Gitea 上发生的事', lines: ['carol 在 firmware 开了合并请求 #9'] },
      { title: 'webhook 请求体里起作用的字段', lines: ['.pull_request = { number: 9, … }', '没有 .comment'] },
      { title: 'ntfy 收到的消息', lines: ['标题 hybrid-mmc/firmware', '正文 pr opened #9'] },
      { title: '插件怎么分', lines: ['说的是别的仓 → 别的仓那一套'] },
      { title: '去 Gitea 取什么', lines: ['重读 firmware 的合并请求与 issue'] },
    ],
  },
  {
    id: 'pr-review',
    label: '审阅了',
    text: 'admin 审阅（批准、要求修改）：审阅的请求体里有 .pull_request、没有 .comment，写成 pr reviewed，不会认成评论。「要你改」「评论了」这类通知收到消息就出现、就消失，不等下一次完整刷新。',
    chain: [
      { title: 'Gitea 上发生的事', lines: ['admin 审阅了 firmware 的 #9（批准 / 要求修改）'] },
      { title: 'webhook 请求体里起作用的字段', lines: ['.pull_request = { number: 9, … }', '没有 .comment'] },
      { title: 'ntfy 收到的消息', lines: ['标题 hybrid-mmc/firmware', '正文 pr reviewed #9'] },
      { title: '插件怎么分', lines: ['说的是别的仓 → 别的仓那一套'] },
      { title: '去 Gitea 取什么', lines: ['重读 firmware 的合并请求与 issue'] },
    ],
  },
  {
    id: 'pr-comment',
    label: '合并请求上的评论',
    text: '合并请求上的评论：请求体里 .comment、.issue 都有，还带着 .pull_request，模板最先认评论，写 comment created——不然会认成 issue 或合并请求自己的动静。',
    chain: [
      { title: 'Gitea 上发生的事', lines: ['有人在 firmware 的 #9 上发了评论'] },
      { title: 'webhook 请求体里起作用的字段', lines: ['.comment = { … }（最先认它）', '.issue = { number: 9, … }', '.pull_request 也在：这是合并请求上的评论'] },
      { title: 'ntfy 收到的消息', lines: ['标题 hybrid-mmc/firmware', '正文 comment created #9'] },
      { title: '插件怎么分', lines: ['说的是别的仓 → 别的仓那一套'] },
      { title: '去 Gitea 取什么', lines: ['重读 firmware 的合并请求与 issue'] },
    ],
  },
  {
    id: 'collab-pr',
    label: '协作仓的合并请求事件',
    text: '协作仓自己的合并请求事件（打开、同步、关闭）不处理：合并请求由执行器定论，提交审核自己等结论；执行器合并后的 push 消息才让各成员取回（第一种情况）。',
    chain: [
      { title: 'Gitea 上发生的事', lines: ['bob 提交审核开出 #7，执行器随即给它结论', 'opened、synchronize、closed 都会推来消息'] },
      { title: 'webhook 请求体里起作用的字段', lines: ['.pull_request = { number: 7, … }'] },
      { title: 'ntfy 收到的消息', lines: ['标题 hybrid-mmc/collab', '正文 pr opened #7（或 synchronize / closed）'] },
      { title: '插件怎么分', lines: ['说的是协作仓 → 协作仓那一套：不处理', '提交审核自己等执行器的结论'] },
      { title: '去 Gitea 取什么', lines: ['不为这条消息取什么', 'main 的动静走 push 那条'] },
    ],
  },
  {
    id: 'repo-created',
    label: '组织里新建了仓',
    text: '组织里新建了仓：四项都没有，模板落到最后一层写 repo <动作>。插件把它克隆进项目文件夹，接着读一遍、核对一遍；删仓这类其他动作只记一行，本机的目录不动。',
    chain: [
      { title: 'Gitea 上发生的事', lines: ['有人在 hybrid-mmc 组织里建了仓 motor-lib'] },
      { title: 'webhook 请求体里起作用的字段', lines: ['.action = "created"', '.ref / .comment / .pull_request / .issue 都没有'] },
      { title: 'ntfy 收到的消息', lines: ['标题 hybrid-mmc/motor-lib', '正文 repo created'] },
      { title: '插件怎么分', lines: ['repo 事件 → 别的仓那一套的建仓分支', '删仓等其他动作只记一行'] },
      { title: '去 Gitea 取什么', lines: ['克隆进项目文件夹', '读一遍合并请求与 issue、核对一遍规矩'] },
    ],
  },
  {
    id: 'leads-changed',
    label: 'leads changed',
    text: 'leads changed 不是 Gitea 发的：collab.repo.setup、collab.repo.create 配好负责人后，调命令的人的插件往同一个 topic 直接发一条，不走 webhook。各成员的插件重读那个仓的负责人、再核对规矩。',
    chain: [
      { title: 'Gitea 上发生的事', lines: ['没有：不是 Gitea 的事件', '负责人在电脑上调 collab.repo.setup 配好了 firmware'] },
      { title: 'webhook 请求体里起作用的字段', lines: ['不经 webhook，没有请求体'] },
      { title: 'ntfy 收到的消息', lines: ['标题 hybrid-mmc/firmware', '正文 leads changed'] },
      { title: '插件怎么分', lines: ['Gitea 换协作者不发 webhook，靠这一条', '说的是别的仓 → 别的仓那一套（协作仓走自己那套，两步一样）'] },
      { title: '去 Gitea 取什么', lines: ['重读那个仓的负责人', '再核对它的规矩'] },
    ],
  },
  {
    id: 'unknown',
    label: '认不出的消息',
    text: '认不出的消息不猜：记一行警告，对那个组织的项目做一次完整刷新；同一个项目最快每 10 秒一次，有人乱发，完整刷新也快不过这个间隔。完整刷新两边各读一遍 Gitea，还核对组织 webhook 与订阅。',
    chain: [
      { title: 'Gitea 上发生的事', lines: ['没有：有人往 topic collab-hybrid-mmc 手动发了一条', '标题或正文不合插件的格式'] },
      { title: 'webhook 请求体里起作用的字段', lines: ['标题不是 <组织>/<仓>，或正文对不上 push / pr / issue / comment / repo 的格式'] },
      { title: 'ntfy 收到的消息', lines: ['认不出'] },
      { title: '插件怎么分', lines: ['记一行警告：认不出推来的消息（…），对这个组织的项目做一次完整刷新', '同一个项目最快每 10 秒一次'] },
      { title: '去 Gitea 取什么', lines: ['完整刷新：两边各读一遍 Gitea', '核对组织 webhook 与订阅'] },
    ],
  },
];
