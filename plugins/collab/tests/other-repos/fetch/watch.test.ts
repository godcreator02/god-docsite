import { writeFileSync } from 'node:fs'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { OtherRepoHead } from '../../../src/other-repos/fetch/state.js'
import { watchOtherRepoHeads, type OtherReposWatcher } from '../../../src/other-repos/fetch/watch.js'
import { git, localOrganization, type LocalOrganization } from '../../fixtures/local-organization.js'

vi.setConfig({ testTimeout: 30_000 })

let organization: LocalOrganization

beforeEach(async () => {
  organization = await localOrganization({ firmware: { 'main.c': 'int main(void) { return 0; }\n' } })
})

describe('盯别的仓的 HEAD', () => {
  const watchers: OtherReposWatcher[] = []
  afterEach(() => watchers.splice(0).forEach((watcher) => watcher.close()))

  function watched() {
    let latest: OtherRepoHead[] | null = null
    const errors: string[] = []
    watchers.push(watchOtherRepoHeads(organization.collabRepo, { onChange: (heads) => (latest = heads), onError: (message) => errors.push(message), settleMilliseconds: 100 }))
    const waitFor = (check: (heads: OtherRepoHead[]) => void) =>
      vi.waitFor(
        () => {
          expect(latest).not.toBeNull()
          check(latest!)
        },
        { timeout: 15_000, interval: 100 },
      )
    return { waitFor, errors }
  }

  it('开始时交出协作仓以外各仓的；提交了、取回了都重算那个仓；工作区里的改动不算；新克隆的仓也跟上', async () => {
    const { waitFor, errors } = watched()
    const firmware = organization.dirOf('firmware')
    await waitFor((heads) => expect(heads).toEqual([{ repo: 'firmware', ahead: 0, behind: 0 }]))
    writeFileSync(path.join(firmware, 'new.c'), '\n')
    organization.commitIn(firmware, '本地提交')
    await waitFor((heads) => expect(heads).toEqual([{ repo: 'firmware', ahead: 1, behind: 0 }]))
    organization.pushToOrigin('firmware', 'theirs.c', 'theirs\n')
    git(firmware, 'fetch', '-q', 'origin')
    await waitFor((heads) => expect(heads).toEqual([{ repo: 'firmware', ahead: 1, behind: 1 }]))
    organization.bareRepoWith('fpga', { 'top.v': 'module top; endmodule\n' })
    git(organization.projectDir, 'clone', '-q', path.join(organization.organizationDir, 'fpga.git'), organization.dirOf('fpga'))
    await waitFor((heads) => expect(heads.map((head) => head.repo)).toEqual(['firmware', 'fpga']))
    expect(errors).toEqual([])
  })

  it('项目文件夹里没有别的仓：也交一次空的', async () => {
    const lonely = await localOrganization({})
    let latest: OtherRepoHead[] | null = null
    watchers.push(watchOtherRepoHeads(lonely.collabRepo, { onChange: (heads) => (latest = heads), onError: () => {}, settleMilliseconds: 100 }))
    expect(latest).toEqual([])
  })
})
