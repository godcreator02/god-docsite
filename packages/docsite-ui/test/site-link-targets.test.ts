import { describe, expect, it } from 'vitest'
import { sitePathOf, siteLinkTargetOf } from '../src/site-link-targets.js'

describe('siteLinkTargetOf', () => {
  it('只有 # 的是本页的标题', () => {
    expect(siteLinkTargetOf('#用法', '/guide')).toEqual({ kind: 'in-page' })
  })

  it('http、https 是站外，开新标签页；别的协议也算站外，不开新标签页', () => {
    expect(siteLinkTargetOf('https://fumadocs.dev/docs', '/guide')).toEqual({ kind: 'external', opensNewTab: true })
    expect(siteLinkTargetOf('mailto:someone@example.com', '/guide')).toEqual({ kind: 'external', opensNewTab: false })
  })

  it('站里的地址解码、去掉末尾的斜杠，带上标题与评论串', () => {
    expect(siteLinkTargetOf('/写作/排版/?comment=abc#%E5%85%AC%E5%BC%8F', '/guide')).toEqual({ kind: 'site', path: '/写作/排版', hash: '公式', commentThread: 'abc' })
    expect(siteLinkTargetOf('/%E5%86%99%E4%BD%9C', '/guide')).toEqual({ kind: 'site', path: '/写作', hash: '', commentThread: undefined })
  })

  it('相对地址按当前页面的地址解析', () => {
    expect(siteLinkTargetOf('./other', '/notes/waveform')).toMatchObject({ kind: 'site', path: '/notes/other' })
    expect(siteLinkTargetOf('../intro', '/notes/waveform')).toMatchObject({ kind: 'site', path: '/intro' })
  })
})

describe('sitePathOf', () => {
  it('根地址保留斜杠', () => {
    expect(sitePathOf('/')).toBe('/')
  })
})
