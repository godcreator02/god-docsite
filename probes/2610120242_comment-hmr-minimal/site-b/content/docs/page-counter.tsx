import { useState } from 'react';

/** 正文同目录的自写交互组件：点一下计数加一，用来观察正文子树状态 */
export function PageCounter() {
  const [count, setCount] = useState(0);
  return (
    <button
      type="button"
      data-docs-counter
      data-docs-count={count}
      onClick={() => setCount((c) => c + 1)}
    >
      正文内组件点击次数：{count}
    </button>
  );
}
