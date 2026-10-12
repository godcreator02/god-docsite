import { describe, expect, it } from 'vitest'
import { CollabRejected } from '../../src/errors.js'
import type { MainProtection } from '../../src/gitea-api/gitea.js'
import { mainAllowancesOf, repoRulesProblemsOf, requireLeadNames, setUpRepoByRules, setupProblemsOf, type MainRule } from '../../src/gitea-api/repo-rules.js'
import { collaborators, done, fakeGitea, hasMain, isAdmin, noMain, noProtection, protectionRule } from '../fixtures/local-organization.js'

const firmware = { owner: 'hybrid-mmc', repo: 'firmware', ownerUrl: 'https://git.example.org/hybrid-mmc' }

const leadsOnly: MainRule = { push: 'leads', merge: 'leads' }
const executorOnly: MainRule = { push: 'nobody', merge: 'executor' }

describe('两种规矩写进 main 保护的许可', () => {
  it('只许负责人：推送与合并都写负责人、不写团队；只许执行器：关掉推送，合并只写团队 bots、不写负责人', () => {
    expect(mainAllowancesOf(leadsOnly, ['bob', 'admin'])).toEqual({ push: { users: ['bob', 'admin'], teams: [] }, merge: { users: ['bob', 'admin'], teams: [] } })
    expect(mainAllowancesOf(executorOnly, ['admin'])).toEqual({ push: null, merge: { users: [], teams: ['bots'] } })
  })
})

describe('按规矩核对一个仓的设置', () => {
  const rule = (overrides: Partial<MainProtection>): MainProtection => ({
    push: { restricted: true, users: ['admin'], teams: [] },
    merge: { restricted: true, users: ['admin'], teams: [] },
    forcePushAllowed: false,
    ...overrides,
  })
  const executorMerges = { restricted: true, users: [], teams: ['bots'] }
  const nobodyPushes = { restricted: true, users: [], teams: [] }

  it('只许负责人：推送与合并只许负责人、不许强制推送没有问题；许可里写了团队算问题', () => {
    expect(setupProblemsOf(['admin'], rule({}), leadsOnly)).toEqual([])
    expect(setupProblemsOf(['admin'], rule({ merge: { restricted: true, users: ['admin'], teams: ['bots'] } }), leadsOnly)).toEqual(['main 的合并许可里写了团队 bots：合并只许负责人，不写团队'])
    expect(setupProblemsOf(['admin'], rule({ push: { restricted: true, users: ['admin'], teams: ['Owners'] } }), leadsOnly)).toEqual(['main 的推送许可里写了团队 Owners：推送只许负责人，不写团队'])
  })

  it('只许执行器：谁都不能推、只有 bots 能合并没有问题；同一份保护按只许负责人核对就不对，反过来也一样', () => {
    const collabMain = rule({ push: nobodyPushes, merge: executorMerges })
    expect(setupProblemsOf(['admin'], collabMain, executorOnly)).toEqual([])
    expect(setupProblemsOf(['admin'], collabMain, leadsOnly)).toEqual([
      'main 的推送许可里的人是 （没有人），负责人是 admin',
      'main 的合并许可里的人是 （没有人），负责人是 admin',
      'main 的合并许可里写了团队 bots：合并只许负责人，不写团队',
    ])
    expect(setupProblemsOf(['admin'], rule({}), executorOnly)).toEqual([
      'main 的推送许可里有 admin：这个仓的 main 谁都不能直接推，负责人的改动也经合并请求进 main',
      'main 的合并许可里写了人 admin：这个仓的 main 只由执行器（团队 bots）合并，负责人也不在许可里',
      'main 的合并许可里没有团队 bots：执行器合并不了',
    ])
  })

  it('只许执行器：许可里出现负责人、团队、bots 以外的团队都算问题', () => {
    expect(setupProblemsOf(['admin'], rule({ push: { restricted: true, users: [], teams: ['Owners'] }, merge: { restricted: true, users: [], teams: ['Owners', 'bots'] } }), executorOnly)).toEqual([
      'main 的推送许可里有 团队 Owners：这个仓的 main 谁都不能直接推，负责人的改动也经合并请求进 main',
      'main 的合并许可里写了团队 Owners：只许团队 bots',
    ])
    expect(setupProblemsOf(['admin'], rule({ push: nobodyPushes, merge: { restricted: true, users: ['admin'], teams: ['bots'] } }), executorOnly)).toEqual([
      'main 的合并许可里写了人 admin：这个仓的 main 只由执行器（团队 bots）合并，负责人也不在许可里',
    ])
    expect(setupProblemsOf(['admin'], rule({ push: { restricted: false, users: [], teams: [] }, merge: { restricted: false, users: [], teams: [] } }), executorOnly)).toEqual([
      'main 的推送没有限定人：有写权限的都能推送',
      'main 的合并没有限定人：有写权限的都能合并',
    ])
  })

  it('许可里的人和负责人对不上：写明两边各是谁，顺序不论', () => {
    expect(setupProblemsOf(['bob', 'admin'], rule({ push: { restricted: true, users: ['admin', 'bob'], teams: [] }, merge: { restricted: true, users: ['admin'], teams: [] } }), leadsOnly)).toEqual([
      'main 的合并许可里的人是 admin，负责人是 bob、admin',
    ])
    expect(setupProblemsOf(['carol-test'], rule({ push: { restricted: true, users: [], teams: [] } }), leadsOnly)).toEqual([
      'main 的推送许可里的人是 （没有人），负责人是 carol-test',
      'main 的合并许可里的人是 admin，负责人是 carol-test',
    ])
  })

  it('没有限定人、允许强制推送、没有协作者、没有保护各记一条；没有协作者时不再比人', () => {
    expect(setupProblemsOf(['admin'], rule({ push: { restricted: false, users: [], teams: [] }, merge: { restricted: false, users: [], teams: [] }, forcePushAllowed: true }), leadsOnly)).toEqual([
      'main 的推送没有限定人：有写权限的都能推送',
      'main 的合并没有限定人：有写权限的都能合并',
      'main 允许强制推送',
    ])
    expect(setupProblemsOf([], rule({}), leadsOnly)).toEqual(['没有协作者（没有负责人）'])
    expect(setupProblemsOf([], null, leadsOnly)).toEqual(['没有协作者（没有负责人）', 'main 没有分支保护'])
    expect(setupProblemsOf(['admin'], null, executorOnly)).toEqual(['main 没有分支保护'])
    expect(setupProblemsOf(['admin'], rule({ push: nobodyPushes, merge: executorMerges, forcePushAllowed: true }), executorOnly)).toEqual(['main 允许强制推送'])
  })
})

