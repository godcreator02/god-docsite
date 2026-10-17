import path from 'node:path'
import type { SubmitState } from '@godcreator/collab'
import { describe, expect, it, vi } from 'vitest'
import { CollabSubmits } from '../../../src/collab-repo/submit/collab-submits.js'
import type { SubmitResult } from '../../../src/collab-repo/submit/submit.js'
import { SubmitFailures } from '../../../src/collab-repo/submit/submit-failures.js'
import { CollabRejected } from '../../../src/errors.js'
import type { RemoteProject } from '../../../src/project/project.js'

const repo = path.resolve('/projects/sst/collab')
const project = { repo, person: 'bob' } as RemoteProject
const merged: SubmitResult = { commit: 'abc', siteFiles: 0, sourceFiles: 0, workflowFiles: 0, siteTypecheck: null, pull: { number: 7, url: 'https://git.test/pulls/7' } }

/** 时刻依次是 t1、t2……；submitProject 由测试控制什么时候、怎样结束 */
function submitsWith(submitProject: (project: RemoteProject) => Promise<SubmitResult>) {
  const published: SubmitState[] = []
  const warned: string[] = []
  const failures = new SubmitFailures(() => {})
  let tick = 0
  const submits = new CollabSubmits({
    openRemote: async () => project,
    submitProject,
    failures,
    publish: (_repo, state) => void published.push(state),
    log: { warn: (message) => void warned.push(message) },
    now: () => new Date(Date.UTC(2026, 9, 17, 8, 0, (tick += 1))),
  })
  return { submits, published, warned, failures }
}

const at = (second: number) => new Date(Date.UTC(2026, 9, 17, 8, 0, second)).toISOString()

describe('提交审核：命令与一键提交共用', () => {
  it('跑的时候写 running，合并了写 merged 带合并请求、清掉上次的失败；命令调的记成项目的身份', async () => {
    const { submits, published, failures } = submitsWith(async () => merged)
    failures.record(repo, { at: 'x', message: '上次被打回' })
    expect(await submits.submit(repo)).toEqual(merged)
    expect(published).toEqual([
      { state: 'running', by: 'bob', at: at(1) },
      { state: 'merged', by: 'bob', at: at(2), pull: merged.pull },
    ])
    expect(failures.failureOf(repo)).toBeNull()
  })

  it('被拒：原话记成失败、写 null、照样抛出；正在跑时再提交就拒绝', async () => {
    let finish: (error: Error) => void = () => {}
    const { submits, published, failures } = submitsWith(() => new Promise((_resolve, reject) => (finish = reject)))
    const first = submits.submit(repo, 'alice')
    await vi.waitFor(() => expect(published).toEqual([{ state: 'running', by: 'alice', at: at(1) }]))
    await expect(submits.submit(repo)).rejects.toThrow('这个项目正在提交审核（alice 在')
    finish(new CollabRejected('合并请求 #3 被关闭'))
    await expect(first).rejects.toThrow('合并请求 #3 被关闭')
    expect(published.at(-1)).toBeNull()
    expect(failures.failureOf(repo)?.message).toBe('合并请求 #3 被关闭')
  })

  it('站点频道：requested 就接手（发起人是点的人）；自己写的 running 回来不动；别处留下的 running 清掉；形状不对报出来再清掉', async () => {
    const { submits, published, warned } = submitsWith(async () => merged)
    submits.onSiteState(repo, { state: 'requested', by: 'alice', at: 't' })
    submits.onSiteState(repo, { state: 'running', by: 'alice', at: at(1) })
    await vi.waitFor(() => expect(published.at(-1)).toMatchObject({ state: 'merged', by: 'alice' }))
    expect(published).toHaveLength(2)

    submits.onSiteState(repo, { state: 'running', by: 'bob', at: 'old' })
    expect(published.at(-1)).toBeNull()
    submits.onSiteState(repo, { state: 'nope' })
    expect(published.at(-1)).toBeNull()
    expect(warned[0]).toContain('形状不对')
    submits.onSiteState(repo, null)
    submits.onSiteState(repo, { state: 'merged', by: 'bob', at: 't', pull: merged.pull })
    expect(published).toHaveLength(4)
  })
})
