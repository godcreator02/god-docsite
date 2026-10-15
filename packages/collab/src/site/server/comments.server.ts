import { existsSync } from 'node:fs'
import { readCommentThreads, type CommentThreadOnDisk } from '@godcreator/comments/node'
import { commentsAccessOf } from '@godcreator/comments/site'
import { handleCommentWrite, pageThreadsOf, type CommentCollectionEntry } from '@godcreator/comments/site/server'
import type { CollabSite } from '../collab-site.js'
import type { PageComments } from '../page-data.js'

/*
 * 协作页（任务页、记录那一页、日志页）上的评论：评论归属键是页面地址（如 /tasks、/tasks/<记录 id>），
 * 评论文件在站点给的评论目录里，和站点自己的评论在同一处
 */

function entriesOf(threads: readonly CommentThreadOnDisk[]): CommentCollectionEntry[] {
  return threads
    .flatMap(({ head, replies }) => [head, ...replies])
    .map((file) => ({
      info: { path: file.path },
      author: file.authorId,
      createdAt: file.createdAt,
      ...(file.page !== undefined ? { page: file.page } : {}),
      ...(file.anchor !== undefined ? { anchor: file.anchor } : {}),
      ...(file.resolved !== undefined ? { status: 'resolved', resolvedBy: file.resolved.by, resolvedAt: file.resolved.at } : {}),
    }))
}

/** 一页上的评论：读评论目录里归属这一页的评论串（作者换成公开的 {id, name}），以及本机身份能不能写；还没有评论目录就是还没有评论 */
export async function pageCommentsOf(site: CollabSite, page: string): Promise<PageComments> {
  const threads = existsSync(site.commentsDir) ? await readCommentThreads(site.commentsDir) : []
  return {
    threads: pageThreadsOf({ entries: entriesOf(threads), people: site.people(), page }),
    access: commentsAccessOf(site.identity()),
  }
}

/** 写评论：评论包唯一的写入 action，评论目录、人员、身份、可信 origin 都取站点给的 */
export function writeComment(request: Request, site: CollabSite) {
  return handleCommentWrite({ request, commentsDir: site.commentsDir, people: site.people(), identity: site.identity(), trustedOrigin: site.trustedOrigin })
}
