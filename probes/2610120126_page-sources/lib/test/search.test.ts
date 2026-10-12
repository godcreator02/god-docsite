import { describe, expect, test } from 'vitest'
import { loader } from 'fumadocs-core/source'
import { htmlPageSource, tsxPageSource } from '../src/sources'
import { searchServerOf } from '../src/search'

/**
 * 用纯 StaticSource 验证搜索约定：TSX/HTML 页的数据形状足以让 createFromSource 建索引、
 * 中文可检索、锚点 url 与 structuredData 的 heading id 一致、loader 实例变化时索引重建
 */

function sourceWith(extraHtml: Record<string, string> = {}, extraTsx: Record<string, unknown> = {}) {
  return loader({
    source: {
      tsx: tsxPageSource({
        '/content/guide/counter.page.tsx': { title: '计数器演示', description: '互动页面', searchText: '点击 次数' },
        ...extraTsx,
      }),
      html: htmlPageSource({
        '/content/guide/waveform.html': `<!doctype html><html><head><title>波形图说明</title></head><body><h2 id="how">怎么看</h2><p>滑块与刻度。</p></body></html>`,
        ...extraHtml,
      }),
    },
    baseUrl: '/',
  })
}

describe('searchServerOf（createFromSource + 中文参数）', () => {
  test('中文标题与正文都可检索，返回页面有效 url', async () => {
    const server = searchServerOf(() => sourceWith())
    const hits = await server.search('计数器')
    expect(hits.some((hit) => hit.url === '/guide/counter')).toBe(true)
    const wave = await server.search('滑块')
    expect(wave.some((hit) => hit.url === '/guide/waveform#how')).toBe(true)
  })

  test('threshold 0：有一个字不在任何页面的词组不返回结果', async () => {
    const server = searchServerOf(() => sourceWith())
    expect(await server.search('摩滑')).toEqual([])
  })

  test('loader 实例变化后（增删页面）索引跟着重建', async () => {
    let current = sourceWith()
    const server = searchServerOf(() => current)
    expect((await server.search('附录')).length === 0).toBe(true)

    current = sourceWith({}, { '/content/appendix.page.tsx': { title: '附录页', description: '补充内容' } })
    const hits = await server.search('附录')
    expect(hits.some((hit) => hit.url === '/guide/../appendix'.replace('/guide/..', ''))).toBe(true)

    current = sourceWith()
    expect((await server.search('附录')).length === 0).toBe(true)
  })

  test('HTML 标题锚点与搜索 url 一致（三处一致里的索引侧）', async () => {
    const server = searchServerOf(() => sourceWith())
    const headingHit = (await server.search('怎么看')).find((hit) => hit.type === 'heading')
    expect(headingHit?.url).toBe('/guide/waveform#how')
  })

  test('GET 处理 ?query= 参数（路由直接用它）', async () => {
    const server = searchServerOf(() => sourceWith())
    const response = await server.GET(new Request('http://x/api/search?query=波形'))
    const hits = (await response.json()) as Array<{ url: string }>
    expect(hits.some((hit) => hit.url === '/guide/waveform')).toBe(true)
    expect((await server.GET(new Request('http://x/api/search')))).toBeTruthy()
  })
})
