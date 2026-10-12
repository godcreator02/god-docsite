import { reactRouter } from '@react-router/dev/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import { fumadocsMdx } from 'fumadocs-mdx/vite';

/**
 * index.target：'default' 让生成的 .source/server.ts、browser.ts 用静态枚举的 import
 * 列出集合文件，不再写 import.meta.glob + 相对 base。相对 base 的 glob 在本机
 * Windows + Vite 8.3.4 上算出错误的绝对匹配路径，集合文件新增后进不了清单
 * （probes/2610112023_docsite-kit-complete/review/20261012-0008-root-cause.md）。
 * 'default' 目标由 fumadocs-mdx 自己的 watcher 在集合文件增删时重新生成入口文件。
 * 该选项在公开类型 IndexFilePluginOptions 里，官网文档未写明，分级与实测见 result.md。
 *
 * ssr.noExternal：@probe/comments-model 直接发布 TS 源码，SSR 端要经 Vite 转换
 * 而不是被当外部依赖交给 Node。
 */
export default defineConfig({
  ssr: { noExternal: ['@probe/comments-model'] },
  plugins: [fumadocsMdx({ index: { target: 'default' } }), tailwindcss(), reactRouter()],
  resolve: { tsconfigPaths: true },
});
