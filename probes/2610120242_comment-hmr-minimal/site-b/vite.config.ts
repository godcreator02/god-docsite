import { reactRouter } from '@react-router/dev/vite';
import { defineConfig } from 'vite';
import { fumadocsMdx } from 'fumadocs-mdx/vite';

// 交付形态：index: { target: 'default' }。对照结论（同一份渲染代码，只切这一个变量）：
// - 默认接线（不设 index.target）：生成的 .source 用 import.meta.glob + 相对 base，本机
//   Windows + Vite 8.3.4 下新增 docs MDX 无任何 watcher/HMR 事件，导航不更新、直开新 URL 404
//   （33 秒轮询实测，见 docs-add-result.md）。
// - default：静态枚举 + 插件 watcher 重新生成入口，新增页约 300ms 出现在导航。
export default defineConfig({
  plugins: [fumadocsMdx({ index: { target: 'default' } }), reactRouter()],
  resolve: { tsconfigPaths: true },
});
