import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { CollabRejected } from '../../../src/errors.js'
import type { OrganizationSource } from '../../../src/other-repos/fetch/clone-new-repos.js'
import { createProjectRepo } from '../../../src/organization/setup/create.js'
import type { RemoteProject } from '../../../src/project/project.js'
import { collaborators, done, fakeGitea, localOrganization, noProtection, type FakeReply, type FakeRequest, type LocalOrganization } from '../../fixtures/local-organization.js'

let organization: LocalOrganization
let bob: RemoteProject

beforeEach(async () => {
  organization = await localOrganization({ datasheets: { 'README.md': '资料库\n' } })
  bob = await organization.bob()
})

describe('collab.repo.create 建仓', () => {
  /** 建仓的假接口在组织目录里建出带初始提交的裸仓，像 Gitea 的 auto_init */
  const createsBareRepo = (request: FakeRequest): FakeReply => {
    organization.bareRepoWith(String(request.body?.['name']), { 'README.md': '新仓\n' })
    return { status: 201, body: { html_url: `https://git.example.org/hybrid-mmc/${String(request.body?.['name'])}` } }
  }

  /** 建仓之后照规矩配好要用到的接口；person 是建仓的人 */
  const setupReplies = (person: string): Record<string, FakeReply> => ({
    'PATCH /repos/hybrid-mmc/fpga-lib': { status: 200, body: {} },
    [`PUT /repos/hybrid-mmc/fpga-lib/collaborators/${person}`]: done,
    'GET /repos/hybrid-mmc/fpga-lib/branch_protections/main': noProtection,
    'POST /repos/hybrid-mmc/fpga-lib/branch_protections': { status: 201, body: {} },
    'GET /repos/hybrid-mmc/fpga-lib/collaborators': collaborators(person),
  })

  it('依次建仓、限定合并方式、把自己加成协作者（管理）、保护 main（只许自己），再克隆进项目文件夹', async () => {
    const { http, requests, sent } = fakeGitea({ 'POST /orgs/hybrid-mmc/repos': createsBareRepo, ...setupReplies('bob') })
    expect(await createProjectRepo(bob, http, organization.source, 'fpga-lib', 'FPGA 公共库')).toEqual({
      name: 'fpga-lib',
      url: 'https://git.example.org/hybrid-mmc/fpga-lib',
      dir: organization.dirOf('fpga-lib'),
      leads: ['bob'],
    })
    expect(sent()).toEqual([
      'POST /orgs/hybrid-mmc/repos',
      'PATCH /repos/hybrid-mmc/fpga-lib',
      'PUT /repos/hybrid-mmc/fpga-lib/collaborators/bob',
      'GET /repos/hybrid-mmc/fpga-lib/branch_protections/main',
      'POST /repos/hybrid-mmc/fpga-lib/branch_protections',
      'GET /repos/hybrid-mmc/fpga-lib/collaborators',
    ])
    expect(requests[4]?.body).toMatchObject({ push_whitelist_usernames: ['bob'], push_whitelist_teams: [], merge_whitelist_usernames: ['bob'], merge_whitelist_teams: [] })
    expect(readFileSync(path.join(organization.dirOf('fpga-lib'), 'README.md'), 'utf8')).toBe('新仓\n')
  })

  it('负责人只写建仓的人，不按 people.json：admin 建仓就只有 admin', async () => {
    const admin = { ...bob, person: 'admin' }
    const { http, requests } = fakeGitea({ 'POST /orgs/hybrid-mmc/repos': createsBareRepo, ...setupReplies('admin') })
    expect((await createProjectRepo(admin, http, organization.source, 'fpga-lib', '')).leads).toEqual(['admin'])
    expect(requests[4]?.body?.['merge_whitelist_usernames']).toEqual(['admin'])
  })

  it('仓名不合法、项目文件夹里已有同名的：拒绝，一个请求都不发', async () => {
    const { http, requests } = fakeGitea({})
    await expect(createProjectRepo(bob, http, organization.source, '../evil', '')).rejects.toThrow(/name 要是仓名/)
    await expect(createProjectRepo(bob, http, organization.source, 'datasheets', '')).rejects.toThrow(`项目文件夹 ${organization.projectDir} 里已经有 datasheets，换一个仓名`)
    writeFileSync(organization.dirOf('notes.txt'), '')
    await expect(createProjectRepo(bob, http, organization.source, 'notes.txt', '')).rejects.toThrow(/已经有 notes\.txt/)
    expect(requests).toEqual([])
  })

  it('建仓被拒（令牌缺权限）：照 Gitea 的原话报，后面的不做', async () => {
    const { http, requests } = fakeGitea({
      'POST /orgs/hybrid-mmc/repos': { status: 403, body: { message: 'token does not have at least one of required scope(s): [write:organization]' } },
    })
    await expect(createProjectRepo(bob, http, organization.source, 'fpga-lib', '')).rejects.toThrow(
      new CollabRejected('建仓 fpga-lib（组织 hybrid-mmc）失败：Gitea 回 403，token does not have at least one of required scope(s): [write:organization]'),
    )
    expect(requests).toHaveLength(1)
  })

  it('建出来以后保护 main 失败：写明已经建好仓、限定了合并方式、加了协作者，不回退，也不克隆', async () => {
    const { http } = fakeGitea({
      'POST /orgs/hybrid-mmc/repos': createsBareRepo,
      ...setupReplies('bob'),
      'POST /repos/hybrid-mmc/fpga-lib/branch_protections': { status: 403, body: { message: 'user should be an owner or a collaborator with admin write of a repository' } },
    })
    await expect(createProjectRepo(bob, http, organization.source, 'fpga-lib', '')).rejects.toThrow(
      new CollabRejected(
        '已在组织 hybrid-mmc 建好私有仓 fpga-lib（https://git.example.org/hybrid-mmc/fpga-lib），合并方式已限定为「合并提交」与「仅快进」，bob 已是协作者（管理）；下一步「保护 main」失败，前面这些不回退：\n' +
          '给 hybrid-mmc/fpga-lib 的 main 加分支保护失败：Gitea 回 403，user should be an owner or a collaborator with admin write of a repository',
      ),
    )
    expect(existsSync(organization.dirOf('fpga-lib'))).toBe(false)
  })

  it('克隆失败：写明前面都做完了，附 git 的原话', async () => {
    const { http } = fakeGitea({ 'POST /orgs/hybrid-mmc/repos': { status: 201, body: { html_url: 'https://git.example.org/hybrid-mmc/fpga-lib' } }, ...setupReplies('bob') })
    const listsNewRepoWithoutBareRepo: OrganizationSource = { ...organization.source, repoNames: async () => [...(await organization.source.repoNames()), 'fpga-lib'] }
    await expect(createProjectRepo(bob, http, listsNewRepoWithoutBareRepo, 'fpga-lib', '')).rejects.toThrow(
      /^已在组织 hybrid-mmc 建好私有仓 fpga-lib（.*），合并方式已限定为「合并提交」与「仅快进」，bob 已是协作者（管理），main 已保护（推送只许 bob，合并只许 bob）；下一步「克隆进项目文件夹」失败，前面这些不回退：\n克隆 fpga-lib 失败[\s\S]*fatal/,
    )
  })
})
