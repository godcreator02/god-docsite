import { readFileSync } from 'node:fs'
import path from 'node:path'
import { recordFileOf, type CollabRecord, type TaskRecord } from '@godcreator/collab'
import { describe, expect, it } from 'vitest'
import { submitCollab } from '../../../src/collab-repo/submit/submit.js'
import { autoSyncCollab } from '../../../src/collab-repo/sync/sync.js'
import type { InstallDependencies, SiteControl } from '../../../src/site-process/dependencies.js'
import { admin, bob, forMain, git, merges, origin, passingSiteChecks, writeRecord } from './submit-fixture.js'

describe('提交审核与自动同步配合', () => {
  function adminPushes(record: CollabRecord, message: string) {
    git(admin, 'pull', '-q', '--ff-only')
    writeRecord(admin, record)
    git(admin, 'add', '.')
    git(admin, 'commit', '-q', '-m', message)
    git(admin, 'push', '-q', 'origin', 'main')
  }

  const notRunning: SiteControl = { whileStopped: async (_project, work) => ({ result: await work(false), relaunched: false }), recheck: async () => {} }
  const noInstall: InstallDependencies = async () => {
    throw new Error('不该装依赖')
  }

  /** 和检查一样：先取回，再自动同步 */
  async function checkSyncs() {
    git(bob.repo, 'fetch', '-q', 'origin')
    return autoSyncCollab(bob, notRunning, noInstall)
  }

  it('提交审核时同一条的同一个字段两边改得不一样：不推送，列出冲突的文件，自动同步不动；改好之后再提交审核完成这次合并', { timeout: 120_000 }, async () => {
    const t3 = (status: TaskRecord['status']): TaskRecord => ({ id: '20260925130000-ddddddd', type: 'task', author: 'admin', status, title: '核算纹波' })
    adminPushes(t3('todo'), '任务 t3')
    expect((await checkSyncs()).outcome).toBe('merged')
    writeRecord(bob.repo, t3('done'))
    adminPushes(t3('doing'), 't3 进行中')

    await expect(submitCollab(bob, merges(), passingSiteChecks)).rejects.toThrow(/有冲突，没有推送；冲突标记留在这些文件里[^\n]*\ncollab\/records\/20260925130000-ddddddd\.json\n/)
    expect(readFileSync(path.join(bob.repo, 'collab', recordFileOf(t3('done').id)), 'utf8')).toMatch(/^<<<<<<< /m)
    expect(() => git(origin, 'rev-parse', '--verify', '-q', 'refs/for/main')).toThrow()
    expect(await checkSyncs()).toEqual({ outcome: 'skipped', reason: '提交审核时把 main 合进来出了冲突，还没改好：让 AI 改好冲突、再提交审核' })

    writeRecord(bob.repo, t3('done'))
    const result = await submitCollab(bob, merges(), passingSiteChecks)
    expect(git(bob.repo, 'rev-list', '--parents', '-n', '1', 'HEAD').split(' ')).toHaveLength(3)
    expect(forMain()).toBe(result.commit)
  })
})
