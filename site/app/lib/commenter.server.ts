import { commentSnapshotsOf } from '@godcreator/docsite-kit/server'
import type { CommentThreadFrontmatter } from '@godcreator/docsite-kit/comments'

/** 这一页各评论串的页面文字快照，从 comments/ 里各评论串的 snapshot.txt 读出来 */
export function pageCommentSnapshots(threads: ReadonlyArray<{ id: string; head: CommentThreadFrontmatter }>) {
  return commentSnapshotsOf(threads)
}
