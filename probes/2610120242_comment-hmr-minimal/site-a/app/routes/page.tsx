import { useEffect, useState } from 'react';
import { useFetcher } from 'react-router';
import { StableWidget } from '~/components/StableWidget';
import { addItem, listItems, removeItem, type Item } from '~/lib/data.server';

// 客户端模块求值计数：HMR 重求值时 window 保留，页面上直接显示模块被重新执行了几次
declare global {
  interface Window {
    __pageModuleEvals?: number;
  }
}
if (typeof window !== 'undefined') {
  window.__pageModuleEvals = (window.__pageModuleEvals ?? 0) + 1;
}

export async function loader() {
  return { items: await listItems() };
}

export async function action({ request }: { request: Request }) {
  const form = await request.formData();
  const intent = String(form.get('intent') ?? '');
  if (intent === 'new') {
    const text = String(form.get('text') ?? '').trim();
    if (text.length === 0) return { ok: false as const, error: 'empty-text' };
    const item = await addItem(text);
    return { ok: true as const, intent, id: item.id };
  }
  if (intent === 'delete') {
    await removeItem(String(form.get('id') ?? ''));
    return { ok: true as const, intent };
  }
  return { ok: false as const, error: 'unknown-intent' };
}

export default function Page({ loaderData }: { loaderData: { items: Item[] } }) {
  const [pageIdentity] = useState(() => `page-${Math.random().toString(36).slice(2, 8)}`);
  const [pageCount, setPageCount] = useState(0);
  const [draftOutsideForm, setDraftOutsideForm] = useState('');
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
      <h1>实验A：服务端模块热更新下的页面状态（A3）</h1>
      <p data-probe="module-evals" data-module-evals={clientEvals ?? ''}>
        客户端模块求值次数：{clientEvals ?? '（水合中）'}
      </p>

      <div data-probe="page-counter">
        <button type="button" data-page-count={pageCount} onClick={() => setPageCount((c) => c + 1)}>
          页面组件（default 导出）计数：{pageCount}
        </button>
      </div>

      <InlineCounter />

      <StableWidget />

      <label data-probe="draft-outside-form">
        受控草稿（state 在页面组件，表单外）：
        <input
          value={draftOutsideForm}
          onChange={(event) => setDraftOutsideForm(event.target.value)}
          data-draft-outside
        />
      </label>

      <fetcher.Form method="post" data-probe="new-item-form" style={{ display: 'grid', gap: '0.5rem' }}>
        <input type="hidden" name="intent" value="new" />
        <label>
          受控草稿（state 在页面组件，输入框在 fetcher.Form 里）：
          <input
            value={draftInsideForm}
            onChange={(event) => setDraftInsideForm(event.target.value)}
            data-draft-inside
          />
        </label>
        <label>
          非受控草稿（纯 DOM 状态，在 fetcher.Form 里，与 N 线的 textarea 同形态）：
          <input name="text" data-draft-uncontrolled />
        </label>
        <button type="submit" disabled={fetcher.state !== 'idle'}>
          {fetcher.state !== 'idle' ? '保存中…' : '新增一条'}
        </button>
        {fetcher.data && fetcher.data.ok ? (
          <p data-probe="action-result" data-saved-id={fetcher.data.id ?? ''}>
            已保存（id: {fetcher.data.id ?? '-'}），fetcher 状态：{fetcher.state}
          </p>
        ) : null}
        {fetcher.data && !fetcher.data.ok ? <p data-probe="action-error">{fetcher.data.error}</p> : null}
      </fetcher.Form>

      <section data-probe="items" data-item-count={loaderData.items.length}>
        {loaderData.items.map((item) => (
          <ItemRow key={item.id} item={item} />
        ))}
        {loaderData.items.length === 0 ? <p data-probe="items-empty">（还没有条目）</p> : null}
      </section>
    </main>
  );
}

function useIdentity(prefix: string): string {
  const [identity] = useState(() => `${prefix}-${Math.random().toString(36).slice(2, 8)}`);
  return identity;
}

/** 同文件命名函数组件：Fast Refresh 的标准可保留形态 */
function InlineCounter() {
  const identity = useIdentity('inline');
  const [count, setCount] = useState(0);
  return (
    <div data-probe="inline-counter" data-identity={identity}>
      <button type="button" data-inline-count={count} onClick={() => setCount((c) => c + 1)}>
        同文件命名组件计数：{count}
      </button>
    </div>
  );
}

function ItemRow({ item }: { item: Item }) {
  const identity = useIdentity(`item-${item.id}`);
  const deleteFetcher = useFetcher<typeof action>();
  return (
    <div data-item={item.id} data-identity={identity} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
      <span>{item.text}</span>
      <deleteFetcher.Form method="post">
        <input type="hidden" name="intent" value="delete" />
        <input type="hidden" name="id" value={item.id} />
        <button type="submit" data-delete-item={item.id}>
          删除
        </button>
      </deleteFetcher.Form>
    </div>
  );
}
