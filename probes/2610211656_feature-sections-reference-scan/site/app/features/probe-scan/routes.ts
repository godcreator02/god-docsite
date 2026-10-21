import { relative, type RouteConfig } from '@react-router/dev/routes'

const { route } = relative(import.meta.dirname)

/** 量引用扫描：/__probe/scan 回这一次扫描的结果与耗时，?cold=1 先清语法树缓存 */
export const standaloneRoutes = [route('__probe/scan', './scan.ts')] satisfies RouteConfig
