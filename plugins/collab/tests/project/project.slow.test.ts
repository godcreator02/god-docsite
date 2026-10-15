import { beforeEach, describe, expect, it } from 'vitest'
import { giteaLocationOfRepoIn, otherRepoNamesOf, requireOrganizationFolder } from '../../src/project/project.js'
import { git, localOrganization, type LocalOrganization } from '../fixtures/local-organization.js'

let organization: LocalOrganization

beforeEach(async () => {
  organization = await localOrganization({ datasheets: { 'README.md': '资料库\n' }, firmware: { 'main.c': '\n' } })
})

describe('项目文件夹里的仓', () => {
  it('协作仓的上一级要以组织命名，大小写不论；不是就拒绝，写明怎么放', () => {
    expect(() => requireOrganizationFolder(organization.collabRepo, 'hybrid-mmc')).not.toThrow()
    expect(() => requireOrganizationFolder(organization.collabRepo, 'HYBRID-MMC')).not.toThrow()
    expect(() => requireOrganizationFolder(organization.collabRepo, 'other-org')).toThrow(/不是以组织 other-org 命名的项目文件夹：用 collab\.project\.clone/)
  })

  it('协作仓以外的仓按名字排；一个仓在 Gitea 上的位置从它的 origin 读', async () => {
    expect(otherRepoNamesOf(organization.collabRepo)).toEqual(['datasheets', 'firmware'])
    git(organization.dirOf('firmware'), 'remote', 'set-url', 'origin', 'https://bob@git.example.org/hybrid-mmc/firmware.git')
    expect(await giteaLocationOfRepoIn(organization.collabRepo, 'firmware')).toEqual({ owner: 'hybrid-mmc', repo: 'firmware', ownerUrl: 'https://git.example.org/hybrid-mmc' })
  })
})
