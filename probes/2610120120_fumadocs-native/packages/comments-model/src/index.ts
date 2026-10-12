/**
 * 评论模型：评论串在磁盘上的形状，以及对它读、写、删的纯函数。
 *
 * 边界约定（design/zcode-orchestration/parallel-rewrite-contract.md）：
 * - 本模块不认识身份码、Origin、as；授权由宿主（站点）完成后才调用这里的写函数。
 * - 作者在文件里只存人员 id 字符串；{id,name} 的可信组合由宿主在读侧解析后传递。
 * - 评论是 fumadocs-mdx 集合里的文件；这里不做编译，只管文件与数据的形状。
 */

import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const THREAD_HEAD_FILE = 'index.mdx';

/** 串头与回复共用的 id 形状：20261012t153000-ab12 */
export const COMMENT_ID_PATTERN = /^\d{8}t\d{6}-[0-9a-z]{2,8}$/;

export interface ThreadHeadFields {
  page: string;
  authorId: string;
  createdAt: string;
}

export interface ReplyFields {
  authorId: string;
  createdAt: string;
}

/** 集合条目里读侧关心的最小形状（结构兼容 fumadocs-mdx 异步集合条目） */
export interface CommentEntryLike {
  /** 相对集合目录的路径，如 `20261012t080000-seed1/index.mdx` */
  path: string;
  authorId: string;
  createdAt: string;
  /** 串头才有：所属页面的集合内路径 */
  page?: string;
}

export interface ReplySummary {
  id: string;
  path: string;
  authorId: string;
  createdAt: string;
}

export interface ThreadSummary {
  id: string;
  headPath: string;
  page: string;
  authorId: string;
  createdAt: string;
  replies: ReplySummary[];
}

export function newCommentId(now = new Date()): string {
  const pad = (n: number, w: number) => String(n).padStart(w, '0');
  const stamp =
    `${pad(now.getFullYear(), 4)}${pad(now.getMonth() + 1, 2)}${pad(now.getDate(), 2)}` +
    `t${pad(now.getHours(), 2)}${pad(now.getMinutes(), 2)}${pad(now.getSeconds(), 2)}`;
  const rand = Math.random().toString(36).slice(2, 6);
  return `${stamp}-${rand}`;
}

/**
 * 把集合条目按文件夹分成评论串，只保留属于指定页面的串。
 * 数据不完整（回复没有串头、串头缺 page/author）时直接抛错并点名条目路径，不做兜底。
 */
export function threadsForPage(entries: CommentEntryLike[], page: string): ThreadSummary[] {
  const threads = new Map<string, ThreadSummary>();
  for (const entry of entries) {
    const segments = entry.path.split('/');
    if (segments.length !== 2) {
      throw new Error(`评论条目不在串文件夹里（期望 <threadId>/<file>.mdx）：${entry.path}`);
    }
    const [threadId, fileName] = segments;
    if (!COMMENT_ID_PATTERN.test(threadId)) {
      throw new Error(`评论文件夹名不是合法 id：${entry.path}`);
    }
    if (fileName === THREAD_HEAD_FILE) {
      if (entry.page === undefined) {
        throw new Error(`串头缺 page 字段：${entry.path}`);
      }
      const existing = threads.get(threadId);
      if (existing) {
        throw new Error(`串文件夹里有两个串头：${existing.headPath} 与 ${entry.path}`);
      }
      threads.set(threadId, {
        id: threadId,
        headPath: entry.path,
        page: entry.page,
        authorId: entry.authorId,
        createdAt: entry.createdAt,
        replies: [],
      });
    }
  }
  for (const entry of entries) {
    const [threadId, fileName] = entry.path.split('/') as [string, string];
    if (fileName === THREAD_HEAD_FILE) continue;
    const thread = threads.get(threadId);
    if (!thread) {
      throw new Error(`回复所在的串没有串头 index.mdx：${entry.path}`);
    }
    thread.replies.push({
      id: fileName.replace(/\.mdx$/, ''),
      path: entry.path,
      authorId: entry.authorId,
      createdAt: entry.createdAt,
    });
  }
  for (const thread of threads.values()) {
    thread.replies.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  }
  return [...threads.values()]
    .filter((thread) => thread.page === page)
    .sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : a.id < b.id ? -1 : 1));
}

/** frontmatter 值一律按 JSON 字符串写，避免 YAML 转义歧义 */
export function serializeCommentFile(fields: Record<string, string>, body: string): string {
  const lines = Object.entries(fields).map(([k, v]) => `${k}: ${JSON.stringify(v)}`);
  return `---\n${lines.join('\n')}\n---\n\n${body.trimEnd()}\n`;
}

function requireId(id: string, what: string): void {
  if (!COMMENT_ID_PATTERN.test(id)) {
    throw new Error(`${what}不是合法 id：${JSON.stringify(id)}`);
  }
}

/** 解析串文件夹路径；id 先过形状校验，杜绝路径穿越 */
function threadDir(commentsDir: string, threadId: string): string {
  requireId(threadId, 'threadId');
  return path.join(commentsDir, threadId);
}

export interface CreateThreadInput {
  page: string;
  authorId: string;
  body: string;
  now?: Date;
}

export async function createThread(
  commentsDir: string,
  input: CreateThreadInput,
): Promise<{ id: string; headPath: string }> {
  const { page, authorId, body, now = new Date() } = input;
  if (page.length === 0) throw new Error('新建评论串缺少 page');
  if (authorId.length === 0) throw new Error('新建评论串缺少 authorId');
  if (body.trim().length === 0) throw new Error('新建评论串缺少正文');
  const id = newCommentId(now);
  const dir = threadDir(commentsDir, id);
  await mkdir(dir, { recursive: false });
  const content = serializeCommentFile(
    { page, author: authorId, createdAt: now.toISOString() },
    body,
  );
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
  requireId(replyId, 'replyId');
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
