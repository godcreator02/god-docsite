import { useState } from 'react';

/** 评论串文件夹里自己的组件：评论正文 import 它用（dev 下经 Vite 按需转换） */
export function Dot() {
  const [count, setCount] = useState(0);
  return (
    <button type="button" onClick={() => setCount(count + 1)} style={{ borderRadius: 9999, width: 28, height: 28, border: '2px solid #1f6feb', padding: 0 }}>
      {count}
    </button>
  );
}
