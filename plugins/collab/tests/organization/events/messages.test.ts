import { describe, expect, it } from 'vitest'
import { distinctEvents, pushEventOf, pushTopicOf, type PushEvent } from '../../../src/organization/events/messages.js'

const topic = 'collab-hybrid-mmc'
const eventOf = (title: string | null, message: string | null) => pushEventOf({ topic, title, message })

describe('推来的消息', () => {
  it('topic 按组织名：组织级 webhook 发到 collab-<组织>', () => {
    expect(pushTopicOf('hybrid-mmc')).toBe('collab-hybrid-mmc')
  })

  it('认出五种 webhook 消息和 leads changed：标题是 <组织>/<仓>，正文是种类、动作与编号', () => {
    expect(eventOf('hybrid-mmc/collab', 'push refs/heads/main')).toEqual({ kind: 'push', repo: 'collab', ref: 'refs/heads/main' })
    expect(eventOf('hybrid-mmc/firmware', 'pr opened #3')).toEqual({ kind: 'pr', repo: 'firmware', action: 'opened', number: 3 })
    expect(eventOf('hybrid-mmc/firmware', 'pr synchronized #3')).toEqual({ kind: 'pr', repo: 'firmware', action: 'synchronized', number: 3 })
    expect(eventOf('hybrid-mmc/firmware', 'pr reviewed #3')).toEqual({ kind: 'pr', repo: 'firmware', action: 'reviewed', number: 3 })
    expect(eventOf('hybrid-mmc/datasheets', 'issue reopened #12')).toEqual({ kind: 'issue', repo: 'datasheets', action: 'reopened', number: 12 })
    expect(eventOf('hybrid-mmc/datasheets', 'comment created #12')).toEqual({ kind: 'comment', repo: 'datasheets', action: 'created', number: 12 })
    expect(eventOf('hybrid-mmc/hil', 'repo created')).toEqual({ kind: 'repo', repo: 'hil', action: 'created' })
    expect(eventOf('hybrid-mmc/firmware', 'leads changed')).toEqual({ kind: 'leads', repo: 'firmware' })
  })

  it('认不出的都回 null：没有标题、别的组织、旧格式的正文、编号不是数', () => {
    expect(eventOf(null, 'push refs/heads/main')).toBeNull()
    expect(eventOf('hybrid-mmc/collab', null)).toBeNull()
    expect(eventOf('chb-dab-sst/collab', 'push refs/heads/main')).toBeNull()
    expect(eventOf('hybrid-mmc', 'push refs/heads/main')).toBeNull()
    expect(eventOf('hybrid-mmc/collab', 'collab push refs/heads/main')).toBeNull()
    expect(eventOf('hybrid-mmc/firmware', 'opened #3')).toBeNull()
    expect(eventOf('hybrid-mmc/firmware', 'pr opened #x')).toBeNull()
  })

  it('同一批里要做的事一样的只留第一个：同一个仓的推送只取回一次，合并请求、issue 与评论都只重读那个仓一次', () => {
    const events: PushEvent[] = [
      { kind: 'push', repo: 'collab', ref: 'refs/heads/main' },
      { kind: 'pr', repo: 'firmware', action: 'opened', number: 3 },
      { kind: 'pr', repo: 'firmware', action: 'closed', number: 4 },
      { kind: 'issue', repo: 'datasheets', action: 'opened', number: 12 },
      { kind: 'comment', repo: 'datasheets', action: 'created', number: 13 },
      { kind: 'comment', repo: 'firmware', action: 'created', number: 5 },
      { kind: 'push', repo: 'collab', ref: 'refs/heads/dev' },
      { kind: 'leads', repo: 'firmware' },
    ]
    expect(distinctEvents(events)).toEqual([events[0], events[1], events[3], events[7]])
  })
})
