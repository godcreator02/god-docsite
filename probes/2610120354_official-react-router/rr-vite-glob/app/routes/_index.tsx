// 与 bare-vite 实验相同的两种写法；pages 在 app/pages/
const standard = import.meta.glob('../pages/*.jsx');
const withBase = import.meta.glob(['**/*.jsx'], { base: '../pages' });

// 第三种：贴近 fumadocs-mdx 生成物的形态（mdx/md 模式 + base + query），无 fumadocs 插件
const fumadocsShaped = import.meta.glob(['**/*.{mdx,md}'], {
  base: '../content',
  query: { collection: 'docs' },
});

export default function Index() {
  return (
    <div style={{ fontFamily: 'monospace', padding: 16 }}>
      <h1>rr-vite glob probe (SSR)</h1>
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
      <section data-probe="fumadocs-shaped">
        <h2>fumadocs-shaped glob</h2>
        <ul data-list="fumadocs">
          {Object.keys(fumadocsShaped).map((k) => (
            <li key={k}>{k}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
