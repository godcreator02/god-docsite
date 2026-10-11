import { reactRouter } from '@react-router/dev/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, type Plugin } from 'vite';
import { fumadocsMdx } from 'fumadocs-mdx/vite';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * E-2：addDependency 登记目录不触发目录内容的增删，这里用 Vite 插件桥接——
 * 目录里 add/unlink 时伪造一次被钉文件的 change 事件，走 Vite 正常的失效链
 */
function probeDirWatch(): Plugin {
  const siteRoot = fileURLToPath(new URL('.', import.meta.url));
  const dir = resolve(siteRoot, 'pinned/dir');
  const pinnedFile = resolve(siteRoot, 'pinned/a.ts');
  return {
    name: 'probe-dir-watch',
    configureServer(server) {
      server.watcher.add(dir);
      const relay = (file: string) => {
        if (!file.startsWith(dir)) return;
        server.watcher.emit('change', pinnedFile);
      };
      server.watcher.on('add', relay);
      server.watcher.on('unlink', relay);
    },
  };
}

// E-4：环境变量 PROBE_NO_EXTERNAL=1 时给 SSR 加 noExternal
// （构建好的库是否要它才能与站点共用同一份 fumadocs 的 React 上下文）
export default defineConfig(
  process.env.PROBE_NO_EXTERNAL
    ? {
        ssr: { noExternal: ['@probe/pin-lib'] },
        plugins: [fumadocsMdx(), tailwindcss(), probeDirWatch(), reactRouter()],
        resolve: { tsconfigPaths: true },
      }
    : {
        plugins: [fumadocsMdx(), tailwindcss(), probeDirWatch(), reactRouter()],
        resolve: { tsconfigPaths: true },
      },
);
