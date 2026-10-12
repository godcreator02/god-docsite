import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { collabRepoLocalStateOf, CollabRepoSync } from '../../../src/collab-repo/sync/state.js'
import { SubmitFailures } from '../../../src/collab-repo/submit/submit-failures.js'
import { openProject, type RemoteProject } from '../../../src/project/project.js'
import type { SiteControl } from '../../../src/site-process/dependencies.js'

vi.setConfig({ testTimeout: 30_000 })

const bobCode = 'bobcode2345'
const people = `${JSON.stringify([{ id: 'admin', name: '管理员' }, { id: 'bob', name: '鲍勃', codes: [bobCode] }])}\n`
/** 协作仓起点就有的一条记录 */
const seedRecord = 'collab/records/20260901090000-seedrec.json'

const git = (cwd: string, ...args: string[]) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim()

function write(file: string, content: string) {
  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(file, content)
}

/** 一个协作仓（collab/ 在仓根下）和它的远端：远端 main 上有一次提交，本机已取回 */
function collabRepoWithRemote() {
  const base = mkdtempSync(path.join(tmpdir(), 'collab-local-state-'))
  const remote = path.join(base, 'remote.git')
  const repo = path.join(base, 'collab')
  git(base, 'init', '-q', '--bare', '-b', 'main', remote)
  git(base, 'clone', '-q', remote, repo)
  git(repo, 'config', 'user.email', 'test@example.com')
  git(repo, 'config', 'user.name', 'test')
  write(path.join(repo, seedRecord), '{}\n')
  write(path.join(repo, 'site', 'people.json'), '[]\n')
  write(path.join(repo, 'README.md'), 'x\n')
  git(repo, 'add', '.')
  git(repo, 'commit', '-q', '-m', 'init')
  git(repo, 'push', '-q', 'origin', 'HEAD:main')
  return { base, repo }
}

describe('协作仓的本机状态', () => {
  it('没改动时是空的，在 main 上', async () => {
    const { repo } = collabRepoWithRemote()
    expect(await collabRepoLocalStateOf(repo)).toEqual({ branch: 'main', unsubmitted: { records: [], siteFiles: [] }, conflicts: [] })
  })

  it('还没提交审核的文件 collab/、site/ 分开，路径各自相对；仓里别处的改动不算', async () => {
    const { repo } = collabRepoWithRemote()
    write(path.join(repo, 'collab', 'records', '20260926120000-abc1234.json'), '{}\n')
    write(path.join(repo, 'site', 'people.json'), '[ ]\n')
    write(path.join(repo, 'site', 'content', 'a.mdx'), '# a\n')
    write(path.join(repo, 'README.md'), 'y\n')
    expect((await collabRepoLocalStateOf(repo)).unsubmitted).toEqual({ records: ['records/20260926120000-abc1234.json'], siteFiles: ['content/a.mdx', 'people.json'] })
  })

  it('合并留下的冲突从状态码里读，路径相对仓根', async () => {
    const { base, repo } = collabRepoWithRemote()
    const other = path.join(base, 'other')
    git(base, 'clone', '-q', path.join(base, 'remote.git'), other)
    write(path.join(other, 'README.md'), 'theirs\n')
    git(other, '-c', 'user.name=t', '-c', 'user.email=t@x', 'commit', '-q', '-am', 'theirs')
    git(other, 'push', '-q', 'origin', 'HEAD:main')
    write(path.join(repo, 'README.md'), 'mine\n')
    git(repo, 'commit', '-q', '-am', 'mine')
    git(repo, 'fetch', '-q', 'origin')
    expect(() => execFileSync('git', ['merge', '-q', 'origin/main'], { cwd: repo, stdio: 'ignore' })).toThrow()
    expect((await collabRepoLocalStateOf(repo)).conflicts).toEqual(['README.md'])
  })

  it('不在 main 上：写出分支名；分离的 HEAD 为 null', async () => {
    const { repo } = collabRepoWithRemote()
    git(repo, 'checkout', '-q', '-b', 'research')
    expect((await collabRepoLocalStateOf(repo)).branch).toBe('research')
    git(repo, 'checkout', '-q', '--detach')
    expect((await collabRepoLocalStateOf(repo)).branch).toBeNull()
  })
})

function cloneAs(root: string, origin: string, person: string): string {
  const repo = path.join(root, person)
  git(root, 'clone', '-q', origin, repo)
  git(repo, 'config', 'user.name', person)
  git(repo, 'config', 'user.email', `${person}@local`)
  return repo
}

let admin: string
let bob: RemoteProject

function adminPushes(file: string) {
  writeFileSync(path.join(admin, file), `${file}\n`)
  git(admin, 'add', '.')
  git(admin, 'commit', '-q', '-m', file)
  git(admin, 'push', '-q', 'origin', 'main')
}

const notRunning: SiteControl = { whileStopped: async (_project, work) => ({ result: await work(false), relaunched: false }), recheck: async () => {} }

function syncWith(changed: string[], submitFailures = new SubmitFailures(() => {})) {
  return new CollabRepoSync({
    sites: notRunning,
    install: async () => {
      throw new Error('不该装依赖')
    },
    onChange: (repo) => changed.push(repo),
    onNothingToSubmit: (repo) => submitFailures.record(repo, null),
    log: { warn: () => {} },
    now: () => new Date('2026-10-08T08:00:00.000Z'),
    settleMilliseconds: 100,
  })
}

