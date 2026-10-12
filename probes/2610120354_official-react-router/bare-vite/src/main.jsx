import { createRoot } from 'react-dom/client';

// 写法一：标准相对路径 glob（官方文档最常见用法）
const standard = import.meta.glob('./pages/*.jsx');

// 写法二：贴近 fumadocs-mdx 生成物的写法（数组 patterns + base；相对 base 在 vite 8.3.4 解析错误，用相对 root 的写法）
const withBase = import.meta.glob(['**/*.jsx'], { base: '/src/pages' });

function App() {
  return (
    <div style={{ fontFamily: 'monospace', padding: 16 }}>
      <h1>bare-vite glob probe</h1>
      <section data-probe="standard">
        <h2>standard glob</h2>
        <ul data-list="standard">
          {Object.keys(standard).map((k) => (
            <li key={k}>{k}</li>
          ))}
        </ul>
      </section>
      <section data-probe="base">
        <h2>base glob</h2>
        <ul data-list="base">
          {Object.keys(withBase).map((k) => (
            <li key={k}>{k}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
