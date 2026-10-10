import { defineDocs } from 'fumadocs-mdx/macro'
import type { TsxPageModule } from '@godcreator/docsite-kit/ui'

/**
 * 列出页面文件的模块，浏览器与服务端都用。defineDocs 与 import.meta.glob 的参数要能静态分析，必须写在项目里，不能放进基础包。
 * TSX 页面在这里只按需加载组件；标题等数据由 source.ts 在服务端读
 */
export const docs = defineDocs({ dir: 'content', docs: { async: true } })

export const tsxPageModules = import.meta.glob<TsxPageModule>('/content/**/*.page.tsx')
