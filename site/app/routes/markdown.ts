import { source } from '../lib/source.server'

/**
 * 三格式统一的 Markdown 形式约定：MDX 走官方 getText('processed')（docs 集合的
 * postprocess.includeProcessedMarkdown），TSX 与 HTML 页面在来源的 data.markdown 里。
 * /api/markdown?path=/writing/components 返回该页的 Markdown
 */
export async function loader({ request }: { request: Request }) {
  const requested = new URL(request.url).searchParams.get('path')
  if (requested === null || requested === '') return new Response('missing path query', { status: 400 })
  const page = source.getPage(requested.replace(/^\//, '').split('/').filter((part) => part !== ''))
  if (!page) return new Response('Not found', { status: 404 })
  const markdown = page.type === 'mdx' ? await page.data.getText('processed') : page.data.markdown
  return new Response(markdown, { headers: { 'content-type': 'text/markdown; charset=utf-8' } })
}
