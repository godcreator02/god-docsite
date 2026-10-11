import { llms, loader } from 'fumadocs-core/source';
import { defineCollections, defineDocs } from 'fumadocs-mdx/macro';
import { applyMdxPreset } from 'fumadocs-mdx/config';
import { docsContentRoute, docsRoute } from './shared';
import { probeDep } from './probe-dep';
import { probePin } from './probe-pin';

export const docs = defineDocs({
  dir: 'content/docs',
  docs: {
    async: true,
    // E-2：站点自己的 remark 插件经 mdxOptions 接进集合，排在默认工序之后、remarkStructure 之前；
    // probePin 是 E-8/E-1 的原型钉码插件
    mdxOptions: applyMdxPreset({ remarkPlugins: [probeDep, probePin] }),
    // E-8：导出的 _markdown 是组件（机读渲染时组件里的 asMarkdown() 生效）
    postprocess: {
      includeProcessedMarkdown: { output: 'function', headingIds: false },
    },
  },
});

// E-7：gwb 推给站点的数据写成 feeds/ 下的文件，站点当集合读（feeds/ 不进 git）。
// fumadocs-mdx 15.4.7 的 defineCollections({ type: 'meta' }) 单独使用是坏的：宏展开成
// runtime.meta({ base, meta })，运行时却读 args.entries（dist/runtime/macro.js），Object.entries(undefined) 直接 500；
// defineDocs 内置的 meta 集合不受影响（它读 args.meta）。这里手写宏的展开形式：eager glob，条目形状与 meta 集合一致。
export const feeds = {
  entries: Object.entries(import.meta.glob('/feeds/*.json', { eager: true, import: 'default' })).map(
    ([path, data]) => ({ info: { path }, ...data }),
  ),
};

// E-3：评论集合，一个评论串一个文件夹，文件夹里允许 .tsx
export const comments = defineCollections({ type: 'doc', dir: 'comments', async: true });

export const source = loader({
  source: docs.toFumadocsSource(),
  baseUrl: docsRoute,
});

export const docsLlms = llms(source, {
  renderPage: async (page) => `# ${page.data.title} (${page.url})

${await page.data.getText('processed')}`,
});
