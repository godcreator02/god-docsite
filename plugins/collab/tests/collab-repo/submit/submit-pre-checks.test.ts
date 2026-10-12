import { writeFileSync } from 'node:fs'
import path from 'node:path'
import { recordFileOf } from '@godcreator/collab-model/task-model'
import { describe, expect, it } from 'vitest'
import { collabProblems } from '../../../src/collab-repo/submit/submit-checks.js'
import { admin, bob, git, t1, t2, task, writeRecord } from './submit-fixture.js'

describe('提交前校验', () => {
  it('刚克隆、没有改动：没有问题', async () => {
    expect(await collabProblems(bob)).toEqual([])
  })

  it('只报这次改动带来的格式问题；替别人写记录、改别人的记录不算问题', async () => {
    writeRecord(bob.repo, task(t1, 'admin', 'done'))
    writeFileSync(path.join(bob.repo, 'collab', recordFileOf(t2)), JSON.stringify(task(t2, 'admin')))
    const problems = await collabProblems(bob)
    expect(problems.map((problem) => problem.file)).toEqual([`records/${t2}.json`])
    expect(problems[0]?.message).toMatch(/^不是规范写法/)
  })

  it('分出来的那个提交上就有的问题不算：同步进来的 main 上的问题不是我的', async () => {
    writeFileSync(path.join(admin, 'collab', 'stray.txt'), '多出来的文件\n')
    git(admin, 'add', '.')
    git(admin, 'commit', '-q', '-m', 'main 上多了一个文件')
    git(admin, 'push', '-q', 'origin', 'main')
    git(bob.repo, 'pull', '-q', '--ff-only')
    expect(await collabProblems(bob)).toEqual([])
  })
})
