import { loader } from 'fumadocs-core/source'
import { lucideIconsPlugin } from 'fumadocs-core/source/plugins/lucide-icons'
import { htmlPageSource, tsxPageSource } from '@godcreator/docsite-page-sources'
import { searchServerOf } from '@godcreator/docsite-page-sources/server'
import { comments, docs } from '../../.source/server'
import { htmlPageText, tsxPageMeta } from './collections'
import { featureRoutes } from '../site/routes'

/**
 * 三种格式的页面进同一棵页面树、同一个搜索索引；page.type 是来源的名字（mdx / tsx / html）。
 * 只在服务端用（.server 文件不进浏览器包）。评论集合也从这里给路由 loader（分组在 comments.server 逐请求做）
 */
export const source = loader({
  source: { mdx: docs.toFumadocsSource(), tsx: tsxPageSource(tsxPageMeta), html: htmlPageSource(htmlPageText) },
  baseUrl: '/',
  plugins: [lucideIconsPlugin()],
})

/** 搜索服务：loader 实例变化（开发时内容增删让本模块重新执行）时按公开约定重建索引 */
export const searchServer = searchServerOf(() => source)

/** 站里每一页的地址与标题：交给功能包的 layoutData */
export function sitePageRefs() {
  return source.getPages().map((page) => ({ url: page.url, title: page.data.title ?? page.url }))
}

/** 站名：content/meta.json 的 title */
export const siteName = () => String(source.getPageTree().name)

/** 评论集合：pageThreads 在 comments.server 里逐请求分组，不在模块顶层做全站分组 */
export const commentCollection = comments
