import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { CollabRejected } from '../../../src/errors.js'
import { updateOtherRepo } from '../../../src/other-repos/fetch/update.js'
import type { RemoteProject } from '../../../src/project/project.js'
import { git, localOrganization, type LocalOrganization } from '../../fixtures/local-organization.js'

let organization: LocalOrganization
let bob: RemoteProject

beforeEach(async () => {
  organization = await localOrganization({ datasheets: { 'README.md': '资料库\n' }, firmware: { 'main.c': 'int main(void) { return 0; }\n' } })
  bob = await organization.bob()
})

describe('collab.repos.update 更新一个别的仓', () => {
  const dirOf = (name: string) => organization.dirOf(name)
  const head = (name: string) => git(dirOf(name), 'rev-parse', 'HEAD')

  it('先取回再快进，回 { repo, outcome, commits }；已经一样新回 up-to-date', async () => {
    organization.pushToOrigin('datasheets', 'a.md', 'A\n')
    organization.pushToOrigin('datasheets', 'b.md', 'B\n')
    expect(await updateOtherRepo(bob, 'datasheets')).toEqual({ repo: 'datasheets', outcome: 'merged', commits: 2 })
    expect(head('datasheets')).toBe(git(dirOf('datasheets'), 'rev-parse', 'origin/main'))
    expect(await updateOtherRepo(bob, 'datasheets')).toEqual({ repo: 'datasheets', outcome: 'up-to-date' })
  })

  it('不在 main 上（别的分支、分离的 HEAD）：拒绝，写明在哪，不动', async () => {
    organization.pushToOrigin('datasheets', 'a.md', 'A\n')
    git(dirOf('datasheets'), 'switch', '-q', '-c', 'dev')
    const before = head('datasheets')
    await expect(updateOtherRepo(bob, 'datasheets')).rejects.toThrow(new CollabRejected('没有更新 datasheets：当前在分支 dev 上：只更新 main，切回 main 才会更新'))
    git(dirOf('datasheets'), 'switch', '-q', '--detach', 'main')
    await expect(updateOtherRepo(bob, 'datasheets')).rejects.toThrow('没有更新 datasheets：当前在分离的 HEAD 上：只更新 main，切回 main 才会更新')
    expect(head('datasheets')).toBe(before)
  })

  it('本地 main 上有服务器上没有的提交：拒绝，写明可能是合并请求还没合并或没推上去', async () => {
    writeFileSync(path.join(dirOf('datasheets'), 'mine.md'), '我的\n')
    organization.commitIn(dirOf('datasheets'), '我的提交')
    organization.pushToOrigin('datasheets', 'a.md', 'A\n')
    const before = head('datasheets')
    await expect(updateOtherRepo(bob, 'datasheets')).rejects.toThrow('没有更新 datasheets：本地 main 上有服务器上没有的提交（1 个）：合并请求还没合并，或者是没推上去的提交')
    expect(head('datasheets')).toBe(before)
  })

  it('没提交的改动和新改动碰到同一个文件：git 不快进，文件原样留着，附 git 的原话', async () => {
    writeFileSync(path.join(dirOf('datasheets'), 'README.md'), '我正在改\n')
    organization.pushToOrigin('datasheets', 'README.md', '维护者改了\n')
    const before = head('datasheets')
    await expect(updateOtherRepo(bob, 'datasheets')).rejects.toThrow(/^没有更新 datasheets：没提交的改动和新改动碰到了同一个文件：先提交或收起这些改动再更新\n[\s\S]*README\.md/)
    expect(head('datasheets')).toBe(before)
    expect(readFileSync(path.join(dirOf('datasheets'), 'README.md'), 'utf8')).toBe('我正在改\n')
  })

  it('没提交的改动不碰新改动的文件：照样快进，改动照留', async () => {
    writeFileSync(path.join(dirOf('datasheets'), 'README.md'), '我正在改\n')
    organization.pushToOrigin('datasheets', 'a.md', 'A\n')
    expect(await updateOtherRepo(bob, 'datasheets')).toEqual({ repo: 'datasheets', outcome: 'merged', commits: 1 })
    expect(git(dirOf('datasheets'), 'status', '--porcelain')).toBe('M README.md')
  })

  it('有一次合并还没完成（MERGE_HEAD 还在）：拒绝', async () => {
    writeFileSync(path.join(dirOf('datasheets'), '.git', 'MERGE_HEAD'), `${head('datasheets')}\n`)
    await expect(updateOtherRepo(bob, 'datasheets')).rejects.toThrow('没有更新 datasheets：有一次合并还没完成（MERGE_HEAD 还在）：先完成或放弃那次合并')
  })

  it('仓里没有 origin/main（服务器上还是空仓）：拒绝，写明原因', async () => {
    git(organization.organizationDir, 'init', '-q', '--bare', '-b', 'main', path.join(organization.organizationDir, 'notes.git'))
    git(organization.projectDir, 'clone', '-q', path.join(organization.organizationDir, 'notes.git'), dirOf('notes'))
    await expect(updateOtherRepo(bob, 'notes')).rejects.toThrow('没有更新 notes：仓里没有 origin/main：服务器上这个仓还没有 main，或者还没取回过')
  })

  it('仓名不对就拒绝：不是合法仓名、是协作仓（大小写不论）、项目文件夹里没有、不是 git 仓', async () => {
    mkdirSync(dirOf('plain'))
    await expect(updateOtherRepo(bob, '../datasheets')).rejects.toThrow(/name 要是项目文件夹里的仓名/)
    await expect(updateOtherRepo(bob, 'collab')).rejects.toThrow('collab 是协作仓：协作仓由检查时的自动同步跟上 main')
    await expect(updateOtherRepo(bob, 'COLLAB')).rejects.toThrow(/是协作仓/)
    await expect(updateOtherRepo(bob, 'nope')).rejects.toThrow(`项目文件夹 ${organization.projectDir} 里没有叫 nope 的 git 仓`)
    await expect(updateOtherRepo(bob, 'plain')).rejects.toThrow(/里没有叫 plain 的 git 仓/)
  })

  it('取回失败：拒绝，附 git 的原话', async () => {
    git(dirOf('firmware'), 'remote', 'set-url', 'origin', path.join(organization.root, 'no-such-remote.git'))
    await expect(updateOtherRepo(bob, 'firmware')).rejects.toThrow(/^取回 firmware 失败：[\s\S]*fatal/)
  })
})
