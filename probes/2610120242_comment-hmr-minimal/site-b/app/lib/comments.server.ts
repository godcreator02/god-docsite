import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * 评论元数据与写入：loader 只交付本页评论的元数据（K-05），
 * 正文经集合编译链在浏览器按需加载（lib/client-content.tsx）。
 * 元数据来源是文件系统扫描（新增后 revalidate 立即可见，与编译集合的入口更新是两条链）。
 */
const commentsRoot = fileURLToPath(new URL('../../comments', import.meta.url));

export type CommentSummary = {
  id: string;
  path: string;
  author: string;
  createdAt: string;
};

export async function listComments(): Promise<CommentSummary[]> {
  let entries;
  try {
    entries = await readdir(commentsRoot, { withFileTypes: true });
  } catch {
    return [];
  }
  const summaries: CommentSummary[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const id = entry.name;
    let text;
    try {
      text = await readFile(path.join(commentsRoot, id, 'index.mdx'), 'utf8');
    } catch {
      continue;
    }
    summaries.push({ id, path: `${id}/index.mdx`, ...parseCommentFrontmatter(text) });
  }
  return summaries.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function createComment(body: string): Promise<CommentSummary> {
  const now = new Date();
  const stamp = `${now.toISOString().slice(0, 10).replaceAll('-', '')}t${now.toISOString().slice(11, 19).replaceAll(':', '')}`;
  const id = `${stamp}-${Math.random().toString(36).slice(2, 6)}`;
  const createdAt = now.toISOString();
  const dir = path.join(commentsRoot, id);
  await mkdir(dir, { recursive: true });
  await writeFile(
    path.join(dir, 'index.mdx'),
    `---\nauthor: probe-owner\ncreatedAt: ${createdAt}\n---\n\n${body.trim()}\n`,
  );
  return { id, path: `${id}/index.mdx`, author: 'probe-owner', createdAt };
}

export async function deleteComment(id: string): Promise<void> {
  if (!/^[0-9a-z-]+$/.test(id)) throw new Error(`评论 id 不合法：${JSON.stringify(id)}`);
  const dir = path.resolve(commentsRoot, id);
  if (path.dirname(dir) !== path.resolve(commentsRoot)) {
    throw new Error(`评论目录越界：${JSON.stringify(id)}`);
  }
  await rm(dir, { recursive: true, force: true });
}

function parseCommentFrontmatter(text: string): { author: string; createdAt: string } {
  const match = /^---\n([\s\S]*?)\n---/.exec(text);
  const fields: Record<string, string> = {};
  if (match) {
    for (const line of match[1].split('\n')) {
      const pair = /^(\w+):\s*"?(.*?)"?$/.exec(line.trim());
      if (pair) fields[pair[1]] = pair[2];
    }
  }
  return { author: fields.author ?? 'unknown', createdAt: fields.createdAt ?? '' };
}
// touch-c 1035
// touch-c2 1042
// touch-c3 1046
