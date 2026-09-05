/**
 * 站侧的全部接线都在这一个文件——跟 fumadocs-site 那份一样的两处（mdxOptions / docs 集合），
 * 多一个 trajectory 集合：卡目录就是本站的 cards/（不像 docs-site 要跨到单元根）。
 */
import { applyMdxPreset, defineConfig, defineDocs } from 'fumadocs-mdx/config';
import { livedocMdxOptions, livedocMarkdownOptions } from '@godcreator02/live-doc-format-fumadocs';
import { cardSchema, remarkTrajectoryLinks } from '@godcreator02/live-doc-trajectory/server';

export const docs = defineDocs({
  dir: 'content/docs',
  docs: {
    postprocess: { includeProcessedMarkdown: livedocMarkdownOptions() },
  },
});

export const trajectory = defineDocs({
  dir: 'cards',
  docs: {
    schema: cardSchema,
    mdxOptions: applyMdxPreset({
      remarkPlugins: (v) => [...v, [remarkTrajectoryLinks, { hrefBase: '/trajectory' }]],
    }),
  },
});

export default defineConfig({
  // 类型要求完整 options（含 themes），运行时会 merge 默认值——cast 只在这一处
  mdxOptions: livedocMdxOptions({ root: process.cwd() }) as never,
});