describe('读 Gitea 核对一个仓', () => {
  it('我是管理员、有 main：读协作者与 main 的保护核对；没有问题回空', async () => {
    const { http, sent } = fakeGitea({
      'GET /repos/hybrid-mmc/firmware/branches/main': hasMain,
      'GET /repos/hybrid-mmc/firmware': isAdmin(true),
      'GET /repos/hybrid-mmc/firmware/collaborators': collaborators('bob'),
      'GET /repos/hybrid-mmc/firmware/branch_protections/main': protectionRule({ pushUsers: ['bob'], mergeUsers: ['bob'] }),
    })
    expect(await repoRulesProblemsOf(http, firmware, leadsOnly)).toEqual([])
    expect(sent().sort()).toEqual(['GET /repos/hybrid-mmc/firmware', 'GET /repos/hybrid-mmc/firmware/branch_protections/main', 'GET /repos/hybrid-mmc/firmware/branches/main', 'GET /repos/hybrid-mmc/firmware/collaborators'])
  })

  it('没有协作者、没有保护：每个问题一句', async () => {
    const { http } = fakeGitea({
      'GET /repos/hybrid-mmc/firmware/branches/main': hasMain,
      'GET /repos/hybrid-mmc/firmware': isAdmin(true),
      'GET /repos/hybrid-mmc/firmware/collaborators': collaborators(),
      'GET /repos/hybrid-mmc/firmware/branch_protections/main': noProtection,
    })
    expect(await repoRulesProblemsOf(http, firmware, leadsOnly)).toEqual(['没有协作者（没有负责人）', 'main 没有分支保护'])
  })

  it('还没有 main 的空仓、我不是管理员：不核对，回 null，不读保护', async () => {
    const empty = fakeGitea({ 'GET /repos/hybrid-mmc/firmware/branches/main': noMain })
    expect(await repoRulesProblemsOf(empty.http, firmware, leadsOnly)).toBeNull()
    expect(empty.sent()).toEqual(['GET /repos/hybrid-mmc/firmware/branches/main'])
    const member = fakeGitea({ 'GET /repos/hybrid-mmc/firmware/branches/main': hasMain, 'GET /repos/hybrid-mmc/firmware': isAdmin(false) })
    expect(await repoRulesProblemsOf(member.http, firmware, leadsOnly)).toBeNull()
  })
})

