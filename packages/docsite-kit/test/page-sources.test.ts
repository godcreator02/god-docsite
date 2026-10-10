import { describe, expect, it } from 'vitest'
import { assertNoReservedSlugs, contentFileUrlOf, htmlPageSource, tsxPageSource } from '../src/page-sources.js'

describe('TSX 页面的来源', () => {
  it('虚拟路径去掉 .page，标题与 description 取自导出的 meta，搜索只收 description', () => {
    const { files } = tsxPageSource({ '/content/notes/waveform.page.tsx': { title: '波形', description: '拖动滑块调占空比' } })
    expect(files).toEqual([
      {
        type: 'page',
        path: 'notes/waveform.tsx',
        data: { title: '波形', description: '拖动滑块调占空比', file: '/content/notes/waveform.page.tsx', structuredData: { headings: [], contents: [{ heading: undefined, content: '拖动滑块调占空比' }] } },
      },
    ])
  })

  it('没导出 meta、title 不是非空字符串时报错，写明是哪个文件、怎么改', () => {
    expect(() => tsxPageSource({ '/content/a.page.tsx': undefined })).toThrow('/content/a.page.tsx 没有导出 meta')
    expect(() => tsxPageSource({ '/content/a.page.tsx': { title: '' } })).toThrow('/content/a.page.tsx 的 meta.title 要是非空字符串')
  })
})

describe('HTML 页面的来源', () => {
  const html = `<!doctype html><html><head><title>主电路 &amp; 拓扑</title><meta name="description" content="三级结构"><style>p{}</style></head>
<body><h1>三级结构</h1><p>隔离级用双有源桥</p><script>console.log('x')</script></body></html>`

  it('标题取 <title>、description 取 meta，搜索收正文分段后的纯文字，不收脚本与样式', () => {
    const [file] = htmlPageSource({ '/content/design/topology.html': html }).files
    expect(file!.path).toBe('design/topology.html')
    expect(file!.data).toMatchObject({ title: '主电路 & 拓扑', description: '三级结构', file: '/content/design/topology.html' })
    expect(file!.data.structuredData.contents.map((content) => content.content)).toEqual(['三级结构', '隔离级用双有源桥'])
  })

  it('没有 <title> 时报错', () => {
    expect(() => htmlPageSource({ '/content/x.html': '<p>正文</p>' })).toThrow('/content/x.html 没有 <title>')
  })
})

describe('保留地址', () => {
  it('页面占了站点自己的路由地址时一次列出全部，TSX 页面写真实文件名', () => {
    const pages = [
      { slugs: ['api', 'x'], path: 'api/x.mdx', data: {} },
      { slugs: ['notes'], path: 'notes/index.mdx', data: {} },
      { slugs: ['api'], path: 'api.tsx', data: { file: '/content/api.page.tsx' } },
    ]
    expect(() => assertNoReservedSlugs(pages, ['api'])).toThrow('/content/api/x.mdx、/content/api.page.tsx：地址第一段 api 留给站点自己的路由，换个名字')
    expect(() => assertNoReservedSlugs(pages.slice(1, 2), ['api'])).not.toThrow()
  })
})

describe('内容文件的地址', () => {
  it('glob 给的路径换成 /api/content/ 下的地址；不在内容目录下的报错', () => {
    expect(contentFileUrlOf('/content/design/topology.html')).toBe('/api/content/design/topology.html')
    expect(() => contentFileUrlOf('/app/x.html')).toThrow('/app/x.html 不在 /content 下')
  })
})
