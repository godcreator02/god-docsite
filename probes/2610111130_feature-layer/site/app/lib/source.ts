import { loader } from 'fumadocs-core/source'
import { lucideIconsPlugin } from 'fumadocs-core/source/plugins/lucide-icons'
import { assertCommentPagesExist, commentThreadsOf } from '@godcreator/docsite-kit/comments'
import { assertNoReservedSlugs, htmlPageSource, tsxPageSource } from '@godcreator/docsite-kit/page-sources'
import { comments, docs } from './collections'

/** 只给 loader 与服务端路由用：TSX 页面的 meta 要加载整个模块才拿得到，放进浏览器端就把所有 TSX 页面都打包进去了 */
const tsxPageMeta = import.meta.glob('/content/**/*.page.tsx', { eager: true, import: 'meta' })
const htmlPageText = import.meta.glob<string>('/content/**/*.html', { eager: true, query: '?raw', import: 'default' })

/** MDX、TSX、HTML 三种页面进同一棵页面树；page.type 是来源的名字。meta.json 与 frontmatter 的 icon 写 lucide 图标名 */
export const source = loader({
  source: { mdx: docs.toFumadocsSource(), tsx: tsxPageSource(tsxPageMeta), html: htmlPageSource(htmlPageText) },
  baseUrl: '/',
  plugins: [lucideIconsPlugin()],
})

/** routes.ts 里内容页以外的路由占用的第一段地址 */
assertNoReservedSlugs(source.getPages(), ['api', 'comments'])

assertCommentPagesExist(
  commentThreadsOf(comments.entries),
  source.getPages().map((page) => page.url),
)
