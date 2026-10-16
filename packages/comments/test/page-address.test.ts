import { describe, expect, it } from 'vitest'
import { pageAddressOf } from '../src/core/index.js'

describe('pageAddressOf', () => {
  it('内容页的路径照 fumadocs 的规则换成地址：去掉扩展名，index 落到所在目录，括号分组目录不进地址', () => {
    expect(pageAddressOf('about.mdx')).toBe('/about')
    expect(pageAddressOf('plan/control-plan.mdx')).toBe('/plan/control-plan')
    expect(pageAddressOf('plan/index.mdx')).toBe('/plan')
    expect(pageAddressOf('index.mdx')).toBe('/')
    expect(pageAddressOf('(guide)/start.mdx')).toBe('/start')
    expect(pageAddressOf('demo.tsx')).toBe('/demo')
    expect(pageAddressOf('reports/sample.html')).toBe('/reports/sample')
  })

  it('中文路径照 fumadocs 那样 encodeURI', () => {
    expect(pageAddressOf('写作/排版.mdx')).toBe(`/${encodeURI('写作')}/${encodeURI('排版')}`)
  })

  it('功能包页面的 page 本来就是地址，原样返回', () => {
    expect(pageAddressOf('/tasks')).toBe('/tasks')
    expect(pageAddressOf('/calendar/2026-10-12')).toBe('/calendar/2026-10-12')
  })

  it('空的 page 直接报错', () => {
    expect(() => pageAddressOf('')).toThrow('评论串的 page 是空的')
  })
})
