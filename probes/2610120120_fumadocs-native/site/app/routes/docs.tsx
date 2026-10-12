import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Component, type ReactNode } from 'react';
import type { Route } from './+types/docs';
import { data, useFetcher } from 'react-router';
import { DocsLayout } from '@fumadocs/base-ui/layouts/docs';
import { useFumadocsLoader } from 'fumadocs-core/source/client';
import {
  createReply,
  createThread,
  deleteReply,
  deleteThread,
} from '@probe/comments-model';
import { source } from '@/lib/source.server';
import { pageThreads, type NamedAuthor, type PageThreadSummary } from '@/lib/comments.server';
import { identityStatus, resolveAuthor, sameOrigin } from '@/lib/identity.server';
import { READ_ONLY_REASONS, type ReadOnlyReason } from '@/lib/read-only-reasons';
import { baseOptions } from '@/lib/layout.shared';
import { commentContent, docsContent } from '@/lib/client-content';

const commentsDir = fileURLToPath(new URL('../../comments', import.meta.url));

export async function loader({ params }: Route.LoaderArgs) {
  const slugs = params['*'].split('/').filter((v) => v.length > 0);
  const page = source.getPage(slugs);
  if (!page) throw new Response('Not Found', { status: 404 });

  // K-05：loader 只交付本页评论的元数据（路径+作者+时间），正文由浏览器按需加载
  const identity = identityStatus();
  return {
    path: page.path,
    comments: pageThreads(page.path),
    pageTree: await source.serializePageTree(source.getPageTree()),
    writable: identity.writable,
    writer: identity.writer,
    readOnlyReason: identity.readOnlyReason,
    asChoices: identity.asChoices,
  };
}

