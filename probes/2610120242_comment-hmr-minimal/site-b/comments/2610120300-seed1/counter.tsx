'use client';

import { useState } from 'react';

/** 评论文件夹里的交互组件：点一下计数加一。它在正文（Renderer 子树）内，计数归零说明正文子树重挂 */
export function Counter() {
  const [count, setCount] = useState(0);
  return (
    <button
      type="button"
      data-comment-counter
      data-comment-count={count}
      onClick={() => setCount((c) => c + 1)}
    >
      评论内组件点击次数：{count}
    </button>
  );
}
