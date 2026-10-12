/**
 * 评论的文件读写（Node）：新建串、回复、删除。评论是 fumadocs-mdx 集合里的文件，
 * 写完由集合自己的 watcher 重新生成入口，不在运行时编译（M2：只有 Vite + fumadocs-mdx 一个编译链）。
 * 授权（身份、Origin、as）由宿主在调用前完成，见 @godcreator/docsite-identity 的 authorizeWrite。
 */
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  assertCommentId,
  COMMENT_ID_PATTERN,
  newCommentId,
  serializeCommentFile,
  THREAD_HEAD_FILE,
} from './model.js';

/** 解析串文件夹路径；id 先过形状校验，杜绝路径穿越 */
function threadDir(commentsDir: string, threadId: string): string {
  assertCommentId(threadId, 'threadId');
  return path.join(commentsDir, threadId);
}

export interface CreateThreadInput {
  page: string;
  authorId: string;
  body: string;
  /** 锚定的页面元素 id；页面级评论省略 */
  anchor?: string;
  now?: Date;
}

export async function createThread(
  commentsDir: string,
  input: CreateThreadInput,
): Promise<{ id: string; headPath: string }> {
  const { page, authorId, body, anchor, now = new Date() } = input;
  if (page.length === 0) throw new Error('新建评论串缺少 page');
  if (authorId.length === 0) throw new Error('新建评论串缺少 authorId');
  if (body.trim().length === 0) throw new Error('新建评论串缺少正文');
  const id = newCommentId(now);
  const dir = threadDir(commentsDir, id);
  await mkdir(dir, { recursive: false });
  const fields: Record<string, string> = { page, author: authorId, createdAt: now.toISOString() };
  if (anchor !== undefined && anchor !== '') fields.anchor = anchor;
  const content = serializeCommentFile(fields, body);
  await writeFile(path.join(dir, THREAD_HEAD_FILE), content, 'utf-8');
  return { id, headPath: `${id}/${THREAD_HEAD_FILE}` };
}

export interface CreateReplyInput {
  authorId: string;
  body: string;
  now?: Date;
}

export async function createReply(
  commentsDir: string,
  threadId: string,
  input: CreateReplyInput,
): Promise<{ id: string; path: string }> {
  const { authorId, body, now = new Date() } = input;
  if (authorId.length === 0) throw new Error('回复缺少 authorId');
  if (body.trim().length === 0) throw new Error('回复缺少正文');
  const dir = threadDir(commentsDir, threadId);
  const head = await readFile(path.join(dir, THREAD_HEAD_FILE), 'utf-8').then(
    () => true,
    () => false,
  );
  if (!head) throw new Error(`回复的目标串不存在：${threadId}`);
  const id = newCommentId(now);
  const content = serializeCommentFile({ author: authorId, createdAt: now.toISOString() }, body);
  await writeFile(path.join(dir, `${id}.mdx`), content, 'utf-8');
  return { id, path: `${threadId}/${id}.mdx` };
}

export async function deleteReply(commentsDir: string, threadId: string, replyId: string): Promise<string> {
  assertCommentId(replyId, 'replyId');
  const dir = threadDir(commentsDir, threadId);
  const file = path.join(dir, `${replyId}.mdx`);
  const existed = await readFile(file, 'utf-8').then(
    () => true,
    () => false,
  );
  if (!existed) throw new Error(`要删的回复不存在：${threadId}/${replyId}.mdx`);
  await rm(file);
  return `${threadId}/${replyId}.mdx`;
}

/** 删除整个评论串（含同目录的 tsx、图片等附件），返回被删文件的相对路径 */
export async function deleteThread(commentsDir: string, threadId: string): Promise<string[]> {
  const dir = threadDir(commentsDir, threadId);
  let removed: string[] = [];
  try {
    removed = (await readdir(dir, { recursive: true }))
      .map((name) => `${threadId}/${name.replaceAll('\\', '/')}`);
  } catch {
    throw new Error(`要删的评论串不存在：${threadId}`);
  }
  await rm(dir, { recursive: true, force: true });
  return removed;
}

/** 磁盘上的一条评论文件：frontmatter 字段加正文（轻量解析，不经集合编译） */
export interface CommentFileOnDisk {
  path: string
  page?: string
  anchor?: string
  authorId: string
  createdAt: string
  body: string
}

/** 轻量解析本项目写的 frontmatter（值都是 JSON 字符串，见 serializeCommentFile）；不是这个形状直接报错 */
function parseCommentFile(file: string, text: string): CommentFileOnDisk {
  const match = /^---\n([\s\S]*?)\n---\n?/.exec(text)
  if (!match) throw new Error(`${file} 没有 frontmatter`)
  const fields: Record<string, string> = {}
  for (const line of match[1].split('\n')) {
    const colon = line.indexOf(': ')
    if (colon <= 0) throw new Error(`${file} 的 frontmatter 有一行认不出：${line}`)
    const key = line.slice(0, colon)
    let value = line.slice(colon + 2)
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1)
    fields[key] = value
  }
  if (typeof fields.author !== 'string' || fields.author === '') throw new Error(`${file} 缺 author 字段`)
  if (typeof fields.createdAt !== 'string' || fields.createdAt === '') throw new Error(`${file} 缺 createdAt 字段`)
  return {
    path: file.replaceAll('\\', '/'),
    ...(typeof fields.page === 'string' ? { page: fields.page } : {}),
    ...(typeof fields.anchor === 'string' && fields.anchor !== '' ? { anchor: fields.anchor } : {}),
    authorId: fields.author,
    createdAt: fields.createdAt,
    body: text.slice(match[0].length).trim(),
  }
}

/**
 * 直接读评论目录（不经集合编译）：gwb 插件在 Node 里列评论用（站点不必在运行）。
 * 目录形状必须已经是串文件夹（<id>/index.mdx + 回复 mdx）；旧机制目录（文字锚点那版）不在支持范围
 */
export async function readCommentThreads(commentsDir: string): Promise<Array<{ head: CommentFileOnDisk; replies: CommentFileOnDisk[] }>> {
  const threads: Array<{ head: CommentFileOnDisk; replies: CommentFileOnDisk[] }> = []
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
