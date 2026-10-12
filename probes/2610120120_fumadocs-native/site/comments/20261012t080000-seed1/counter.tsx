'use client';

import { useState } from 'react';

/** 评论文件夹里的交互组件：点一下计数加一 */
export function Counter() {
  const [count, setCount] = useState(0);
  return (
    <button
      type="button"
      data-comment-counter
      onClick={() => setCount((c) => c + 1)}
      className="rounded-md border px-3 py-1"
    >
      评论内组件点击次数：{count}
    </button>
  );
}
