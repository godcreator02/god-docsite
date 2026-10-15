import { loader } from 'fumadocs-core/source'
import { lucideIconsPlugin } from 'fumadocs-core/source/plugins/lucide-icons'
import { htmlPageSource, tsxPageSource } from '@godcreator/god-docsite/server'
import { pageTreeLinksPlugin } from '@godcreator/god-docsite/react'
import { docs } from '../../.source/server'
import { featureRuntime } from '../features/runtime.generated.ts'

// 内容目录里的 TSX 与 HTML 页面：glob 的参数要能静态分析，只能写在站点模块里
const tsxPageMeta = import.meta.glob('/content/**/*.page.tsx', { eager: true, import: 'meta' })
const htmlPageText = import.meta.glob<string>('/content/**/*.html', { eager: true, query: '?raw', import: 'default' })

/** 三种页面进同一棵页面树、同一个搜索索引；只在服务端用（经 site.server.ts）。各功能的侧栏入口排在全站评论后面 */
export const source = loader({
  source: { mdx: docs.toFumadocsSource(), tsx: tsxPageSource(tsxPageMeta), html: htmlPageSource(htmlPageText) },
  baseUrl: '/',
  plugins: [lucideIconsPlugin(), pageTreeLinksPlugin([{ name: '全站评论', url: '/comments' }]), ...featureRuntime.pageTreePlugins],
})
