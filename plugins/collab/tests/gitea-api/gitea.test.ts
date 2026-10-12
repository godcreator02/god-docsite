import { describe, expect, it } from 'vitest'
import { CollabRejected } from '../../src/errors.js'
import { createOrganizationRepo, giteaRepo, isOrganization, limitMergeStyles, organizationRepoNames, ownerAndRepoOf, protectMain, type GiteaHttp } from '../../src/gitea-api/gitea.js'
import { done, fakeGitea, noProtection, protectionRule } from '../fixtures/local-organization.js'

const replyWith =
  (status: number, body: unknown): GiteaHttp =>
  async () => ({ status, body })

describe('Gitea 上的位置', () => {
  it('从 origin 读出主人、仓名与主人的网页地址，去掉地址里的用户名', () => {
    expect(ownerAndRepoOf('https://bob@git.example.org:28377/hybrid-mmc/collab.git\n')).toEqual({ owner: 'hybrid-mmc', repo: 'collab', ownerUrl: 'https://git.example.org:28377/hybrid-mmc' })
    expect(() => ownerAndRepoOf('D:/projects/collab')).toThrow(CollabRejected)
  })
})

describe('Gitea 上的组织', () => {
  it('列出组织的仓：一页一页取完，只要仓名', async () => {
    const all = Array.from({ length: 53 }, (_, index) => ({ name: `repo-${index}` }))
    const requests: unknown[] = []
    const http: GiteaHttp = async (request) => {
      requests.push(request)
      const page = Number(request.query?.['page'])
      return { status: 200, body: all.slice((page - 1) * 50, page * 50) }
    }
    expect(await organizationRepoNames(http, 'hybrid-mmc')).toEqual(all.map((repo) => repo.name))
    expect(requests).toEqual([
      { method: 'GET', path: '/orgs/hybrid-mmc/repos', query: { limit: 50, page: 1 } },
      { method: 'GET', path: '/orgs/hybrid-mmc/repos', query: { limit: 50, page: 2 } },
    ])
  })

  it('组织不存在或看不到：照 Gitea 的原话报出来；仓名不是合法的目录名也报', async () => {
    await expect(organizationRepoNames(replyWith(404, { message: 'org not found' }), 'nobody')).rejects.toThrow(/列出组织 nobody 的仓失败：Gitea 回 404，org not found/)
    await expect(organizationRepoNames(replyWith(200, [{ name: '../evil' }]), 'hybrid-mmc')).rejects.toThrow(/仓名/)
  })

  it('主人是不是组织：200 是，404 是个人账号，别的状态照实报错', async () => {
    const paths: string[] = []
    const answering =
      (status: number): GiteaHttp =>
      async (request) => {
        paths.push(request.path)
        return { status, body: {} }
      }
    expect(await isOrganization(answering(200), 'hybrid-mmc')).toBe(true)
    expect(await isOrganization(answering(404), 'bob')).toBe(false)
    await expect(isOrganization(answering(500), 'hybrid-mmc')).rejects.toThrow(/Gitea 回 500/)
    expect(paths[0]).toBe('/orgs/hybrid-mmc')
  })
})

