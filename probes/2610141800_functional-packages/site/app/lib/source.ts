import { llms, loader } from 'fumadocs-core/source';
import { demoPageTreePlugin } from 'demo-pages/site';
import { docs } from '../../.source/server';
import { docsRoute } from './shared';

export const source = loader({
  source: docs.toFumadocsSource(),
  baseUrl: docsRoute,
  plugins: [demoPageTreePlugin({ name: '演示', url: '/demo' })],
});

export const docsLlms = llms(source, {
  renderPage: async (page) => `# ${page.data.title} (${page.url})

${await page.data.getText('processed')}`,
});
