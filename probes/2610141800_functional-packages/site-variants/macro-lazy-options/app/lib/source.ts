import { llms, loader } from 'fumadocs-core/source';
import { defineDocs } from 'fumadocs-mdx/macro';
import { demoPageTreePlugin } from 'demo-pages/site';
import { docsContentRoute, docsRoute } from './shared';

// 对照写法：构建期插件全在 mdxOptions 函数里动态 import。macro 在运行时代码里把整个 defineDocs 调用换掉，
// 这些 import 随之消失，浏览器不会加载它们；写在文件顶部的静态 import 则会留在浏览器代码里
export const docs = defineDocs({
  dir: 'content/docs',
  docs: {
    async: true,
    postprocess: {
      includeProcessedMarkdown: true,
    },
    mdxOptions: async (environment) => {
      const [{ applyMdxPreset }, { default: remarkMath }, { default: rehypeKatex }, { remarkDemoMark }] = await Promise.all([
        import('fumadocs-mdx/config'),
        import('remark-math'),
        import('rehype-katex'),
        import('demo-content/site'),
      ]);
      return applyMdxPreset({
        remarkPlugins: [remarkMath, remarkDemoMark],
        rehypePlugins: (list) => [rehypeKatex, ...list],
      })(environment);
    },
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
