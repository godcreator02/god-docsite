import type { Route } from './+types/comments'
import { Link, useLoaderData } from 'react-router'
import { DocsPage } from '@fumadocs/base-ui/layouts/docs/page'
import { sitePageRefs } from '@godcreator/god-docsite/server'
import { handleCommentWrite, threadsByPageOf } from '@godcreator/comments/site/server'
import { site } from '@/lib/site.server'
import { CommentBody } from '@/lib/content'

export async function loader() {
  const byPage = threadsByPageOf({ entries: site.commentEntries, people: site.people() })
  return { groups: sitePageRefs(site).flatMap((page) => (byPage.has(page.key) ? [{ ...page, threads: byPage.get(page.key)! }] : [])) }
}

/** 评论写入：各页的评论面板都提交到 /comments */
export async function action({ request }: Route.ActionArgs) {
  return handleCommentWrite({ request, commentsDir: site.commentsDir, people: site.people(), identity: site.identity(), trustedOrigin: site.trustedOrigin() })
}

/** 全站评论：按页分组列出评论串与回复（只读；写评论去对应页面） */
export default function AllComments() {
  const { groups } = useLoaderData<typeof loader>()
  return (
    <DocsPage toc={[]}>
      <title>全站评论</title>
      <h1 className="text-2xl font-semibold">全站评论</h1>
      {groups.length === 0 ? <p className="text-fd-muted-foreground">还没有评论。</p> : null}
      {groups.map((group) => (
        <section key={group.key} className="mt-6">
          <h2 className="mb-2 text-lg font-medium">
            <Link to={group.url} className="underline">
              {group.title}
            </Link>
          </h2>
          {group.threads.map((thread) => (
            <article key={thread.id} data-comment-card={thread.id} className="docsite-comment-card mb-3">
              <header className="docsite-comment-meta">
                {thread.author.name} · {new Date(thread.createdAt).toLocaleString('zh-CN')}
              </header>
              <CommentBody path={thread.headPath} />
              {thread.replies.map((reply) => (
                <div key={reply.id} data-reply={reply.id} className="docsite-reply ms-4 border-s ps-3">
                  <span className="docsite-comment-meta">
                    {reply.author.name} · {new Date(reply.createdAt).toLocaleString('zh-CN')}
                  </span>
                  <CommentBody path={reply.path} />
                </div>
              ))}
            </article>
          ))}
        </section>
      ))}
    </DocsPage>
  )
}
