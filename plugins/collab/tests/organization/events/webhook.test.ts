import { describe, expect, it } from 'vitest'
import type { GiteaHttp } from '../../../src/gitea-api/gitea.js'
import { pushEventOf } from '../../../src/organization/events/messages.js'
import { setupOrganizationWebhook, webhookEventsReadBack, webhookEventsToWrite, webhookProblemsOf, webhookUrlOf } from '../../../src/organization/events/webhook.js'

const organization = 'hybrid-mmc'

/**
 * 照 Go 模板的规则算 ntfy 出的正文，只认模板里用到的写法：{{if .a}}…{{else if .b}}…{{else}}…{{end}} 一串，
 * 与 {{.a.b}} 取值；条件里的字段缺了或为空算假，和 Go 模板读 JSON 解出来的 map 一样
 */
function renderMessageTemplate(template: string, body: Record<string, unknown>): string {
  const valueOf = (path: string): unknown => path.split('.').filter((key) => key !== '').reduce<unknown>((value, key) => (value as Record<string, unknown> | undefined)?.[key], body)
  const branches = /^\{\{if (\.[\w.]+)\}\}(.*)\{\{end\}\}$/s.exec(template)
  if (branches === null) throw new Error(`模板不是 if … end 一串：${template}`)
  const parts = `{{if ${branches[1]}}}${branches[2]}`.split(/\{\{(?=if |else)/).filter((part) => part !== '')
  for (const part of parts) {
    const branch = /^(?:if |else if )?(\.[\w.]+)?\}\}(.*)$/s.exec(part.replace(/^else(?=\}\})/, ''))
    if (branch === null) throw new Error(`认不出模板的这一段：${part}`)
    const [, condition, text] = branch
    const value = condition === undefined ? true : valueOf(condition)
    if (value !== undefined && value !== null && value !== '' && value !== false) return text!.replace(/\{\{(\.[\w.]+)\}\}/g, (_, path: string) => String(valueOf(path)))
  }
  return ''
}

/** Gitea 读回来的一个 webhook；不给的按期望配置填 */
function hookOf(fields: Partial<{ id: number; type: string; url: string; content_type: string; events: string[]; active: boolean }> = {}) {
  return {
    id: fields.id ?? 1,
    type: fields.type ?? 'gitea',
    config: { url: fields.url ?? webhookUrlOf(organization), content_type: fields.content_type ?? 'json' },
    events: fields.events ?? webhookEventsReadBack,
    active: fields.active ?? true,
  }
}

const parsed = (hook: ReturnType<typeof hookOf>) => ({ id: hook.id, type: hook.type, url: hook.config.url, contentType: hook.config.content_type, events: hook.events, active: hook.active })