describe('照规矩配好一个仓', () => {
  const adminOfFirmware = { 'GET /repos/hybrid-mmc/firmware/branches/main': hasMain, 'GET /repos/hybrid-mmc/firmware': isAdmin(true) }

  it('给了 leads：限定合并方式 → 逐个加成协作者（管理）→ 改 main 已有的保护 → 最后删掉多出来的协作者（用户名大小写不论）', async () => {
    const { http, requests, sent } = fakeGitea({
      ...adminOfFirmware,
      'PATCH /repos/hybrid-mmc/firmware': { status: 200, body: {} },
      'PUT /repos/hybrid-mmc/firmware/collaborators/Carol': done,
      'PUT /repos/hybrid-mmc/firmware/collaborators/bob': done,
      'GET /repos/hybrid-mmc/firmware/branch_protections/main': protectionRule({ pushTeams: ['Owners'], mergeTeams: ['Owners'] }),
      'PATCH /repos/hybrid-mmc/firmware/branch_protections/main': { status: 200, body: {} },
      'GET /repos/hybrid-mmc/firmware/collaborators': collaborators('carol', 'bob', 'dave'),
      'DELETE /repos/hybrid-mmc/firmware/collaborators/dave': done,
    })
    expect(await setUpRepoByRules(http, firmware, 'bob', ['Carol', 'bob'], leadsOnly)).toEqual(['Carol', 'bob'])
    expect(sent()).toEqual([
      'GET /repos/hybrid-mmc/firmware/branches/main',
      'GET /repos/hybrid-mmc/firmware',
      'PATCH /repos/hybrid-mmc/firmware',
      'PUT /repos/hybrid-mmc/firmware/collaborators/Carol',
      'PUT /repos/hybrid-mmc/firmware/collaborators/bob',
      'GET /repos/hybrid-mmc/firmware/branch_protections/main',
      'PATCH /repos/hybrid-mmc/firmware/branch_protections/main',
      'GET /repos/hybrid-mmc/firmware/collaborators',
      'DELETE /repos/hybrid-mmc/firmware/collaborators/dave',
    ])
    expect(requests[6]?.body).toMatchObject({ push_whitelist_usernames: ['Carol', 'bob'], push_whitelist_teams: [], merge_whitelist_usernames: ['Carol', 'bob'], merge_whitelist_teams: [], enable_force_push: false })
  })

  it('还没有 main、我不是管理员、不给 leads 又没有协作者：拒绝并写明原因，什么都不改', async () => {
    const empty = fakeGitea({ 'GET /repos/hybrid-mmc/firmware/branches/main': noMain })
    await expect(setUpRepoByRules(empty.http, firmware, 'bob', ['bob'], leadsOnly)).rejects.toThrow('hybrid-mmc/firmware 还没有 main 分支，没有改动：先推一个提交到 main 再配')
    expect(empty.requests).toHaveLength(1)

    const member = fakeGitea({ ...adminOfFirmware, 'GET /repos/hybrid-mmc/firmware': isAdmin(false) })
    await expect(setUpRepoByRules(member.http, firmware, 'bob', ['bob'], leadsOnly)).rejects.toThrow(
      'bob 不是 hybrid-mmc/firmware 的管理员，没有改动：协作者与分支保护只有这个仓的管理员能改，请它的负责人或组织管理员来配',
    )
    expect(member.sent()).toEqual(['GET /repos/hybrid-mmc/firmware/branches/main', 'GET /repos/hybrid-mmc/firmware'])

    const nobody = fakeGitea({ ...adminOfFirmware, 'GET /repos/hybrid-mmc/firmware/collaborators': collaborators() })
    await expect(setUpRepoByRules(nobody.http, firmware, 'bob', undefined, leadsOnly)).rejects.toThrow('hybrid-mmc/firmware 还没有协作者（负责人），没有改动：给 leads 写明负责人的 Gitea 用户名')
    expect(nobody.sent().every((request) => request.startsWith('GET'))).toBe(true)
  })

  it('leads 是外部输入：空的、不是用户名、重复（大小写不论）都拒绝', () => {
    expect(() => requireLeadNames([])).toThrow('leads 不能是空的：至少写一个负责人的 Gitea 用户名')
    expect(() => requireLeadNames(['bob', '../x'])).toThrow('leads 里的 "../x" 不是 Gitea 用户名（只含字母、数字与 _ . -）')
    expect(() => requireLeadNames(['bob', 'BOB'])).toThrow('leads 里的 BOB 重复了')
  })

  it('第一步就失败：照 Gitea 的原话报；中途失败：写明前面做到哪一步，不回退', async () => {
    const first = fakeGitea({ ...adminOfFirmware, 'PATCH /repos/hybrid-mmc/firmware': { status: 403, body: { message: 'forbidden' } } })
    await expect(setUpRepoByRules(first.http, firmware, 'bob', ['bob'], leadsOnly)).rejects.toThrow(new CollabRejected('限定 hybrid-mmc/firmware 的合并方式失败：Gitea 回 403，forbidden'))

    const midway = fakeGitea({
      ...adminOfFirmware,
      'PATCH /repos/hybrid-mmc/firmware': { status: 200, body: {} },
      'PUT /repos/hybrid-mmc/firmware/collaborators/bob': done,
      'PUT /repos/hybrid-mmc/firmware/collaborators/nobody': { status: 404, body: { message: 'user does not exist [name: nobody]' } },
    })
    await expect(setUpRepoByRules(midway.http, firmware, 'bob', ['bob', 'nobody'], leadsOnly)).rejects.toThrow(
      new CollabRejected(
        'hybrid-mmc/firmware 的合并方式已限定为「合并提交」与「仅快进」，bob 已是协作者（管理）；下一步「把 nobody 加成协作者（管理）」失败，前面这些不回退：\n' +
          '把 nobody 加成 hybrid-mmc/firmware 的协作者（管理）失败：Gitea 回 404，user does not exist [name: nobody]',
      ),
    )
  })
})
