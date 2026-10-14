import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';
import { incrementDemoCounter, type DemoCounterData, type DemoCounterEvent } from '../core/index.js';
import { readDemoCounterFile, writeDemoCounterFile } from '../node/index.js';

// 站点经参数传入的上下文：功能包不 import 站点代码
export interface DemoSiteContext {
  dir: string;
}

// 浏览器脚本在 build/client 里搜这串字，搜到就说明服务端代码漏进了客户端产物
const serverOnlyMarker = 'demo-pages-server-only-marker';

type DemoCounterListener = (event: DemoCounterEvent) => void;
const demoCounterListeners = new Set<DemoCounterListener>();

function publishDemoCounterEvent(event: DemoCounterEvent) {
  for (const listener of demoCounterListeners) listener(event);
}

export async function demoLoader(_args: LoaderFunctionArgs, site: DemoSiteContext): Promise<DemoCounterData> {
  return readDemoCounterFile(site.dir);
}

export async function demoAction({ request }: ActionFunctionArgs, site: DemoSiteContext) {
  const form = await request.formData();
  const intent = form.get('intent');
  if (intent !== 'increment') throw new Response(`${serverOnlyMarker}: 不认识的 intent ${String(intent)}`, { status: 400 });
  const next = incrementDemoCounter(await readDemoCounterFile(site.dir), new Date());
  await writeDemoCounterFile(site.dir, next);
  publishDemoCounterEvent({ count: next.count, updatedAt: next.updatedAt! });
  return { ok: true as const, count: next.count };
}

export function demoEventsLoader({ request }: LoaderFunctionArgs): Response {
  const encoder = new TextEncoder();
  let unsubscribe = () => {};
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const listener: DemoCounterListener = (event) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };
      demoCounterListeners.add(listener);
      unsubscribe = () => demoCounterListeners.delete(listener);
      controller.enqueue(encoder.encode(': connected\n\n'));
      request.signal.addEventListener('abort', () => {
        unsubscribe();
        controller.close();
      });
    },
    cancel() {
      unsubscribe();
    },
  });
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
