import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { readCollabSnapshotAtRevision } from '../../../src/collab-repo/submit/revision-files.js'

let root: string
const git = (...args: string[]) => execFileSync('git', args, { cwd: root, encoding: 'utf8' })

function write(relative: string, content: string) {
  const file = path.join(root, relative)
  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(file, content)
}

beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), 'gwb-collab-revision-'))
  git('init', '-q', '-b', 'main')
  git('config', 'user.name', 'probe')
  git('config', 'user.email', 'probe@local')
  git('config', 'core.autocrlf', 'false')
})

describe('从 git 的某个版本读记录', () => {
  it('读出那个版本里的 collab/ 与 site/people.json，工作区后来的改动不算', async () => {
    write('site/people.json', '[]\n')
    write('collab/records/a.json', '{ "id": "a" }\n')
    git('add', '.')
    git('commit', '-q', '-m', 'base')
    write('collab/records/a.json', '{ "id": "a", "改过": true }\n')
    expect(await readCollabSnapshotAtRevision(root, 'HEAD')).toEqual({ people: '[]\n', files: { 'records/a.json': '{ "id": "a" }\n' } })
  })

  it('那个版本里没有人员列表：people 为 null', async () => {
    write('collab/records/a.json', '{ "id": "a" }\n')
    git('add', '.')
    git('commit', '-q', '-m', 'base')
    expect(await readCollabSnapshotAtRevision(root, 'HEAD')).toEqual({ people: null, files: { 'records/a.json': '{ "id": "a" }\n' } })
  })

  it('版本不存在就报错，并带上 git 的原话', async () => {
    await expect(readCollabSnapshotAtRevision(root, 'no-such-rev')).rejects.toThrow(/no-such-rev/)
  })
})