describe('Gitea 上一个仓与建仓的接口', () => {
  it('有没有 main 分支：404 是没有；别的失败照 Gitea 的原话报；仓的权限字段不对照实报错', async () => {
    expect(await giteaRepo(replyWith(404, {}), 'hybrid-mmc', 'scratch').hasMain()).toBe(false)
    expect(await giteaRepo(replyWith(200, { protected: false }), 'hybrid-mmc', 'x').hasMain()).toBe(true)
    await expect(giteaRepo(replyWith(500, { message: 'boom' }), 'hybrid-mmc', 'x').hasMain()).rejects.toThrow('读 hybrid-mmc/x 的 main 分支失败：Gitea 回 500，boom')
    await expect(giteaRepo(replyWith(200, { permissions: {} }), 'hybrid-mmc', 'x').callerIsAdmin()).rejects.toThrow(/admin 不对/)
  })

  it('协作者：一页一页取完，回登录名；成员读不到时照 Gitea 的原话报', async () => {
    const pages = [Array.from({ length: 50 }, (_, index) => ({ login: `user${index}` })), [{ login: 'last' }]]
    const { http, requests } = fakeGitea({ 'GET /repos/hybrid-mmc/x/collaborators': () => ({ status: 200, body: pages.shift() }) })
    const logins = await giteaRepo(http, 'hybrid-mmc', 'x').collaborators()
    expect(logins).toHaveLength(51)
    expect(logins.at(-1)).toBe('last')
    expect(requests.map((request) => request.query?.['page'])).toEqual([1, 2])
    await expect(giteaRepo(replyWith(403, { message: 'forbidden' }), 'hybrid-mmc', 'x').collaborators()).rejects.toThrow('读 hybrid-mmc/x 的协作者失败：Gitea 回 403，forbidden')
    await expect(giteaRepo(replyWith(200, [{ id: 1 }]), 'hybrid-mmc', 'x').collaborators()).rejects.toThrow(/协作者里 login 不对/)
  })

  it('合并请求的审阅：读审阅人、状态与撤销没有；字段不对照实报错', async () => {
    const reviews = [
      { id: 1, user: { login: 'carol' }, state: 'COMMENT', dismissed: false },
      { id: 2, user: { login: 'admin' }, state: 'REQUEST_CHANGES', dismissed: true },
    ]
    const { http, sent } = fakeGitea({ 'GET /repos/hybrid-mmc/x/pulls/7/reviews': { status: 200, body: reviews } })
    expect(await giteaRepo(http, 'hybrid-mmc', 'x').pullReviews(7)).toEqual([
      { reviewer: 'carol', state: 'COMMENT', dismissed: false },
      { reviewer: 'admin', state: 'REQUEST_CHANGES', dismissed: true },
    ])
    expect(sent()).toEqual(['GET /repos/hybrid-mmc/x/pulls/7/reviews'])
    await expect(giteaRepo(replyWith(200, [{ user: { login: 'carol' }, state: 'APPROVED' }]), 'hybrid-mmc', 'x').pullReviews(7)).rejects.toThrow(/dismissed 不对/)
  })

  it('main 的保护：404 为 null；按 Gitea 1.24 的字段读；enable_push 为假算谁都不能推；字段不对照实报错', async () => {
    expect(await giteaRepo(replyWith(404, {}), 'hybrid-mmc', 'x').mainProtection()).toBeNull()
    expect(await giteaRepo(async () => protectionRule({ pushUsers: ['carol-test'], pushTeams: ['Owners'], mergeUsers: ['carol-test'], mergeTeams: ['Owners'] }), 'hybrid-mmc', 'x').mainProtection()).toEqual({
      push: { restricted: true, users: ['carol-test'], teams: ['Owners'] },
      merge: { restricted: true, users: ['carol-test'], teams: ['Owners'] },
      forcePushAllowed: false,
    })
    expect((await giteaRepo(async () => protectionRule({ enablePush: false, pushUsers: ['admin'] }), 'hybrid-mmc', 'x').mainProtection())?.push).toEqual({ restricted: true, users: [], teams: [] })
    await expect(giteaRepo(replyWith(200, { enable_push: true }), 'hybrid-mmc', 'x').mainProtection()).rejects.toThrow(/enable_push_whitelist 不对/)
    await expect(giteaRepo(replyWith(403, { message: 'forbidden' }), 'hybrid-mmc', 'x').mainProtection()).rejects.toThrow('读 hybrid-mmc/x 的 main 分支保护失败：Gitea 回 403，forbidden')
  })

  it('加协作者给「管理」，删协作者：请求照约定', async () => {
    const { http, requests } = fakeGitea({ 'PUT /repos/hybrid-mmc/x/collaborators/carol': done, 'DELETE /repos/hybrid-mmc/x/collaborators/dave': done })
    await giteaRepo(http, 'hybrid-mmc', 'x').addAdminCollaborator('carol')
    await giteaRepo(http, 'hybrid-mmc', 'x').removeCollaborator('dave')
    expect(requests).toEqual([
      { method: 'PUT', path: '/repos/hybrid-mmc/x/collaborators/carol', body: { permission: 'admin' } },
      { method: 'DELETE', path: '/repos/hybrid-mmc/x/collaborators/dave' },
    ])
  })

  it('建仓、限定合并方式、保护 main：没有 main 的规则就建，推送与合并照给的许可写；令牌缺权限的 403 原话带上', async () => {
    const { http, requests } = fakeGitea({
      'POST /orgs/hybrid-mmc/repos': { status: 201, body: { html_url: 'https://git.example.org/hybrid-mmc/fpga-lib' } },
      'PATCH /repos/hybrid-mmc/fpga-lib': { status: 200, body: {} },
      'GET /repos/hybrid-mmc/fpga-lib/branch_protections/main': noProtection,
      'POST /repos/hybrid-mmc/fpga-lib/branch_protections': { status: 403, body: { message: 'token does not have at least one of required scope(s): [write:repository]' } },
    })
    expect(await createOrganizationRepo(http, 'hybrid-mmc', 'fpga-lib', 'FPGA 公共库')).toEqual({ url: 'https://git.example.org/hybrid-mmc/fpga-lib' })
    await limitMergeStyles(http, 'hybrid-mmc', 'fpga-lib')
    const leads = { users: ['bob', 'admin'], teams: [] }
    await expect(protectMain(http, 'hybrid-mmc', 'fpga-lib', { push: leads, merge: leads })).rejects.toThrow(
      '给 hybrid-mmc/fpga-lib 的 main 加分支保护失败：Gitea 回 403，token does not have at least one of required scope(s): [write:repository]',
    )
    expect(requests).toEqual([
      { method: 'POST', path: '/orgs/hybrid-mmc/repos', body: { name: 'fpga-lib', description: 'FPGA 公共库', private: true, default_branch: 'main', auto_init: true } },
      {
        method: 'PATCH',
        path: '/repos/hybrid-mmc/fpga-lib',
        body: { allow_merge_commits: true, allow_fast_forward_only_merge: true, allow_squash_merge: false, allow_rebase: false, allow_rebase_explicit: false, default_merge_style: 'merge' },
      },
      { method: 'GET', path: '/repos/hybrid-mmc/fpga-lib/branch_protections/main' },
      {
        method: 'POST',
        path: '/repos/hybrid-mmc/fpga-lib/branch_protections',
        body: {
          rule_name: 'main',
          enable_push: true,
          enable_push_whitelist: true,
          push_whitelist_usernames: ['bob', 'admin'],
          push_whitelist_teams: [],
          enable_merge_whitelist: true,
          merge_whitelist_usernames: ['bob', 'admin'],
          merge_whitelist_teams: [],
          enable_force_push: false,
        },
      },
    ])
  })

  it('已经有 main 的规则就改它；推送许可为 null 时关掉推送、清空推送许可，合并照给的写', async () => {
    const { http, requests } = fakeGitea({
      'GET /repos/hybrid-mmc/collab/branch_protections/main': protectionRule({ pushUsers: ['admin'], pushTeams: ['Owners'], mergeTeams: ['Owners', 'bots'] }),
      'PATCH /repos/hybrid-mmc/collab/branch_protections/main': { status: 200, body: {} },
    })
    await protectMain(http, 'hybrid-mmc', 'collab', { push: null, merge: { users: [], teams: ['bots'] } })
    expect(requests[1]).toEqual({
      method: 'PATCH',
      path: '/repos/hybrid-mmc/collab/branch_protections/main',
      body: {
        enable_push: false,
        enable_push_whitelist: false,
        push_whitelist_usernames: [],
        push_whitelist_teams: [],
        enable_merge_whitelist: true,
        merge_whitelist_usernames: [],
        merge_whitelist_teams: ['bots'],
        enable_force_push: false,
      },
    })
  })
})
