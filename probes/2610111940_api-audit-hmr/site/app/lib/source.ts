import { llms, loader } from 'fumadocs-core/source';
import { defineCollections, defineDocs } from 'fumadocs-mdx/macro';
import { docsContentRoute, docsRoute } from './shared';

export const docs = defineDocs({
  dir: 'content/docs',
  docs: {
    async: true,
    // E-2 的 mdxOptions 挪去了 source.config.ts：插件模块是 Node-only（node:fs），静态 import 写进这个
    // 浏览器端也加载的文件会让客户端加载 node:fs、整站 hydration 失败；异步函数内动态 import 则让
    // fumadocs-mdx 的宏求值报 Vite module runner has been closed。全局配置文件只构建时在 Node 里加载，两条都避开
    // E-8：导出的 _markdown 是组件（机读渲染时组件里的 asMarkdown() 生效）
    postprocess: {
      includeProcessedMarkdown: { output: 'function', headingIds: false },
    },
  },
});

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

