import type { MentionPlace, Notification } from './notifications.js'

const mentionPlaceNames: Record<MentionPlace, string> = { comment: '评论', reply: '回复' }

function unsubmittedBreakdownOf(records: string[], siteFiles: string[]): string {
  return [records.length > 0 && `记录 ${records.length} 个`, siteFiles.length > 0 && `站点文件 ${siteFiles.length} 个`].filter(Boolean).join('，')
}

function issueAskedBy(poster: string, lastSpeaker: string, nameOf: (personId: string) => string): string {
  return lastSpeaker === poster ? `${nameOf(poster)} 提的` : `${nameOf(lastSpeaker)} 刚回复`
}

/** 一句话说清是什么事：网站提示栏与 QQ 通知用同一份。人名经 nameOf 从 Gitea 用户名换成显示名 */
export function notificationSentenceOf(notification: Notification, nameOf: (personId: string) => string): string {
  switch (notification.kind) {
    case 'unsubmitted': {
      const { records, siteFiles } = notification
      return `本机有 ${records.length + siteFiles.length} 个文件还没提交审核（${unsubmittedBreakdownOf(records, siteFiles)}）`
    }
    case 'conflicts':
      return `提交审核合 main 出了冲突，${notification.files.length} 个文件还没改好`
    case 'submit-failure':
      return '上次提交审核没成功'
    case 'sync-problem':
      return '没能自动同步 main 上的新改动'
    case 'check-error':
      return 'gwb 检查项目出错'
    case 'off-main':
      return `协作仓${notification.branch === null ? '在分离的 HEAD 上' : `在分支 ${notification.branch} 上`}，不在 main`
    case 'record-problem':
      return `collab/${notification.file} 读不对`
    case 'webhook-setup':
      return `组织 ${notification.organization} 的 webhook 没按插件要的配`
    case 'unpushed':
      return `${notification.repo} 有 ${notification.count} 个提交还没推送`
    case 'unpulled':
      return `${notification.repo} 服务器上有 ${notification.count} 个新提交还没拉下来`
    case 'diverged':
      return `${notification.repo} 和服务器分叉了：本地有 ${notification.ahead} 个提交没推送，服务器上有 ${notification.behind} 个没拉下来`
    case 'pull-to-review':
      return `${notification.repo} #${notification.number}「${notification.title}」等你审阅（${nameOf(notification.poster)} 开的）`
    case 'issue-to-answer':
      return `${notification.repo} 的 issue #${notification.number}「${notification.title}」等负责人回（${issueAskedBy(notification.poster, notification.lastSpeaker, nameOf)}）`
    case 'my-pull-update': {
      const action = notification.change === 'changes-requested' ? '要你改' : '评论了'
      return `${nameOf(notification.by)} ${action} ${notification.repo} #${notification.number}「${notification.title}」（你开的合并请求）`
    }
    case 'my-issue-answered':
      return `${nameOf(notification.by)} 回了 ${notification.repo} 的 issue #${notification.number}「${notification.title}」（你提的）`
    case 'repo-setup':
      return `${notification.repo} 没按规矩配好`
    case 'task':
      return `指派给我的任务：${notification.title}`
    case 'mention':
      return `${nameOf(notification.author)} 在${mentionPlaceNames[notification.in]}里 @了我`
    case 'reply':
      return `${nameOf(notification.author)} 回复了我`
  }
}

/** 原文：文件清单、报错原话、评论或任务正文、规矩不对的几条，一行一项；没有为 null */
export function notificationOriginalTextOf(notification: Notification): string | null {
  switch (notification.kind) {
    case 'unsubmitted':
      return [...notification.records.map((file) => `collab/${file}`), ...notification.siteFiles.map((file) => `site/${file}`)].join('\n')
    case 'conflicts':
      return notification.files.join('\n')
    case 'submit-failure':
    case 'check-error':
    case 'record-problem':
      return notification.message
    case 'sync-problem':
      return notification.reason
    case 'webhook-setup':
    case 'repo-setup':
      return notification.problems.join('\n')
    case 'task':
      return notification.detail
    case 'mention':
    case 'reply':
      return notification.text
    case 'off-main':
    case 'unpushed':
    case 'unpulled':
    case 'diverged':
    case 'pull-to-review':
    case 'issue-to-answer':
    case 'my-pull-update':
    case 'my-issue-answered':
      return null
  }
}
