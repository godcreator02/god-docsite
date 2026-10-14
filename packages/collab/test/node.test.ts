import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { readCollabSnapshot } from '../src/node/index.js'
import { cleanSnapshot, peopleText } from './fixtures.js'
import { repoOnDisk } from './repo-on-disk.js'

describe('从磁盘读取协作仓的记录', () => {
  it('读出 site/people.json 与 collab/ 下全部记录文件，路径用 / 分隔、按路径排序', async () => {
    const snapshot = await readCollabSnapshot(repoOnDisk(cleanSnapshot.files, peopleText))
    expect(snapshot.people).toBe(peopleText)
    expect(Object.keys(snapshot.files)).toEqual(['records/20260920090000-m1a2b3c.json', 'records/20260925160530-t5v9w3d.json'])
    expect(snapshot.files).toEqual(cleanSnapshot.files)
  })

  it('没有 site/people.json 时 people 是 null', async () => {
    expect((await readCollabSnapshot(repoOnDisk({}, null))).people).toBeNull()
  })

  it('还没有 collab/ 时没有记录', async () => {
    const repo = mkdtempSync(path.join(tmpdir(), 'collab-repo-'))
    expect((await readCollabSnapshot(repo)).files).toEqual({})
  })
})
