import type { CommentEntry } from '@godcreator/docsite-comments'

/**
 * 一条评论交给浏览器的形状：包的 CommentEntry（frontmatter 加 info.path），
 * 正文不是 MDX 原文，而是服务端编译产物（function-body 的代码字符串，可以随 loader 数据序列化）。
 * 浏览器端用它经 run 还原成 React 组件（app/lib/comment-body.tsx）
 */
export type CompiledCommentEntry = CommentEntry & { body: string }
