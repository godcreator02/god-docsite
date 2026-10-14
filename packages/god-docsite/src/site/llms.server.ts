import { llms } from 'fumadocs-core/source'
import type { DocsiteContext, SitePage } from './site-context.js'
import { markdownOfPage } from './page.server.js'

function siteLlms({ source }: Pick<DocsiteContext, 'source'>) {
  // SiteSource 只声明了平台用到的几样，运行时就是站点 loader() 的结果；fumadocs 的 llms 要完整的 LoaderOutput 类型
  return llms(source as unknown as Parameters<typeof llms>[0], {
    renderPage: async (page) => `# ${page.data.title ?? page.url} (${page.url})\n\n${await markdownOfPage(page as unknown as SitePage)}`,
  })
}

const textHeaders = { 'Content-Type': 'text/plain; charset=utf-8' }

/** 资源路由 llms.txt 的 loader：全站页面的目录 */
export async function llmsIndexLoader(_args: unknown, site: Pick<DocsiteContext, 'source'>): Promise<Response> {
  return new Response(await siteLlms(site).index(), { headers: textHeaders })
}

/** 资源路由 llms-full.txt 的 loader：全站页面的 Markdown 连在一起 */
export async function llmsFullLoader(_args: unknown, site: Pick<DocsiteContext, 'source'>): Promise<Response> {
  return new Response(await siteLlms(site).full(), { headers: textHeaders })
}
