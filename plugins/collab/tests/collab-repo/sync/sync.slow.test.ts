import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { encodeRecordFile, recordFileOf, type CollabRecord, type TaskRecord } from '@godcreator/collab'
import { beforeEach, describe, expect, it } from 'vitest'
import type { InstallDependencies, SiteControl } from '../../../src/site-process/dependencies.js'
import { openProject, type RemoteProject } from '../../../src/project/project.js'
import { autoSyncCollab } from '../../../src/collab-repo/sync/sync.js'
import { CollabRejected } from '../../../src/errors.js'

/** 每个测试一套：origin 是本地裸仓，admin 往 main 上推，bob 只用本地 main；自动同步前先取回，和定时检查一样 */
const git = (cwd: string, ...args: string[]) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim()

const bobCode = 'bobcode2345'
const people = `${JSON.stringify([
  { id: 'admin', name: '管理员' },
  { id: 'bob', name: '鲍勃', codes: [bobCode] },
])}\n`

const task = (id: string, author: string, extra: Partial<TaskRecord> = {}): TaskRecord => ({ id, type: 'task', author, status: 'todo', title: `${author} 的任务`, ...extra })
const shared = task('20260930090000-aaaaaaa', 'admin', { title: '核算纹波' })

function writeRecord(repo: string, record: CollabRecord) {
  const file = path.join(repo, 'collab', recordFileOf(record.id))
  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(file, encodeRecordFile(record))
}

function commitAll(repo: string, message: string) {
  git(repo, 'add', '.')
  git(repo, 'commit', '-q', '-m', message)
}

function cloneAs(root: string, origin: string, person: string): string {
  const repo = path.join(root, person)
  git(root, 'clone', '-q', origin, repo)
  git(repo, 'config', 'user.name', person)
  git(repo, 'config', 'user.email', `${person}@local`)
  git(repo, 'config', 'core.autocrlf', 'false')
  return repo
}

let admin: string
let bob: RemoteProject

beforeEach(async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'gwb-collab-autosync-'))
  const origin = path.join(root, 'origin.git')
  git(root, 'init', '-q', '--bare', '-b', 'main', origin)
  admin = cloneAs(root, origin, 'admin')
  mkdirSync(path.join(admin, 'collab'))
  mkdirSync(path.join(admin, 'site'))
  writeFileSync(path.join(admin, 'site', 'people.json'), people)
  writeFileSync(path.join(admin, 'site', 'docsite.json'), '{"kind":"collab","format":1}\n')
  writeFileSync(path.join(admin, 'site', 'package.json'), '{ "name": "site" }\n')
  writeRecord(admin, shared)
  commitAll(admin, '起点')
  git(admin, 'push', '-q', 'origin', 'main')
  const bobRepo = cloneAs(root, origin, 'bob')
  bob = { ...(await openProject(bobRepo, bobCode)), remote: { env: {} }, gitea: { owner: 'hybrid-mmc', repo: 'collab', ownerUrl: 'https://git.example.org/hybrid-mmc' } }
})

/** admin 往 main 上推一条新任务 */
function adminPushes(record: CollabRecord, message: string) {
  writeRecord(admin, record)
  commitAll(admin, message)
  git(admin, 'push', '-q', 'origin', 'main')
}

const fetchBob = () => git(bob.repo, 'fetch', '-q', 'origin')

const notRunning: SiteControl = { whileStopped: async (_project, work) => ({ result: await work(false), relaunched: false }), recheck: async () => {} }
const noInstall: InstallDependencies = async () => {
  throw new Error('不该装依赖')
}

