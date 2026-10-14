import { llms, loader } from 'fumadocs-core/source';
import { defineDocs } from 'fumadocs-mdx/macro';
import { applyMdxPreset } from 'fumadocs-mdx/config';
import { remarkDemoMark } from 'demo-content/site';
import { demoPageTreePlugin } from 'demo-pages/site';
import { docsContentRoute, docsRoute } from './shared';

// 对照写法：公式插件只放在 vite.config.ts 的 fumadocsMdx({ globalOptions })，集合只放功能包的插件
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

export const source = loader({
  source: docs.toFumadocsSource(),
  baseUrl: docsRoute,
  plugins: [demoPageTreePlugin({ name: '演示', url: '/demo' })],
});

export const docsLlms = llms(source, {
  renderPage: async (page) => `# ${page.data.title} (${page.url})

${await page.data.getText('processed')}`,
});
