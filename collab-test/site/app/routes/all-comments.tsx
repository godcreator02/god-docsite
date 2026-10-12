import { Link } from 'react-router'
import { DocsPage } from '@fumadocs/base-ui/layouts/docs/page'
import type { PageThreadSummary } from '@godcreator/docsite-comments/react'
import { allPageThreads } from '../lib/comments.server'
import { commentContent } from '../lib/client-content'
import { source } from '../lib/source.server'
import type { Route } from './+types/all-comments'

function CommentBody({ path }: { path: string }) {
  return commentContent.useContent(path)
}

/** 全站评论页：按页分组列出（只读；写评论去对应页面） */
export async function loader() {
  const byPage = allPageThreads()
  const pages = source.getPages().filter((page) => (byPage.get(page.path) ?? []).length > 0)
  return {
    groups: pages.map((page) => ({ url: page.url, title: page.data.title ?? page.url, threads: byPage.get(page.path) ?? [] })),
    siteName: String(source.getPageTree().name),
  }
}

export default function AllComments({ loaderData }: Route.ComponentProps) {
  return (
    <DocsPage toc={[]}>
      <title>{`评论 · ${loaderData.siteName}`}</title>
      <h1 className="text-2xl font-semibold">全站评论</h1>
      {loaderData.groups.length === 0 ? <p className="text-fd-muted-foreground">还没有评论。</p> : null}
      {loaderData.groups.map((group) => (
        <section key={group.url} className="mt-6">
          <h2 className="mb-2 text-lg font-medium">
            <Link to={group.url} className="underline">
              {group.title}
            </Link>
          </h2>
          <div className="space-y-3">
            {group.threads.map((thread: PageThreadSummary) => (
              <article key={thread.id} data-comment-card={thread.id} className="docsite-comment-card">
                <header className="docsite-comment-meta">
                  <span>
                    {thread.author.name} · {new Date(thread.createdAt).toLocaleString('zh-CN')}
                  </span>
                </header>
                <CommentBody path={thread.headPath} />
              </article>
            ))}
          </div>
        </section>
      ))}
    </DocsPage>
  )
}
