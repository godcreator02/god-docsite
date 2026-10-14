import { applyMdxPreset, defineConfig, defineDocs } from 'fumadocs-mdx/config';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { remarkDemoMark } from 'demo-content/site';

// 全站共用的插件：集合一旦写了自己的 mdxOptions，全局 mdxOptions 对它就不生效（fumadocs-mdx getMDXOptions），
// 所以全站插件要在每个集合的 applyMdxPreset 里再列一次；全局这份只管集合外被 import 的 mdx
const siteRemarkPlugins = [remarkMath];
const siteRehypePlugins = [rehypeKatex];

export default defineConfig({
  mdxOptions: { remarkPlugins: siteRemarkPlugins, rehypePlugins: siteRehypePlugins },
});

export const docs = defineDocs({
  dir: 'content/docs',
  docs: {
    async: true,
    postprocess: {
      includeProcessedMarkdown: true,
    },
    mdxOptions: applyMdxPreset({
      remarkPlugins: [...siteRemarkPlugins, remarkDemoMark],
      rehypePlugins: (list) => [...siteRehypePlugins, ...list],
    }),
  },
});
