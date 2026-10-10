import { index, layout, route, type RouteConfig } from '@react-router/dev/routes'

export default [
  route('api/search', 'routes/search.ts'),
  route('api/content/*', 'routes/content-file.ts'),
  route('api/comments', 'routes/comments.ts'),
  // 整站布局放在外层路由：跳页时侧栏不重新挂载。* 不匹配根地址 /，首页另用一条 index 路由交给同一个页面文件
  layout('routes/layout.tsx', [index('routes/page.tsx', { id: 'home-page' }), route('*', 'routes/page.tsx')]),
] satisfies RouteConfig
