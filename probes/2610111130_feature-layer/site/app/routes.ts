import { realpathSync } from 'node:fs'
import path from 'node:path'
import { index, layout, route, type RouteConfig } from '@react-router/dev/routes'
import { featureRoutes } from '@probe/feature/routes'

/** 包里的路由模块换成真实路径（pnpm 的 node_modules/<包> 是符号链接），仍写成相对 app/ 的路径 */
const appDir = import.meta.dirname
const realFileOf = (file: string) => path.relative(appDir, realpathSync(path.resolve(appDir, file))).replaceAll('\\', '/')

export default [
  route('api/search', 'routes/search.ts'),
  route('api/content/*', 'routes/content-file.ts'),
  route('api/comments', 'routes/comments.ts'),
  layout('routes/layout.tsx', [
    index('routes/page.tsx', { id: 'home-page' }),
    route('comments', 'routes/all-comments.tsx'),
    ...featureRoutes.map(({ path: routePath, file }) => route(routePath, realFileOf(file))),
    route('*', 'routes/page.tsx'),
  ]),
] satisfies RouteConfig
