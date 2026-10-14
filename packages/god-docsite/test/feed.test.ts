import { describe, expect, it } from 'vitest'
import { isFeedChannel } from '../src/core/feed.js'

describe('推送通道', () => {
  it('频道名只认字母、数字、下划线、连字符', () => {
    expect(isFeedChannel('notices')).toBe(true)
    expect(isFeedChannel('project-owner')).toBe(true)
    expect(isFeedChannel('a b')).toBe(false)
    expect(isFeedChannel('')).toBe(false)
    expect(isFeedChannel('通知')).toBe(false)
  })
})
