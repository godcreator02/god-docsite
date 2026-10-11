# E-4 观察记录（2026-10-11，日志 14–18）

lib：`lib/` 下的 ESM 包 `@probe/pin-lib`，tsc 构建出 `dist/index.js`（对 `fumadocs-ui/contexts/tree`
保持外部 import），`fumadocs-ui`、`react` 是 peerDependencies；站点用 `file:../lib` 引用。
组件 `LibTreeProbe` 调 `useTreeContext()`——宿主 `DocsLayout` 提供 Provider；
不是同一份 fumadocs-ui 模块时 `use(TreeContext)` 得 null，抛 "You must wrap this component under <DocsLayout />"。
组件放在 `/docs` 路由的 `DocsLayout` 内。`vite.config.ts` 用环境变量 `PROBE_NO_EXTERNAL` 切换
`ssr.noExternal: ['@probe/pin-lib']`。

| 情况 | 结果 |
| --- | --- |
| dev，不加 noExternal | **500**。SSR 渲染抛 "You must wrap this component under <DocsLayout />"；堆栈走 `.pnpm/@probe+pin-lib@file+…/dist/index.js`，fumadocs-ui 解析到 lib 的 peer 副本（`.pnpm/@fumadocs+base-ui@16.17.1_@_e09b…`，与站点的实例 hash 不同）——Context 双实例（runs/14-e4-dev-noext.log） |
| dev，加 noExternal | **200**，组件渲染成功：`data-probe="lib-tree" data-root="root"`（runs/15-e4-dev-ext.log） |
| build，不加 | **构建失败**：prerender `/docs/` 时同样的 Provider 错，500，exit 1（runs/16-e4-build-noext.log） |
| build 加 + start | **正常**：build exit 0，start(4447) 下 `/docs` SSR 与浏览器 hydration 都正常，组件显示「库组件读到的页面树：2 个顶层节点，当前根 Docs」，无错误兜底页（runs/17、18） |

结论：**有条件成立——构建好的普通库要和站点共用同一份 fumadocs 的 React 上下文，`ssr.noExternal`（点名这个库）仍然必须**：
不加时 dev 直接 500、build 在 prerender 就红；加了以后 dev、build+start、客户端全部正常。
K-04 里 `docsite()` 的这部分（对基础包等库点名 noExternal）需要保留。
