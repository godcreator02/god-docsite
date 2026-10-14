import { notificationGroupOf, notificationOriginalTextOf, notificationSentenceOf, type Notification, type NotificationGroup, type NotificationKind } from '@godcreator/collab'
import { CollabRejected } from '../errors.js'

/** 设置 ai-handling 的取值：off 不交给 AI；zcode 在 ZCode 桌面端开会话；claude-terminal 新开一个 pwsh 窗口运行 Claude Code */
export const aiHandlingModes = ['off', 'zcode', 'claude-terminal'] as const
export type AiHandlingMode = (typeof aiHandlingModes)[number]

export function aiHandlingModeOf(value: unknown): AiHandlingMode {
  const mode = aiHandlingModes.find((each) => each === value)
  if (mode === undefined) throw new CollabRejected(`设置 ai-handling 只能是 ${aiHandlingModes.join(' / ')}，读到 ${JSON.stringify(value)}`)
  return mode
}

/** 提示词开头写的项目：站名是 site/content/meta.json 的 title，repo 是协作仓根的绝对路径 */
export type AiPromptProject = { title: string; repo: string }

const groupLabel: Record<NotificationGroup, string> = { 'collab-repo': '协作仓', 'other-repos': '别的仓', 'for-me': '找我的' }

/** 说明书 collab 里写着某种通知怎么处理的那一节：附件路径（skill.read 的 file 参数）与节名 */
type HandlingSection = { file: `references/${string}.md`; section: string }

const collabRepoNotices: HandlingSection = { file: 'references/collab-repo.md', section: '通知' }
const otherReposNotices: HandlingSection = { file: 'references/other-repos.md', section: '通知' }
const organizationWebhook: HandlingSection = { file: 'references/organization.md', section: '组织 webhook' }

/** 每种通知照说明书 collab 的哪一节处理；处理办法只写在说明书里，插件只指过去 */
const handlingSectionOfKind = {
  unsubmitted: collabRepoNotices,
  conflicts: collabRepoNotices,
  'submit-failure': collabRepoNotices,
  'sync-problem': collabRepoNotices,
  'check-error': collabRepoNotices,
  'off-main': collabRepoNotices,
  'record-problem': collabRepoNotices,
  'webhook-setup': organizationWebhook,
  unpushed: otherReposNotices,
  unpulled: otherReposNotices,
  diverged: otherReposNotices,
  'pull-to-review': otherReposNotices,
  'issue-to-answer': otherReposNotices,
  'my-pull-update': otherReposNotices,
  'my-issue-answered': otherReposNotices,
  'repo-setup': otherReposNotices,
  task: collabRepoNotices,
  mention: collabRepoNotices,
  reply: collabRepoNotices,
} as const satisfies Record<NotificationKind, HandlingSection>

function skillReadCallOf(file?: string): string {
  return `run skill.read ${JSON.stringify(file === undefined ? { name: 'collab' } : { name: 'collab', file })}`
}

/** 这批通知用到的附件，按第一次用到的顺序，不重复 */
function referenceFilesOf(notifications: Notification[]): string[] {
  return [...new Set(notifications.map((notification) => handlingSectionOfKind[notification.kind].file))]
}

/** ZCode 的会话是完全访问，工具层面拦不住改文件、调命令，只能靠提示词：写在读说明书之前，结尾再重复一句 */
const listPlanAndWaitRule = [
  '这一轮只读和整理，不动手：',
  '- 读完下面的说明书和要处理的事，逐条列出打算怎么处理：改哪些文件、调哪些命令。',
  '- 列完就停下，等人回复。',
  '- 人明确同意之前，不改任何文件，也不调任何会改东西的命令：collab.submit、collab.task.*、collab.module.*、docsite.comment.*、collab.repos.update、collab.org.setup、gitea.http 的写请求（POST、PUT、PATCH、DELETE）、git commit、git push 都算。',
  '- 人只同意了其中几条，就只做那几条。',
].join('\n')

const listPlanAndWaitReminder = '再说一遍：先列出每条打算怎么处理，然后停下等人回复；人明确同意之前不改文件、不调会改东西的命令。'

function readSkillInstructionOf(notifications: Notification[]): string {
  const reads = [skillReadCallOf(), ...referenceFilesOf(notifications).map((file) => skillReadCallOf(file))]
  return `经 gwb MCP 读说明书 collab 的主文件和这批通知用到的附件：\n${reads.join('\n')}\n人同意以后照说明书用 collab.* 命令做事，命令的 repo 参数填上面的协作仓路径。`
}

function promptBlockOf(notification: Notification, index: number, nameOf: (personId: string) => string): string {
  const { file, section } = handlingSectionOfKind[notification.kind]
  const lines = [`${index + 1}. 【${groupLabel[notificationGroupOf(notification)]}】${notificationSentenceOf(notification, nameOf)}`, `   照说明书 collab 的附件 ${file} 的「${section}」一节处理。`]
  const original = notificationOriginalTextOf(notification)
  if (original !== null) lines.push('   原文：', ...original.split('\n').map((line) => `   > ${line}`))
  return lines.join('\n')
}

/** 交给 AI 的完整提示词：一个项目的全部通知一起交，按通知的顺序。ZCode 拿第一行当会话标题，第一行不写 Markdown 标记 */
export function aiPromptOf(project: AiPromptProject, notifications: Notification[], nameOf: (personId: string) => string): string {
  if (notifications.length === 0) throw new CollabRejected(`${project.title} 现在没有要处理的事，没有交给 AI`)
  const heading =
    notifications.length === 1 ? `协作站要处理的事（${project.title}）：${notificationSentenceOf(notifications[0]!, nameOf)}` : `协作站要处理的 ${notifications.length} 件事（${project.title}）`
  return (
    [
      heading,
      `项目站：${project.title}\n协作仓：${project.repo}`,
      listPlanAndWaitRule,
      readSkillInstructionOf(notifications),
      `要处理的事：\n${notifications.map((notification, index) => promptBlockOf(notification, index, nameOf)).join('\n\n')}`,
      `${listPlanAndWaitReminder}\n照说明书主文件的「始终照做」。`,
    ].join('\n\n') + '\n'
  )
}

/** 交出去之后回的：交给了谁、在哪看（ZCode 的会话 id，或写着提示词的文件） */
export type AiHandoffReceipt = { handler: 'zcode' | 'claude-terminal'; detail: string }

/** 交出提示词的两种做法，回在哪看：ZCode 的会话 id，或写着提示词的文件 */
export type AiHandoffs = {
  zcode(repo: string, prompt: string): Promise<string>
  claudeTerminal(repo: string, prompt: string): Promise<string>
}

/** 照设置 ai-handling 把提示词交出去；off 时拒绝，写明去哪里改 */
export async function handOffAsSet(mode: AiHandlingMode, repo: string, prompt: string, handoffs: AiHandoffs): Promise<AiHandoffReceipt> {
  if (mode === 'off') throw new CollabRejected('设置 ai-handling 是 off，没有交给 AI：在 gwb 设置里把 gwb-collab 的 ai-handling 改成 zcode 或 claude-terminal')
  if (mode === 'zcode') return { handler: 'zcode', detail: await handoffs.zcode(repo, prompt) }
  return { handler: 'claude-terminal', detail: await handoffs.claudeTerminal(repo, prompt) }
}
