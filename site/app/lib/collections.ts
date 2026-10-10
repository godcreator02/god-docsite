import { defineCollections, defineDocs } from 'fumadocs-mdx/macro'
import { commentFrontmatterSchema } from '@godcreator/docsite-kit/comments'
import type { TsxPageModule } from '@godcreator/docsite-kit/ui'

/**
 * 列出页面文件与评论文件的模块，浏览器与服务端都用。defineDocs、defineCollections 与 import.meta.glob 的参数要能静态分析，必须写在项目里，不能放进基础包。
 * TSX 页面在这里只按需加载组件；标题等数据由 source.ts 在服务端读
 */
export const docs = defineDocs({ dir: 'content', docs: { async: true } })

export const tsxPageModules = import.meta.glob<TsxPageModule>('/content/**/*.page.tsx')

/** 一个评论串一个文件夹；frontmatter 一开始就全部加载，正文按需加载 */
export const comments = defineCollections({ type: 'doc', dir: 'comments', async: true, schema: commentFrontmatterSchema })
