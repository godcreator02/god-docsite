import { applyMdxPreset, defineConfig } from 'fumadocs-mdx/config';
import { probeDep } from './app/lib/probe-dep';
import { probePin } from './app/lib/probe-pin';

/**
 * E-2 / E-8：站点自己的 remark 插件经全局 mdxOptions 接进编译，排在默认工序之后、remarkStructure 之前。
 * 写在这里而不是 app/lib/source.ts 的集合 mdxOptions：这个文件只在构建期由 Node 加载，
 * 浏览器端不会解析；插件模块（node:fs）以静态 import 写进 source.ts 会让客户端加载失败、整站
 * hydration 死掉，写成异步函数内动态 import 又会让 fumadocs-mdx 的宏求值报
 * 「Vite module runner has been closed」（E-7 补做时两条都实测过）。
 */
export default defineConfig({
  mdxOptions: applyMdxPreset({ remarkPlugins: [probeDep, probePin] }),
});

import { defineDocs } from 'fumadocs-mdx/config';
import { auditNodePlugin } from './app/lib/audit-node-plugin';
export const auditA = defineDocs({ dir: 'content/audit-a', docs: { mdxOptions: applyMdxPreset({ remarkPlugins: [[auditNodePlugin, { marker: 'A-ONLY-NODE-COMPILED' }]] }) } });
export const auditB = defineDocs({ dir: 'content/audit-b', docs: { mdxOptions: applyMdxPreset({ remarkPlugins: [] }) } });
