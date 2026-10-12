import { describe, expect, it } from 'vitest'
import { isFeedChannel } from '../src/feed-protocol.js'
import { feedStore } from '../src/feed-store.js'

describe('推送通道', () => {
  it('频道名只认字母、数字、下划线、连字符', () => {
    expect(isFeedChannel('notices')).toBe(true)
    expect(isFeedChannel('project-owner')).toBe(true)
    expect(isFeedChannel('a b')).toBe(false)
    expect(isFeedChannel('')).toBe(false)
    expect(isFeedChannel('通知')).toBe(false)
  })

  it('按频道只留最新一份：后推的覆盖先推的', () => {
    feedStore().set('notices', { text: '第一条' })
    feedStore().set('notices', { text: '第二条' })
    expect(feedStore().get('notices')).toEqual({ text: '第二条' })
    feedStore().delete('notices')
  })
})
