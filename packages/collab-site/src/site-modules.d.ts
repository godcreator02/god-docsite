/// <reference types="@godcreator/docsite-kit/site-modules" />

/**
 * 功能包模板复制进站点的 app/lib/journal.ts（日志页的集合）与骨架里功能包用到的另外两个模块，
 * src/routes/ 里经别名 @site 读；类型由这个包自己写
 */
declare module '@site/lib/journal' {
  import type { ComponentType } from 'react'
  type JournalEntry = {
    info: { path: string }
    load(): Promise<{ body: ComponentType<{ components?: Readonly<Record<string, ComponentType<any>>> }> }>
  }
  export const journal: { entries: JournalEntry[] }
}

declare module '@site/lib/comments.server' {
  /** 本页评论（page 是评论归属键：功能包页面用页面地址）；author 已由骨架解析成可信的 {id, name} */
  export function pageThreads(page: string): Array<{
    id: string
    headPath: string
    page: string
    anchor?: string
    author: { id: string; name: string }
    createdAt: string
    replies: Array<{ id: string; path: string; author: { id: string; name: string }; createdAt: string }>
  }>
}

declare module '@site/lib/client-content' {
  import type { ReactNode } from 'react'
  /** 浏览器一侧评论正文的按需加载入口：服务端只传路径，正文在浏览器按路径异步加载并渲染 */
  export const commentContent: { useContent(path: string): ReactNode }
}