describe('定时检查里的自动同步', () => {
  it('落后 origin/main、本地没有还没合进去的提交：本地 main 快进到和 origin/main 一样', async () => {
    adminPushes(task('20260930100000-bbbbbbb', 'admin', { owner: 'bob' }), '指派')
    fetchBob()
    const result = await autoSyncCollab(bob, notRunning, noInstall)
    expect(result).toEqual({ outcome: 'merged', commits: 1, dependenciesInstalled: false, siteRestarted: false })
    expect(git(bob.repo, 'rev-parse', 'HEAD')).toBe(git(bob.repo, 'rev-parse', 'origin/main'))
    expect(git(bob.repo, 'branch', '--show-current')).toBe('main')
  })

  it('我的提交被执行器合进 main：快进，本地 main 就是 origin/main，不生成合并提交', async () => {
    writeRecord(bob.repo, task('20260930110000-ccccccc', 'bob'))
    commitAll(bob.repo, 'bob 的任务')
    git(bob.repo, 'push', '-q', 'origin', 'HEAD:refs/pull/1/head')
    adminPushes(task('20260930100000-bbbbbbb', 'admin'), 'admin 的任务')
    // 执行器把 bob 的合并请求合进 main
    git(admin, 'fetch', '-q', 'origin', 'refs/pull/1/head')
    git(admin, 'merge', '-q', '--no-ff', '--no-edit', 'FETCH_HEAD')
    git(admin, 'push', '-q', 'origin', 'main')
    fetchBob()
    expect((await autoSyncCollab(bob, notRunning, noInstall)).outcome).toBe('merged')
    expect(git(bob.repo, 'rev-parse', 'HEAD')).toBe(git(bob.repo, 'rev-parse', 'origin/main'))
  })

  it('本地 main 上有还没进 main 的提交（提交审核正在等执行器）：不动，写明原因', async () => {
    writeRecord(bob.repo, task('20260930110000-ccccccc', 'bob'))
    commitAll(bob.repo, 'bob 的任务')
    adminPushes(task('20260930100000-bbbbbbb', 'admin'), 'admin 的任务')
    fetchBob()
    const before = git(bob.repo, 'rev-parse', 'HEAD')
    expect(await autoSyncCollab(bob, notRunning, noInstall)).toEqual({
      outcome: 'skipped',
      reason: '本地 main 上有还没进 main 的提交：提交审核正在等执行器，或者上次提交审核中途断了，再运行一次 collab.submit',
    })
    expect(git(bob.repo, 'rev-parse', 'HEAD')).toBe(before)
    expect(git(bob.repo, 'status', '--porcelain')).toBe('')
  })

  it('只快进：工作区里没提交、不和新改动碰同一个文件的改动照留', async () => {
    adminPushes(task('20260930100000-bbbbbbb', 'admin'), 'admin 的任务')
    writeRecord(bob.repo, task('20260930120000-ddddddd', 'bob'))
    fetchBob()
    expect((await autoSyncCollab(bob, notRunning, noInstall)).outcome).toBe('merged')
    expect(git(bob.repo, 'rev-parse', 'HEAD')).toBe(git(bob.repo, 'rev-parse', 'origin/main'))
    expect(git(bob.repo, 'status', '--porcelain')).toBe(`?? collab/${recordFileOf('20260930120000-ddddddd')}`)
  })

  it('快进进来的改动动了依赖、接着装依赖失败：报错写明已经快进了，附 pnpm 原话', async () => {
    writeFileSync(path.join(admin, 'site', 'package.json'), '{ "name": "site", "dependencies": { "@godcreator/collab": "^0.1.0" } }\n')
    commitAll(admin, '升框架包')
    git(admin, 'push', '-q', 'origin', 'main')
    fetchBob()
    const failing: InstallDependencies = async () => {
      throw new CollabRejected('在 site/ 里运行 pnpm install 失败（退出码 1）：\nERR_PNPM_FETCH_404')
    }
    await expect(autoSyncCollab(bob, notRunning, failing)).rejects.toThrow(/^自动同步已快进到 origin\/main[\s\S]*ERR_PNPM_FETCH_404/)
    expect(git(bob.repo, 'rev-list', '--count', 'HEAD..origin/main')).toBe('0')
  })

  it('已经和 main 一样新：什么都不做', async () => {
    fetchBob()
    expect(await autoSyncCollab(bob, notRunning, noInstall)).toEqual({ outcome: 'up-to-date' })
  })

  it('在 main 以外的分支上：不动，写明原因', async () => {
    git(bob.repo, 'switch', '-q', '-c', 'bob/改页面')
    adminPushes(task('20260930100000-bbbbbbb', 'admin'), '新任务')
    fetchBob()
    const before = git(bob.repo, 'rev-parse', 'HEAD')
    const result = await autoSyncCollab(bob, notRunning, noInstall)
    expect(result).toEqual({ outcome: 'skipped', reason: '当前在分支 bob/改页面 上：协作仓只用 main 一条分支，只在 main 上自动同步' })
    expect(git(bob.repo, 'rev-parse', 'HEAD')).toBe(before)
  })

  it('工作区里没提交的改动会被覆盖：git 不快进，文件原样留着', async () => {
    const file = path.join(bob.repo, 'collab', recordFileOf(shared.id))
    writeRecord(bob.repo, { ...shared, title: 'bob 正在改标题' })
    const edited = readFileSync(file, 'utf8')
    adminPushes({ ...shared, status: 'done' }, 'admin：已完成')
    fetchBob()
    const before = git(bob.repo, 'rev-parse', 'HEAD')
    const result = await autoSyncCollab(bob, notRunning, noInstall)
    expect(result).toMatchObject({ outcome: 'skipped' })
    expect(result.outcome === 'skipped' && result.reason).toMatch(/^工作区里没提交的改动和 main 上的新改动碰到了同一个文件：提交审核时会把 main 合进来，冲突由人配合 AI 改好\n/)
    expect(git(bob.repo, 'rev-parse', 'HEAD')).toBe(before)
    expect(readFileSync(file, 'utf8')).toBe(edited)
  })

  it('提交审核合 main 出的冲突还没改好：不动，冲突标记原样留着', async () => {
    writeRecord(bob.repo, { ...shared, status: 'doing' })
    commitAll(bob.repo, 'bob：进行中')
    adminPushes({ ...shared, status: 'done' }, 'admin：已完成')
    fetchBob()
    // 提交审核时把 main 合进来出了冲突，还没改好
    expect(() => execFileSync('git', ['merge', '--no-edit', 'origin/main'], { cwd: bob.repo, stdio: 'ignore' })).toThrow()
    adminPushes(task('20260930100000-bbbbbbb', 'admin'), '又一条')
    fetchBob()
    const result = await autoSyncCollab(bob, notRunning, noInstall)
    expect(result).toEqual({ outcome: 'skipped', reason: '提交审核时把 main 合进来出了冲突，还没改好：让 AI 改好冲突、再提交审核' })
    expect(git(bob.repo, 'diff', '--name-only', '--diff-filter=U')).toBe(`collab/${recordFileOf(shared.id)}`)
  })

  it('合进来的改动只动了 site/ 的页面：不装依赖，让站点再过一遍启动前的检查；只动 collab/ 时不查', async () => {
    const rechecked: string[] = []
    const sites: SiteControl = { ...notRunning, recheck: async (project) => void rechecked.push(project.repo) }
    adminPushes(task('20260930100000-bbbbbbb', 'admin'), '只改记录')
    fetchBob()
    await autoSyncCollab(bob, sites, noInstall)
    expect(rechecked).toEqual([])

    mkdirSync(path.join(admin, 'site', 'pages', 'hardware-library'), { recursive: true })
    writeFileSync(path.join(admin, 'site', 'pages', 'hardware-library', 'page.mdx'), '# 器件库\n')
    commitAll(admin, '加一页')
    git(admin, 'push', '-q', 'origin', 'main')
    fetchBob()
    expect(await autoSyncCollab(bob, sites, noInstall)).toEqual({ outcome: 'merged', commits: 1, dependenciesInstalled: false, siteRestarted: false })
    expect(rechecked).toEqual([bob.repo])
  })

  it('合进来的改动动了 site/ 的依赖：接着装依赖，站点照常驻的规矩重启', async () => {
    writeFileSync(path.join(admin, 'site', 'package.json'), '{ "name": "site", "dependencies": { "@godcreator/collab": "^0.1.0" } }\n')
    commitAll(admin, '升框架包')
    git(admin, 'push', '-q', 'origin', 'main')
    fetchBob()
    const installedIn: string[] = []
    const install: InstallDependencies = async (siteDir) => {
      installedIn.push(siteDir)
      return { outputTail: 'Done in 1.2s' }
    }
    const running: SiteControl = { whileStopped: async (_project, work) => ({ result: await work(true), relaunched: true }), recheck: async () => {} }
    expect(await autoSyncCollab(bob, running, install)).toEqual({ outcome: 'merged', commits: 1, dependenciesInstalled: true, siteRestarted: true })
    expect(installedIn).toEqual([bob.siteDir])
  })
})
