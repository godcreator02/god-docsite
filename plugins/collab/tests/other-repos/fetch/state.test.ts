import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchOtherRepo, otherRepoHeadOf, OtherReposFetch } from '../../../src/other-repos/fetch/state.js'
import { git, localOrganization, type LocalOrganization } from '../../fixtures/local-organization.js'

// 每条测试都新建几个 git 仓；和别的测试并行时 Windows 上启动 git 进程慢，5 秒不够
vi.setConfig({ testTimeout: 30_000 })

let organization: LocalOrganization

describe('取回一个别的仓', () => {
  beforeEach(async () => {
    organization = await localOrganization({ datasheets: { 'README.md': '资料库\n' } })
  })

  it('git fetch origin 一次，只取回、不动分支与工作区：之后和服务器比的结果就准了', async () => {
    organization.pushToOrigin('datasheets', 'new.txt', '新的\n')
    await fetchOtherRepo(organization.collabRepo, 'datasheets', { env: {} })
    const dir = organization.dirOf('datasheets')
    expect(git(dir, 'rev-list', '--count', 'HEAD..origin/main')).toBe('1')
    expect(git(dir, 'status', '--porcelain')).toBe('')
    expect(git(dir, 'branch', '--show-current')).toBe('main')
  })

  it('取回失败：写明是哪个仓与 git 的原话', async () => {
    git(organization.dirOf('datasheets'), 'remote', 'set-url', 'origin', path.join(organization.root, 'no-such-remote.git'))
    await expect(fetchOtherRepo(organization.collabRepo, 'datasheets', { env: {} })).rejects.toThrow(/取回 datasheets 失败：[\s\S]*fatal/)
  })
})

function write(file: string, content: string) {
  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(file, content)
}

/** 一个仓和它的远端：远端 main 上有一次提交，本机已取回；other 是另一个人的克隆，用来往远端推新提交 */
function repoWithRemote() {
  const base = mkdtempSync(path.join(tmpdir(), 'collab-head-'))
  const remote = path.join(base, 'remote.git')
  const repo = path.join(base, 'firmware')
  const other = path.join(base, 'other')
  git(base, 'init', '-q', '--bare', '-b', 'main', remote)
  for (const dir of [repo, other]) {
    git(base, 'clone', '-q', remote, dir)
    git(dir, 'config', 'user.email', 'test@example.com')
    git(dir, 'config', 'user.name', 'test')
  }
  write(path.join(repo, 'README.md'), 'x\n')
  git(repo, 'add', '.')
  git(repo, 'commit', '-q', '-m', 'init')
  git(repo, 'push', '-q', 'origin', 'HEAD:main')
  git(other, 'pull', '-q', 'origin', 'main')
  const pushFromOther = (file: string) => {
    write(path.join(other, file), 'theirs\n')
    git(other, 'add', '.')
    git(other, 'commit', '-q', '-m', file)
    git(other, 'push', '-q', 'origin', 'HEAD:main')
  }
  const commitMine = (file: string) => {
    write(path.join(repo, file), 'mine\n')
    git(repo, 'add', '.')
    git(repo, 'commit', '-q', '-m', file)
  }
  return { repo, pushFromOther, commitMine }
}

