/**
 * QqTiming（「gwb-collab：协作站插件」那一页「交给站点、协作窗格与 QQ」一节）的全部数据，画面（qq-timing.tsx）只读这一份。
 * QQ 私聊只发新出现、连续存在满 1 分钟的；期间消失过从头算；有一批里有 check-error 时已发的一个都不去掉。
 * 时长与规则照 qq-private-chat.ts 与 project-notifications.ts 抄并钉码；时间轴上的时刻（10 秒刷新完成、
 * 100 秒读失败、130 秒恢复）是为讲解拼的例子，规则本身（60 秒、一个不去掉）照代码。
 * 私聊两条原文按 notificationSentenceOf 的拼法用正文贯穿的例子（hybrid-mmc、carol 的 #7、显示名卡萝）排出。
 */

/** 连续存在这么久才私聊：先提交、一两秒后才推送时中间那条「还没推送」这类中间状态不发 */

/* ref file="../plugins/collab/src/notifications/qq-private-chat.ts" lines="11-12" hash="2aeced677d33" blob="fcc474a74e72" */
export const presentForMillisecondsBeforeSending = 60_000

/** 已发过的通知 id 记在 gwb-data 的这个文档里 */

/* ref file="../plugins/collab/src/notifications/qq-private-chat.ts" lines="8-9" hash="04978d91bd10" blob="fcc474a74e72" */
export const sentNotificationsDocKey = 'qq-sent-notifications'

/** 自己保存出来的改动不播报 */

/* ref file="../plugins/collab/src/notifications/qq-private-chat.ts" lines="35-36" hash="03ec9426e40a" blob="fcc474a74e72" */
export const silentKinds = ['unsubmitted']

/** 等待中的一条消失后再出现是另一个对象、等待从头算；交来一批后：消失了的从已发里去掉（再出现算新的一件事），
 *  这批里有 check-error 时一个都不去——读 Gitea 失败时读不到的合并请求看起来像消失了，恢复后不能当成新的重发 */

/* ref file="../plugins/collab/src/notifications/qq-private-chat.ts" lines="53-64" hash="f9897b2a1e77" blob="fcc474a74e72" */
export const disappearanceRule = '消失了的从已发里去掉，再出现算新的一件事；这批里有 check-error 时一个都不去'

/** 到点时还在等的（期间没消失过）才发；同时到点的合成一条 */

/* ref file="../plugins/collab/src/notifications/qq-private-chat.ts" lines="146-158" hash="16e8f5f6511c" blob="fcc474a74e72" */
export const sendRule = '到点时还在等的才发，同时到点的合成一条'

/** 插件加载后要先做完一次完整刷新才把通知交给通知渠道（QQ），之前读 Gitea 的结果还不齐 */

/* ref file="../plugins/collab/src/notifications/project-notifications.ts" lines="80-88" hash="7752c4b69579" blob="456019e4bd7c" */
export const refreshedOnceRule = '做完过一次完整刷新，才把此刻的通知交给 QQ'

/** 例子通知：别的仓 firmware 里 carol 开的合并请求 #7；id 的拼法照 notificationIdOf */

/* ref file="../packages/collab/src/core/notifications/notifications.ts" lines="113-116" hash="e5b500ffa058" blob="feb99d6138df" */
export const exampleNotification = {
  id: 'pull-to-review:firmware#7',
  sentence: 'firmware #7「修复」等你审阅（卡萝 开的）',
  checkError: 'gwb 检查项目出错',
}

/** 私聊的原文：第一行固定「协作站 加项目名」，后面每条通知一行短句，一条最长 600 字 */

/* ref file="../packages/collab/src/core/notifications/notification-text.ts" lines="40-41" hash="a01e2f4d09e7" blob="d8d56dd65fa0" */
export const chatLines = ['协作站 混合型 MMC', 'firmware #7「修复」等你审阅（卡萝 开的）']

/** 时间轴上的关键时刻（秒）：10 刷新完成、#7 出现并开始计时；70 满 1 分钟发出；100 读 Gitea 失败；130 恢复 */
export const timeline = {
  totalSeconds: 160,
  appearAt: 10,
  sendAfter: 60,
  failAt: 100,
  recoverAt: 130,
  ticks: [0, 10, 70, 100, 130, 160],
}

export const chapters = [
  {
    title: '0–10 秒 · 完整刷新还没做完',
    text: '插件加载后要先做完一次完整刷新才交给 QQ：之前读 Gitea 的结果还不齐，还没读到的会被当成消失了。这 10 秒里 #7 已经在站点提示栏里（提示栏每次现算），但一个也不交给 QQ。',
    duration: 10,
  },
  {
    title: '10–70 秒 · 出现并计时，满 1 分钟发出',
    text: '刷新完成，此刻的通知整批交来：别的仓 firmware 里 carol 开的合并请求 #7「修复」等 bob 审阅。没发过的开始计时——连续存在满 1 分钟才私聊，只存在几秒的中间状态不发。70 秒满时长，发出私聊。',
    duration: 60,
  },
  {
    title: '70–100 秒 · 已发过，不重发',
    text: '又一次交来同一批：#7 的 id 已经记在 gwb-data 的文档 qq-sent-notifications 里，不再计时、不再发。它在站点提示栏里还在——提示栏每次现算，QQ 只记发没发过。',
    duration: 30,
  },
  {
    title: '100–130 秒 · 读 Gitea 失败',
    text: '读 Gitea 的一步出了错（这批里有 check-error），#7 读不到、看起来像消失了。这时已发的 id 一个都不去掉：恢复后不能当成新的一件事重发。',
    duration: 30,
  },
  {
    title: '130–160 秒 · 恢复，也不重发',
    text: 'Gitea 恢复，#7 又交来了。它的 id 还在 qq-sent-notifications 里，不重发。真消失了（比如合并请求被合并）才把它从已发里去掉，之后再出现才算新的一件事。',
    duration: 30,
  },
]
