import { mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import {
  assertCommentId,
  COMMENT_ID_PATTERN,
  CommentWriteRejected,
  newCommentId,
  parseCommentFile,
  parseCommentFileForRewrite,
  serializeCommentFile,
  THREAD_HEAD_FILE,
  threadResolutionOf,
  withThreadResolution,
  type CommentFileOnDisk,
  type ThreadResolution,
} from '../core/comment-file.js'
import { reactionsField, reactionsOf, serializeReactions, withReaction, type ReactionEmoji, type Reactions } from '../core/reactions.js'

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
  const fields: Record<string, string> = { page, author: authorId, createdAt: now.toISOString(), status: 'open' }
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

export interface SetThreadStatusInput {
  /** 标为已解决的人（人员 id）；重新打开不需要 */
  by?: string
  now?: Date
}

/**
 * 标一串评论为已解决（status 给 resolved，by 必填）或重新打开（open）：只改串头 frontmatter 里的 status、resolvedBy、resolvedAt，
 * 别的字段与正文原样写回。已经是这个状态就拒绝（409），写明是谁在什么时候标的
 */
export async function setThreadStatus(commentsDir: string, threadId: string, status: 'open' | 'resolved', input: SetThreadStatusInput = {}): Promise<{ resolved?: ThreadResolution }> {
  const headFile = path.join(threadDirOf(commentsDir, threadId), THREAD_HEAD_FILE)
  const headPath = `${threadId}/${THREAD_HEAD_FILE}`
  let text: string
  try {
    text = await readFile(headFile, 'utf-8')
  } catch (error) {
    if (isMissingFileError(error)) throw new CommentWriteRejected(404, `评论串不存在：${threadId}`)
    throw error
  }
  const { fields, body } = parseCommentFileForRewrite(headPath, text)
  const current = threadResolutionOf(headPath, fields)
  if (status === 'resolved' && current !== undefined) throw new CommentWriteRejected(409, `评论串 ${threadId} 已经是已解决（${current.by} 在 ${current.at} 标的）`)
  if (status === 'open' && current === undefined) throw new CommentWriteRejected(409, `评论串 ${threadId} 本来就是未解决`)
  let resolved: ThreadResolution | undefined
  if (status === 'resolved') {
    if (input.by === undefined || input.by.length === 0) throw new CommentWriteRejected(400, '标为已解决缺少标的人（by）')
    resolved = { by: input.by, at: (input.now ?? new Date()).toISOString() }
  }
  await writeFile(headFile, serializeCommentFile(withThreadResolution(fields, resolved), body), 'utf-8')
  return resolved === undefined ? {} : { resolved }
}

export interface SetReactionInput {
  /** 点在哪条回复上；不给是串头 */
  replyId?: string
  emoji: ReactionEmoji
  /** 点的人（人员 id） */
  by: string
  /** true 是加上，false 是撤掉 */
  on: boolean
}

/**
 * 给串头或一条回复加上、撤掉一个人的一个表情：只改那个文件 frontmatter 里的 reactions（没人点了就去掉这个字段），别的字段与正文原样写回。
 * 已经点过还要加、没点过还要撤都拒绝（409）：网页上的按钮按它看到的状态发，状态过时了就告诉它
 */
export async function setReaction(commentsDir: string, threadId: string, input: SetReactionInput): Promise<{ reactions: Reactions }> {
  const { replyId, emoji, by, on } = input
  if (by.length === 0) throw new CommentWriteRejected(400, '点表情缺少点的人（by）')
  if (replyId !== undefined) assertCommentId(replyId, 'replyId')
  const fileName = replyId === undefined ? THREAD_HEAD_FILE : `${replyId}.mdx`
  const file = path.join(threadDirOf(commentsDir, threadId), fileName)
  const relativePath = `${threadId}/${fileName}`
  let text: string
  try {
    text = await readFile(file, 'utf-8')
  } catch (error) {
    if (isMissingFileError(error)) throw new CommentWriteRejected(404, `要点表情的评论不存在：${relativePath}`)
    throw error
  }
  const { fields, body } = parseCommentFileForRewrite(relativePath, text)
  const current = reactionsOf(relativePath, fields[reactionsField])
  const has = (current[emoji] ?? []).includes(by)
  if (on && has) throw new CommentWriteRejected(409, `${by} 已经点过 ${emoji}`)
  if (!on && !has) throw new CommentWriteRejected(409, `${by} 没点过 ${emoji}，没有可撤的`)
  const reactions = withReaction(current, emoji, by, on)
  const serialized = serializeReactions(reactions)
  const { [reactionsField]: _old, ...otherFields } = fields
  await writeFile(file, serializeCommentFile(serialized === undefined ? otherFields : { ...otherFields, [reactionsField]: serialized }, body), 'utf-8')
  return { reactions }
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
