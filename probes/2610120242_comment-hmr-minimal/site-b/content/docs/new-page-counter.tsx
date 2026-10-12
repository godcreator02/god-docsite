import { useState } from 'react';

/** 新页正文同目录的自写交互组件：点一下计数加一 */
export function NewPageCounter() {
  const [count, setCount] = useState(0);
  return (
    <button
      type="button"
      data-docs-counter
      data-docs-count={count}
      onClick={() => setCount((c) => c + 1)}
    >
      新页组件点击次数：{count}
    </button>
  );
}
