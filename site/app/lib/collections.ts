import type { ComponentType } from 'react'
import { tsxPageSource, type TsxPageMeta } from '@godcreator/docsite-page-sources'

/**
 * TSX/HTML 页面的文件清单：glob 参数要能静态分析，只能写在站点模块里（MDX 集合不经这里——
 * Config API 在 source.config.ts 定义，入口由 fumadocs-mdx 生成的 .source/server 与 .source/browser 给）。
 * 两个 glob 都用根路径模式：Vite 按项目根解析，避开相对 base 的坑
 */
export const tsxPageMeta = import.meta.glob<Record<string, TsxPageMeta>>('/content/**/*.page.tsx', { eager: true, import: 'meta' })
export const htmlPageText = import.meta.glob<string>('/content/**/*.html', { eager: true, query: '?raw', import: 'default' })

/** TSX 页面模块：路由按需加载页面组件（默认导出），标题等 meta 由 source.server 的 eager glob 取 */
export const tsxPageModules = import.meta.glob<{ default: ComponentType }>('/content/**/*.page.tsx')
