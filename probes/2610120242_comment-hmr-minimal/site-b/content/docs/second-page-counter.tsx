import { useState } from 'react';

/** 第二篇新增正文同目录的自写交互组件：点一下计数加一 */
export function SecondPageCounter() {
  const [count, setCount] = useState(0);
  return (
    <button
      type="button"
      data-docs-counter
      data-docs-count={count}
      onClick={() => setCount((c) => c + 1)}
    >
      第二篇组件点击次数：{count}
    </button>
  );
}
