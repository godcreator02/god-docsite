import type { GwbZcodeApi } from '@godcreator/gwb-zcode'
import { describe, expect, it, vi } from 'vitest'
import { handOffToZcode } from '../../src/ai-handoff/zcode.js'
import { CollabRejected } from '../../src/errors.js'

/** 服务 gwbZcode 的假件：只实现交给 AI 用到的 open 与 create */
function zcodeWith(behaviour: { open?: () => Promise<unknown>; create?: () => Promise<{ taskId: string }> } = {}) {
  const calls: Array<{ method: string; input: unknown }> = []
  const zcode = {
    open: vi.fn(async (input: unknown) => { calls.push({ method: 'open', input }); return behaviour.open === undefined ? { workspace: 'D:/project', switched: true } : behaviour.open() }),
    create: vi.fn(async (input: unknown) => { calls.push({ method: 'create', input }); return behaviour.create === undefined ? { taskId: 'sess_1' } : behaviour.create() }),
  }
  return { calls, zcode: zcode as unknown as GwbZcodeApi }
}

describe('handOffToZcode', () => {
  it('先切窗口再建会话，提示词原样交出、不附回报约定；回会话 id', async () => {
    const { calls, zcode } = zcodeWith()
    await expect(handOffToZcode(zcode, 'D:/project', '提示词')).resolves.toBe('sess_1')
    expect(calls).toEqual([
      { method: 'open', input: { workspace: 'D:/project' } },
      { method: 'create', input: { workspace: 'D:/project', prompt: '提示词' } },
    ])
  })
  it('建会话与切窗口失败都换成 CollabRejected，原话交给网页', async () => {
    const failing = handOffToZcode(zcodeWith({ create: async () => { throw new Error('ZCode 没开') } }).zcode, 'D:/project', '提示词')
    await expect(failing).rejects.toThrow('在 ZCode 里建会话失败：ZCode 没开')
    await expect(failing).rejects.toBeInstanceOf(CollabRejected)
    await expect(handOffToZcode(zcodeWith({ open: async () => { throw new Error('ZCode 没开') } }).zcode, 'D:/project', '提示词')).rejects.toThrow('把 ZCode 切到 D:/project 失败：ZCode 没开')
  })
  it('没装 gwb-zcode：直接拒绝并说清怎么办', async () => {
    await expect(handOffToZcode(null, 'D:/project', '提示词')).rejects.toThrow('没装 gwb-zcode')
  })
})
