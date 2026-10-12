import { existsSync } from 'node:fs'
import path from 'node:path'
import type { FeatureRoute, FeatureRoutes } from './feature.js'
import { installedPackageDirOf } from './package-dirs.js'

/**
 * 骨架的 routes.ts 用：功能包给的路由文件（相对包根）换成相对 app/ 的路径。
 * 要用真实路径：pnpm 的 node_modules/<包> 是符号链接，写链接路径时 react-router build 找不到打包出的文件，
 * 也认不出它是路由模块、不剥掉 loader 引用的服务端代码
 */
export function featureRouteFilesOf(appDir: string, features: ReadonlyArray<{ name: string } & FeatureRoutes>): FeatureRoute[] {
  const siteDir = path.dirname(appDir)
  const files = features.flatMap(({ name, routes }) => {
    const packageDir = installedPackageDirOf(siteDir, name)
    return routes.map((route) => {
      const file = path.join(packageDir, route.file)
      if (!existsSync(file)) throw new Error(`${name} 的路由文件 ${route.file} 不在包里`)
      return { ...route, file: path.relative(appDir, file).replaceAll('\\', '/') }
    })
  })
  const indexes = files.filter((each) => 'index' in each)
  if (indexes.length > 1) throw new Error(`首页只能有一个，功能包给了 ${indexes.length} 个：${indexes.map((each) => each.file).join('、')}`)
  return files
}
