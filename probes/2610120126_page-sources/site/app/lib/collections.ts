import { defineDocs } from 'fumadocs-mdx/macro'
import type { ComponentType } from 'react'

/**
 * 集合与页面模块清单，服务端和浏览器都用。defineDocs 与 import.meta.glob 的参数要能静态分析，
 * 只能写在站点模块里，不能挪进来源包。
 * MDX 集合是宏式 async（官方 React Router 示例的现行形态）：frontmatter（标题、描述、搜索数据）
 * 两端同步可用，正文按需加载——这就是集合的 server/browser 分离
 */
export const docs = defineDocs({
  dir: 'content',
  docs: {
    async: true,
    postprocess: { includeProcessedMarkdown: true },
  },
})

/** TSX 页面模块：非 eager 的整模块 glob，路由按需加载页面组件（默认导出） */
export const tsxPageModules = import.meta.glob<{ default: ComponentType }>('/content/**/*.page.tsx')
