import { describe, expect, it } from 'vitest'
import { parseCommentAnchor, serializeTextAnchor } from '../src/model.js'

describe('anchor 协议（parseCommentAnchor）', () => {
  it('缺省与空串是整页评论', () => {
    expect(parseCommentAnchor(undefined)).toEqual({ kind: 'page' })
    expect(parseCommentAnchor('')).toEqual({ kind: 'page' })
  })

  it('不以 { 开头的字符串是页面元素 id（最早的写法，现有数据）', () => {
    expect(parseCommentAnchor('收起内容试验')).toEqual({ kind: 'element', id: '收起内容试验' })
    expect(parseCommentAnchor('dc-1wx4ptw')).toEqual({ kind: 'element', id: 'dc-1wx4ptw' })
  })

  it('JSON 形状解析成划字评论', () => {
    const anchor = serializeTextAnchor({ quote: '被批的原文', start: 3, end: 8, snapshot: '一整页的文字' })
    expect(parseCommentAnchor(anchor)).toEqual({ kind: 'text', quote: '被批的原文', start: 3, end: 8, snapshot: '一整页的文字' })
  })

  it('以 { 开头但认不出的按 broken 处理，不抛错', () => {
    expect(parseCommentAnchor('{不是 json')).toEqual({ kind: 'broken', raw: '{不是 json' })
    expect(parseCommentAnchor('{"quote":"缺别的字段"}')).toEqual({ kind: 'broken', raw: '{"quote":"缺别的字段"}' })
    expect(parseCommentAnchor('{"quote":"q","start":"1","end":2,"snapshot":"s"}')).toEqual({ kind: 'broken', raw: '{"quote":"q","start":"1","end":2,"snapshot":"s"}' })
  })

  it('serialize 写出的串里换行被转义，frontmatter 仍是单行', () => {
    const serialized = serializeTextAnchor({ quote: 'a\nb', start: 0, end: 3, snapshot: 'x\ny' })
    expect(serialized.includes('\n')).toBe(false)
  })
})
