import type { ComponentType, ReactNode } from 'react'
import { CommentsDock, commentScopeProps, type CommentAvatar } from '@godcreator/comments/site'
import { Avatar } from '@godcreator/identity/site'
import type { PageComments as PageCommentsData } from '../page-data.js'

/** 站点给的评论正文组件：按评论目录里的相对路径渲染那条评论（站点评论集合的按需加载） */
export type CommentBodyComponent = ComponentType<{ path: string }>

const commentAvatar: CommentAvatar = ({ id, name, size }) => <Avatar person={{ id, name }} size={size} />

/**
 * 协作页上的评论：右下角「评论」弹出本页评论的收件箱，点一串在被批的位置下方浮出；能批整页、批一段文字或一个元素。
 * page 是评论归属键，也是写评论提交到的地址：协作页自己的路由 action（recordAction、commentAction）收评论
 */
export function PageComments({ page, comments, CommentBody, children }: { page: string; comments: PageCommentsData; CommentBody: CommentBodyComponent; children: ReactNode }) {
  return (
    <>
      <div {...commentScopeProps}>{children}</div>
      <CommentsDock pagePath={page} action={page} threads={comments.threads} access={comments.access} BodyComponent={CommentBody} AvatarComponent={commentAvatar} />
    </>
  )
}
