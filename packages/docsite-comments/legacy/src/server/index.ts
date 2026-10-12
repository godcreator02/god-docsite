/**
 * 只在 Node 里用的服务端函数：站点路由的 loader、action 调用它们。
 * 谁在操作由 @godcreator/docsite-identity/server 的 authorizeWrite 校验；这里只有评论的读写与检查
 */

export { commentRequestResponse, commentSnapshotsOf, commentSourceResponse, type CommentOperation, type CommentRequestOptions, type PageHtmlOf } from './comments.js'
export { commentSiteProblems, commentThreadIdsAbout, readCommentThreads, type CommentFile, type CommentThreadFile } from './comment-files.js'
export { pageTextOfHtml } from './page-text.js'