export async function action({ request }: Route.ActionArgs) {
  // 写入保护不区分意图：身份、来源两项都过才动文件；build/start 启动时没有身份码，天然只读
  if (!sameOrigin(request)) {
    return data({ ok: false, error: 'origin-rejected' }, { status: 403 });
  }
  const identity = identityStatus();
  if (!identity.writable) {
    return data({ ok: false, error: identity.readOnlyReason }, { status: 403 });
  }
  const form = await request.formData();
  const intent = form.get('intent');
  const author = resolveAuthor(form);
  if ('error' in author) {
    return data({ ok: false, error: author.error }, { status: 403 });
  }

  try {
    switch (intent) {
      case 'create-thread': {
        const body = String(form.get('body') ?? '');
        const created = await createThread(commentsDir, {
          page: String(form.get('page') ?? ''),
          authorId: author.author.id,
          body,
        });
        return data({ ok: true, intent, threadId: created.id });
      }
      case 'reply': {
        const threadId = requireCommentId(form.get('threadId'), 'threadId');
        const created = await createReply(commentsDir, threadId, {
          authorId: author.author.id,
          body: String(form.get('body') ?? ''),
        });
        return data({ ok: true, intent, threadId, replyId: created.id });
      }
      case 'delete-reply': {
        const threadId = requireCommentId(form.get('threadId'), 'threadId');
        const replyId = requireCommentId(form.get('replyId'), 'replyId');
        await deleteReply(commentsDir, threadId, replyId);
        return data({ ok: true, intent, threadId, replyId });
      }
      case 'delete-thread': {
        const threadId = requireCommentId(form.get('threadId'), 'threadId');
        await deleteThread(commentsDir, threadId);
        return data({ ok: true, intent, threadId });
      }
      default:
        return data({ ok: false, error: 'unknown-intent' }, { status: 400 });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return data({ ok: false, error: 'model-rejected', message }, { status: 400 });
  }
}

function requireCommentId(value: FormDataEntryValue | null, what: string): string {
  const id = String(value ?? '');
  if (!/^\d{8}t\d{6}-[0-9a-z]{2,8}$/.test(id)) {
    throw new Error(`${what} 不合法：${JSON.stringify(id)}`);
  }
  return id;
}

export default function RouteComponent({ loaderData }: Route.ComponentProps) {
  const { path, pageTree, ...rest } = useFumadocsLoader(loaderData);
  return (
    <DocsLayout {...baseOptions()} tree={pageTree}>
      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="min-w-0 flex-1">
          {docsContent.useContent(path)}
        </div>
        <CommentsSidebar
          pagePath={path}
          comments={rest.comments}
          writable={rest.writable}
          writer={rest.writer}
          readOnlyReason={rest.readOnlyReason}
          asChoices={rest.asChoices}
        />
      </div>
    </DocsLayout>
  );
}

function CommentsSidebar({
  pagePath,
  comments,
  writable,
  writer,
  readOnlyReason,
  asChoices,
}: {
  pagePath: string;
  comments: PageThreadSummary[];
  writable: boolean;
  writer: NamedAuthor | null;
  readOnlyReason: ReadOnlyReason | null;
  asChoices: NamedAuthor[];
}) {
  return (
    <aside
      data-comments-sidebar
      data-comment-count={comments.length}
      className="w-full shrink-0 space-y-4 lg:w-80"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">本页评论</h2>
        <span className="text-fd-muted-foreground">{comments.length} 串</span>
      </div>
      {writable ? (
        <NewThreadForm pagePath={pagePath} asChoices={asChoices} />
      ) : (
        <p data-readonly-reason={readOnlyReason} className="rounded-md border border-dashed p-2 text-fd-muted-foreground">
          {readOnlyReason ? READ_ONLY_REASONS[readOnlyReason] : '站点只读'}
        </p>
      )}
      {comments.map((thread) => (
        <ThreadCard key={thread.id} thread={thread} writable={writable} asChoices={asChoices} />
      ))}
    </aside>
  );
}

function AuthorSelect({ asChoices }: { asChoices: NamedAuthor[] }) {
  if (asChoices.length <= 1) return null;
  const [self, ...agents] = asChoices;
  return (
    <label className="block text-xs">
      署名
      {/* as 只用于 agent 声明署名；本人选项的 value 必须为空（提交空 as = 本人对号入座），
          传本人的 id 会被 action 按「as 目标必须是 agent」拒绝 */}
      <select name="as" className="ml-2 rounded border bg-transparent px-1 py-0.5" defaultValue="">
        <option value="">
          {self.name}（本人）
        </option>
        {agents.map((choice) => (
          <option key={choice.id} value={choice.id}>
            {choice.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function NewThreadForm({ pagePath, asChoices }: { pagePath: string; asChoices: NamedAuthor[] }) {
  const fetcher = useFetcher<typeof action>();
  return (
    <fetcher.Form method="post" className="space-y-2" data-new-thread-form>
      <input type="hidden" name="intent" value="create-thread" />
      <input type="hidden" name="page" value={pagePath} />
      <textarea
        name="body"
        required
        rows={3}
        placeholder="新建评论串（支持 MDX）"
        className="w-full rounded-md border p-2"
      />
      <div className="flex items-center justify-between">
        <AuthorSelect asChoices={asChoices} />
        <button
          type="submit"
          disabled={fetcher.state !== 'idle'}
          className="rounded-md bg-fd-primary px-3 py-1 text-fd-primary-foreground"
        >
          {fetcher.state !== 'idle' ? '写入中…' : '新建评论串'}
        </button>
      </div>
      {fetcher.data && !fetcher.data.ok && 'error' in fetcher.data ? <p data-action-error>{fetcher.data.error}</p> : null}
    </fetcher.Form>
  );
}

function ThreadCard({
  thread,
  writable,
  asChoices,
}: {
  thread: PageThreadSummary;
  writable: boolean;
  asChoices: NamedAuthor[];
}) {
  const fetcher = useFetcher<typeof action>();
  return (
    <section data-comment-card={thread.id} data-thread-author={thread.author.name} className="space-y-2">
      <header className="flex items-center justify-between text-xs text-fd-muted-foreground">
        <span>
          {thread.author.name} · {new Date(thread.createdAt).toLocaleString('zh-CN')}
        </span>
        {writable ? (
          <fetcher.Form method="post">
            <input type="hidden" name="intent" value="delete-thread" />
            <input type="hidden" name="threadId" value={thread.id} />
            <button type="submit" className="underline" data-delete-thread={thread.id}>
              删除整串
            </button>
          </fetcher.Form>
        ) : null}
      </header>
      <CommentBody path={thread.headPath} />
      {thread.replies.map((reply) => (
        <div key={reply.id} data-reply={reply.id} className="ml-4 space-y-1 border-l pl-3">
          <div className="flex items-center justify-between text-xs text-fd-muted-foreground">
            <span data-reply-author={reply.id}>
              {reply.author.name} · {new Date(reply.createdAt).toLocaleString('zh-CN')}
            </span>
            {writable ? (
              <fetcher.Form method="post">
                <input type="hidden" name="intent" value="delete-reply" />
                <input type="hidden" name="threadId" value={thread.id} />
                <input type="hidden" name="replyId" value={reply.id} />
                <button type="submit" className="underline" data-delete-reply={reply.id}>
                  删除
                </button>
              </fetcher.Form>
            ) : null}
          </div>
          <CommentBody path={reply.path} />
        </div>
      ))}
      {writable ? (
        <fetcher.Form method="post" className="ml-4 space-y-1" data-reply-form={thread.id}>
          <input type="hidden" name="intent" value="reply" />
          <input type="hidden" name="threadId" value={thread.id} />
          <textarea name="body" required rows={2} placeholder="回复（支持 MDX）" className="w-full rounded-md border p-2" />
          <div className="flex items-center justify-between">
            <AuthorSelect asChoices={asChoices} />
            <button type="submit" disabled={fetcher.state !== 'idle'} className="rounded-md border px-2 py-0.5">
              {fetcher.state !== 'idle' ? '写入中…' : '回复'}
            </button>
          </div>
        </fetcher.Form>
      ) : null}
      {fetcher.data && !fetcher.data.ok && 'error' in fetcher.data ? <p data-action-error>{fetcher.data.error}</p> : null}
    </section>
  );
}


/**
 * dev 下刚写入的评论：服务端清单已更新，浏览器里已加载的 .source/browser 还没有它的入口，
 * useContent 会抛「does not exist」；Vite 重新生成入口后整页刷新即恢复。
 * 这里用每条评论一个错误边界兜住这个窗口，不改正文、不碰框架。
 */
class CommentBodyBoundary extends Component<{ path: string; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed) {
      return (
        <p data-comment-pending className="text-xs text-fd-muted-foreground">
          这条评论刚写入，等浏览器拿到编译入口后显示（刷新页面）。
        </p>
      );
    }
    return this.props.children;
  }
}

function CommentBody({ path: commentPath }: { path: string }) {
  return (
    <CommentBodyBoundary key={commentPath} path={commentPath}>
      {commentContent.useContent(commentPath)}
    </CommentBodyBoundary>
  );
}
