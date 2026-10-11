import { loader } from 'fumadocs-core/source'
import { lucideIconsPlugin } from 'fumadocs-core/source/plugins/lucide-icons'
import { assertCommentPagesExist, commentThreadsOf } from '@godcreator/docsite-kit/comments'
import { assertNoReservedSlugs, htmlPageSource, tsxPageSource } from '@godcreator/docsite-kit/page-sources'
import { featureRoutes } from '../site/routes'
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

/** routes.ts 里内容页以外的路由占用的第一段地址：骨架自己的，加上功能包各条路由的 */
const featureSlugs = featureRoutes.flatMap(({ routes }) => routes.flatMap((each) => ('path' in each ? [each.path.split('/')[0]!] : [])))
assertNoReservedSlugs(source.getPages(), ['api', 'comments', ...featureSlugs])

assertCommentPagesExist(
  commentThreadsOf(comments.entries),
  source.getPages().map((page) => page.url),
)

/** 站里每一页的地址与标题：交给功能包的 layoutData */
export function sitePageRefs() {
  return source.getPages().map((page) => ({ url: page.url, title: page.data.title ?? page.url }))
}

/** 站名：content/meta.json 的 title */
export const siteName = () => String(source.getPageTree().name)
