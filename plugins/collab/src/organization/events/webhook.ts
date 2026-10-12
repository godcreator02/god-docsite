import { CollabRejected } from '../../errors.js'
import { organizationHooks, writeOrganizationHook, type GiteaHttp, type OrganizationHook } from '../../gitea-api/gitea.js'
import { repoKeyOf } from '../../project/project.js'
import { pushTopicOf } from './messages.js'

/**
 * 每个协作组织一个组织级 webhook，发到 NAS 上和 Gitea 同在一个 compose 里的 ntfy（Gitea 那边按服务名 ntfy 访问）。
 * 消息只带位置：标题是 <组织>/<仓>，正文是 push <ref>、pr <动作> #<编号>、comment <动作> #<编号>、issue <动作> #<编号>、repo <动作>；
 * 由 ntfy 的消息模板从 Gitea 的请求体里取。管理员用 collab.org.setup 照这里写进组织，完整刷新时管理员的插件照这里核对
 */
const ntfyInGitea = 'http://ntfy'

const titleTemplate = '{{.repository.full_name}}'

/**
 * 判断顺序有讲究：评论的请求体里也有 issue，合并请求上的评论还带着 pull_request，要最先认 comment；
 * 合并请求的审阅请求体里有 pull_request、没有 comment，动作是 reviewed
 */
const messageTemplate =
  '{{if .ref}}push {{.ref}}' +
  '{{else if .comment}}comment {{.action}} #{{.issue.number}}' +
  '{{else if .pull_request}}pr {{.action}} #{{.pull_request.number}}' +
  '{{else if .issue}}issue {{.action}} #{{.issue.number}}' +
  '{{else}}repo {{.action}}{{end}}'

/**
 * 写入时的事件名：带 _only 的只订那一个事件，不带的会把指派、标签、里程碑这些子事件一起订上。
 * pull_request_review 一个名字订上审阅的批准、要求修改、评论三种；pull_request_comment 是合并请求上的评论，issue_comment 只管 issue 上的
 */
export const webhookEventsToWrite = ['push', 'pull_request_only', 'pull_request_sync', 'pull_request_review', 'pull_request_comment', 'issues_only', 'issue_comment', 'repository']

/** 写好以后 Gitea 读回来的事件名：每个事件各列一个 */
export const webhookEventsReadBack = ['push', 'pull_request', 'pull_request_sync', 'pull_request_review', 'pull_request_comment', 'issues', 'issue_comment', 'repository']

function webhookBaseOf(organization: string): string {
  return `${ntfyInGitea}/${pushTopicOf(organization)}`
}

/** 期望的完整地址：ntfy 的 topic 加上标题与正文的模板 */
export function webhookUrlOf(organization: string): string {
  return `${webhookBaseOf(organization)}?template=yes&t=${encodeURIComponent(titleTemplate)}&m=${encodeURIComponent(messageTemplate)}`
}

/** 发到这个组织 topic 的 webhook（地址去掉查询串以后就是 topic 的地址） */
function collabHooksOf(hooks: OrganizationHook[], organization: string): OrganizationHook[] {
  const base = webhookBaseOf(organization)
  return hooks.filter((hook) => hook.url.split('?')[0] === base)
}

