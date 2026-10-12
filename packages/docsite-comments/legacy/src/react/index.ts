/**
 * 浏览器里的 React 界面：一页上的评论（PageComments）与全部评论页（AllComments）。
 * 评论正文由 renderBody 传入，包不导入站点的组件表；人员头像用 @godcreator/docsite-identity/react
 */

export { commentScopeAttribute, commentScopeProps, PageComments, type PageCommentsProps } from './comments.js'
export { AllComments, type AllCommentsProps } from './all-comments.js'
export { CommentEditor, CommentItem, PeopleContext, postComment, rememberThreadToOpen, recentThreadToOpen, ThreadView, type CommentApi } from './comment-cards.js'
