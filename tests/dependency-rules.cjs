/**
 * 依赖规则：仓根 `pnpm test:deps` 用它跑 dependency-cruiser，扫 packages/*\/src 与 plugins/*\/src，包之间的方向只由它检查。
 * 规则有三类：没有环、包不依赖 gwb 插件、gwb 插件不 import 包的站点层；功能包之间允许的边（allowedFeatureDependencies）；
 * 包内 src/core|node|site|cli 的分层。方向与分层的来历见 refactor-plan.html 的「功能包」「依赖方向」两节。
 * 没有豁免清单，报出来的每一条都算违规。规则里的路径都相对仓根，从仓根运行。
 * 本仓包之间按包名 import 时解析到对方的 dist/，所以要先 pnpm build 再跑。
 */

/** 功能包（按 packages/ 下的目录名）各自允许依赖的其他功能包；不在表里的边都报错 */
const allowedFeatureDependencies = {
  'god-docsite': [],
  identity: [],
  explainer: [],
  'code-pin': [],
  trajectory: [],
  comments: ['identity'],
  'doc-export': ['code-pin'],
  collab: ['identity', 'comments'],
  report: ['comments'],
  docfirst: ['code-pin', 'doc-export', 'trajectory'],
}
const featurePackages = Object.keys(allowedFeatureDependencies)

const reactPackages = '(react|react-dom|react-router)'
const fumadocsPackages = '(fumadocs-[^/]+|@fumadocs/[^/]+)'
/** 外部包按 node_modules 里的解析路径认；pnpm 的路径形如 node_modules/.pnpm/<id>/node_modules/<包名>/… */
const externalPackagePath = (namePattern) => `(^|/)node_modules/${namePattern}/`
const reactPaths = externalPackagePath(reactPackages)
const fumadocsPaths = externalPackagePath(fumadocsPackages)
/** 本仓包的站点层出口：源码在 src/site|mdx|vite/，构建产物在 dist/site…、dist/mdx…、dist/vite…（trajectory 是 dist/site.mjs、dist/site-server.mjs 这种平铺名） */
const siteLayerPaths = ['^packages/[^/]+/src/(site|mdx|vite)/', '^packages/[^/]+/dist/(site|mdx|vite)([/.-])']

/** 功能包之间不允许的边：from 包的源码 import 了不在白名单里的功能包 */
function featureEdgeRules() {
  return featurePackages.map((name) => {
    const forbiddenTargets = featurePackages.filter((other) => other !== name && !allowedFeatureDependencies[name].includes(other))
    return {
      name: `feature-edge-${name}`,
      comment: `功能包 ${name} 只许依赖：${allowedFeatureDependencies[name].join('、') || '无'}`,
      severity: 'error',
      from: { path: `^packages/${name}/src/` },
      to: { path: `^packages/(${forbiddenTargets.join('|')})/` },
    }
  })
}

