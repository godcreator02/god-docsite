import { reactRouter } from '@react-router/dev/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import { fumadocsMdx } from 'fumadocs-mdx/vite';

export default defineConfig({
  cacheDir: '.probe-vite-cache',
  // 评论包与身份包经 link: 链到本站（本站是独立的 pnpm workspace，与仓根的 React 不是同一份物理实例），
  // dedupe 强制这两个包里的 react 也从本站解析，避免出现两份 React 实例
  resolve: { dedupe: ['react', 'react-dom'] },
  plugins: [tailwindcss(), fumadocsMdx(), reactRouter()],
});
