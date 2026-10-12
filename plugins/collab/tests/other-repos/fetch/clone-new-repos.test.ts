import { existsSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { cloneMissingRepos, repoCloneUrlOf, type OrganizationSource } from '../../../src/other-repos/fetch/clone-new-repos.js'
import { localOrganization, type LocalOrganization } from '../../fixtures/local-organization.js'

let organization: LocalOrganization

beforeEach(async () => {
  organization = await localOrganization({})
})

const sourceOf = (names: string[]): OrganizationSource => ({ ...organization.source, repoNames: async () => [...names] })

describe('补克隆组织里新加的仓', () => {
  it('各仓的克隆地址是 <组织地址>/<仓名>.git', () => {
    expect(repoCloneUrlOf('https://git.example.org/hybrid-mmc', 'datasheets')).toBe('https://git.example.org/hybrid-mmc/datasheets.git')
  })

  it('项目文件夹里没有的就克隆，回克隆了哪些；都有了就什么都不做', async () => {
    organization.bareRepoWith('datasheets', { 'README.md': '资料库\n' })
    expect(await cloneMissingRepos(organization.collabRepo, sourceOf(['collab', 'datasheets']), { env: {} })).toEqual(['datasheets'])
    expect(existsSync(path.join(organization.dirOf('datasheets'), 'README.md'))).toBe(true)
    expect(readdirSync(organization.projectDir).sort()).toEqual(['collab', 'datasheets'])
    expect(await cloneMissingRepos(organization.collabRepo, sourceOf(['collab', 'datasheets']), { env: {} })).toEqual([])
  })

  it('克隆失败：原话报出来', async () => {
    await expect(cloneMissingRepos(organization.collabRepo, sourceOf(['collab', 'missing-repo']), { env: {} })).rejects.toThrow(/克隆 missing-repo 失败/)
  })
})
