import { reactRouter } from '@react-router/dev/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, type Plugin } from 'vite';
import { fumadocsMdx } from 'fumadocs-mdx/vite';
import { copyContentAssetsToBuild } from '@probe/page-sources/server';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const contentDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'content');

/**
 * build 收尾时把 content 里可被 /api/content/ 服务的文件（HTML 页面与页面引用的图片、字体等资产）
 * 复制成客户端静态资产：start 下这些地址由静态文件接管，正文/资源与构建时的标题、搜索索引来自同一份快照；
 * dev 下没有这批静态文件，由 api.content 路由读 content 源目录
 */
function copyContentAssets(): Plugin {
  return {
    name: 'copy-content-assets',
    apply: 'build',
    async closeBundle() {
      if (this.environment.name !== 'client') return;
      const copied = await copyContentAssetsToBuild(contentDir, this.environment.config.build.outDir);
      console.log(`[copy-content-assets] ${copied.length} 个文件进产物：${copied.join(', ')}`);
    },
  };
}

export default defineConfig({
  plugins: [fumadocsMdx(), tailwindcss(), copyContentAssets(), reactRouter()],
  resolve: { tsconfigPaths: true },
});
