import type { ReactNode } from 'react'
import { CommentsDock, commentScopeProps, type CommentAvatar } from '@godcreator/docsite-comments/react'
import { Avatar } from '@godcreator/docsite-identity/react'
import { commentContent } from '@site/lib/client-content'
import type { RouteCommentData } from '../server/comments.server.js'

/** 评论正文：骨架把评论集合的 client loader 包成的组件，评论包的侧栏按路径取它 */
function CommentBody({ path }: { path: string }) {
  return <>{commentContent.useContent(path)}</>
}

/** 评论卡的头像：身份包的 Avatar（名字第一个字、底色由 id 算出），评论包只收插槽 */
const commentAvatar: CommentAvatar = ({ id, name, size }) => <Avatar person={{ id, name }} size={size} />

/** 协作站页面上的评论：照骨架内容页的接法（右下角浮标唤起的评论栏），能批整页、批一段文字或一个元素；comments 是 loader 里 routeCommentData 读的 */
export function RouteComments({ page, comments, children }: { page: string; comments: RouteCommentData; children: ReactNode }) {
  const { threads, writable, writer, readOnlyReason } = comments
  return (
    <>
      <div {...commentScopeProps}>{children}</div>
      <CommentsDock
        pagePath={page}
        threads={threads}
        access={writable && writer ? { kind: 'writable', writer } : { kind: 'readonly', reasonCode: 'readonly', reasonText: readOnlyReason ?? '站点只读' }}
        BodyComponent={CommentBody}
        AvatarComponent={commentAvatar}
      />
    </>
  )
}
