/**
 * 功能包里的路由模块经别名 @site（站点的 app/，由 ./vite 的 docsite() 设）读骨架里的这几个模块。
 * 功能包在源码里写 /// <reference types="@godcreator/docsite-kit/site-modules" /> 引用这一份
 */

declare module '@site/lib/source' {
  /** 站名：content/meta.json 的 title */
  export function siteName(): string
  /** 站里每一页的地址与标题 */
  export function sitePageRefs(): Array<{ url: string; title: string }>
}

declare module '@site/lib/comment-threads' {
  import type { ReactNode } from 'react'
  import type { CommentEntry, CommentThread } from '@godcreator/docsite-kit/comments'
  /** 全站的评论串 */
  export const allThreads: CommentThread<CommentEntry>[]
  /** 页面地址到批这一页的评论串 */
  export const threadsOfPage: Map<string, CommentThread<CommentEntry>[]>
  /** 评论正文：交给 PageComments 的 renderBody */
  export function renderCommentBody(entry: CommentEntry): ReactNode
}

declare module '@site/lib/commenter.server' {
  import type { CommentEntry, CommentThread, CommentThreadFrontmatter, Person } from '@godcreator/docsite-kit/comments'
  /** 一页要的评论数据：站点人员列表与这一页各评论串的页面文字快照；功能包路由的 loader 调它 */
  export function pageCommentData(
    allThreads: ReadonlyArray<CommentThread<CommentEntry>>,
    pageThreads: ReadonlyArray<{ id: string; head: CommentThreadFrontmatter }>,
  ): Promise<{ people: Person[]; snapshots: Record<string, string> }>
}

declare module '@site/lib/mdx-components' {
  import type { ComponentType } from 'react'
  /** fumadocs 的 MDX 组件并上各功能包的 mdxComponents */
  export const mdxComponents: Readonly<Record<string, ComponentType<any>>>
}
