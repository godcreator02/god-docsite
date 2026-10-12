import { index, layout, route, type RouteConfig } from '@react-router/dev/routes'
import { featureRouteFilesOf } from '@godcreator/docsite-kit/routes'
import { featureRoutes } from './site/routes'

/** 功能包的路由：路由模块在功能包里，路径已换成相对 app/ 的真实路径 */
const featureRouteFiles = featureRouteFilesOf(import.meta.dirname, featureRoutes)
const featureIndex = featureRouteFiles.find((each) => 'index' in each)
const pageRoutes = featureRouteFiles.flatMap((each) => ('path' in each ? [each] : []))

export default [
  route('api/search', 'routes/search.ts'),
  route('api/markdown', 'routes/markdown.ts'),
  route('api/content/*', 'routes/content-file.ts'),
  ...pageRoutes.filter((each) => each.layout === false).map((each) => route(each.path, each.file)),
  // 整站布局放在外层路由：跳页时侧栏不重新挂载。* 不匹配根地址 /：首页另用一条 index 路由，功能包给了首页就用它的
  layout('routes/layout.tsx', [
    featureIndex ? index(featureIndex.file) : index('routes/page.tsx', { id: 'home-page' }),
    route('comments', 'routes/all-comments.tsx'),
    ...pageRoutes.filter((each) => each.layout !== false).map((each) => route(each.path, each.file)),
    route('*', 'routes/page.tsx'),
  ]),
] satisfies RouteConfig
