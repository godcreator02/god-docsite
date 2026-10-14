import { index, route, type RouteConfig } from '@react-router/dev/routes';
import { demoRoutes } from './features/demo/routes';

export default [
  index('routes/home.tsx'),
  route('docs/*', 'routes/docs.tsx'),
  route('api/search', 'routes/search.ts'),
  route('og/docs/*', 'routes/og.docs.tsx'),

  // LLM integration:
  route('llms.txt', 'llms/index.ts'),
  route('llms-full.txt', 'llms/full.ts'),
  route('llms.mdx/docs/*', 'llms/mdx.ts'),

  // 功能包的页面：转发文件在 app/features/<包>/，由建站器从包的 template/ 复制
  ...demoRoutes,

  route('*', 'routes/not-found.tsx'),
] satisfies RouteConfig;
