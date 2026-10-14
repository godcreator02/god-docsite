import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { notificationOf } from '@godcreator/collab'
import { beforeEach, describe, expect, it } from 'vitest'
import { summaryOf } from '../../src/pane/summary.js'
import type { Project } from '../../src/project/project.js'

const git = (cwd: string, ...args: string[]) => execFileSync('git', args, { cwd, encoding: 'utf8' })

let project: Project

beforeEach(() => {
  const repo = path.join(mkdtempSync(path.join(tmpdir(), 'gwb-collab-summary-')), 'collab')
  mkdirSync(repo)
  git(repo, 'init', '-q', '-b', 'main')
  git(repo, 'remote', 'add', 'origin', 'https://bob@git.example.org/hybrid-mmc/collab.git')
  project = { repo, collabDir: path.join(repo, 'collab'), siteDir: path.join(repo, 'site'), person: 'bob' }
})

const nameOf = (personId: string) => (personId === 'bob' ? '鲍勃' : personId)

describe('窗格里一个项目的一行', () => {
  it('项目名、身份与显示名、通知各组几条、Gitea 上组织的页面', async () => {
    const notifications = [
      notificationOf({ kind: 'unsubmitted', records: ['records/a.json'], siteFiles: [] }),
      notificationOf({ kind: 'check-error', message: 'fetch 失败' }),
      notificationOf({ kind: 'unpulled', repo: 'firmware', count: 1 }),
      notificationOf({ kind: 'task', recordId: 't1', title: '核算纹波', due: null, detail: null }),
    ]
    expect(await summaryOf({ project, notifications, nameOf })).toEqual({
      repo: project.repo,
      title: 'collab',
      person: 'bob',
      name: '鲍勃',
      counts: { 'collab-repo': 2, 'other-repos': 1, 'for-me': 1 },
      giteaUrl: 'https://git.example.org/hybrid-mmc',
    })
  })

  it('site/content/meta.json 有 title 就用它作站名；origin 不是 Gitea 上仓的地址照实报错', async () => {
    mkdirSync(path.join(project.siteDir, 'content'), { recursive: true })
    writeFileSync(path.join(project.siteDir, 'content', 'meta.json'), JSON.stringify({ title: '混合型 MMC' }))
    expect((await summaryOf({ project, notifications: [], nameOf })).title).toBe('混合型 MMC')
    git(project.repo, 'remote', 'set-url', 'origin', path.join(tmpdir(), 'somewhere'))
    await expect(summaryOf({ project, notifications: [], nameOf })).rejects.toThrow(/origin 的地址 .* 不是 https:\/\/<主机>\/<owner>\/<仓名> 的样子/)
  })
})
