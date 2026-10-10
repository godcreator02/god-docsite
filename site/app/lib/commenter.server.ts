import { commentSnapshotsOf, currentCommenter } from '@godcreator/docsite-kit/server'
import type { CommentThreadFrontmatter } from '@godcreator/docsite-kit/comments'

/** 写评论的人：开发服务里是本机 git 的 user.name；发布出去的站（react-router-serve）只读，没有 */
export async function pageCommenter() {
  return import.meta.env.DEV ? await currentCommenter() : null
}

/** 这一页各评论串的页面文字快照，从 comments/ 里各评论串的 snapshot.txt 读出来 */
export function pageCommentSnapshots(threads: ReadonlyArray<{ id: string; head: CommentThreadFrontmatter }>) {
  return commentSnapshotsOf(threads)
}
