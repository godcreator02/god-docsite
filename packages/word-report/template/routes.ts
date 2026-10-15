import { relative, type RouteConfig } from '@react-router/dev/routes'

const { route } = relative(import.meta.dirname)

// 地址与 site.server.ts 的 reportHrefBase 一致；参数名 report、* 是 reportPageLoader、reportAssetLoader 读的
export default [
  route('reports', './list.tsx'),
  route('reports/:report', './report.tsx'),
  route('reports/:report/assets/*', './asset.ts'),
] satisfies RouteConfig
