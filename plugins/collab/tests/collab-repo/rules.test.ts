import { describe, expect, it } from 'vitest'
import { CollabRepoRules, setupCollabRepo } from '../../src/collab-repo/rules.js'
import type { RemoteProject } from '../../src/project/project.js'
import { collaborators, done, fakeGitea, hasMain, isAdmin, noProtection, protectionRule } from '../fixtures/local-organization.js'

/** 协作仓的规矩只读 Gitea，不碰本机的仓 */
const bob: RemoteProject = {
  repo: 'D:/projects/hybrid-mmc/collab',
  collabDir: 'D:/projects/hybrid-mmc/collab/collab',
  siteDir: 'D:/projects/hybrid-mmc/collab/site',
  person: 'bob',
  remote: { env: {} },
  gitea: { owner: 'hybrid-mmc', repo: 'collab', ownerUrl: 'https://git.example.org/hybrid-mmc' },
}

const adminOfCollab = { 'GET /repos/hybrid-mmc/collab/branches/main': hasMain, 'GET /repos/hybrid-mmc/collab': isAdmin(true) }

describe('协作仓的规矩', () => {
  it('谁都不能直接推、只有 bots 能合并不算问题；负责人在推送或合并许可里、写了 Owners、少了 bots 都算；变了才报变化', async () => {
    const changed: string[] = []
    const protections = [
      protectionRule({ enablePush: false, mergeTeams: ['bots'] }),
      protectionRule({ pushUsers: ['admin'], pushTeams: ['Owners'], mergeUsers: ['admin'], mergeTeams: ['Owners'] }),
    ]
    const rules = new CollabRepoRules(
      fakeGitea({ ...adminOfCollab, 'GET /repos/hybrid-mmc/collab/collaborators': collaborators('admin'), 'GET /repos/hybrid-mmc/collab/branch_protections/main': () => protections.shift()! }).http,
      (repo) => changed.push(repo),
    )
    await rules.check(bob)
    expect(rules.problemsOf(bob.repo)).toEqual([])
    expect(changed).toEqual([])
    await rules.check(bob)
    expect(rules.problemsOf(bob.repo)).toEqual([
      'main 的推送许可里有 admin、团队 Owners：这个仓的 main 谁都不能直接推，负责人的改动也经合并请求进 main',
      'main 的合并许可里写了人 admin：这个仓的 main 只由执行器（团队 bots）合并，负责人也不在许可里',
      'main 的合并许可里写了团队 Owners：只许团队 bots',
      'main 的合并许可里没有团队 bots：执行器合并不了',
    ])
    expect(changed).toEqual([bob.repo])
  })

  it('以前配的样子（负责人能推、合并许可是负责人加 bots）：报负责人不该在推送与合并许可里', async () => {
    const rules = new CollabRepoRules(
      fakeGitea({
        ...adminOfCollab,
        'GET /repos/hybrid-mmc/collab/collaborators': collaborators('admin'),
        'GET /repos/hybrid-mmc/collab/branch_protections/main': protectionRule({ pushUsers: ['admin'], mergeUsers: ['admin'], mergeTeams: ['bots'] }),
      }).http,
      () => {},
    )
    await rules.check(bob)
    expect(rules.problemsOf(bob.repo)).toEqual([
      'main 的推送许可里有 admin：这个仓的 main 谁都不能直接推，负责人的改动也经合并请求进 main',
      'main 的合并许可里写了人 admin：这个仓的 main 只由执行器（团队 bots）合并，负责人也不在许可里',
    ])
  })

  it('我不是协作仓的管理员：不核对，当作没有问题', async () => {
    const rules = new CollabRepoRules(fakeGitea({ ...adminOfCollab, 'GET /repos/hybrid-mmc/collab': isAdmin(false) }).http, () => {})
    await rules.check(bob)
    expect(rules.problemsOf(bob.repo)).toEqual([])
  })

  it('collab.repo.setup 配协作仓：位置用打开项目时的 origin；负责人加成协作者，main 关掉推送、合并只许 bots；不给 leads 就照现有协作者重配', async () => {
    const { http, requests, sent } = fakeGitea({
      ...adminOfCollab,
      'GET /repos/hybrid-mmc/collab/collaborators': collaborators('admin'),
      'PATCH /repos/hybrid-mmc/collab': { status: 200, body: {} },
      'PUT /repos/hybrid-mmc/collab/collaborators/admin': done,
      'GET /repos/hybrid-mmc/collab/branch_protections/main': noProtection,
      'POST /repos/hybrid-mmc/collab/branch_protections': { status: 201, body: {} },
    })
    expect(await setupCollabRepo(bob, http, undefined)).toEqual({ leads: ['admin'], location: bob.gitea })
    expect(sent()).toContain('PUT /repos/hybrid-mmc/collab/collaborators/admin')
    expect(sent().filter((request) => request.startsWith('DELETE'))).toEqual([])
    expect(requests.find((request) => request.method === 'POST')?.body).toMatchObject({
      enable_push: false,
      push_whitelist_usernames: [],
      push_whitelist_teams: [],
      enable_merge_whitelist: true,
      merge_whitelist_usernames: [],
      merge_whitelist_teams: ['bots'],
      enable_force_push: false,
    })
  })

  it('保护 main 之后一步失败：报错里写明 main 已保护成谁都不能直接推送、合并只许团队 bots', async () => {
    const { http } = fakeGitea({
      ...adminOfCollab,
      'PATCH /repos/hybrid-mmc/collab': { status: 200, body: {} },
      'PUT /repos/hybrid-mmc/collab/collaborators/admin': done,
      'GET /repos/hybrid-mmc/collab/branch_protections/main': noProtection,
      'POST /repos/hybrid-mmc/collab/branch_protections': { status: 201, body: {} },
      'GET /repos/hybrid-mmc/collab/collaborators': { status: 500, body: { message: 'boom' } },
    })
    await expect(setupCollabRepo(bob, http, ['admin'])).rejects.toThrow('main 已保护（谁都不能直接推送，合并只许团队 bots）；下一步「读现有的协作者」失败')
  })
})