module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      comment: '模块之间不许有环',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    {
      name: 'workspace-package-resolvable',
      comment: '本仓包按包名 import 时解析到对方的 dist/：解析不到就看不见这条边，先 pnpm build 再跑 test:deps',
      severity: 'error',
      from: {},
      to: { couldNotResolve: true, path: '^@godcreator/' },
    },
    {
      name: 'no-package-to-gwb-plugin',
      comment: 'packages/ 下的包不许依赖 gwb 插件：本仓 plugins/ 里的，以及 registry 上任何 @godcreator/gwb-*',
      severity: 'error',
      from: { path: '^packages/' },
      to: { path: ['^plugins/', externalPackagePath('@godcreator/gwb-[^/]+')] },
    },
    {
      name: 'feature-src-not-to-god-docsite',
      comment: '任何功能包的 src 不依赖 god-docsite；站点信息由站点经参数传入',
      severity: 'error',
      from: { path: '^packages/[^/]+/src/', pathNot: '^packages/god-docsite/' },
      to: { path: '^packages/god-docsite/' },
    },
    {
      name: 'gwb-plugin-no-site-layer',
      comment: 'gwb 插件跑在工作台的 Node 里，只用包的 . 与 ./node（平台包的 ./scaffold 也在 node 层），不 import 站点层',
      severity: 'error',
      from: { path: '^plugins/[^/]+/src/' },
      to: { path: siteLayerPaths },
    },
    ...featureEdgeRules(),
    {
      name: 'non-site-layer-not-to-other-site-layer',
      comment: 'src/core|node|cli/ 不 import 别的包的站点层出口：那会把 react、fumadocs 带进纯 Node 的使用方',
      severity: 'error',
      from: { path: '^packages/[^/]+/src/(core|node|cli)/' },
      to: { path: '^packages/[^/]+/dist/(site|mdx|vite)([/.-])' },
    },
    {
      name: 'core-no-ui',
      comment: 'src/core/ 是纯逻辑：不 import react 系、fumadocs 系',
      severity: 'error',
      from: { path: '^packages/[^/]+/src/core/' },
      to: { path: [reactPaths, fumadocsPaths] },
    },
    {
      name: 'core-no-node-builtins',
      comment: 'src/core/ 不 import Node 内置模块（node: 前缀或裸名）',
      severity: 'error',
      from: { path: '^packages/[^/]+/src/core/' },
      to: { dependencyTypes: ['core'] },
    },
    {
      name: 'core-not-to-own-node-or-site',
      comment: 'src/core/ 不 import 本包的 node/ 与 site/',
      severity: 'error',
      from: { path: '^packages/([^/]+)/src/core/' },
      to: { path: '^packages/$1/src/(node|site)/' },
    },
    {
      name: 'node-not-to-own-site',
      comment: 'src/node/ 只往 core/ 走，不 import 本包的 site/',
      severity: 'error',
      from: { path: '^packages/([^/]+)/src/node/' },
      to: { path: '^packages/$1/src/site/' },
    },
    {
      name: 'cli-not-to-own-site',
      comment: 'src/cli/ 只用 core/ 与 node/，不 import 本包的 site/',
      severity: 'error',
      from: { path: '^packages/([^/]+)/src/cli/' },
      to: { path: '^packages/$1/src/site/' },
    },
    {
      name: 'node-no-ui',
      comment: 'src/node/ 不 import react 系与 fumadocs 系',
      severity: 'error',
      from: { path: '^packages/[^/]+/src/node/' },
      to: { path: [reactPaths, fumadocsPaths] },
    },
    {
      name: 'site-client-no-node',
      comment: 'src/site/ 里不以 .server.ts(x) 结尾的文件会进浏览器：不 import Node 内置模块与本包 node/',
      severity: 'error',
      from: { path: '^packages/([^/]+)/src/site/', pathNot: '\\.server\\.tsx?$' },
      to: { path: '^packages/$1/src/node/' },
    },
    {
      name: 'site-client-no-node-builtins',
      comment: 'src/site/ 里不以 .server.ts(x) 结尾的文件不 import Node 内置模块',
      severity: 'error',
      from: { path: '^packages/[^/]+/src/site/', pathNot: '\\.server\\.tsx?$' },
      to: { dependencyTypes: ['core'] },
    },
    {
      name: 'trajectory-disk-self-contained',
      comment: '星轨盘画布 trajectory/src/site/disk/ 零依赖：只 import 自己目录里的文件、星轨盘数据模型 src/core/model/ 与 react',
      severity: 'error',
      from: { path: '^packages/trajectory/src/site/disk/' },
      to: { pathNot: ['^packages/trajectory/src/(site/disk|core/model)/', externalPackagePath('react')] },
    },
    {
      name: 'trajectory-model-self-contained',
      comment: '星轨盘数据模型 trajectory/src/core/model/ 只 import 自己目录里的文件：画布依赖它，它也得零依赖',
      severity: 'error',
      from: { path: '^packages/trajectory/src/core/model/' },
      to: { pathNot: '^packages/trajectory/src/core/model/' },
    },
    {
      name: 'cli-no-ui',
      comment: 'src/cli/ 不 import react 系与 fumadocs 系',
      severity: 'error',
      from: { path: '^packages/[^/]+/src/cli/' },
      to: { path: [reactPaths, fumadocsPaths] },
    },
  ],
  options: {
    // 本仓包之间按包名 import，经 pnpm 的链接解析到对方的 dist/：dist/ 要留在依赖图里当终点（不能 exclude），只是不再解析它里面的 import
    doNotFollow: { path: ['(^|/)node_modules/', '^(packages|plugins)/[^/]+/dist/'] },
    tsPreCompilationDeps: true,
    combinedDependencies: false,
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
      mainFields: ['module', 'main', 'types', 'typings'],
      extensions: ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs', '.json', '.d.ts'],
    },
  },
}
