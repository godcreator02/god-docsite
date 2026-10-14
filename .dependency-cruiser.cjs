/**
 * 依赖规则：`pnpm depcheck` 跑 dependency-cruiser，扫 packages/*\/src 与 plugins/*\/src。
 * 规则分两类：现有代码现在就要守的（没有环、包不依赖 gwb 插件），以及目标结构的规则——
 * 功能包的 src/core|node|site|cli 分层与功能包之间允许的边。目标结构的目录还没建出来时这些规则没有匹配，
 * 下一阶段的包一建出来就生效。目标结构见 refactor-plan.html 的「功能包」「依赖方向」两节。
 * 建规则时已有的环记在 .dependency-cruiser-known-violations.json（depcheck 带 --ignore-known），
 * 新出现的环照样报错；表里的环修掉后用 depcruise-baseline 重新生成这份表。
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
      comment: '本仓包按包名 import 时解析到对方的 dist/：解析不到就看不见这条边，先 pnpm build 再跑 depcheck',
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
    ...featureEdgeRules(),
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
      name: 'cli-no-ui',
      comment: 'src/cli/ 不 import react 系与 fumadocs 系',
      severity: 'error',
      from: { path: '^packages/[^/]+/src/cli/' },
      to: { path: [reactPaths, fumadocsPaths] },
    },
  ],
  options: {
    // 本仓包之间按包名 import，经 pnpm 的链接解析到对方的 dist/：dist/ 要留在图里当终点（不能 exclude），只是不往里走
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
