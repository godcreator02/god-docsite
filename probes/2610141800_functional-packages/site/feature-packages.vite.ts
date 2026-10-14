import path from 'node:path';
import type { Plugin } from 'vite';
import { crawlFrameworkPkgs } from 'vitefu';

const fumadocsPeerNames = ['fumadocs-core', '@fumadocs/base-ui'];

export function declaresFumadocsPeer(packageJson: Record<string, any>): boolean {
  const peers: Record<string, string> = packageJson.peerDependencies ?? {};
  return fumadocsPeerNames.some((name) => name in peers);
}

// 功能包要和站点走同一条 Vite 处理链：不预构建（浏览器端与站点共用一份 fumadocs）、SSR 不外置（服务端同理）；
// 它们的 CommonJS 依赖以「功能包 > 依赖」进预构建。识别只看依赖的 package.json，不写包名单
function featurePackagesConfig(): Plugin {
  return {
    name: 'site:feature-packages',
    async config(userConfig, env) {
      if (process.env.PROBE_DISABLE_FEATURE_PACKAGES_PLUGIN === '1') return;
      const crawled = await crawlFrameworkPkgs({
        root: userConfig.root ?? process.cwd(),
        isBuild: env.command === 'build',
        viteUserConfig: userConfig,
        isFrameworkPkgByJson: declaresFumadocsPeer,
      });
      if (process.env.PROBE_PRINT_FEATURE_PACKAGES === '1') {
        console.log(`[feature-packages] ${JSON.stringify(crawled)}`);
      }
      return {
        optimizeDeps: crawled.optimizeDeps,
        ssr: crawled.ssr,
      };
    },
  };
}

const serverOnlyModulePattern = /\.server(\.[cm]?[jt]sx?)?$|\/\.server\//;

// React Router 的 .server 检查拿解析结果整串匹配（以 .server.js 结尾）。dev 下 Vite 给 node_modules 里不预构建的包
// 加 ?v= 版本查询，装进 node_modules 的功能包的 .server 模块就漏检了；build 下没有查询，React Router 照常拦。
// 这里去掉查询再查一遍，只补 dev 下漏掉的那一种
function featurePackagesDotServerGuard(): Plugin {
  return {
    name: 'site:feature-packages-dot-server-guard',
    apply: 'serve',
    enforce: 'pre',
    async resolveId(id, importer, options) {
      if (process.env.PROBE_DISABLE_DEV_DOT_SERVER_GUARD === '1') return;
      if (this.environment.name !== 'client' || ('scan' in options && options.scan) || !importer) return;
      if (options.custom?.['site:dot-server-guard']) return;
      const resolved = await this.resolve(id, importer, { ...options, custom: { ...options.custom, 'site:dot-server-guard': true } });
      if (!resolved || !resolved.id.includes('?')) return;
      if (!serverOnlyModulePattern.test(resolved.id.split('?')[0]!)) return;
      const importerFromRoot = path.relative(this.environment.config.root, importer.split('?')[0]!).replaceAll('\\', '/');
      throw new Error(`Server-only module referenced by client\n\n    '${id}' imported by '${importerFromRoot}'\n`);
    },
  };
}

export function featurePackages(): Plugin[] {
  return [featurePackagesConfig(), featurePackagesDotServerGuard()];
}
