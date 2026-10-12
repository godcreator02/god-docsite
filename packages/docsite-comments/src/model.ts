/**
 * 评论模型：评论串在磁盘上的形状，以及对它的分组与序列化（纯函数，不碰 Node）。
 *
 * 边界约定（design/zcode-orchestration/parallel-rewrite-contract.md）：
 * - 本模块不认识身份码、Origin、as；授权由宿主（站点）完成后才调用写函数（见 ./server）。
 * - 作者在文件里只存人员 id 字符串；{id,name} 的可信组合由宿主在读侧解析后传递。
 * - 评论是 fumadocs-mdx 集合里的文件（M2：与页面同一编译链）；这里不做编译，只管文件与数据的形状。
 * - anchor 是评论锚定的页面元素 id（正文标题等自带 id 的元素），可空；正文外覆盖层（./overlay）
 *   按宿主给的定位函数用它找元素。文字级锚点（正文改动后的快照映射）不在本段。
 */

export const THREAD_HEAD_FILE = 'index.mdx';

/** 串头与回复共用的 id 形状：20261012t153000-ab12 */
export const COMMENT_ID_PATTERN = /^\d{8}t\d{6}-[0-9a-z]{2,8}$/;

export interface ThreadHeadFields {
  page: string;
  authorId: string;
  createdAt: string;
  /** 锚定的页面元素 id；页面级评论（不锚元素）没有这个字段 */
  anchor?: string;
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
  /** 串头才有：锚定的页面元素 id */
  anchor?: string;
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
  anchor?: string;
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
        ...(typeof entry.anchor === 'string' && entry.anchor !== '' ? { anchor: entry.anchor } : {}),
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

/** id 先过形状校验，杜绝路径穿越；供写侧（./server）与宿主 action 共用 */
export function assertCommentId(id: string, what: string): void {
  if (!COMMENT_ID_PATTERN.test(id)) {
    throw new Error(`${what}不是合法 id：${JSON.stringify(id)}`);
  }
}
