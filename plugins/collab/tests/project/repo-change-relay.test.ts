import { describe, expect, it } from 'vitest'
import { RepoChangeRelay } from '../../src/project/repo-change-relay.js'

describe('仓变化的中转', () => {
  it('接上之前就有变化：报错写明是装配顺序的问题，不是读不到变量的 ReferenceError', () => {
    const relay = new RepoChangeRelay()
    expect(() => relay.changed('D:/projects/hybrid-mmc/collab')).toThrow(/D:\/projects\/hybrid-mmc\/collab 的状态变了，但通知还没接上/)
  })

  it('接上之后：每次变化按顺序交给下游', () => {
    const relay = new RepoChangeRelay()
    const received: string[] = []
    const { changed } = relay
    relay.connect((repo) => void received.push(repo))
    changed('a')
    changed('b')
    expect(received).toEqual(['a', 'b'])
  })

  it('下游只能接一个', () => {
    const relay = new RepoChangeRelay()
    relay.connect(() => {})
    expect(() => relay.connect(() => {})).toThrow(/已经接上了/)
  })
})
