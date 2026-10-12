import { beforeEach, describe, expect, it } from 'vitest'
import { OtherReposRules, setupOtherRepo } from '../../src/other-repos/rules.js'
import type { RemoteProject } from '../../src/project/project.js'
import { collaborators, done, fakeGitea, git, hasMain, isAdmin, localOrganization, noProtection, protectionRule, type LocalOrganization } from '../fixtures/local-organization.js'

let organization: LocalOrganization
let bob: RemoteProject

beforeEach(async () => {
  organization = await localOrganization({ firmware: { 'main.c': '\n' } })
  bob = await organization.bob()
  git(organization.dirOf('firmware'), 'remote', 'set-url', 'origin', 'https://git.example.org/hybrid-mmc/firmware.git')
})

const adminOfFirmware = { 'GET /repos/hybrid-mmc/firmware/branches/main': hasMain, 'GET /repos/hybrid-mmc/firmware': isAdmin(true) }

describe('别的仓的规矩', () => {
  it('合并许可不写团队：写了 bots 也算问题；配好的不列', async () => {
    const changed: string[] = []
    const rules = new OtherReposRules(
      fakeGitea({
        ...adminOfFirmware,
        'GET /repos/hybrid-mmc/firmware/collaborators': collaborators('bob'),
        'GET /repos/hybrid-mmc/firmware/branch_protections/main': protectionRule({ pushUsers: ['bob'], mergeUsers: ['bob'], mergeTeams: ['bots'] }),
      }).http,
      (repo) => changed.push(repo),
    )
    await rules.check(bob, 'firmware')
    expect(rules.problemsOf(bob.repo)).toEqual([{ repo: 'firmware', problems: ['main 的合并许可里写了团队 bots：合并只许负责人，不写团队'] }])
    expect(changed).toEqual([bob.repo])
    rules.retainOnly(bob.repo, [])
    expect(rules.problemsOf(bob.repo)).toEqual([])
  })

  it('collab.repo.setup 配别的仓：按它的 origin 找到 Gitea 上的仓，推送许可与合并许可都只写负责人', async () => {
    const { http, requests } = fakeGitea({
      ...adminOfFirmware,
      'PATCH /repos/hybrid-mmc/firmware': { status: 200, body: {} },
      'PUT /repos/hybrid-mmc/firmware/collaborators/bob': done,
      'GET /repos/hybrid-mmc/firmware/branch_protections/main': noProtection,
      'POST /repos/hybrid-mmc/firmware/branch_protections': { status: 201, body: {} },
      'GET /repos/hybrid-mmc/firmware/collaborators': collaborators('bob'),
    })
    expect(await setupOtherRepo(bob, http, 'firmware', ['bob'])).toEqual({ leads: ['bob'], location: { owner: 'hybrid-mmc', repo: 'firmware', ownerUrl: 'https://git.example.org/hybrid-mmc' } })
    expect(requests.find((request) => request.method === 'POST')?.body).toMatchObject({
      enable_push: true,
      enable_push_whitelist: true,
      push_whitelist_usernames: ['bob'],
      push_whitelist_teams: [],
      merge_whitelist_usernames: ['bob'],
      merge_whitelist_teams: [],
    })
  })

  it('name 不是项目文件夹里的别的仓：拒绝，一个请求都不发', async () => {
    const { http, requests } = fakeGitea({})
    await expect(setupOtherRepo(bob, http, 'nope', ['bob'])).rejects.toThrow(/里没有叫 nope 的 git 仓/)
    await expect(setupOtherRepo(bob, http, '../datasheets', ['bob'])).rejects.toThrow(/name 要是项目文件夹里的仓名/)
    expect(requests).toEqual([])
  })
})
