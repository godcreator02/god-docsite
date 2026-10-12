import { describe, expect, test } from 'vitest'
import { htmlPageSource, tsxPageSource } from '../src/sources.js'

describe('tsxPageSource', () => {
  test('glob 条目换成虚拟文件：.page.tsx 去掉 .page，slug 与 meta.json 名字一致', () => {
    const source = tsxPageSource({
      '/content/guide/counter.page.tsx': { title: '计数器演示', description: '互动页面' },
      '/content/nested/deep/item.page.tsx': { title: '嵌套页' },
    })
    expect(source.files.map((file) => file.type === 'page' ? file.path : '')).toEqual(['guide/counter.tsx', 'nested/deep/item.tsx'])
    const first = source.files[0]!
    if (first.type !== 'page') throw new Error('unreachable')
    expect(first.data.title).toBe('计数器演示')
    expect(first.data.file).toBe('/content/guide/counter.page.tsx')
    expect(first.data.markdown).toBe('# 计数器演示\n\n互动页面\n')
    expect(first.data.structuredData.contents).toEqual([{ heading: undefined, content: '互动页面' }])
    expect(first.data.headings).toEqual([])
  })

  test('searchText 也进搜索内容，markdown 显式提供时不派生', () => {
    const source = tsxPageSource({
      '/content/x.page.tsx': { title: 'X', description: '描述', searchText: '补充词', markdown: '# 自定 Markdown\n' },
    })
    const page = source.files[0]!
    if (page.type !== 'page') throw new Error('unreachable')
    expect(page.data.structuredData.contents).toEqual([{ heading: undefined, content: '描述' }, { heading: undefined, content: '补充词' }])
    expect(page.data.markdown).toBe('# 自定 Markdown\n')
  })

  test('缺 meta、缺 title、字段类型不对都直接报错并说明修法', () => {
    expect(() => tsxPageSource({ '/content/a.page.tsx': undefined })).toThrow(/a\.page\.tsx 没有导出 meta/)
    expect(() => tsxPageSource({ '/content/a.page.tsx': {} })).toThrow(/meta\.title 要是非空字符串/)
    expect(() => tsxPageSource({ '/content/a.page.tsx': { title: 'A', description: 3 } })).toThrow(/meta\.description 要是字符串/)
    expect(() => tsxPageSource({ '/content/a.page.tsx': { title: '', description: 'x' } })).toThrow(/meta\.title/)
  })

  test('不在 contentDir 下或后缀不对的路径直接报错', () => {
    expect(() => tsxPageSource({ '/elsewhere/a.page.tsx': { title: 'A' } })).toThrow(/不在 \/content 下/)
    expect(() => tsxPageSource({ '/content/a.tsx': { title: 'A' } })).toThrow(/不以 \.page\.tsx 结尾/)
  })
})

describe('htmlPageSource', () => {
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>波形图说明</title>
<meta name="description" content="展示页面"></head><body><h2 id="how">怎么看</h2><p>正文段落。</p></body></html>`

  test('虚拟路径保留 .html，标题与搜索分段从 HTML 派生', () => {
    const source = htmlPageSource({ '/content/guide/waveform.html': html })
    const page = source.files[0]!
    if (page.type !== 'page') throw new Error('unreachable')
    expect(page.path).toBe('guide/waveform.html')
    expect(page.data.title).toBe('波形图说明')
    expect(page.data.description).toBe('展示页面')
    expect(page.data.headings).toEqual([{ id: 'how', text: '怎么看', level: 2 }])
    expect(page.data.structuredData.headings).toEqual([{ id: 'how', content: '怎么看' }])
    expect(page.data.structuredData.contents).toEqual([{ heading: 'how', content: '正文段落。' }])
    expect(page.data.markdown).toContain('# 波形图说明')
    expect(page.data.markdown).toContain('## 怎么看')
  })

  test('缺 <title> 的 HTML 直接报错', () => {
    expect(() => htmlPageSource({ '/content/bad.html': '<body><p>无标题</p></body>' })).toThrow(/bad\.html 没有 <title>/)
  })
})
