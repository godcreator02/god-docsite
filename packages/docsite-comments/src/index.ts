/**
 * 评论包的根入口：模型纯函数与类型（threadsForPage 分组、文件序列化、id 形状）。
 * 不拉 Node、不拉 React：Node 写入在 ./server，批注覆盖层在 ./overlay，界面在 ./react。
 * 人员（Person）与身份在 @godcreator/docsite-identity，由站点组合，本包不依赖它。
 */
export {
  assertCommentId,
  COMMENT_ID_PATTERN,
  newCommentId,
  serializeCommentFile,
  THREAD_HEAD_FILE,
  threadsForPage,
  type CommentEntryLike,
  type ReplyFields,
  type ReplySummary,
  type ThreadHeadFields,
  type ThreadSummary,
} from './model.js'
