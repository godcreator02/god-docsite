import path from 'node:path'
import type { Plugin } from 'vite'
import { crawlFrameworkPkgs } from 'vitefu'

const fumadocsPeerNames = ['fumadocs-core', '@fumadocs/base-ui']

/** 本包浏览器端代码 import 的 peer 依赖：本包不预构建，Vite 扫描不进来，不点名就要等打开页面才发现、整页刷新 */
const browserPeersOfPlatform = ['katex', 'lucide-react']

/**
 * 要和站点走同一条 Vite 处理链的包：peerDependencies 里有 fumadocs-core 或 @fumadocs/base-ui（平台与用 fumadocs 的功能包），
 * 或者照功能包的分层导出了 ./site（身份、评论这类不用 fumadocs 的功能包）
 */
export function isSitePackage(packageJson: Record<string, unknown>): boolean {
  const peers = (packageJson['peerDependencies'] ?? {}) as Record<string, string>
  const exports = packageJson['exports']
  const exportsSite = typeof exports === 'object' && exports !== null && './site' in exports
  return fumadocsPeerNames.some((name) => name in peers) || exportsSite
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
      const crawled = await crawlFrameworkPkgs({
        root: path.resolve(userConfig.root ?? process.cwd()),
        isBuild: env.command === 'build',
        viteUserConfig: userConfig,
        isFrameworkPkgByJson: isSitePackage,
      })
      return {
        optimizeDeps: { include: [...crawled.optimizeDeps.include, ...browserPeersOfPlatform], exclude: crawled.optimizeDeps.exclude },
        ssr: crawled.ssr,
        // 不变式：React、React Router 与 fumadocs 的上下文在一个站里只能有一份；包按 link: 装进来时它们会从包自己的目录解析出另一份
        resolve: { dedupe: ['react', 'react-dom', 'react-router', 'fumadocs-core', '@fumadocs/base-ui'] },
      }
    },
  }
}
