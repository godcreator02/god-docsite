import { applyMdxPreset, defineConfig, defineDocs } from 'fumadocs-mdx/config';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { remarkDemoMark } from 'demo-content/site';

// 对照写法：公式插件只放全局 defineConfig，集合只放功能包的插件
export default defineConfig({
  mdxOptions: { remarkPlugins: [remarkMath], rehypePlugins: [rehypeKatex] },
});

export const docs = defineDocs({
  dir: 'content/docs',
  docs: {
    async: true,
    postprocess: {
      includeProcessedMarkdown: true,
    },
    mdxOptions: applyMdxPreset({
      remarkPlugins: [remarkDemoMark],
    }),
  },
});
