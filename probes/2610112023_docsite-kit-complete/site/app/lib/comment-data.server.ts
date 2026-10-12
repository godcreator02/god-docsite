import path from 'node:path'
import { compile } from '@mdx-js/mdx'
import {
  commentSnapshotsOf,
  commentThreadIdsAbout,
  readCommentThreads,
  type CommentFile,
  type CommentThreadFile,
} from '@godcreator/docsite-comments/server'
import type { CommentThread, CommentThreadFrontmatter, CommentReplyFrontmatter } from '@godcreator/docsite-comments'
import { publicPeopleOf, siteIdentity, sitePeople } from '@godcreator/docsite-identity/server'
import type { CompiledCommentEntry } from './comment-entry'

/**
 * 评论数据每次请求都从磁盘读（readCommentThreads 是评论包的公开 server 入口），
 * 不经 Fumadocs 集合、不在模块顶层固化：写评论后页面一刷新，这里看到的就是新数据。
 * 每条正文当场用官方 @mdx-js/mdx 编译成 function-body 代码字符串——组件、同目录组件引用、图片都还是 MDX 能力，
 * 浏览器端 app/lib/comment-body.tsx 把它 run 回组件
 */
async function compiledEntryOf<Frontmatter extends CommentThreadFrontmatter | CommentReplyFrontmatter>(threadId: string, file: CommentFile<Frontmatter>): Promise<CompiledCommentEntry> {
  const { file: fileName, body: source, ...frontmatter } = file
  const body = String(await compile(source, { outputFormat: 'function-body' }))
  return { ...frontmatter, info: { path: `${threadId}/${fileName}` }, body }
}

async function compiledThreadsOf(threadFiles: readonly CommentThreadFile[]) {
  return Promise.all(
    threadFiles.map(async (thread) => ({
      id: thread.id,
      head: await compiledEntryOf(thread.id, thread.head),
      replies: await Promise.all(thread.replies.map((reply) => compiledEntryOf(thread.id, reply))),
    })),
  ) as Promise<CommentThread<CompiledCommentEntry>[]>
}

/** 内容页要的评论数据：本页的评论串（正文已编译）、快照、公开人员与身份 */
export async function commentsPageData(page: string) {
  const threadFiles = await readCommentThreads(path.resolve('comments'))
  const threads = await compiledThreadsOf(threadFiles.filter((thread) => thread.head.page === page))
  return {
    identity: siteIdentity(),
    people: publicPeopleOf(sitePeople()),
    threads,
    snapshots: await commentSnapshotsOf(threads),
  }
}

/** 全部评论页要的数据：全站评论串、「和我有关」（用同一次读取的原文算 @）、页面标题 */
export async function allCommentsData() {
  const threadFiles = await readCommentThreads(path.resolve('comments'))
  const identity = siteIdentity()
  return {
    identity,
    people: publicPeopleOf(sitePeople()),
    aboutMe: identity.person ? commentThreadIdsAbout(threadFiles, identity.person.id, sitePeople()) : [],
    pageTitles: { '/comments-demo': '评论示例页' } as Record<string, string>,
    threads: await compiledThreadsOf(threadFiles),
  }
}
