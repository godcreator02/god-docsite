'use client';

import { useState } from 'react';

/**
 * 独立纯组件模块（实验A2的更新目标）：
 * 它是普通客户端 React 组件，改它验证标准 React Fast Refresh 保不保状态。
 */
export function StableWidget() {
  const [count, setCount] = useState(0);
  const [identity] = useState(() => `widget-${Math.random().toString(36).slice(2, 8)}`);
  return (
    <div data-probe="widget-counter" data-identity={identity}>
      <button type="button" data-widget-count={count} onClick={() => setCount((c) => c + 1)}>
        独立模块组件计数（v2）：{count}
      </button>
    </div>
  );
}
