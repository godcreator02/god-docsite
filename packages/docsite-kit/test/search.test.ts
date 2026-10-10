import { describe, expect, it } from 'vitest'
import { loader } from 'fumadocs-core/source'
import { siteSearchServer } from '../src/server/search.js'

function pageOf(path: string, title: string, content: string) {
  return { type: 'page' as const, path, data: { title, structuredData: { headings: [], contents: [{ heading: undefined, content }] } } }
}

const source = loader({
  source: {
    files: [
      pageOf('slider.mdx', '调占空比', '拖动滑块调占空比'),
      pageOf('modules.mdx', '模块', '基础包分成几个模块'),
      pageOf('tree.mdx', '页面树', '三种页面进同一棵页面树'),
      pageOf('pages.mdx', '页面', '页面放在内容目录里'),
    ],
  },
  baseUrl: '/',
})

async function pagesFound(query: string) {
  const results = await siteSearchServer(source).search(query)
  return [...new Set(results.map((result) => result.url.split('#')[0]))].sort()
}

describe('中文站点的搜索', () => {
  it('每个字都要原样出现：搜「滑块」不命中只差一个字的「模块」', async () => {
    expect(await pagesFound('滑块')).toEqual(['/slider'])
  })

  it('切出的每个词都要出现：搜「页面树」只命中同时有「页面」和「树」的页', async () => {
    expect(await pagesFound('页面树')).toEqual(['/tree'])
  })
})
