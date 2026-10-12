import { useState } from 'react';
import { Link } from 'react-router';
import browserCollections from '../../.source/browser';
import { renderedCollections } from '../lib/collections.server';

// 浏览器正文：走官方生成的 .source/browser 入口，只有 type 层面引用
// source.config.ts 的集合定义，运行时不加载任何 Node-only 插件模块。
const clientA = browserCollections.collectionA.createClientLoader({
  component({ default: Mdx }) {
    return <Mdx />;
  },
});
const clientB = browserCollections.collectionB.createClientLoader({
  component({ default: Mdx }) {
    return <Mdx />;
  },
});

export function loader() {
  return renderedCollections();
}

export default function Home({
  loaderData,
}: {
  loaderData: { a: string; b: string };
}) {
  const [count, setCount] = useState(0);
  const [text, setText] = useState('');

  return (
    <main>
      <h1>docsite-kit 完整功能验证站 · 1.1 基础接线</h1>
      <nav className="site-nav">
        <Link to="/">首页</Link>
        <Link to="/second">第二页</Link>
      </nav>
      <section data-probe="server-a" dangerouslySetInnerHTML={{ __html: loaderData.a }} />
      <section data-probe="server-b" dangerouslySetInnerHTML={{ __html: loaderData.b }} />
      <section data-probe="browser-a">{clientA.useContent('index.mdx')}</section>
      <section data-probe="browser-b">{clientB.useContent('index.mdx')}</section>
      <div className="interaction">
        <button onClick={() => setCount(count + 1)}>计数：{count}</button>
        <input
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="输入点什么"
          aria-label="验证输入框"
        />
      </div>
      <p>已输入：{text || '（空）'}</p>
    </main>
  );
}
