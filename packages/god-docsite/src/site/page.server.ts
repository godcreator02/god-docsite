import { data, type LoaderFunctionArgs } from 'react-router'
import { contentFileUrlOf } from '../core/content-file-url.js'
import type { DocsiteContext, SitePage, SitePageData } from './site-context.js'

function slugsOf(splat: string | undefined): string[] {
  return (splat ?? '').split('/').filter((segment) => segment.length > 0)
}

function sitePageOf(source: DocsiteContext['source'], slugs: string[]): SitePage {
  const page = source.getPage(slugs)
  if (!page) throw data(`没有 /${slugs.join('/')} 这一页`, { status: 404 })
  return page
}

/**
 * 页面路由 loader 的平台部分（首页的 index 路由与 * 路由共用）：按地址找页，交给浏览器渲染正文要的东西。
 * 不带页面树：页面树只由布局路由给
 */
export function sitePageData({ params }: LoaderFunctionArgs, { source }: Pick<DocsiteContext, 'source'>): SitePageData {
  const page = sitePageOf(source, slugsOf(params['*']))
  const tree = source.getPageTree()
  const common = {
    key: page.path,
    url: page.url,
    title: page.data.title ?? page.url,
    description: page.data.description,
    siteName: typeof tree.name === 'string' ? tree.name : '',
  }
  if (page.type === 'mdx') return { ...common, type: 'mdx', path: page.path }
  if (page.type === 'tsx') return { ...common, type: 'tsx', file: page.data.file }
  return { ...common, type: 'html', src: contentFileUrlOf(page.data.file), headings: page.data.headings }
}

/** 站里每一页的归属键（内容目录里的路径）、地址与标题：按页分组的列表（全站评论这类）用 */
export function sitePageRefs({ source }: Pick<DocsiteContext, 'source'>): Array<{ key: string; url: string; title: string }> {
  return source.getPages().map((page) => ({ key: page.path, url: page.url, title: page.data.title ?? page.url }))
}

/** 一页的 Markdown：MDX 走 fumadocs-mdx 的 getText('processed')，TSX 与 HTML 页面在来源的 data.markdown 里 */
export async function markdownOfPage(page: SitePage): Promise<string> {
  return page.type === 'mdx' ? page.data.getText('processed') : page.data.markdown
}

/** 资源路由 api/markdown 的 loader：?path=/writing/x 回那一页的 Markdown */
export async function markdownLoader({ request }: LoaderFunctionArgs, { source }: Pick<DocsiteContext, 'source'>): Promise<Response> {
  const requested = new URL(request.url).searchParams.get('path')
  if (requested === null || requested === '') return new Response('缺 path 参数：?path=/页面地址', { status: 400 })
  const page = sitePageOf(source, slugsOf(requested))
  return new Response(await markdownOfPage(page), { headers: { 'Content-Type': 'text/markdown; charset=utf-8' } })
}
