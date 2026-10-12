import { useEffect, useState } from 'react';
import { useFetcher } from 'react-router';
import { StableWidget } from '~/components/StableWidget';
import { CommentMdx } from '~/lib/content-components';
import { docsContent } from '~/lib/docs-entry';
import { docsRaw } from '~/lib/content-loaders';
import { createComment, deleteComment, listComments, type CommentSummary } from '~/lib/comments.server';
import { source } from '~/lib/source.server';

// 客户端模块求值计数：HMR 重求值时 window 保留
declare global {
  interface Window {
    __pageModuleEvals?: number;
  }
}
if (typeof window !== 'undefined') {
  window.__pageModuleEvals = (window.__pageModuleEvals ?? 0) + 1;
}

export async function loader() {
  const page = source.getPage([]);
  if (!page) throw new Response('Not Found', { status: 404 });
  return {
    docsPath: page.path,
    comments: await listComments(),
  };
}

export async function action({ request }: { request: Request }) {
  const form = await request.formData();
  const intent = String(form.get('intent') ?? '');
  if (intent === 'new') {
    const body = String(form.get('body') ?? '').trim();
    if (body.length === 0) return { ok: false as const, error: 'empty-body' };
    const created = await createComment(body);
    return { ok: true as const, intent, id: created.id };
  }
  if (intent === 'delete') {
    await deleteComment(String(form.get('id') ?? ''));
    return { ok: true as const, intent };
  }
  return { ok: false as const, error: 'unknown-intent' };
}

export default function Page({ loaderData }: { loaderData: { docsPath: string; comments: CommentSummary[] } }) {
  const [pageIdentity] = useState(() => `page-${Math.random().toString(36).slice(2, 8)}`);
  const [pageCount, setPageCount] = useState(0);
  const [draftComment, setDraftComment] = useState('');
  const [draftInsideForm, setDraftInsideForm] = useState('');
  const [clientEvals, setClientEvals] = useState<number | null>(null);
  const fetcher = useFetcher<typeof action>();
  // 水合后读真实值，SSR 与客户端首渲染一致，避免 hydration mismatch；
  // Fast Refresh 会重跑 effect，刷新后这里会显示新值
  useEffect(() => {
    setClientEvals(window.__pageModuleEvals ?? null);
  }, []);

  return (
    <main data-probe="page" data-identity={pageIdentity} style={{ maxWidth: '48rem', margin: '2rem auto', display: 'grid', gap: '1rem' }}>
      <h1>实验B：Fumadocs 原生评论热更新</h1>
      <p data-probe="module-evals" data-module-evals={clientEvals ?? ''}>
        客户端模块求值次数：{clientEvals ?? '（水合中）'}
      </p>

      <div data-probe="page-counter">
        <button type="button" data-page-count={pageCount} onClick={() => setPageCount((c) => c + 1)}>
          页面组件（default 导出）计数：{pageCount}
        </button>
      </div>

      <StableWidget />

      <label data-probe="draft-independent">
        独立未提交输入（表单外·受控，state 在页面组件）：
        <input
          value={draftInsideForm}
          onChange={(event) => setDraftInsideForm(event.target.value)}
          data-draft-independent
        />
      </label>
      <label data-probe="draft-independent-uncontrolled">
        独立未提交输入（表单外·非受控，纯 DOM 状态）：
        <input data-draft-independent-uncontrolled />
      </label>

      <article data-probe="docs-body">
        {loaderData.docsPath in docsRaw || `./${loaderData.docsPath}` in docsRaw ? (
          docsContent.useContent(loaderData.docsPath)
        ) : (
          <p data-docs-pending>页面正文准备中（浏览器编译入口未到）</p>
        )}
      </article>

      <fetcher.Form method="post" data-probe="new-comment-form" style={{ display: 'grid', gap: '0.5rem' }}>
        <input type="hidden" name="intent" value="new" />
        <label>
          评论正文（受控，state 在页面组件，提交字段）：
          <textarea
            name="body"
            rows={2}
            value={draftComment}
            onChange={(event) => setDraftComment(event.target.value)}
            data-draft-comment
          />
        </label>
        <button type="submit" disabled={fetcher.state !== 'idle'}>
          {fetcher.state !== 'idle' ? '保存中…' : '新增评论'}
        </button>
        {fetcher.data && fetcher.data.ok ? (
          <p data-probe="action-result" data-saved-id={fetcher.data.id ?? ''}>
            已保存（id: {fetcher.data.id ?? '-'}），正文等浏览器编译入口就绪后自动显示。
          </p>
        ) : null}
        {fetcher.data && !fetcher.data.ok ? <p data-probe="action-error">{fetcher.data.error}</p> : null}
      </fetcher.Form>

      <section data-probe="comments" data-comment-count={loaderData.comments.length} style={{ display: 'grid', gap: '1rem' }}>
        {loaderData.comments.map((comment) => (
          <CommentCard key={comment.id} comment={comment} />
        ))}
        {loaderData.comments.length === 0 ? <p data-probe="comments-empty">（还没有评论）</p> : null}
      </section>
    </main>
  );
}

function useIdentity(prefix: string): string {
  const [identity] = useState(() => `${prefix}-${Math.random().toString(36).slice(2, 8)}`);
  return identity;
}

function CommentCard({ comment }: { comment: CommentSummary }) {
  const identity = useIdentity(`comment-${comment.id}`);
  const deleteFetcher = useFetcher<typeof action>();
  return (
    <section data-comment-card={comment.id} data-identity={identity} style={{ border: '1px solid #ccc', padding: '0.75rem', display: 'grid', gap: '0.5rem' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
        <span>
          {comment.author} · {comment.createdAt}
        </span>
        <deleteFetcher.Form method="post">
          <input type="hidden" name="intent" value="delete" />
          <input type="hidden" name="id" value={comment.id} />
          <button type="submit" data-delete-comment={comment.id}>
            删除
          </button>
        </deleteFetcher.Form>
      </header>
      <CommentMdx path={comment.path} />
    </section>
  );
}
