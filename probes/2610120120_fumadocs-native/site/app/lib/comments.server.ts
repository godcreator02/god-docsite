import { threadsForPage, type ThreadSummary } from '@probe/comments-model';
import { commentCollection } from './source.server';
import { personById } from './people.server';

/**
 * 路由 loader 的评论数据：把集合条目交给纯模型分组（逐请求执行，不做模块顶层分组），
 * 再由站点把 authorId 解析成可信的 {id,name}（模型不认识人员表）。
 */
export function pageThreads(pagePath: string): PageThreadSummary[] {
  // 评论集合没写 schema：frontmatter 字段在运行时直接挂在条目上，类型是 unknown（K-05 的既知形状）
  const entries = commentCollection.map((entry) => {
    const raw = entry as unknown as Record<string, unknown>;
    return {
      path: entry.info.path,
      authorId: typeof raw.author === 'string' ? raw.author : '',
      createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : '',
      page: typeof raw.page === 'string' ? raw.page : undefined,
    };
  });
  return threadsForPage(entries, pagePath).map((thread) => ({
    ...thread,
    author: authorOf(thread),
    replies: thread.replies.map((reply) => ({ ...reply, author: authorOf(reply) })),
  }));
}

export interface NamedAuthor {
  id: string;
  name: string;
}

export interface PageThreadSummary extends Omit<ThreadSummary, 'authorId'> {
  authorId: string;
  author: NamedAuthor;
  replies: Array<ThreadSummary['replies'][number] & { author: NamedAuthor }>;
}

function authorOf({ authorId }: { authorId: string }): NamedAuthor {
  const person = personById(authorId);
  if (!person) {
    throw new Error(`评论作者不在 people.json 里：${JSON.stringify(authorId)}`);
  }
  return { id: person.id, name: person.name };
}

