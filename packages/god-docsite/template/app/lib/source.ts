import { loader } from 'fumadocs-core/source'
import { lucideIconsPlugin } from 'fumadocs-core/source/plugins/lucide-icons'
import { htmlPageSource, pageTreeLinksPlugin, tsxPageSource } from '@godcreator/god-docsite/server'
import { docs } from '../../.source/server'

// 内容目录里的 TSX 与 HTML 页面：glob 的参数要能静态分析，只能写在站点模块里
const tsxPageMeta = import.meta.glob('/content/**/*.page.tsx', { eager: true, import: 'meta' })
const htmlPageText = import.meta.glob<string>('/content/**/*.html', { eager: true, query: '?raw', import: 'default' })

/** 三种页面进同一棵页面树、同一个搜索索引；只在服务端用（经 site.server.ts） */
export const source = loader({
  source: { mdx: docs.toFumadocsSource(), tsx: tsxPageSource(tsxPageMeta), html: htmlPageSource(htmlPageText) },
  baseUrl: '/',
  // 功能包的侧栏入口（页面树插件）加在这一列里
  plugins: [lucideIconsPlugin(), pageTreeLinksPlugin([{ name: '全站评论', url: '/comments' }])],
})
