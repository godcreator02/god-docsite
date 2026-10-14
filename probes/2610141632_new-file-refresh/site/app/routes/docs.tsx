import { DocsLayout } from 'fumadocs-ui/layouts/docs'
import { useFumadocsLoader } from 'fumadocs-core/source/client'
import { commentsForPage, source } from '../lib/source.server'
import { docsContent } from '../lib/client-content'
import type { Route } from './+types/docs'

/**
 * 补法「树标识」（PROBE_TREE_KEY=1）：fumadocs 侧栏按根节点 $id 缓存整棵树，而根节点 $id 是固定的路径值，
 * 新增页面后侧栏不换。这里把根节点 $id 换成页面树内容的摘要，内容一变侧栏就重新渲染
 */
async function pageTreeForClient() {
  const tree = await source.serializePageTree(source.getPageTree())
  if (process.env.PROBE_TREE_KEY !== '1') return tree
  const { createHash } = await import('node:crypto')
  const contentKey = createHash('sha1').update(JSON.stringify(tree.data)).digest('hex').slice(0, 12)
  return { ...tree, data: { ...tree.data, $id: contentKey } }
}

export async function loader({ params }: Route.LoaderArgs) {
  const slugs = (params['*'] ?? '').split('/').filter((segment) => segment.length > 0)
  const page = source.getPage(slugs)
  if (!page) throw new Response('没有这一页', { status: 404 })
  return {
    path: page.path,
    title: page.data.title,
    pageTree: await pageTreeForClient(),
    comments: commentsForPage(page.path),
  }
}

export default function DocsRoute({ loaderData }: Route.ComponentProps) {
  const { path, title, pageTree, comments } = useFumadocsLoader(loaderData)
  return (
    <DocsLayout nav={{ title: '刷新实验站' }} tree={pageTree}>
      <title>{title}</title>
      {docsContent.useContent(path)}
      <section className="p-4 border-t">
        <h2>评论</h2>
        {comments.map((comment) => (
          <p key={comment.path} data-comment-marker={comment.marker}>
            {comment.marker}
          </p>
        ))}
      </section>
    </DocsLayout>
  )
}
