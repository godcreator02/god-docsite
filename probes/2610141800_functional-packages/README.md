pnpm install && node scripts/run-all.mjs

# 2610141800_functional-packages：功能包怎样原生地接进 fumadocs 官方 React Router 模板

## 问什么

站点 = fumadocs 官方 React Router 模板 + 按功能切分的功能包。功能包不放路由模块、不 import 站点代码、
不给 `@react-router/dev` 打补丁，只经 fumadocs 与 React Router 原生的扩展点接进站点——这条路在 dev 与
build + start（react-router-serve）下、在 workspace 链接与「从 registry 装进 node_modules」两种装法下都走得通吗？
逐项要回答的六个问题与结论见 `result.md`。

## 怎么运行

第一行那条命令跑全部验证（约 25 分钟），在实验目录下运行；Windows、pwsh 7 与 Node 24 下验过。它会：

1. 构建两个功能包（`packages/*/dist`）
2. 依次换两种装法：`linked`（`workspace:*`）、`packed`（`pnpm pack` 出 tarball 再按 `file:` 装，包的真实路径在
   `node_modules/.pnpm` 下，模拟从 registry 装）；每换一次运行一遍 `pnpm install`
3. 每种装法、每种集合写法下，dev 与 build + start 各起一次服务，用 Playwright（headless Chromium）跑 `scripts/browser-checks.mjs`
   的检查；build 后搜 `build/client` 的产物
4. 另外几项：`react-router typegen` + `tsc`、`.server` 检查的反例（有无站点插件里的 dev 补查各一次）、页面路由直接 re-export loader、不挂站点 vite 插件的对照、全局插件对照、功能包页面预渲染对照
5. 结束时恢复成 `linked` 装法与推荐的集合写法（`config`），数据文件重置成 0

只跑一部分：`node scripts/run-all.mjs --install=packed --collections=config --server=dev,start --extras=typegen`
（`--extras` 可选 `typegen,dot-server,reexport-loader,no-plugin,global-only,prerender-feature-page`，写 `--extras=` 表示不跑）。
服务端口固定 5691（dev）与 5692（start），启动前先确认端口空闲，被占就报错退出；服务按端口轮询等就绪，
每格结束都停掉整棵进程树。

看某个模块经 Vite 客户端编译后的 import：`node scripts/inspect-client-module.mjs <记录名> /app/features/demo/demo.tsx`。单独复现「dev 下写站点目录里的文件引起整页刷新」：`node scripts/reload-cause.mjs <记录名>`（app.css 去掉
`@source not '../data'` 那行再跑一次即可看到刷新）。

每次运行的全部输出在 `runs/<运行时刻>/`：每格的服务日志、构建日志、`report.json`（全部检查项与结论）。

## 目录

| 路径 | 内容 |
| --- | --- |
| `site/` | 官方模板快照（`probes/2610120354_official-react-router/official-snapshot/`）+ 本实验的接线；`git diff --no-index` 对照快照即可看到全部改动 |
| `site-variants/` | 集合的五种写法（`config` 推荐；`macro`、`macro-lazy-options`、两种 `*-global-only` 是对照），脚本把选中的一种覆盖进 `site/` |
| `packages/demo-content/` | 正文类功能包：remark 插件、MDX 组件（点击计数，内含 CommonJS 依赖 `ms` 与 fumadocs 的 `usePathname`）、样式 |
| `packages/demo-pages/` | 页面类功能包：`.server.ts` 里的 loader/action（读写站点目录的 JSON）、SSE 推送 loader、页面组件、页面树插件、`template/` 转发文件 |
| `scripts/` | `run-all.mjs`（总入口）、`browser-checks.mjs`（浏览器检查）、`setup.mjs`（换装法、换集合写法）、`lib.mjs`（起停服务、日志）、`reload-cause.mjs`、`inspect-client-module.mjs` |
| `patches/vite@8.3.4.patch` | 仓根同名补丁的副本（Windows 上 glob 的缺陷，与本实验无关）；不打 `@react-router/dev` 补丁 |
| `runs/` | 每次运行的原始记录，按运行时刻分目录，试错的中间运行也留着 |

## 结论

六项在两种装法、dev 与 build + start 下全部原生跑通，不打 React Router 补丁（最终运行 `runs/20261014-1022/`，推荐写法 0 项失败）。
前提有六个：集合用 Config API（`source.config.ts`）而不是 macro，全站插件在集合里再列一次；功能包页面组件用 `useLoaderData` 取数据；
站点 vite 插件用 vitefu 按 peer 依赖识别功能包（packed 装法下不挂就有两份 fumadocs）；同一个插件在 dev 下补查带 `?v=` 的 `.server` 模块
（React Router 自己的检查在 packed 装法的 dev 下漏检）；`app.css` 用 `@source not` 排除功能包写数据的目录；预渲染不收功能包的路由。
详见 `result.md`。

## 运行那次的环境

2026-10-14，Windows 11，Node v24.14.1，pnpm 12.4.2；fumadocs-core 16.17.1、@fumadocs/base-ui 16.17.1、fumadocs-mdx 15.4.7、
react-router / @react-router/dev 8.4.0、vite 8.3.4（打仓根的 glob 补丁）、vitefu 1.1.3、tailwindcss 4.3.3、
Playwright 1.62.0（Chromium 151）。被测仓 god-docsite 分支 `refactor/functional-packages`，起点提交 `ffe905e`。
