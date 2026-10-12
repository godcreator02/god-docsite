import { useState } from 'react';
import { Link } from 'react-router';
import browserCollections from '../../.source/browser';

const clientB = browserCollections.collectionB.createClientLoader({
  component({ default: Mdx }) {
    return <Mdx />;
  },
});

export default function Second() {
  const [count, setCount] = useState(0);

  return (
    <main>
      <h1>第二页</h1>
      <nav className="site-nav">
        <Link to="/">首页</Link>
        <Link to="/second">第二页</Link>
      </nav>
      <section data-probe="second-browser-b">{clientB.useContent('index.mdx')}</section>
      <div className="interaction">
        <button onClick={() => setCount(count + 1)}>本页计数：{count}</button>
      </div>
    </main>
  );
}
