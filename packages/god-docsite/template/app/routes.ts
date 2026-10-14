import { index, layout, route, type RouteConfig } from '@react-router/dev/routes'

export default [
  route('api/search', 'routes/search.ts'),
  route('api/markdown', 'routes/markdown.ts'),
  route('api/content/*', 'routes/content-file.ts'),
  route('llms.txt', 'routes/llms.ts'),
  route('llms-full.txt', 'routes/llms-full.ts'),
  route('__docsite/feed/:channel', 'routes/feed.ts'),
  // 整站布局放在外层：跳页时侧栏不重新挂载。功能包的页面路由（app/features/<包>/routes.ts）展开在 * 前面
  layout('routes/layout.tsx', [
    index('routes/page.tsx', { id: 'home' }),
    route('comments', 'routes/comments.tsx'),
    route('*', 'routes/page.tsx'),
  ]),
] satisfies RouteConfig