describe('协作仓那一边的自动同步', () => {
  beforeEach(async () => {
    const root = mkdtempSync(path.join(tmpdir(), 'gwb-collab-sync-'))
    const origin = path.join(root, 'origin.git')
    git(root, 'init', '-q', '--bare', '-b', 'main', origin)
    admin = cloneAs(root, origin, 'admin')
    write(path.join(admin, seedRecord), '{}\n')
    write(path.join(admin, 'site', 'people.json'), people)
    git(admin, 'add', '.')
    git(admin, 'commit', '-q', '-m', '起点')
    git(admin, 'push', '-q', 'origin', 'main')
    bob = { ...(await openProject(cloneAs(root, origin, 'bob'), bobCode)), remote: { env: {} }, gitea: { owner: 'hybrid-mmc', repo: 'collab', ownerUrl: 'https://git.example.org/hybrid-mmc' } }
  })

  it('取回 origin、能快进就快进，记下结果；还没同步过为 null', async () => {
    const sync = syncWith([])
    expect(sync.lastSyncOf(bob.repo)).toBeNull()
    adminPushes('a.md')
    await sync.fetch(bob)
    await sync.autoSync(bob)
    expect(sync.lastSyncOf(bob.repo)).toEqual({ at: '2026-10-08T08:00:00.000Z', outcome: 'merged', commits: 1, dependenciesInstalled: false, siteRestarted: false })
    expect(git(bob.repo, 'rev-parse', 'HEAD')).toBe(git(admin, 'rev-parse', 'HEAD'))
    expect(sync.syncProblemOf(bob.repo)).toBeNull()
  })

  it('不能快进：同步不了的原因留给通知，变了才报变化；能同步了就清掉', async () => {
    const changed: string[] = []
    const sync = syncWith(changed)
    git(bob.repo, 'switch', '-q', '-c', 'dev')
    await sync.autoSync(bob)
    expect(sync.syncProblemOf(bob.repo)).toMatch(/^当前在分支 dev 上：协作仓只用 main 一条分支/)
    await sync.autoSync(bob)
    expect(changed).toEqual([bob.repo])
    git(bob.repo, 'switch', '-q', 'main')
    await sync.autoSync(bob)
    expect(sync.syncProblemOf(bob.repo)).toBeNull()
    expect(changed).toEqual([bob.repo, bob.repo])
  })

  it('盯着协作仓：本机状态一变就报变化；还没算出来、没在盯时现算；忘掉以后不再记自动同步', async () => {
    const changed: string[] = []
    const sync = syncWith(changed)
    writeFileSync(path.join(bob.repo, seedRecord), '{ }\n')
    expect((await sync.localStateOf(bob.repo)).unsubmitted.records).toEqual(['records/20260901090000-seedrec.json'])
    sync.startWatching(bob.repo)
    await vi.waitFor(() => expect(changed.length).toBeGreaterThan(0), { timeout: 15_000, interval: 100 })
    await sync.autoSync(bob)
    sync.forget(bob.repo)
    expect(sync.lastSyncOf(bob.repo)).toBeNull()
    sync.closeAll()
  })

  describe('自动同步以后没有东西可提交，上次提交审核的失败就清掉', () => {
    const rejected = { at: '2026-10-08T13:10:00.000Z', message: '没有推送，改动留在工作区（没提交）：改了只有负责人能改的内容' }
    const changedRecord = () => path.join(bob.repo, seedRecord)

    /** bob 改了 collab/ 去提交审核、被拒，改动留在工作区 */
    function rejectedWithChangeInWorkTree() {
      const changed: string[] = []
      const failures = new SubmitFailures((repo) => changed.push(repo))
      writeFileSync(changedRecord(), '{ }\n')
      failures.record(bob.repo, rejected)
      return { changed, failures, sync: syncWith([], failures) }
    }

    it('被拒后撤掉改动：下一次自动同步后这条消失', async () => {
      const { changed, failures, sync } = rejectedWithChangeInWorkTree()
      git(bob.repo, 'checkout', '-q', '--', seedRecord)
      await sync.autoSync(bob)
      expect(failures.failureOf(bob.repo)).toBeNull()
      expect(changed).toEqual([bob.repo, bob.repo])
    })

    it('撤掉改动时 main 上正好有新提交：快进以后同样消失', async () => {
      const { failures, sync } = rejectedWithChangeInWorkTree()
      git(bob.repo, 'checkout', '-q', '--', seedRecord)
      adminPushes('a.md')
      await sync.fetch(bob)
      await sync.autoSync(bob)
      expect(sync.lastSyncOf(bob.repo)?.outcome).toBe('merged')
      expect(failures.failureOf(bob.repo)).toBeNull()
    })

    it('改动还在工作区：保留', async () => {
      const { failures, sync } = rejectedWithChangeInWorkTree()
      await sync.autoSync(bob)
      expect(failures.failureOf(bob.repo)).toEqual(rejected)
    })

    it('改动提交在本地 main 上、还没进 main：保留', async () => {
      const { failures, sync } = rejectedWithChangeInWorkTree()
      git(bob.repo, 'commit', '-q', '-am', 'bob 的改动')
      await sync.autoSync(bob)
      expect(sync.syncProblemOf(bob.repo)).toMatch(/^本地 main 上有还没进 main 的提交/)
      expect(failures.failureOf(bob.repo)).toEqual(rejected)
    })
  })
})
