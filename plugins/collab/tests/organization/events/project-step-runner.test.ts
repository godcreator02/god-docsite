import { describe, expect, it } from 'vitest'
import { CollabRejected } from '../../../src/errors.js'
import { ProjectStepRunner } from '../../../src/organization/events/project-step-runner.js'

const at = '2026-10-08T08:00:00.000Z'
const repo = 'D:/projects/hybrid-mmc/collab'

function runnerWith() {
  const changed: string[] = []
  const runner = new ProjectStepRunner({ onChange: (each) => void changed.push(each), now: () => new Date(at) })
  return { runner, changed }
}

const fail = (message: string) => async () => Promise.reject(new CollabRejected(message))

describe('按步记出错', () => {
  it('出错的步记下原话、加进这一次的 errors、回 null；同一步做成了就清掉', async () => {
    const { runner } = runnerWith()
    const errors: string[] = []
    expect(await runner.step(repo, 'collab-repo:fetch', errors, fail('取回失败'))).toBeNull()
    runner.stepSync(repo, 'other-repos:watch', errors, () => {
      throw new CollabRejected('监视不了')
    })
    expect(errors).toEqual(['取回失败', '监视不了'])
    expect(runner.errorsOf(repo)).toEqual(['取回失败', '监视不了'])
    expect(await runner.step(repo, 'collab-repo:fetch', [], async () => 'ok')).toBe('ok')
    expect(runner.errorsOf(repo)).toEqual(['监视不了'])
  })

  it('按项目仓根记：大小写、写法不同的同一个目录算一个项目；forget 清掉它的', async () => {
    const { runner } = runnerWith()
    await runner.step(repo, 'open', [], fail('打不开'))
    expect(runner.errorsOf(repo.toUpperCase())).toEqual(['打不开'])
    runner.forget(repo)
    expect(runner.errorsOf(repo)).toEqual([])
  })
})

describe('同一个项目同时只做一件', () => {
  it('正在做时回 busy；做完回这一次的出错，变了才通知', async () => {
    const { runner, changed } = runnerWith()
    let release = () => {}
    const blocked = new Promise<void>((resolve) => (release = resolve))
    const first = runner.exclusively(repo, false, async (errors) => {
      await blocked
      await runner.step(repo, 'collab-repo:fetch', errors, fail('取回失败'))
    })
    expect(await runner.exclusively(repo, false, async () => {})).toBe('busy')
    release()
    expect(await first).toEqual({ at, error: '取回失败' })
    expect(changed).toEqual([repo])
    expect(await runner.exclusively(repo, false, async () => {})).toEqual({ at, error: null })
    expect(changed).toEqual([repo])
  })

  it('完整刷新先清掉上次全部的出错，按这一次重新记', async () => {
    const { runner } = runnerWith()
    await runner.exclusively(repo, false, async (errors) => void (await runner.step(repo, 'other-repos:review:firmware', errors, fail('读不了'))))
    await runner.exclusively(repo, true, async (errors) => void (await runner.step(repo, 'collab-repo:fetch', errors, fail('取回失败'))))
    expect(runner.errorsOf(repo)).toEqual(['取回失败'])
  })
})
