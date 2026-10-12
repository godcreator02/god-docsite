import { index, route, type RouteConfig } from '@react-router/dev/routes';

export default [
  index('routes/home.tsx'),
  // 具名前缀的路由先注册，splat 内容页放最后
  route('api/search', 'routes/api.search.ts'),
  route('api/markdown', 'routes/api.markdown.ts'),
  route('api/content/*', 'routes/api.content.$.ts'),
  route('*', 'routes/page.tsx'),
] satisfies RouteConfig;
