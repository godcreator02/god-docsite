import { use } from 'react'
import defaultMdxComponents from '@fumadocs/base-ui/mdx'
import { commentThreadsByPage, commentThreadsOf } from '@godcreator/docsite-kit/comments'
import { comments } from './collections'

export type CommentEntry = (typeof comments.entries)[number]

/** 全站的评论串，和按页面分组的；内容页与全部评论页共用 */
export const allThreads = commentThreadsOf(comments.entries)
export const threadsOfPage = commentThreadsByPage(allThreads)

/** 不用 entry.body：它加载完后不再调用 use()，React 报 conditional use of use() */
function CommentBody({ entry }: { entry: CommentEntry }) {
  const { body: Mdx } = use(entry.load())
  return <Mdx components={defaultMdxComponents} />
}

export function renderCommentBody(entry: CommentEntry) {
  return <CommentBody entry={entry} />
}
