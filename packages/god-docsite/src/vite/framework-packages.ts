import { readFile } from 'node:fs/promises'
import path from 'node:path'
import type { Plugin } from 'vite'
import { crawlFrameworkPkgs, findDepPkgJsonPath } from 'vitefu'

const fumadocsPeerNames = ['fumadocs-core', '@fumadocs/base-ui']

/** 本包浏览器端代码 import 的 peer 依赖：本包不预构建，Vite 扫描不进来，不点名就要等打开页面才发现、整页刷新 */
const browserPeersOfPlatform = ['katex', 'lucide-react']

/**
 * 不变式：React、React Router 与 fumadocs 的上下文在一个站里只能有一份；包按 link: 装进来时它们会从包自己的目录解析出另一份。
 * lucide-react 的图标组件用 useContext：从包目录解析出的那份带着另一份 React，dev 下服务端渲染报 Invalid hook call
 */
const dedupedPackages = ['react', 'react-dom', 'react-router', 'fumadocs-core', '@fumadocs/base-ui', 'lucide-react']

type PackageJson = Record<string, unknown>

function exportsSite(packageJson: PackageJson): boolean {
  const exports = packageJson['exports']
  return typeof exports === 'object' && exports !== null && './site' in exports
}

/**
 * 要和站点走同一条 Vite 处理链的包：peerDependencies 里有 fumadocs-core 或 @fumadocs/base-ui（平台与用 fumadocs 的功能包），
 * 或者照功能包的分层导出了 ./site（身份、评论这类不用 fumadocs 的功能包）
 */
export function isSitePackage(packageJson: PackageJson): boolean {
  const peers = (packageJson['peerDependencies'] ?? {}) as Record<string, string>
  return fumadocsPeerNames.some((name) => name in peers) || exportsSite(packageJson)
}

/**
 * 功能包（导出 ./site 的包）自己的依赖写成「包 > 依赖」进预构建：功能包不预构建，Vite 扫描不进去；vitefu 只替其中的 CommonJS 包写，
 * ESM 的（如 react-markdown、unified）要等浏览器打开页面才发现，重新预构建后整页刷新，刷新前已加载的模块引用旧的预构建产物而报错。
 * 站点包与去重的包不写：前者不预构建，后者按站点根目录解析
 */
export function featureDependencyIncludes(featurePackages: ReadonlyArray<{ name: string; packageJson: PackageJson }>, sitePackageNames: ReadonlySet<string>): string[] {
  return featurePackages.flatMap(({ name, packageJson }) => {
    if (!exportsSite(packageJson)) return []
    const dependencies = Object.keys((packageJson['dependencies'] ?? {}) as Record<string, string>)
    return dependencies.filter((dependency) => !sitePackageNames.has(dependency) && !dedupedPackages.includes(dependency)).map((dependency) => `${name} > ${dependency}`)
  })
}

async function packageJsonsOf(names: readonly string[], root: string): Promise<Array<{ name: string; packageJson: PackageJson }>> {
  const found = await Promise.all(
    names.map(async (name) => {
      const file = await findDepPkgJsonPath(name, root)
      return file === undefined ? [] : [{ name, packageJson: JSON.parse(await readFile(file, 'utf8')) as PackageJson }]
    }),
  )
  return found.flat()
}

/**
 * 站点包要和站点走同一条 Vite 处理链：不预构建（浏览器端与站点共用一份 fumadocs 与 React 上下文）、SSR 不外置（服务端同理），
 * 它们自己的依赖以「包 > 依赖」进预构建。只看依赖的 package.json，不写包名单。
 * 不这样做时，从 registry 装的包被 Node 直接加载，拿到另一份 fumadocs-core，服务端渲染报 FrameworkProvider 缺失；
 * SSR 外置的包还会在 React Router 收集 dev 样式时被浏览器那边的依赖预构建当成新依赖，首次打开页面整页刷新
 */
export function frameworkPackages(): Plugin {
  return {
    name: 'god-docsite:framework-packages',
    async config(userConfig, env) {
      const root = path.resolve(userConfig.root ?? process.cwd())
      const crawled = await crawlFrameworkPkgs({ root, isBuild: env.command === 'build', viteUserConfig: userConfig, isFrameworkPkgByJson: isSitePackage })
      const sitePackageNames = new Set(crawled.optimizeDeps.exclude)
      const featureIncludes = featureDependencyIncludes(await packageJsonsOf([...sitePackageNames], root), sitePackageNames)
      const include = [...new Set([...crawled.optimizeDeps.include, ...featureIncludes, ...browserPeersOfPlatform])]
      return {
        optimizeDeps: { include, exclude: crawled.optimizeDeps.exclude },
        ssr: crawled.ssr,
        resolve: { dedupe: dedupedPackages },
      }
    },
  }
}
