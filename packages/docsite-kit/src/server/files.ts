/**
 * 不经开发服务、直接读站点目录里的文件：gwb 插件（gwb-docsite、gwb-collab）在 Node 里用。
 * 不引用评论接口那一份（它带着 MDX 编译器），插件打包时不把它带进去
 */
export { commentThreadIdsAbout, readCommentThreads, siteProblems, type CommentFile, type CommentThreadFile } from './comment-files.js'
export { jsonFileOf, sitePeople } from './site-people.js'
