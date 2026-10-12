/**
 * 评论的文件读写（Node）：新建串、回复、删除。评论是 fumadocs-mdx 集合里的文件，
 * 写完由集合自己的 watcher 重新生成入口，不在运行时编译（M2：只有 Vite + fumadocs-mdx 一个编译链）。
 * 授权（身份、Origin、as）由宿主在调用前完成，见 @godcreator/docsite-identity 的 authorizeWrite。
 */
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  assertCommentId,
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
