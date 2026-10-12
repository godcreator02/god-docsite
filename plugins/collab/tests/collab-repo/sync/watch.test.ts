import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CollabRepoLocalState } from '../../../src/collab-repo/sync/state.js'
import { watchCollabRepo, type CollabRepoWatcher } from '../../../src/collab-repo/sync/watch.js'

vi.setConfig({ testTimeout: 30_000 })

const git = (cwd: string, ...args: string[]) => execFileSync('git', args, { cwd, encoding: 'utf8' })

function write(file: string, content: string) {
  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(file, content)
}

function collabRepo(): string {
  const repo = mkdtempSync(path.join(tmpdir(), 'collab-watch-'))
  git(repo, 'init', '-q', '-b', 'main')
  git(repo, 'config', 'user.email', 'test@example.com')
  git(repo, 'config', 'user.name', 'test')
  write(path.join(repo, 'collab', 'people.json'), '[]\n')
  git(repo, 'add', '.')
  git(repo, 'commit', '-q', '-m', 'init')
  return repo
}

describe('盯协作仓', () => {
  const watchers: CollabRepoWatcher[] = []
  afterEach(() => watchers.splice(0).forEach((watcher) => watcher.close()))

  it('开始时算一次；保存了文件、提交了、切了分支都重算再交', async () => {
    const repo = collabRepo()
    let latest: CollabRepoLocalState | null = null
    const errors: string[] = []
    watchers.push(watchCollabRepo(repo, { onChange: (state) => (latest = state), onError: (message) => errors.push(message), settleMilliseconds: 100 }))
    const waitFor = (check: (state: CollabRepoLocalState) => void) =>
      vi.waitFor(
        () => {
          expect(latest).not.toBeNull()
          check(latest!)
        },
        { timeout: 15_000, interval: 100 },
      )
    await waitFor((state) => expect(state).toEqual({ branch: 'main', unsubmitted: { records: [], siteFiles: [] }, conflicts: [] }))
    write(path.join(repo, 'site', 'pages', 'a.mdx'), '# a\n')
    await waitFor((state) => expect(state.unsubmitted.siteFiles).toEqual(['pages/a.mdx']))
    git(repo, 'add', '.')
    git(repo, 'commit', '-q', '-m', 'a')
    await waitFor((state) => expect(state.unsubmitted.siteFiles).toEqual([]))
    git(repo, 'switch', '-q', '-c', 'research')
    await waitFor((state) => expect(state.branch).toBe('research'))
    expect(errors).toEqual([])
  })

  it('目录不存在：开始盯时直接抛错', () => {
    expect(() => watchCollabRepo(path.join(tmpdir(), 'collab-watch-missing', 'collab'), { onChange: () => {}, onError: () => {}, settleMilliseconds: 100 })).toThrow(/ENOENT/)
  })
})