describe('组织 webhook 的期望配置', () => {
  it('地址是 Gitea 那边按服务名访问的 ntfy 加组织的 topic，模板把标题写成 <组织>/<仓>、正文写成种类、动作与编号', () => {
    const url = new URL(webhookUrlOf(organization))
    expect(`${url.origin}${url.pathname}`).toBe('http://ntfy/collab-hybrid-mmc')
    expect(url.searchParams.get('template')).toBe('yes')
    expect(url.searchParams.get('t')).toBe('{{.repository.full_name}}')
    const message = url.searchParams.get('m')!
    for (const part of ['push {{.ref}}', 'pr {{.action}} #{{.pull_request.number}}', 'comment {{.action}} #{{.issue.number}}', 'issue {{.action}} #{{.issue.number}}', 'repo {{.action}}']) expect(message).toContain(part)
    expect(message.indexOf('.comment')).toBeLessThan(message.indexOf('else if .pull_request'))
    expect(message.indexOf('.comment')).toBeLessThan(message.indexOf('else if .issue'))
  })

  it('模板对 Gitea 各种请求体出的正文，插件都认得出：审阅是 pr reviewed，合并请求上的评论是 comment', () => {
    const topic = 'collab-hybrid-mmc'
    const title = 'hybrid-mmc/firmware'
    const repository = { full_name: title }
    const eventOfBody = (body: Record<string, unknown>) => pushEventOf({ topic, title, message: renderMessageTemplate(new URL(webhookUrlOf(organization)).searchParams.get('m')!, { repository, ...body }) })
    const pull = { number: 4, head: { ref: 'fix' } }
    expect(eventOfBody({ ref: 'refs/heads/main' })).toEqual({ kind: 'push', repo: 'firmware', ref: 'refs/heads/main' })
    expect(eventOfBody({ action: 'opened', number: 4, pull_request: pull })).toEqual({ kind: 'pr', repo: 'firmware', action: 'opened', number: 4 })
    expect(eventOfBody({ action: 'reviewed', number: 4, pull_request: pull, review: { type: 'pull_request_review_rejected', content: '改一下' } })).toEqual({ kind: 'pr', repo: 'firmware', action: 'reviewed', number: 4 })
    expect(eventOfBody({ action: 'created', issue: { number: 4 }, pull_request: pull, comment: { body: '好' }, is_pull: true })).toEqual({ kind: 'comment', repo: 'firmware', action: 'created', number: 4 })
    expect(eventOfBody({ action: 'created', issue: { number: 9 }, comment: { body: '好' }, is_pull: false })).toEqual({ kind: 'comment', repo: 'firmware', action: 'created', number: 9 })
    expect(eventOfBody({ action: 'opened', issue: { number: 9 } })).toEqual({ kind: 'issue', repo: 'firmware', action: 'opened', number: 9 })
    expect(eventOfBody({ action: 'created' })).toEqual({ kind: 'repo', repo: 'firmware', action: 'created' })
  })

  it('写入时只订那几个事件本身，不连带指派、标签这些子事件；审阅与合并请求上的评论也订', () => {
    expect(webhookEventsToWrite).toEqual(['push', 'pull_request_only', 'pull_request_sync', 'pull_request_review', 'pull_request_comment', 'issues_only', 'issue_comment', 'repository'])
    expect(webhookEventsReadBack).toEqual(['push', 'pull_request', 'pull_request_sync', 'pull_request_review', 'pull_request_comment', 'issues', 'issue_comment', 'repository'])
  })

  it('核对：都对时没有问题；没有、好几个、地址、类型、请求体、停用、少订多订分别写明', () => {
    expect(webhookProblemsOf([parsed(hookOf())], organization)).toEqual([])
    expect(webhookProblemsOf([], organization)).toEqual(['没有发到 http://ntfy/collab-hybrid-mmc 的 webhook：成员收不到这个组织的实时推送'])
    expect(webhookProblemsOf([parsed(hookOf({ id: 1 })), parsed(hookOf({ id: 2 }))], organization)[0]).toMatch(/有 2 个.*#1、#2/)
    const old = parsed(hookOf({ url: 'http://ntfy/collab-hybrid-mmc?template=yes&m=x', type: 'slack', content_type: 'form', active: false, events: ['push', 'pull_request', 'pull_request_sync', 'create'] }))
    expect(webhookProblemsOf([old], organization)).toEqual([
      '地址里的消息模板和插件要的不一样：插件认不出推来的消息，只能每次做完整检查',
      '类型是 slack，要是 gitea',
      '请求体是 form，要是 json：ntfy 的消息模板只认 JSON',
      'webhook 停用了',
      '少订了事件 pull_request_review、pull_request_comment、issues、issue_comment、repository',
      '多订了事件 create',
    ])
  })

  it('核对：已有组织按以前的六个事件订的，少了审阅与合并请求上的评论，要组织管理员重配', () => {
    const before = parsed(hookOf({ events: ['push', 'pull_request', 'pull_request_sync', 'issues', 'issue_comment', 'repository'] }))
    expect(webhookProblemsOf([before], organization)).toEqual(['少订了事件 pull_request_review、pull_request_comment'])
  })

  it('发到别的地址的 webhook 不管', () => {
    expect(webhookProblemsOf([parsed(hookOf({ id: 7, url: 'https://ci.example.org/hook' })), parsed(hookOf())], organization)).toEqual([])
  })
})

describe('collab.org.setup', () => {
  function giteaWith(hooks: unknown[] | 'forbidden') {
    const calls: Array<{ method: string; path: string; body?: unknown }> = []
    const http: GiteaHttp = async (request) => {
      calls.push({ method: request.method, path: request.path, ...(request.body === undefined ? {} : { body: request.body }) })
      if (request.method === 'GET') return hooks === 'forbidden' ? { status: 403, body: { message: 'forbidden' } } : { status: 200, body: hooks }
      return { status: request.method === 'POST' ? 201 : 200, body: hookOf({ id: request.method === 'POST' ? 9 : 1 }) }
    }
    return { http, calls }
  }

  it('没有就建一个，地址与事件一起写，读回来核对', async () => {
    const { http, calls } = giteaWith([])
    expect(await setupOrganizationWebhook(http, organization)).toMatchObject({ organization, hook: 9, outcome: 'created' })
    expect(calls[1]).toEqual({
      method: 'POST',
      path: '/orgs/hybrid-mmc/hooks',
      body: { type: 'gitea', config: { url: webhookUrlOf(organization), content_type: 'json', http_method: 'post' }, events: webhookEventsToWrite, active: true, branch_filter: '*' },
    })
  })

  it('有一个不对的就改它；已经对了不动', async () => {
    const stale = giteaWith([hookOf({ events: ['push', 'pull_request'] })])
    expect(await setupOrganizationWebhook(stale.http, organization)).toMatchObject({ hook: 1, outcome: 'updated' })
    expect(stale.calls[1]).toMatchObject({ method: 'PATCH', path: '/orgs/hybrid-mmc/hooks/1' })
    const fine = giteaWith([hookOf()])
    expect(await setupOrganizationWebhook(fine.http, organization)).toMatchObject({ hook: 1, outcome: 'unchanged' })
    expect(fine.calls).toHaveLength(1)
  })

  it('不是组织管理员、有好几个：拒绝，什么都不改', async () => {
    const forbidden = giteaWith('forbidden')
    await expect(setupOrganizationWebhook(forbidden.http, organization)).rejects.toThrow(/不是这个组织的管理员/)
    const doubled = giteaWith([hookOf({ id: 1 }), hookOf({ id: 2 })])
    await expect(setupOrganizationWebhook(doubled.http, organization)).rejects.toThrow(/有 2 个.*#1、#2.*删到只剩一个/)
    expect([...forbidden.calls, ...doubled.calls].every((call) => call.method === 'GET')).toBe(true)
  })

  it('写了读回来还不对：报出哪里不对', async () => {
    const http: GiteaHttp = async (request) => (request.method === 'GET' ? { status: 200, body: [] } : { status: 201, body: hookOf({ id: 9, events: ['push'] }) })
    await expect(setupOrganizationWebhook(http, organization)).rejects.toThrow(/#9 写了，但读回来还不对：少订了事件/)
  })
})
