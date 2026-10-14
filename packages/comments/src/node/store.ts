import { mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import {
  assertCommentId,
  COMMENT_ID_PATTERN,
  CommentWriteRejected,
  newCommentId,
  parseCommentFile,
  serializeCommentFile,
  THREAD_HEAD_FILE,
  type CommentFileOnDisk,
} from '../core/comment-file.js'

/*
 * 站点评论目录的读写。评论是 fumadocs-mdx 集合里的文件：写完由集合自己的 watcher 重新生成入口，这里不编译。
 * 授权（身份、Origin、as）由调用方先做完，见 site/action.server.ts
 */

function threadDirOf(commentsDir: string, threadId: string): string {
  assertCommentId(threadId, 'threadId')
  return path.join(commentsDir, threadId)
}

function isMissingFileError(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT'
}

async function fileExists(file: string): Promise<boolean> {
  try {
    await stat(file)
    return true
  } catch (error) {
    if (isMissingFileError(error)) return false
    throw error
  }
}

export interface CreateThreadInput {
  page: string
  authorId: string
  body: string
  /** 锚定的目标（页面元素 id 或划字评论的 JSON）；批整页省略 */
  anchor?: string
  now?: Date
}

export async function createThread(commentsDir: string, input: CreateThreadInput): Promise<{ id: string; headPath: string }> {
  const { page, authorId, body, anchor, now = new Date() } = input
  if (page.length === 0) throw new CommentWriteRejected(400, '新建评论串缺少 page')
  if (authorId.length === 0) throw new CommentWriteRejected(400, '新建评论串缺少 authorId')
  if (body.trim().length === 0) throw new CommentWriteRejected(400, '新建评论串缺少正文')
  const id = newCommentId(now)
  const threadDir = threadDirOf(commentsDir, id)
  // 站点的第一条评论时评论目录还不存在
  await mkdir(threadDir, { recursive: true })
  const fields: Record<string, string> = { page, author: authorId, createdAt: now.toISOString() }
  if (anchor !== undefined && anchor !== '') fields.anchor = anchor
  await writeFile(path.join(threadDir, THREAD_HEAD_FILE), serializeCommentFile(fields, body), 'utf-8')
  return { id, headPath: `${id}/${THREAD_HEAD_FILE}` }
}

export interface CreateReplyInput {
  authorId: string
  body: string
  now?: Date
}

export async function createReply(commentsDir: string, threadId: string, input: CreateReplyInput): Promise<{ id: string; path: string }> {
  const { authorId, body, now = new Date() } = input
  if (authorId.length === 0) throw new CommentWriteRejected(400, '回复缺少 authorId')
  if (body.trim().length === 0) throw new CommentWriteRejected(400, '回复缺少正文')
  const threadDir = threadDirOf(commentsDir, threadId)
  if (!(await fileExists(path.join(threadDir, THREAD_HEAD_FILE)))) throw new CommentWriteRejected(404, `回复的目标串不存在：${threadId}`)
  const id = newCommentId(now)
  await writeFile(path.join(threadDir, `${id}.mdx`), serializeCommentFile({ author: authorId, createdAt: now.toISOString() }, body), 'utf-8')
  return { id, path: `${threadId}/${id}.mdx` }
}

/** 删一条回复，返回它相对评论目录的路径 */
export async function deleteReply(commentsDir: string, threadId: string, replyId: string): Promise<string> {
  assertCommentId(replyId, 'replyId')
  const replyFile = path.join(threadDirOf(commentsDir, threadId), `${replyId}.mdx`)
  if (!(await fileExists(replyFile))) throw new CommentWriteRejected(404, `要删的回复不存在：${threadId}/${replyId}.mdx`)
  await rm(replyFile)
  return `${threadId}/${replyId}.mdx`
}

/** 删整个评论串（含同目录的附件），返回被删文件相对评论目录的路径 */
export async function deleteThread(commentsDir: string, threadId: string): Promise<string[]> {
  const threadDir = threadDirOf(commentsDir, threadId)
  let removedFiles: string[]
  try {
    removedFiles = (await readdir(threadDir, { recursive: true })).map((name) => `${threadId}/${name.replaceAll('\\', '/')}`)
  } catch (error) {
    if (isMissingFileError(error)) throw new CommentWriteRejected(404, `要删的评论串不存在：${threadId}`)
    throw error
  }
  await rm(threadDir, { recursive: true, force: true })
  return removedFiles
}

export interface CommentThreadOnDisk {
  head: CommentFileOnDisk
  replies: CommentFileOnDisk[]
}

/**
 * 直接读评论目录（不经集合编译）：gwb 插件在 Node 里列评论用，站点不必在运行。
 * 评论目录里名字不是评论 id 的文件夹和散放的文件不算评论；评论文件夹里没有串头时报错
 */
export async function readCommentThreads(commentsDir: string): Promise<CommentThreadOnDisk[]> {
  const threads: CommentThreadOnDisk[] = []
  for (const entry of await readdir(commentsDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || !COMMENT_ID_PATTERN.test(entry.name)) continue
    const replies: CommentFileOnDisk[] = []
    let head: CommentFileOnDisk | undefined
    for (const file of await readdir(path.join(commentsDir, entry.name))) {
      if (!file.endsWith('.mdx')) continue
      const parsed = parseCommentFile(`${entry.name}/${file}`, await readFile(path.join(commentsDir, entry.name, file), 'utf-8'))
      if (file === THREAD_HEAD_FILE) head = parsed
      else replies.push(parsed)
    }
    if (head === undefined) throw new Error(`评论串没有串头：${entry.name}/${THREAD_HEAD_FILE}`)
    threads.push({ head, replies: replies.sort((a, b) => (a.path < b.path ? -1 : 1)) })
  }
  return threads
}
