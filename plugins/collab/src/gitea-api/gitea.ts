import { CollabRejected } from '../errors.js'

type GiteaRequest = { method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'; path: string; query?: Record<string, string | number | boolean>; body?: Record<string, unknown> }
type GiteaResponse = { status: number; body: unknown }

/** 发一条 Gitea 接口调用；生产里经 gwb-gitea 插件的服务 gwbGitea 发，测试里换成假的 */
export type GiteaHttp = (request: GiteaRequest) => Promise<GiteaResponse>

/** 列出别的仓开着的合并请求要看的字段；url 是网页地址 */
type PullRequest = { number: number; title: string; poster: string; baseRef: string; url: string }

/** 提交审核等执行器结论时看的：还开着，还是已关闭（merged 为 true 是合并了，false 是被打回） */
type PullState = { open: boolean; merged: boolean }

const pageSize = 50

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Gitea 回的数据是外部输入：缺字段、类型不对就报出来，不猜 */
function fieldOf<T>(record: Record<string, unknown>, key: string, check: (value: unknown) => value is T, what: string): T {
  const value = record[key]
  if (!check(value)) throw new CollabRejected(`Gitea 回的${what}里 ${key} 不对：${JSON.stringify(value)}`)
  return value
}

const isNumber = (value: unknown): value is number => typeof value === 'number'
const isString = (value: unknown): value is string => typeof value === 'string'

function pullOf(raw: unknown): PullRequest {
  if (!isRecord(raw)) throw new CollabRejected('Gitea 回的合并请求不是对象')
  const what = '合并请求'
  const user = fieldOf(raw, 'user', isRecord, what)
  const base = fieldOf(raw, 'base', isRecord, what)
  return {
    number: fieldOf(raw, 'number', isNumber, what),
    title: fieldOf(raw, 'title', isString, what),
    poster: fieldOf(user, 'login', isString, what),
    baseRef: fieldOf(base, 'ref', isString, what),
    url: fieldOf(raw, 'html_url', isString, what),
  }
}

const isBoolean = (value: unknown): value is boolean => typeof value === 'boolean'

function requireSuccess(response: GiteaResponse, doing: string): unknown {
  if (response.status >= 200 && response.status < 300) return response.body
  const message = isRecord(response.body) && isString(response.body['message']) ? response.body['message'] : JSON.stringify(response.body)
  throw new CollabRejected(`${doing}失败：Gitea 回 ${response.status}，${message}`)
}

/** 一页一页取完；Gitea 的列表接口默认每页不多 */
async function allPages(http: GiteaHttp, path: string, query: Record<string, string | number | boolean>, doing: string): Promise<unknown[]> {
  const items: unknown[] = []
  for (let page = 1; ; page++) {
    const body = requireSuccess(await http({ method: 'GET', path, query: { ...query, limit: pageSize, page } }), doing)
    if (!Array.isArray(body)) throw new CollabRejected(`${doing}：Gitea 回的不是列表`)
    items.push(...(body as unknown[]))
    if (body.length < pageSize) return items
  }
}

/** 分支保护里的一项许可：restricted 为假是没限定人，有写权限的都能做；为真时只许 users 与 teams 里的 */
export type Allowance = { restricted: boolean; users: string[]; teams: string[] }

/** main 的分支保护里和负责人有关的几项：谁能直接推、谁能合并、允不允许强制推送 */
export type MainProtection = { push: Allowance; merge: Allowance; forcePushAllowed: boolean }

const isStringArray = (value: unknown): value is string[] => Array.isArray(value) && value.every(isString)

function mainProtectionOf(raw: unknown, what: string): MainProtection {
  if (!isRecord(raw)) throw new CollabRejected(`Gitea 回的${what}不是对象`)
  const pushEnabled = fieldOf(raw, 'enable_push', isBoolean, what)
  const pushWhitelisted = fieldOf(raw, 'enable_push_whitelist', isBoolean, what)
  return {
    // enable_push 为假是谁都不能直接推：也算限定了人，许可里没有人
    push: pushEnabled
      ? { restricted: pushWhitelisted, users: fieldOf(raw, 'push_whitelist_usernames', isStringArray, what), teams: fieldOf(raw, 'push_whitelist_teams', isStringArray, what) }
      : { restricted: true, users: [], teams: [] },
    merge: {
      restricted: fieldOf(raw, 'enable_merge_whitelist', isBoolean, what),
      users: fieldOf(raw, 'merge_whitelist_usernames', isStringArray, what),
      teams: fieldOf(raw, 'merge_whitelist_teams', isStringArray, what),
    },
    forcePushAllowed: fieldOf(raw, 'enable_force_push', isBoolean, what),
  }
}

/**
 * 一个仓上用到的接口：有没有 main 分支、调用者是不是管理员、协作者（就是负责人）与 main 的保护，加减协作者，列出开着的合并请求与 issue、读合并请求的审阅、读 issue 或合并请求的最后一条评论；
 * 协作仓提交审核等结论时查状态、读执行器的留言，执行器一直没给结论时关掉。
 * 协作仓的合并与打回由 NAS 上的执行器做，不在插件里
 */
export function giteaRepo(http: GiteaHttp, owner: string, repo: string) {
  const base = `/repos/${owner}/${repo}`
  return {
    /** 协作者的登录名，也就是这个仓的负责人；项目成员都读得到（分支保护只有管理员读得到） */
    async collaborators(): Promise<string[]> {
      const users = await allPages(http, `${base}/collaborators`, {}, `读 ${owner}/${repo} 的协作者`)
      return users.map((raw) => {
        if (!isRecord(raw)) throw new CollabRejected(`Gitea 回的 ${owner}/${repo} 的协作者不是对象`)
        return fieldOf(raw, 'login', isString, '协作者')
      })
    },
    /** 加成协作者、权限是「管理」；已经是协作者就把权限改成「管理」 */
    async addAdminCollaborator(login: string): Promise<void> {
      requireSuccess(await http({ method: 'PUT', path: `${base}/collaborators/${login}`, body: { permission: 'admin' } }), `把 ${login} 加成 ${owner}/${repo} 的协作者（管理）`)
    },
    async removeCollaborator(login: string): Promise<void> {
      requireSuccess(await http({ method: 'DELETE', path: `${base}/collaborators/${login}` }), `把 ${login} 从 ${owner}/${repo} 的协作者里删掉`)
    },
    /** main 的保护规则；没有名为 main 的规则时 Gitea 回 404，这时为 null。只有仓的管理员读得到 */
    async mainProtection(): Promise<MainProtection | null> {
      const response = await http({ method: 'GET', path: `${base}/branch_protections/main` })
      if (response.status === 404) return null
      return mainProtectionOf(requireSuccess(response, `读 ${owner}/${repo} 的 main 分支保护`), `${owner}/${repo} 的 main 分支保护`)
    },
    /** 有没有 main 分支：空仓还没有，Gitea 回 404 */
    async hasMain(): Promise<boolean> {
      const response = await http({ method: 'GET', path: `${base}/branches/main` })
      if (response.status === 404) return false
      requireSuccess(response, `读 ${owner}/${repo} 的 main 分支`)
      return true
    },
    /** 调用者（令牌的账号）是不是这个仓的管理员：成员在组织里建仓时 Gitea 把建仓的人设成管理员 */
    async callerIsAdmin(): Promise<boolean> {
      const raw = requireSuccess(await http({ method: 'GET', path: base }), `读仓 ${owner}/${repo} 的权限`)
      const what = `仓 ${owner}/${repo}`
      if (!isRecord(raw)) throw new CollabRejected(`Gitea 回的${what}不是对象`)
      return fieldOf(fieldOf(raw, 'permissions', isRecord, what), 'admin', isBoolean, `${what}的 permissions`)
    },
    async openPulls(): Promise<PullRequest[]> {
      return (await allPages(http, `${base}/pulls`, { state: 'open' }, '列出合并请求')).map(pullOf)
    },
    async pullState(number: number): Promise<PullState> {
      const raw = requireSuccess(await http({ method: 'GET', path: `${base}/pulls/${number}` }), `查合并请求 #${number}`)
      if (!isRecord(raw)) throw new CollabRejected(`Gitea 回的合并请求 #${number} 不是对象`)
      const what = `合并请求 #${number}`
      return { open: fieldOf(raw, 'state', isString, what) === 'open', merged: fieldOf(raw, 'merged', isBoolean, what) }
    },
    /** 合并请求上最后一条留言的正文；一条都没有为 null */
    async lastComment(number: number): Promise<string | null> {
      const comments = await allPages(http, `${base}/issues/${number}/comments`, {}, `读合并请求 #${number} 的留言`)
      const last = comments.at(-1)
      if (last === undefined) return null
      if (!isRecord(last)) throw new CollabRejected(`Gitea 回的合并请求 #${number} 的留言不是对象`)
      return fieldOf(last, 'body', isString, '留言')
    },
    async close(number: number): Promise<void> {
      requireSuccess(await http({ method: 'PATCH', path: `${base}/pulls/${number}`, body: { state: 'closed' } }), `关闭合并请求 #${number}`)
    },
    /** 合并请求上的审阅，按提交的先后排（Gitea 按 id 升序回） */
    async pullReviews(number: number): Promise<PullReview[]> {
      const what = `${owner}/${repo} 合并请求 #${number} 的审阅`
      return (await allPages(http, `${base}/pulls/${number}/reviews`, {}, `读${what}`)).map((raw) => pullReviewOf(raw, what))
    },
    /** 开着的 issue（不含合并请求） */
    async openIssues(): Promise<Issue[]> {
      return (await allPages(http, `${base}/issues`, { state: 'open', type: 'issues' }, `列出 ${owner}/${repo} 的 issue`)).map((raw) => issueOf(raw, `${owner}/${repo} 的 issue`))
    },
    /** 一条 issue；编号指的是合并请求时 isPull 为真。Gitea 回 404 时为 null（删了，或编号不对） */
    async issue(number: number): Promise<Issue | null> {
      const response = await http({ method: 'GET', path: `${base}/issues/${number}` })
      if (response.status === 404) return null
      return issueOf(requireSuccess(response, `读 ${owner}/${repo} 的 issue #${number}`), `${owner}/${repo} 的 issue #${number}`)
    },
    /** issue 上最后一条评论的作者；一条评论都没有为 null */
    async lastCommenter(number: number): Promise<string | null> {
      const comments = await allPages(http, `${base}/issues/${number}/comments`, {}, `读 ${owner}/${repo} 的 issue #${number} 的评论`)
      const last = comments.at(-1)
      if (last === undefined) return null
      if (!isRecord(last)) throw new CollabRejected(`Gitea 回的 ${owner}/${repo} 的 issue #${number} 的评论不是对象`)
      return fieldOf(fieldOf(last, 'user', isRecord, '评论'), 'login', isString, '评论的作者')
    },
  }
}

/** 一条审阅要看的字段：state 是 Gitea 的原值（APPROVED、REQUEST_CHANGES、COMMENT、PENDING 等），dismissed 是被撤销了 */
export type PullReview = { reviewer: string; state: string; dismissed: boolean }

function pullReviewOf(raw: unknown, what: string): PullReview {
  if (!isRecord(raw)) throw new CollabRejected(`Gitea 回的${what}不是对象`)
  return {
    reviewer: fieldOf(fieldOf(raw, 'user', isRecord, what), 'login', isString, what),
    state: fieldOf(raw, 'state', isString, what),
    dismissed: fieldOf(raw, 'dismissed', isBoolean, what),
  }
}

/** 一条 issue 要看的字段：comments 是评论条数，open 是还开着，isPull 是这个编号其实是合并请求 */
export type Issue = { number: number; title: string; poster: string; url: string; comments: number; open: boolean; isPull: boolean }

function issueOf(raw: unknown, what: string): Issue {
  if (!isRecord(raw)) throw new CollabRejected(`Gitea 回的${what}不是对象`)
  return {
    number: fieldOf(raw, 'number', isNumber, what),
    title: fieldOf(raw, 'title', isString, what),
    poster: fieldOf(fieldOf(raw, 'user', isRecord, what), 'login', isString, what),
    url: fieldOf(raw, 'html_url', isString, what),
    comments: fieldOf(raw, 'comments', isNumber, what),
    open: fieldOf(raw, 'state', isString, what) === 'open',
    isPull: raw['pull_request'] !== null && raw['pull_request'] !== undefined,
  }
}

/** 组织级 webhook 里核对要看的：读回来的事件名是 Gitea 按每个事件各列一个的名字（如 pull_request、issues） */
export type OrganizationHook = { id: number; type: string; url: string; contentType: string; events: string[]; active: boolean }

function organizationHookOf(raw: unknown, what: string): OrganizationHook {
  if (!isRecord(raw)) throw new CollabRejected(`Gitea 回的${what}不是对象`)
  const config = fieldOf(raw, 'config', isRecord, what)
  return {
    id: fieldOf(raw, 'id', isNumber, what),
    type: fieldOf(raw, 'type', isString, what),
    url: fieldOf(config, 'url', isString, `${what}的 config`),
    contentType: fieldOf(config, 'content_type', isString, `${what}的 config`),
    events: fieldOf(raw, 'events', isStringArray, what),
    active: fieldOf(raw, 'active', isBoolean, what),
  }
}

/** 组织的 webhook；只有组织管理员读得到，别人 Gitea 回 403，这时为 null */
export async function organizationHooks(http: GiteaHttp, organization: string): Promise<OrganizationHook[] | null> {
  const response = await http({ method: 'GET', path: `/orgs/${organization}/hooks` })
  if (response.status === 403) return null
  const hooks = requireSuccess(response, `读组织 ${organization} 的 webhook`)
  if (!Array.isArray(hooks)) throw new CollabRejected(`读组织 ${organization} 的 webhook：Gitea 回的不是列表`)
  return hooks.map((raw) => organizationHookOf(raw, `组织 ${organization} 的 webhook`))
}

/** 写组织 webhook 时交给 Gitea 的：地址与事件一起写（只改地址，Gitea 会把事件重置成只剩 push）；events 用写入时的事件名 */
export type OrganizationHookWrite = { url: string; events: string[] }

/** id 为 null 时新建一个 gitea 类型的 webhook，否则改那一个；回写完以后 Gitea 读回来的样子 */
export async function writeOrganizationHook(http: GiteaHttp, organization: string, id: number | null, hook: OrganizationHookWrite): Promise<OrganizationHook> {
  const body = { config: { url: hook.url, content_type: 'json', http_method: 'post' }, events: hook.events, active: true, branch_filter: '*' }
  const request: GiteaRequest =
    id === null ? { method: 'POST', path: `/orgs/${organization}/hooks`, body: { type: 'gitea', ...body } } : { method: 'PATCH', path: `/orgs/${organization}/hooks/${id}`, body }
  return organizationHookOf(requireSuccess(await http(request), id === null ? `给组织 ${organization} 加 webhook` : `改组织 ${organization} 的 webhook #${id}`), `组织 ${organization} 的 webhook`)
}

export type GiteaRepo = ReturnType<typeof giteaRepo>

/** Gitea 的组织名与仓名只含这些字符；克隆时它们直接当目录名用 */
const giteaNamePattern = /^[A-Za-z0-9_.-]+$/

export function isGiteaName(name: string): boolean {
  return giteaNamePattern.test(name) && name !== '.' && name !== '..'
}

/** 组织里没归档的仓的名字；组织私有，要令牌。归档的仓是只读存档，不克隆进项目文件夹，本机删掉后也不再补回来 */
export async function organizationRepoNames(http: GiteaHttp, organization: string): Promise<string[]> {
  const repos = await allPages(http, `/orgs/${organization}/repos`, {}, `列出组织 ${organization} 的仓`)
  return repos.flatMap((raw) => {
    if (!isRecord(raw)) throw new CollabRejected(`Gitea 回的组织 ${organization} 的仓不是对象`)
    const name = fieldOf(raw, 'name', isString, '仓')
    if (!isGiteaName(name)) throw new CollabRejected(`Gitea 回的组织 ${organization} 里有个仓名 ${JSON.stringify(name)} 不能当目录名`)
    return fieldOf(raw, 'archived', isBoolean, `仓 ${name}`) ? [] : [name]
  })
}

/** 在组织里建私有仓，带一个初始提交、默认分支 main；回仓的网页地址。令牌缺权限时 Gitea 回 403，原话里写着缺哪一项 */
export async function createOrganizationRepo(http: GiteaHttp, organization: string, name: string, description: string): Promise<{ url: string }> {
  const raw = requireSuccess(
    await http({ method: 'POST', path: `/orgs/${organization}/repos`, body: { name, description, private: true, default_branch: 'main', auto_init: true } }),
    `建仓 ${name}（组织 ${organization}）`,
  )
  if (!isRecord(raw)) throw new CollabRejected(`Gitea 回的新仓 ${organization}/${name} 不是对象`)
  return { url: fieldOf(raw, 'html_url', isString, `新仓 ${organization}/${name}`) }
}

/** 合并方式只留「合并提交」和「仅快进」：成员的提交原样进 main，本地 main 之后能快进 */
export async function limitMergeStyles(http: GiteaHttp, owner: string, repo: string): Promise<void> {
  requireSuccess(
    await http({
      method: 'PATCH',
      path: `/repos/${owner}/${repo}`,
      body: { allow_merge_commits: true, allow_fast_forward_only_merge: true, allow_squash_merge: false, allow_rebase: false, allow_rebase_explicit: false, default_merge_style: 'merge' },
    }),
    `限定 ${owner}/${repo} 的合并方式`,
  )
}

/** 许可里写的人与团队 */
export type Allowed = { users: string[]; teams: string[] }

/** 写进 main 保护的许可：push 为 null 是谁都不能直接推（enable_push 为假）；merge 只许里面的人与团队合并 */
export type MainAllowances = { push: Allowed | null; merge: Allowed }

/** 照给的许可写 main 的保护，禁止强制推送。已有名为 main 的规则就改它，没有就建 */
export async function protectMain(http: GiteaHttp, owner: string, repo: string, allowed: MainAllowances): Promise<void> {
  const push =
    allowed.push === null
      ? { enable_push: false, enable_push_whitelist: false, push_whitelist_usernames: [], push_whitelist_teams: [] }
      : { enable_push: true, enable_push_whitelist: true, push_whitelist_usernames: allowed.push.users, push_whitelist_teams: allowed.push.teams }
  const allowances = {
    ...push,
    enable_merge_whitelist: true,
    merge_whitelist_usernames: allowed.merge.users,
    merge_whitelist_teams: allowed.merge.teams,
    enable_force_push: false,
  }
  const existing = await giteaRepo(http, owner, repo).mainProtection()
  const request: GiteaRequest =
    existing === null
      ? { method: 'POST', path: `/repos/${owner}/${repo}/branch_protections`, body: { rule_name: 'main', ...allowances } }
      : { method: 'PATCH', path: `/repos/${owner}/${repo}/branch_protections/main`, body: allowances }
  requireSuccess(await http(request), existing === null ? `给 ${owner}/${repo} 的 main 加分支保护` : `改 ${owner}/${repo} 的 main 分支保护`)
}

/** owner 是组织就回 true；Gitea 对个人账号回 404，回 false */
export async function isOrganization(http: GiteaHttp, owner: string): Promise<boolean> {
  const response = await http({ method: 'GET', path: `/orgs/${owner}` })
  if (response.status === 404) return false
  requireSuccess(response, `查 ${owner} 是不是组织`)
  return true
}

/** 一个仓在 Gitea 上的位置：主人、仓名、主人的网页（地址里的用户名去掉） */
export type GiteaLocation = { owner: string; repo: string; ownerUrl: string }

/** 从 origin 的地址取出 Gitea 上的位置：https://host[:port]/owner/repo(.git) */
export function ownerAndRepoOf(remoteUrl: string): GiteaLocation {
  const trimmed = remoteUrl.trim()
  const match = /^https?:\/\/[^/]+\/([^/]+)\/([^/]+?)(?:\.git)?\/?$/.exec(trimmed)
  if (match === null) throw new CollabRejected(`origin 的地址 ${trimmed} 不是 https://<主机>/<owner>/<仓名> 的样子`)
  const owner = match[1]!
  return { owner, repo: match[2]!, ownerUrl: `${new URL(trimmed).origin}/${owner}` }
}
