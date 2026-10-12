import { reactRouter } from '@react-router/dev/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import { fumadocsMdx } from 'fumadocs-mdx/vite';
import path from 'node:path';
import fs from 'node:fs';

// 实验插件（workaround，非官方模板内容）：dev 运行中新增/删除 content/docs 下的文件时，
// vite 的 import.meta.glob 对「新增文件」的自动失效在此组合下不工作（见 result.md 第 11–13 节），
// 这里自动对 app/lib/source.ts 做一次原样重写，让它走常规 change 失效路径重新枚举 glob，
// 等价于人工保存一次该文件。
function revalidateSourceOnContentChange() {
  const sourcePath = path.resolve('app/lib/source.ts');
  let lastTouch = 0;
  return {
    name: 'probe-revalidate-source-on-content-change',
    configureServer(server: import('vite').ViteDevServer) {
      const revalidate = (file: string) => {
        if (!file.replaceAll('\\', '/').includes('/content/docs/')) return;
        if (Date.now() - lastTouch < 250) return;
        lastTouch = Date.now();
        fs.writeFileSync(sourcePath, fs.readFileSync(sourcePath));
      };
      server.watcher.on('add', revalidate);
      server.watcher.on('unlink', revalidate);
    },
  };
}

export default defineConfig({
  plugins: [fumadocsMdx(), tailwindcss(), revalidateSourceOnContentChange(), reactRouter()],
  resolve: {
    tsconfigPaths: true,
  },
});
