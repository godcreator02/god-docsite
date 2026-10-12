import type { ReactNode } from 'react'
import { renderCommentBody, threadsOfPage } from '@site/lib/comment-threads'
import { commentScopeProps, PageComments } from '@godcreator/docsite-kit/ui'
import type { RouteCommentData } from './comment-data.server.js'

const noThreads: never[] = []

/** 协作站页面上的评论：和内容页一样，能批整页、批一段文字或一个元素；comments 是 loader 里 routeCommentData 读的 */
export function RouteComments({ page, comments, children }: { page: string; comments: RouteCommentData; children: ReactNode }) {
  return (
    <PageComments page={page} threads={threadsOfPage.get(page) ?? noThreads} snapshots={comments.snapshots} commenter={comments.commenter} people={comments.people} renderBody={renderCommentBody}>
      <div {...commentScopeProps}>{children}</div>
    </PageComments>
  )
}
