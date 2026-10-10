import { assertCommentAuthorsKnown, type CommentEntry, type CommentThread, type CommentThreadFrontmatter } from '@godcreator/docsite-kit/comments'
import { commentSnapshotsOf, sitePeople } from '@godcreator/docsite-kit/server'

/**
 * 内容页要的评论数据：站点人员列表（people.json），和这一页各评论串的页面文字快照（各评论串的 snapshot.txt）。
 * 全站评论的作者都要在人员列表里，不在就报错
 */
export async function pageCommentData(allThreads: ReadonlyArray<CommentThread<CommentEntry>>, pageThreads: ReadonlyArray<{ id: string; head: CommentThreadFrontmatter }>) {
  const people = sitePeople()
  assertCommentAuthorsKnown(allThreads, people)
  return { people, snapshots: await commentSnapshotsOf(pageThreads) }
}
