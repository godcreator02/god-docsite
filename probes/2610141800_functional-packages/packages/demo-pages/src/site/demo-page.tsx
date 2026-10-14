import { useEffect, useState } from 'react';
import { Link, useFetcher, useLoaderData, useResolvedPath } from 'react-router';
import { usePathname } from 'fumadocs-core/framework';
import type { DemoCounterData, DemoCounterEvent } from '../core/index.js';

// 推送地址约定为页面路由下的 events 子路径，由站点的 routes.ts 声明。
// 数据用 useLoaderData 取、不靠 props：转发文件写 export { DemoPage as default } from 时，React Router 不给它包 withComponentProps，props 里没有 loaderData
export function DemoPage() {
  const loaderData = useLoaderData<DemoCounterData>();
  const fetcher = useFetcher();
  const pathname = usePathname();
  const eventsPath = useResolvedPath('events').pathname;
  const [hydrated, setHydrated] = useState(false);
  const [eventSourceOpen, setEventSourceOpen] = useState(false);
  const [lastPushedEvent, setLastPushedEvent] = useState<DemoCounterEvent | null>(null);

  useEffect(() => setHydrated(true), []);

  useEffect(() => {
    const eventSource = new EventSource(eventsPath);
    eventSource.addEventListener('open', () => setEventSourceOpen(true));
    eventSource.addEventListener('message', (message) => setLastPushedEvent(JSON.parse(message.data) as DemoCounterEvent));
    return () => eventSource.close();
  }, [eventsPath]);

  return (
    <main className="demo-page" data-demo-page="" data-hydrated={hydrated ? 'yes' : 'no'}>
      <h1>演示页（demo-pages 功能包）</h1>
      <p>
        文件里的计数：<span data-demo-count="">{loaderData.count}</span>
      </p>
      <p>
        fumadocs 看到的路径：<span data-demo-pathname="">{pathname}</span>
      </p>
      <p>
        推送：<span data-demo-sse-state="">{eventSourceOpen ? 'open' : 'connecting'}</span>，最近一次计数
        <span data-demo-pushed-count="">{lastPushedEvent ? lastPushedEvent.count : '-'}</span>
      </p>
      <fetcher.Form method="post">
        <input type="hidden" name="intent" value="increment" />
        <button type="submit" data-demo-increment="" disabled={fetcher.state !== 'idle'}>
          加一并写回文件
        </button>
      </fetcher.Form>
      <p>
        <Link to="/docs" data-demo-back="">回到文档</Link>
      </p>
    </main>
  );
}
