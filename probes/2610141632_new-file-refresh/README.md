pnpm install && pnpm run setup && pnpm run measure && node scripts/measure-docs-site.mjs && pnpm run summarize

# 2610141632_new-file-refresh：dev 运行中新增内容文件，几种刷新方案实测对比

问题：站点跑 dev，新写入的正文页、日志、评论、轨迹卡要尽快出现：新地址能打开，已打开的页面也要自动更新。
Windows 上 Vite 解析 `import.meta.glob` 的相对 base 有缺陷，fumadocs-mdx 生成的集合代码正好是这种写法，
所以原版 vite 下新文件不会被发现（成因见 `../2610121018_vite-add-discovery/result.md`）。这里把几种修法放在同一个实验站上比快慢。

结论与数据见 `result.md`，逐轮原始数据在 `results/*.json`，汇总表在 `results/summary.md`。

## 实验站

`site/` 用 fumadocs 官方 React Router 模板的同一套版本（fumadocs-core 16.17.1、fumadocs-mdx 15.4.7、react-router 8.4.0、vite 8.3.4），
集合接法与 docsite-kit 骨架同形：正文与评论走 Config API（`.source/server.ts`、`.source/browser.ts`），日志走 macro（`app/lib/journal.ts`）。

`pnpm run setup` 把 `site/` 复制成两个独立安装根：

- `.work/original`：原版 vite
- `.work/patched`：挂上 docsite-kit 仓根的 `patches/vite@8.3.4.patch`

两个目录都被 gitignore 排除。环境变量 `PROBE_FIX` 选择修复插件（`site/vite.config.ts`），`PROBE_TREE_KEY=1` 打开「树标识」补法（`site/app/routes/docs.tsx`），
`PROBE_REQUEST_COMPILE=1` 挂上方案 E 的路由。

| 方案 | 做法 | 代码 |
| --- | --- | --- |
| original | 原版 vite，不修 | — |
| A-vite-patch | vite 补丁（仓里现状） | `.work/patched` |
| B-rewrite-base | vite 插件把 fumadocs 生成的相对 base 改写成以 `/` 开头 | `site/plugins/rewrite-relative-glob-base.ts` |
| C-hot-update | vite 插件在新增或删除内容文件时把集合模块补进热更新列表 | `site/plugins/invalidate-collections.ts` |
| C+full-reload | C，再让浏览器整页刷新 | 同上，`reloadClient: true` |
| C+tree-id / A+tree-id | C 或 A，loader 把页面树根节点 `$id` 换成内容摘要 | `site/app/routes/docs.tsx` |
| D1-process-restart | 测量脚本发现新文件就杀掉并重启开发服务进程 | `scripts/measure.mjs` |
| D2-vite-restart | vite 插件发现新文件就调 `server.restart()` | `site/plugins/restart-on-content-add.ts` |
| E-request-compile | 不用集合，每次请求读目录、用 @fumadocs/mdx-remote 现场编译 | `site/app/routes/remote.tsx` |

## 怎么测

`scripts/measure.mjs` 对每个方案、每种规模（20 页、300 页）、每类内容（正文页、日志、评论）重复多轮：
用本机 Edge（playwright-core 的 `msedge` 通道，不下载浏览器）打开观察页，写入新文件，同时记两个时间：

- 新地址返回 200 且内容里有新文件的标记：每 50 毫秒请求一次
- 已打开的页面里出现新文件：等页面里出现新链接或新评论；超时后再手动刷新一次，记下刷新后出没出现

`site/plugins/probe-diagnostics.ts` 把文件监视事件、热更新模块列表、发出的热更新消息打到 dev 日志（`results/logs/`）。
`scripts/measure-docs-site.mjs` 在真实的 `docs-site` 上测正文页与轨迹卡（仓里现状，即方案 A），只写 `probe-*` 临时文件，测完删掉。

注意：测量时开发服务占端口 5610（实验站）与 5620（docs-site）；中途中断会在 `.work/*/content`、`docs-site/content/future/spec`、
`docs-site/trajectory` 留下 `probe-*` 文件，重跑脚本开始时会自动清掉。
