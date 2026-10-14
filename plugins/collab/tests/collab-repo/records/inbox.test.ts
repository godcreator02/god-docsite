import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { encodeRecordFile, recordFileOf, type CollabRecord } from '@godcreator/collab'
import { describe, expect, it } from 'vitest'
import { collabRecordsStateOf } from '../../../src/collab-repo/records/inbox.js'
import type { Project } from '../../../src/project/project.js'

function projectWith(people: string, records: CollabRecord[], broken: Record<string, string> = {}): Project {
  const repo = mkdtempSync(path.join(tmpdir(), 'gwb-collab-records-'))
  const collabDir = path.join(repo, 'collab')
  mkdirSync(path.join(collabDir, 'records'), { recursive: true })
  mkdirSync(path.join(repo, 'site'))
  writeFileSync(path.join(repo, 'site', 'people.json'), people)
  for (const record of records) writeFileSync(path.join(collabDir, recordFileOf(record.id)), encodeRecordFile(record))
  for (const [file, content] of Object.entries(broken)) writeFileSync(path.join(collabDir, file), content)
  return { repo, collabDir, siteDir: path.join(repo, 'site'), person: 'bob' }
}

describe('工作区交出的', () => {
  it('找我的待办、读不对的记录与人员列表；还没有 comments/ 就是没有评论', async () => {
    const people = `${JSON.stringify([{ id: 'bob', name: '鲍勃' }])}\n`
    const project = projectWith(people, [{ id: '20261008080000-aaaaaaa', type: 'task', author: 'admin', status: 'todo', title: '核算纹波', owner: 'bob' }], { 'records/broken.json': '{{{' })
    const state = await collabRecordsStateOf(project)
    expect(state.inbox.tasks.map((task) => task.title)).toEqual(['核算纹波'])
    expect(state.inbox.mentions).toEqual([])
    expect(state.problems.map((problem) => problem.file)).toEqual(['records/broken.json'])
    expect(state.people).toEqual([{ id: 'bob', name: '鲍勃' }])
  })

  it('site/people.json 读不对：拒绝，原话写明是它', async () => {
    await expect(collabRecordsStateOf(projectWith('{{{', []))).rejects.toThrow(/site\/people\.json 不是合法 JSON/)
  })
})
