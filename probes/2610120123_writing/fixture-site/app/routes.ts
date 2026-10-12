import { index, layout, route, type RouteConfig } from '@react-router/dev/routes'

export default [
  index('routes/home.tsx'),
  // 整站布局（含侧栏）放在外层路由：跳页时侧栏不重新挂载；DocsPage 的面包屑也要这个上下文
  layout('routes/shell.tsx', [
    route('docs/*', 'routes/docs-page.tsx'),
    route('notes/*', 'routes/notes-page.tsx'),
    route('tex', 'routes/tex-demo.tsx'),
  ]),
] satisfies RouteConfig
