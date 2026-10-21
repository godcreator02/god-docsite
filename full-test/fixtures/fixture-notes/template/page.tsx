import type { Route } from './+types/page'
import { useMemo } from 'react'
import { useLoaderData } from 'react-router'
import { CommentsDock, commentScopeProps } from '@godcreator/comments/site'
import { ExternalMdxContent, ExternalMdxPage } from '@godcreator/god-docsite/react'
import { commentAvatar } from '@/lib/content'
import { mdxComponents } from '@/lib/mdx-components'
import { itemPageData, writeItemComment } from './library.server'

export const loader = ({ params }: Route.LoaderArgs) => itemPageData(params.id, params.page)

/** 这一页的评论写入：评论目录由条目定，所以评论面板提交到本页 */
export const action = ({ request, params }: Route.ActionArgs) => writeItemComment(request, params.id)

export default function FixtureNotesItemPage() {
  const { title, key, compiled, threads, bodies, access } = useLoaderData<typeof loader>()
  // 刚写入的评论，评论面板可能比重新取的数据先拿到它
  const CommentBody = useMemo(
    () =>
      function CommentBody({ path }: { path: string }) {
        const body = bodies[path]
        if (body === undefined) return <p data-comment-pending="">正文还没取到</p>
        return <ExternalMdxContent compiled={body} components={mdxComponents} />
      },
    [bodies],
  )
  return (
    <>
      <ExternalMdxPage title={title} compiled={compiled} components={mdxComponents} bodyProps={commentScopeProps} />
      <CommentsDock pagePath={key} action={key} threads={threads} access={access} BodyComponent={CommentBody} AvatarComponent={commentAvatar} />
    </>
  )
}
