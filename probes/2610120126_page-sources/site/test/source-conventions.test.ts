import { expect, test } from 'vitest'
import { createServer } from 'vite'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

/**
 * 用真实的 Vite 编译管线加载站点的来源模块（app/lib/source.server.ts），
 * 断言三格式数据的公开约定：页面清单、URL、structuredData、Markdown 形式与页面树。
 * 服务不监听端口，只走 ssrLoadModule
 */

const siteRoot = fileURLToPath(new URL('..', import.meta.url))

test('三格式来源的公开约定（真实编译管线）', async () => {
  const server = await createServer({
    root: siteRoot,
    configFile: path.join(siteRoot, 'vite.config.ts'),
    server: { middlewareMode: true },
    optimizeDeps: { noDiscovery: true },
  })
  try {
    const mod = await server.ssrLoadModule('/app/lib/source.server.ts')
    const source = mod.source as import('fumadocs-core/source').LoaderOutput

    const pages = source.getPages()
    const byUrl = new Map(pages.map((page) => [page.url, page]))

    // URL 约定：index.mdx 是首页，.page.tsx 去掉 .page，.html 保留
    expect([...byUrl.keys()].sort()).toEqual(['/', '/guide/counter', '/guide/quickstart', '/guide/waveform'])
    expect(byUrl.get('/')!.type).toBe('mdx')
    expect(byUrl.get('/guide/quickstart')!.type).toBe('mdx')
    expect(byUrl.get('/guide/counter')!.type).toBe('tsx')
    expect(byUrl.get('/guide/waveform')!.type).toBe('html')

    // 标题：三格式都在内容定义处给出
    expect(byUrl.get('/')!.data.title).toBe('三种页面来源')
    expect(byUrl.get('/guide/counter')!.data.title).toBe('计数器演示')
    expect(byUrl.get('/guide/waveform')!.data.title).toBe('波形图说明')

    // structuredData：HTML 页的标题锚点与段落归属；TSX 页收 meta 显式给出的文字
    // （TSX/HTML 来源给现成的值，MDX 集合给函数——loader 两种都收）
    const structuredDataOf = async (page: (typeof pages)[number]) => {
      const data = page.data.structuredData
      if (!data) throw new Error(`${page.url} 没有 structuredData`)
      return typeof data === 'function' ? await data() : data
    }
    const htmlPage = byUrl.get('/guide/waveform')!
    if (htmlPage.type !== 'html') throw new Error('unreachable')
    const structured = await structuredDataOf(htmlPage)
    expect(structured?.headings.map(({ id, content }) => ({ id, content }))).toContainEqual({ id: 'how-to-read', content: '波形图怎么看' })
    expect(structured?.contents.some(({ heading, content }) => heading === 'how-to-read' && content.includes('原样渲染'))).toBe(true)

    const tsxPage = byUrl.get('/guide/counter')!
    if (tsxPage.type !== 'tsx') throw new Error('unreachable')
    const tsxStructured = await structuredDataOf(tsxPage)
    expect(tsxStructured?.contents.map(({ content }) => content)).toEqual(['TSX 互动页面：组件状态、事件与同目录模块引用。', '互动 计数器 点击 次数 状态重置'])

    // Markdown 形式：MDX 走官方 getText('processed')，TSX/HTML 在 data.markdown。
    // loader 的 PageData 不带扩展字段，这里按三来源约定断言实际形状
    const dataOf = <T,>(page: (typeof pages)[number]) => page.data as T
    const mdxPage = byUrl.get('/guide/quickstart')!
    if (mdxPage.type !== 'mdx') throw new Error('unreachable')
    expect(await dataOf<{ getText: (type: 'raw' | 'processed') => Promise<string> }>(mdxPage).getText('processed')).toContain('![方框示意图](./mdx-demo.svg)')
    expect(dataOf<{ markdown: string }>(tsxPage).markdown).toContain('## 怎么互动')
    expect(dataOf<{ markdown: string }>(htmlPage).markdown).toContain('# 波形图说明')

    // 页面树：root meta 分组「指南」里三格式混排，顺序照 meta.json。
    // serializePageTree 的输出是给 useFumadocsLoader 的壳（$fumadocs_loader.data），结构断言用原树
    const tree = source.getPageTree()
    const guide = tree.children.find((node) => node.type === 'folder' && node.name === '指南')
    expect(guide).toBeTruthy()
    if (guide && guide.type === 'folder') {
      expect(guide.children.filter((node) => node.type === 'page').map((node) => (node as { name: string }).name)).toEqual([
        '快速开始',
        '计数器演示',
        '波形图说明',
      ])
    }
    const serialized = await source.serializePageTree(tree)
    expect(serialized).toMatchObject({ $fumadocs_loader: 'page-tree' })
  } finally {
    await server.close()
  }
})
