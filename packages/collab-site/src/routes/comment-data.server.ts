import { allThreads, threadsOfPage } from '@site/lib/comment-threads'
import { pageCommentData } from '@site/lib/commenter.server'
import { siteCommenter } from '@godcreator/docsite-kit/server'

/** 一页上的评论要的数据：写评论的人（只读时为 null）、人员列表、这一页各评论串的快照；只在路由的 loader 里调 */
export async function routeCommentData(page: string) {
  const { people, snapshots } = await pageCommentData(allThreads, threadsOfPage.get(page) ?? [])
  return { commenter: siteCommenter(), people, snapshots }
}

export type RouteCommentData = Awaited<ReturnType<typeof routeCommentData>>
