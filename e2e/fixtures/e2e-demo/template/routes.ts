import { relative, type RouteConfig } from '@react-router/dev/routes'

const { route } = relative(import.meta.dirname)

/** 嵌在整站布局里的页面 */
export default [route('e2e-demo', './page.tsx'), route('e2e-demo/notes/:slug', './note.tsx')] satisfies RouteConfig

/** 整站布局之外的页面：占满窗口、不带侧栏 */
export const standaloneRoutes = [route('e2e-demo/full', './full.tsx')] satisfies RouteConfig
