'use client';

import { useState } from 'react';

/** 独立纯组件模块：普通客户端 React 组件，fumadocs 链下改它验证标准 Fast Refresh 行为 */
export function StableWidget() {
  const [count, setCount] = useState(0);
  const [identity] = useState(() => `widget-${Math.random().toString(36).slice(2, 8)}`);
  return (
    <div data-probe="widget-counter" data-identity={identity}>
      <button type="button" data-widget-count={count} onClick={() => setCount((c) => c + 1)}>
        独立模块组件计数：{count}
      </button>
    </div>
  );
}
