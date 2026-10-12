/**
 * 评论包的根入口：评论串的模型与校验、页面文字的取字规则、快照位置的推算、评论链接协议。
 * 不拉 Node，也不拉 React；Node 只在 ./server，浏览器定位在 ./browser，React 界面在 ./react。
 * 人员（Person）与身份在 @godcreator/docsite-identity。
 */

export {
  assertCommentAuthorsKnown,
  assertCommentPagesExist,
  commentablePagesOf,
  commentElementKinds,
  commentFileName,
  commentFrontmatterSchema,
  commentRoutePatternOf,
  commentSnapshotFile,
  commentThreadsByPage,
  commentThreadsOf,
  isCommentOpeners,
  isCommentRange,
  isThreadHeadFile,
  snapshotMismatchOf,
  type CommentElementKind,
  type CommentEntry,
  type CommentFrontmatter,
  type CommentFrontmatterSchema,
  type Commenter,
  type CommentReplyFrontmatter,
  type CommentStatus,
  type CommentThread,
  type CommentThreadFrontmatter,
} from './comments.js'

export { diffOfTexts, createRangeMapper, mapRangeThroughDiff, type CommentRange, type MappedRange, type RangeMapper } from './comment-ranges.js'

export { atomicCharacter, commentScopeAttribute, commentUiAttribute, pageTextRoleOf, type PageTextRole } from './page-text-rules.js'

export { commentLinkOf, linkedCommentParam } from './comment-links.js'