describe('别的仓的 HEAD 和服务器上的同名分支比', () => {
  it('一样新时两样都是 0；工作区里没提交的文件不算', async () => {
    const { repo } = repoWithRemote()
    write(path.join(repo, 'README.md'), 'y\n')
    write(path.join(repo, 'src', 'new.c'), '\n')
    expect(await otherRepoHeadOf(repo, 'firmware')).toEqual({ repo: 'firmware', ahead: 0, behind: 0 })
  })

  it('本地多出来的是 ahead，取回之后服务器上多出来的是 behind，两边都有就两个都不是 0', async () => {
    const { repo, pushFromOther, commitMine } = repoWithRemote()
    commitMine('mine.c')
    expect(await otherRepoHeadOf(repo, 'firmware')).toEqual({ repo: 'firmware', ahead: 1, behind: 0 })
    pushFromOther('theirs.c')
    expect(await otherRepoHeadOf(repo, 'firmware')).toMatchObject({ ahead: 1, behind: 0 })
    git(repo, 'fetch', '-q', 'origin')
    expect(await otherRepoHeadOf(repo, 'firmware')).toEqual({ repo: 'firmware', ahead: 1, behind: 1 })
  })

  it('别的分支和服务器上的同名分支比：推上去以后一样，主线再往前走也不算；还没推的分支，多的是哪个 origin 分支都没有的提交', async () => {
    const { repo, pushFromOther, commitMine } = repoWithRemote()
    git(repo, 'checkout', '-q', '-b', 'fix-pll')
    commitMine('pll.c')
    expect(await otherRepoHeadOf(repo, 'firmware')).toEqual({ repo: 'firmware', ahead: 1, behind: 0 })
    git(repo, 'push', '-q', 'origin', 'fix-pll')
    pushFromOther('theirs.c')
    git(repo, 'fetch', '-q', 'origin')
    expect(await otherRepoHeadOf(repo, 'firmware')).toEqual({ repo: 'firmware', ahead: 0, behind: 0 })
  })

  it('分离的 HEAD：多的是服务器上没有的提交；还没有提交的空仓两样都是 0', async () => {
    const { repo, commitMine } = repoWithRemote()
    git(repo, 'checkout', '-q', '--detach')
    commitMine('detached.c')
    expect(await otherRepoHeadOf(repo, 'firmware')).toEqual({ repo: 'firmware', ahead: 1, behind: 0 })
    const empty = mkdtempSync(path.join(tmpdir(), 'collab-head-'))
    git(empty, 'init', '-q', '-b', 'main')
    expect(await otherRepoHeadOf(empty, 'empty')).toEqual({ repo: 'empty', ahead: 0, behind: 0 })
  })
})

describe('别的仓那一边的取回', () => {
  beforeEach(async () => {
    organization = await localOrganization({ firmware: { 'main.c': 'int main(void) { return 0; }\n' } })
  })

  it('还没开始盯时现算各仓的 HEAD；项目文件夹不存在时开始盯直接报错', async () => {
    const fetch = new OtherReposFetch({ onChange: () => {}, log: { warn: () => {} }, settleMilliseconds: 100 })
    mkdirSync(path.join(organization.dirOf('firmware'), 'src'))
    expect(await fetch.headsOf(organization.collabRepo)).toEqual([{ repo: 'firmware', ahead: 0, behind: 0 }])
    expect(() => fetch.startWatching(path.join(organization.root, 'missing', 'collab'))).toThrow(/ENOENT/)
    fetch.closeAll()
  })

  it('盯着以后取回了就报变化，HEAD 状态跟着变；忘掉以后不再盯', async () => {
    const changed: string[] = []
    const fetch = new OtherReposFetch({ onChange: (repo) => changed.push(repo), log: { warn: () => {} }, settleMilliseconds: 100 })
    fetch.startWatching(organization.collabRepo)
    await vi.waitFor(() => expect(changed.length).toBeGreaterThan(0), { timeout: 15_000, interval: 100 })
    organization.pushToOrigin('firmware', 'theirs.c', 'theirs\n')
    await fetch.fetch(await organization.bob(), 'firmware')
    await vi.waitFor(async () => expect(await fetch.headsOf(organization.collabRepo)).toEqual([{ repo: 'firmware', ahead: 0, behind: 1 }]), { timeout: 15_000, interval: 100 })
    fetch.forget(organization.collabRepo)
    const before = changed.length
    writeFileSync(path.join(organization.dirOf('firmware'), 'new.c'), '\n')
    organization.commitIn(organization.dirOf('firmware'), '本地提交')
    await new Promise((resolve) => setTimeout(resolve, 400))
    expect(changed.length).toBe(before)
  })
})
