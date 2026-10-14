import { createFromSource, type SearchAPI } from 'fumadocs-core/search/server'
import type { LoaderConfig, LoaderOutput } from 'fumadocs-core/source'
import type { LoaderFunctionArgs } from 'react-router'
import type { DocsiteContext } from './site-context.js'

/**
 * 中文站点的搜索服务：站点路由用它包装自己的 loader，代替直接调 fumadocs 的 createFromSource。
 * zbsearch 默认 multilingual 分词（中文能切开），但另两项默认值不适合中文：
 * tolerance 1 允许一个字的出入，搜「滑块」会命中「模块」；threshold 1 只要切出的词有一个出现就算命中，
 * 搜「页面树」时含「页面」的页全都返回。这里两项都设为 0：每个词都要原样出现。
 *
 * 传函数而不是 loader 实例：createFromSource 的公开约定是 loader 实例变化时重建全部索引，
 * 开发模式下内容增删让来源模块重新执行、得到新 loader 时，搜索跟着重建
 */
export function searchServerOf<C extends LoaderConfig>(getSource: () => LoaderOutput<C>): SearchAPI {
  return createFromSource(getSource, { search: { tolerance: 0, threshold: 0 } })
}

let latestSiteSource: DocsiteContext['source'] | undefined
// SiteSource 只声明了平台用到的几样，运行时就是站点 loader() 的结果；createFromSource 要完整的 LoaderOutput 类型
const siteSearchServer = searchServerOf(() => latestSiteSource as unknown as LoaderOutput)

/** 资源路由 api/search 的 loader：每次请求带上站点现在的 loader，内容增删后索引跟着重建 */
export async function searchLoader({ request }: LoaderFunctionArgs, { source }: Pick<DocsiteContext, 'source'>): Promise<Response> {
  latestSiteSource = source
  return siteSearchServer.GET(request)
}
