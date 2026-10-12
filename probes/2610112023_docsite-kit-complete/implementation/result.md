# 任务 B 交付结果：1.1 基础验证站

日期：2026-10-11。执行环境：pwsh 7（Node 24.14.1、pnpm 12.4.2）。只写入
`probes/2610112023_docsite-kit-complete/site/` 与 `implementation/`，未动原实验、
生产包、插件、site 自述站与其他仓；未提交、未发布、未改正式包版本。

## 改动文件清单（全部新建）

站点（`../site/`）：

| 文件 | 作用 |
| --- | --- |
| `package.json` | 私有包 `docsite-kit-complete-site`；目标版本组合（见下） |
| `pnpm-workspace.yaml` | 让 pnpm 把本目录当 workspace 根，隔离 docsite-kit 仓根 workspace |
| `vite.config.ts` | `fumadocsMdx()` + `reactRouter()`；`cacheDir: '.probe-vite-cache'` |
| `react-router.config.ts` | `ssr: true` |
| `tsconfig.json` | 照已通过样本：bundler 解析、strict、rootDirs 含 `.react-router/types` |
| `source.config.ts` | `defineDocs` 命名集合 collectionA / collectionB，各自 `docs.mdxOptions`（A 挂 Node 插件，B 空数组）；全局 `defineConfig({})` 只放共同设置 |
| `app/lib/node-marker-remark.ts` | Node-only remark 插件：`node:fs.readFileSync` 真实读 `package.json`，正文追加 `A-ONLY-NODE-COMPILED` |
| `app/lib/collections.server.ts` | `.server.ts` 后缀；从 `.source/server` 取集合、`renderToStaticMarkup` 渲染，只被 loader 调用 |
| `app/root.tsx`、`app/routes.ts` | React Router 框架模式最小入口；两条路由 |
| `app/routes/home.tsx` | 首页：server-a/server-b（loaderData HTML）+ browser-a/browser-b（`.source/browser` 的 `createClientLoader`+`useContent`）+ 计数按钮 + 输入框 + 站内导航 |
| `app/routes/second.tsx` | 第二页：B 集合 browser 正文 + 本页计数 + 返回导航 |
| `app/app.css` | 极简样式（无 tailwind / base-ui，1.2 再引） |
| `content/collection-a/index.mdx`、`content/collection-b/index.mdx` | 两集合正文 |
| `README.md` | 复跑说明 |

实现记录（`implementation/`）：本文件、`handoff.json`、`logs/`（安装、版本、
dev、SSR HTML、类型检查日志与 PID 记录）。

生成物（gitignore，不入清单）：`site/node_modules/`（本目录自有容器，257 包全部
从本机 store 硬链接）、`site/.source/`、`site/.react-router/`、`site/.probe-vite-cache/`。

## 实际解析版本（pnpm list --depth 0，02-versions.log）

| 包 | 版本 | 说明 |
| --- | --- | --- |
| fumadocs-core | 16.17.1 | 目标组合 |
| fumadocs-mdx | 15.4.7 | 目标组合（精确锁定） |
| vite | 8.3.4 | 目标组合（精确锁定） |
| react-router / @react-router/node / @react-router/dev | 8.4.0 | 目标组合 |
| react / react-dom | 19.3.0 | 与复核样本一致 |
| typescript | 7.0.2 | |
| @types/node | 24.19.2 | |

`@fumadocs/base-ui` 未安装：本轮最小接线不需要 UI 布局，留 1.2（布局导航）引入，
避免装而不用。`react-router dev` 首次启动自动往 `package.json` 写入 `"isbot": "^5"`
（框架自身行为，未手动改任何版本声明；gwb-release 规则本轮用不上——没有升版本、
没有改正式包依赖）。

## 实跑命令与退出码

| 命令 | 结果 |
| --- | --- |
| `pnpm install`（site 目录） | 退出码 0，8.8s，257 包，01-install.log |
| `pnpm list --depth 0` | 退出码 0，02-versions.log |
| `react-router dev --port 5460 --host 127.0.0.1 --strictPort`（经 `pnpm dev` 后台启动，pwsh PID 67788，见 dev-pid.txt） | 启动成功，`http://127.0.0.1:5460`，03-dev.log |
| `Invoke-WebRequest http://127.0.0.1:5460/` | 200，SSR HTML 存 04-ssr-home.html |
| `Invoke-WebRequest http://127.0.0.1:5460/second` | 200，05-ssr-second.html |
| `pnpm types:check`（`react-router typegen && tsc --noEmit`） | 退出码 0，06-types-check.log |
| `taskkill /PID 67788 /T /F` | 整树终止（6 个进程），端口 5460 释放 |

## 浏览器验证（真实交互，ZCode 内置浏览器 IAB）

证据为会话内的 DOM 快照与真实点击/输入，逐项如下：

1. **正文四段齐全**：首页 DOM 快照里 server-a、browser-a 两段均含
   「A 集合正文…」+ `A-ONLY-NODE-COMPILED` 标记段；server-b、browser-b 均只含
   「B 集合正文…」、无标记。说明 A 的 Node 插件在编译期真实执行（readFileSync
   成功且加了标记），B 集合不受影响；server 与 browser 两个生成入口渲染一致。
2. **按钮计数（hydration）**：刷新后单次点击「计数：0」→「计数：1」；
   第二页「本页计数：0」→1→2。SSR 输出是静态 HTML，计数变化证明客户端
   React 接管成功。
3. **输入框**：`fill("probe-input-123")` 后页面出现「已输入：probe-input-123」。
4. **站内导航**：点击「第二页」链接 URL 变为 `/second`、第二页内容正确；
   再点「首页」回到 `/`，h1 与 A 标记（2 段）恢复。客户端路由导航，无整页刷新报错。

环境备注（非站点缺陷）：IAB 后端的 Playwright click 对部分元素反复卡在
actionability 等待（含中文 accessible name 的定位与部分导航后的点击），
超时期间一次可见的副作用是某次重试叠加使计数跳到 4；随后刷新页面单次点击复核
为 0→1，确认按钮行为正确。链接与部分按钮改用坐标点击（`cua.click`，同为真实
输入事件）完成，全部成功。此现象已如实记录，供主会话复验时留意。

## 未验证项（属于 1.2 及以后，本轮不做）

- 内容增删、改名、新建 JSON、HMR 状态保持（E-5/E-7 已知问题，1.2/1.5 处理）。
- TSX/HTML 页面类型、写作组件、布局导航、搜索、术语。
- 评论、身份与写入边界、feeds 推送链。
- `build` / `start`（快照模式）——按派单避免生产全站 build。
- `@fumadocs/base-ui` 布局集成（1.2）。
- 多页站点、大站构建、产物体积（原复核也未覆盖）。

## 遗留进程 / 端口

无。dev 进程树（PID 67788 及其 5 个子进程）已全部终止，端口 5460 已确认空闲
（Get-NetTCPConnection 无监听）。浏览器验证标签页已关闭。后台任务的 failed
退出码是 `taskkill /F` 终止的预期结果。

## 复跑入口

单一复跑命令与检查命令见 `../site/README.md`；机器可读摘要见 `handoff.json`。
