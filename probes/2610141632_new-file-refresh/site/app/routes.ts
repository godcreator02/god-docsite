import { index, route, type RouteConfig } from '@react-router/dev/routes'

// 方案 E 的路由只在测 E 时挂上：它把 @fumadocs/mdx-remote 整套编译器带进服务端模块图，会拖慢别的方案的服务端重载
const requestCompileRoutes = process.env.PROBE_REQUEST_COMPILE === '1' ? [route('remote/*', 'routes/remote.tsx')] : []

export default [
  index('routes/home.tsx'),
  route('docs/*', 'routes/docs.tsx'),
  route('journal', 'routes/journal-index.tsx'),
  route('journal/:date', 'routes/journal-page.tsx'),
  ...requestCompileRoutes,
] satisfies RouteConfig