/** 一个组织的 webhook 和期望配置比，每条是给人看的一句；都对时为空 */
export function webhookProblemsOf(hooks: OrganizationHook[], organization: string): string[] {
  const matching = collabHooksOf(hooks, organization)
  if (matching.length === 0) return [`没有发到 ${webhookBaseOf(organization)} 的 webhook：成员收不到这个组织的实时推送`]
  if (matching.length > 1) return [`有 ${matching.length} 个发到 ${webhookBaseOf(organization)} 的 webhook（${matching.map((hook) => `#${hook.id}`).join('、')}），同一件事会推送几次`]
  const hook = matching[0]!
  const problems: string[] = []
  if (hook.url !== webhookUrlOf(organization)) problems.push('地址里的消息模板和插件要的不一样：插件认不出推来的消息，只能每次做完整检查')
  if (hook.type !== 'gitea') problems.push(`类型是 ${hook.type}，要是 gitea`)
  if (hook.contentType !== 'json') problems.push(`请求体是 ${hook.contentType}，要是 json：ntfy 的消息模板只认 JSON`)
  if (!hook.active) problems.push('webhook 停用了')
  const missing = webhookEventsReadBack.filter((event) => !hook.events.includes(event))
  if (missing.length > 0) problems.push(`少订了事件 ${missing.join('、')}`)
  const extra = hook.events.filter((event) => !webhookEventsReadBack.includes(event))
  if (extra.length > 0) problems.push(`多订了事件 ${extra.join('、')}`)
  return problems
}

/** 管理员的插件完整刷新时核对；不是组织管理员读不到 webhook，为 null */
export async function organizationWebhookProblems(http: GiteaHttp, organization: string): Promise<string[] | null> {
  const hooks = await organizationHooks(http, organization)
  return hooks === null ? null : webhookProblemsOf(hooks, organization)
}

/** 组织的 webhook 和插件要的不一样：哪个组织，problems 每条是给人看的一句 */
export type WebhookProblem = { organization: string; problems: string[] }

/** 各项目所在组织的 webhook 核对结果，按项目仓根记；对了、不是组织管理员（读不到）、还没核对过为 null。变了调 onChange */
export class WebhookChecks {
  private readonly problems = new Map<string, WebhookProblem>()

  constructor(
    private readonly http: GiteaHttp,
    private readonly onChange: (repo: string) => void,
  ) {}

  async check(repo: string, organization: string): Promise<void> {
    const problems = await organizationWebhookProblems(this.http, organization)
    const next = problems === null || problems.length === 0 ? null : { organization, problems }
    if (JSON.stringify(next) === JSON.stringify(this.problemOf(repo))) return
    if (next === null) this.problems.delete(repoKeyOf(repo))
    else this.problems.set(repoKeyOf(repo), next)
    this.onChange(repo)
  }

  problemOf(repo: string): WebhookProblem | null {
    return this.problems.get(repoKeyOf(repo)) ?? null
  }

  forget(repo: string): void {
    this.problems.delete(repoKeyOf(repo))
  }
}

export type WebhookSetupResult = { organization: string; hook: number; outcome: 'created' | 'updated' | 'unchanged'; url: string; events: string[] }

/**
 * 把组织的 webhook 写成期望配置：没有就建，有一个就改它，已经对了就不动；发到这个 topic 的有好几个就拒绝、列出编号，由人决定留哪个。
 * 写完读回来再核对一次，还不对就报出来（Gitea 换了事件名这类）
 */
export async function setupOrganizationWebhook(http: GiteaHttp, organization: string): Promise<WebhookSetupResult> {
  const hooks = await organizationHooks(http, organization)
  if (hooks === null) throw new CollabRejected(`读不到组织 ${organization} 的 webhook（Gitea 回 403）：本机身份不是这个组织的管理员，请组织管理员来配`)
  const matching = collabHooksOf(hooks, organization)
  if (matching.length > 1) {
    throw new CollabRejected(`组织 ${organization} 有 ${matching.length} 个发到 ${webhookBaseOf(organization)} 的 webhook（${matching.map((hook) => `#${hook.id}`).join('、')}）：先在 Gitea 网页上删到只剩一个，再调这条命令`)
  }
  const existing = matching[0] ?? null
  if (existing !== null && webhookProblemsOf(hooks, organization).length === 0) {
    return { organization, hook: existing.id, outcome: 'unchanged', url: existing.url, events: existing.events }
  }
  const written = await writeOrganizationHook(http, organization, existing?.id ?? null, { url: webhookUrlOf(organization), events: webhookEventsToWrite })
  const problems = webhookProblemsOf([written], organization)
  if (problems.length > 0) throw new CollabRejected(`组织 ${organization} 的 webhook #${written.id} 写了，但读回来还不对：${problems.join('；')}`)
  return { organization, hook: written.id, outcome: existing === null ? 'created' : 'updated', url: written.url, events: written.events }
}
