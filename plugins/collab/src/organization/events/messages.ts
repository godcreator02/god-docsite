import type { NtfyMessage } from './ntfy-subscription.js'

/** 一个组织的 ntfy topic：组织级 webhook 发到这里，collab.repo.setup 配完负责人也发到这里 */
export function pushTopicOf(organization: string): string {
  return `collab-${organization}`
}

/**
 * 推来的一条消息说的是哪里出了什么事。消息只当位置用，事实由两边自己去 Gitea 取；repo 是 Gitea 上的仓名。
 * 格式见 webhook.ts：标题 <组织>/<仓>，正文 push <ref>、pr|issue|comment <动作> #<编号>、repo <动作>，
 * 以及 collab.repo.setup 配完负责人自己发的 leads changed
 */
export type PushEvent =
  | { kind: 'push'; repo: string; ref: string }
  | { kind: 'pr' | 'issue' | 'comment'; repo: string; action: string; number: number }
  | { kind: 'repo'; repo: string; action: string }
  | { kind: 'leads'; repo: string }

const numberedPattern = /^(pr|issue|comment) ([a-z_]+) #(\d+)$/

/** 认得出就回事件；标题不是这个 topic 的组织下的仓、正文格式不对都回 null，由调用方记一行警告、做一次完整刷新 */
export function pushEventOf({ topic, title, message }: NtfyMessage): PushEvent | null {
  if (title === null || message === null) return null
  const slash = title.indexOf('/')
  if (slash < 0 || pushTopicOf(title.slice(0, slash)) !== topic) return null
  const repo = title.slice(slash + 1)
  if (repo === '' || repo.includes('/')) return null
  const body = message.trim()
  if (body === 'leads changed') return { kind: 'leads', repo }
  if (body.startsWith('push ') && !body.slice(5).includes(' ')) return { kind: 'push', repo, ref: body.slice(5) }
  const numbered = numberedPattern.exec(body)
  if (numbered !== null) return { kind: numbered[1] as 'pr' | 'issue' | 'comment', repo, action: numbered[2]!, number: Number(numbered[3]) }
  const repoAction = /^repo ([a-z_]+)$/.exec(body)
  if (repoAction !== null) return { kind: 'repo', repo, action: repoAction[1]! }
  return null
}

/** 两个事件要做的事一样时 key 一样：同一个仓的合并请求、issue 与评论都是重读那个仓 */
function workKeyOf(event: PushEvent): string {
  switch (event.kind) {
    case 'push':
      return `push:${event.repo}`
    case 'pr':
    case 'issue':
    case 'comment':
      return `activity:${event.repo}`
    case 'repo':
      return `repo:${event.repo}:${event.action}`
    case 'leads':
      return `leads:${event.repo}`
  }
}

/** 同一批里要做的事一样的只做一次：一次合并会连着推来 push 与合并请求关闭 */
export function distinctEvents(events: PushEvent[]): PushEvent[] {
  const seen = new Set<string>()
  return events.filter((event) => {
    const key = workKeyOf(event)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
