# result.md：评论 dev 热更新最小独立实验（S 线）

日期：2026-10-12。派单目标：一页包含稳定计数器、未提交输入框、可新增/删除的 MDX 评论，
验证「稳定页面组件 + 原生 MDX 热更新 + 正文入口就绪后显示」。**用户中途收住实验**（重新审视
「评论是否需要与热开发配合」的需求），本文件保存已得到的对照证据并如实列出未验证项，
不为交付制造结论。

## 结论摘要

**N 线的「无公开无损解」结论在最小样本上不成立。** 同一套 React Router 8.4.0 + fumadocs-mdx
15.4.7 基线，用公开 API（`browserCollections.<name>.raw` 预查入口 + 原生 HMR 更新重渲染）即可做到：

- 新增评论：POST → 「已保存」反馈 → 卡片先渲染「正文准备中」占位 → 原生 HMR 到达后**自动脱离占位**、
  正文（含 MDX 粗体、评论内 TSX 组件）渲染出来。**全程零 console 错误、无整页刷新**（两轮实测）。
- 页面级状态（页面组件与独立模块组件的 `useState`、受控输入值、`useRef`、DOM 容器身份）在
  **所有实验场景下都保留**——包括 N 判定「必重挂」的 SSR 模块图失效链。

真实丢失的只有两类，边界都已精确定位（见 C）：

1. `fetcher.Form` 子树的**非受控 DOM 状态**（N 的草稿 textarea 正是这个形态）；
2. 评论**正文子树内**的组件状态（Renderer 换实例导致重挂）。

## 对 N 线两处推理跳跃的核对结果

主会话点名的两处，都有源码与实测双重证据：

1. **「reloadModule → 整树 remount」是跳跃**。`@react-router/dev` 8.4.0 的
   `react-router-server-change-trigger-client-hmr` 对客户端 route 模块 `reloadModule` 后，
   更新走 route 模块 footer 注入的 `import.meta.hot.accept` →
   `RefreshRuntime.validateRefreshBoundaryAndEnqueueUpdate`（`refresh-utils.mjs`，非组件导出有白名单，
   loader/action 在客户端 bundle 里本来就被剔除）→ `router.revalidate()` + `performReactRefresh()`。
   react-refresh 对组件做**原位更新**：路由组件引用保留旧值（refresh-utils 里有明确注释
   "react-refresh takes care of updating these in-place"），实例与 hooks state 不动。
   实测（A1 两轮、B 两轮提交）：route 模块每次重求值（页面上的模块求值计数 +1），但组件
   `data-identity`、计数器值、受控草稿、`timeOrigin` 全部不变——**模块重求值 ≠ 组件重挂**。
2. **`raw` 查询本来就有**。fumadocs-mdx 15.4.7 的 `DocCollectionEntry.raw`（`dist/runtime/browser.d.ts`
   公开类型）就是「集合相对路径 → 加载器」映射，default-target 生成的 key 与 `useContent(path)`
   同格式。预查 `raw[path]` 未到就渲染占位，`createClientLoader` 的同步 throw 完全不会发生，
   无需等上游提供 `has(path)`。

另两处主会话点名核对的机制，实测确认：

- **`fetcher.Form` 的 useMemo**（`react-router` 8.4.0 `lib/dom/lib.js`：`useMemo(() => forwardRef(...), [fetcherKey])`，
  `fetcherKey` 默认 `useId()`）：route 模块经 SSR 失效链重求值后，form 元素被替换（旧节点 `isConnected=false`），
  但 `fetcherKey` 与组件 state 保留——即 **Form 组件类型换了、hooks 没丢**。受控输入值恢复、非受控 DOM 值丢失。
- **`createClientLoader` 内部 Renderer**（`dist/runtime/browser.js`：`renderers` 缓存在 `createClientLoader`
  闭包里，模块重求值即换实例）：Renderer 类型换 → **仅正文子树重挂**（评论内 counter 归零），容器 DOM
  （`docs-body` article、评论卡片 section 的 data-identity）不变。与顶层路由卸载是两回事。

## A：纯 React Router 站点（无 fumadocs）

页面探针：页面组件（default 导出）计数、同文件命名组件计数、独立模块组件计数、受控草稿（表单外/
表单内各一）、非受控草稿（在 `fetcher.Form` 里，与 N 的 textarea 同形态）、每层 DOM `data-identity`、
模块求值计数、`timeOrigin`。全部为真实浏览器操作（点击、输入），采样经页面内脚本。

| 对照 | 触发 | 结果 |
| --- | --- | --- |
| A1（×2 轮） | 更新 `app/lib/data.server.ts`（纯服务端模块，加注释行） | 客户端 route 模块重求值（计数 +1）；**页面/同文件/独立模块三个计数器、全部 identity、受控草稿、timeOrigin 全保留**；`fetcher.Form` 元素被替换（旧 form `isConnected=false`），**非受控草稿清空**；无 console 错误 |
| A2 | 更新 `app/components/StableWidget.tsx`（客户端组件模块） | 标准 Fast Refresh：文案更新、计数保留、**连 form DOM 都不换**（无任何丢失） |
| A3 | 更新 `app/routes/page.tsx` 本身（h1 文案） | route 模块重求值 ×3；**一切保留（含 form DOM 与非受控草稿）**。与 A1 同为「route 模块重求值」，来源不同结果不同：SSR 失效链（reloadModule）换 form DOM，文件自身变化的 HMR 不换 |
| A4 | 表单提交新增条目（action 写 `data/items.json`） | 写**数据文件**不触发任何模块更新：条目渲染、「已保存」反馈、全部状态保留（含非受控草稿）。这是 B 站写 MDX（模块文件）的基线对照 |

dev 日志（A1）：`(client) hmr update /app/routes/page.tsx` + `(ssr) page reload app/lib/data.server.ts`，
与 N 的对照实验日志一致——**同样的日志、不同的结论**：N 据此判定整树 remount，实测组件树未动。

## B：Fumadocs 原生集合站点（核心验证）

接线：`source.config.ts` 两个 async 集合（docs / comments），`index.target: 'default'`；loader 只给
评论元数据（文件系统扫描）；正文经 `client-content.tsx` 的官方 `createClientLoader`，渲染前用
`comments.raw[path]` 预查，未到显示「正文准备中」占位；`Suspense` 包正文首次加载。

| 对照 | 结果 |
| --- | --- |
| B1（第一次提交） | POST → 已保存反馈 → 新卡片渲染、**MDX 粗体正文渲染**（`<strong>`）、零 console 错误、timeOrigin 不变、无 pending 卡死。200ms 采样粒度内一帧完成（中间态在 B2 补获） |
| B2（第二次提交） | 完整时序：帧1 卡片+「正文准备中」占位出现（无 throw）；帧2（+200ms）HMR 到达，占位脱离、页面计数保留；帧4（+600ms）正文渲染。页面状态保留与丢失项同 A1：**受控草稿在、非受控草稿丢、种子评论内 counter 3→0（Renderer 子树重挂）**；route 模块重求值 +4/次提交 |
| 状态总表 | 保留：页面组件计数、独立模块计数、受控草稿（表单内外）、页面/卡片容器 identity、`timeOrigin`。丢失：`fetcher.Form` 内非受控 DOM 值、评论正文子树内组件状态 |

## C：失稳边界识别（A 过、B 的页面状态也过，丢的是什么）

- **边界一：`fetcher.Form` 组件类型**。SSR 失效链触发的 route 模块重求值后 Form 类型更换，
  form 子树 DOM 重建。**受控值不丢**（state 在页面组件）；非受控 DOM 值丢。N 的「草稿丢失」
  完整机制即此——把草稿做成受控（state 在表单外的稳定组件里）即可保住。
- **边界二：`createClientLoader` 的 Renderer**。模块重求值换实例 → Renderer 类型换 → 仅正文子树
  重挂（评论内交互组件 state 归零）。**页面其余部分不受影响**。编辑器、稳定页面 UI、正文入口
  （`client-content.tsx`）已按「合理分开」组织（页面组件 / 正文入口模块 / 服务端模块各自独立文件），
  实测稳定 UI 无恙，无需 HMR 状态总线。
- 观察记录：B 站 dev 长时间运行（多轮写删 + 若干 `(ssr) program reload`）后，touch 纯服务端模块的
  客户端更新出现**数十秒延迟**（最终到达且保状态；A 站与 B 站提交评论链路均即时）。未深挖根因。

## D：删除已加载评论

- 功能行为正确：受控复现（提交新评论 → 等正文加载 → 删除另一条）**只删目标目录**，UI 与文件系统一致，
  卡片消失、其余保留、无 5xx。
- **报错独立记录（未通过项）**：删除已加载评论后浏览器 console 出现
  `[vite] Failed to reload /comments/<id>/index.mdx?collection=comments ...`（每次删除 3 个文件 × 各 3 条）；
  服务端出现 `Failed to load url .../index.mdx?...&only=frontmatter in .source/server.ts. Does the file exist?`
  与 RR 的 `No route matches URL "/comments/<id>/counter.tsx"`（模块 URL 被打到 router 上，404）。
  即 root-cause 已知的「Vite 对已删除已加载模块的 reload 报错」，本轮按派单未修（不做 hotUpdate 过滤）。
- **未复现事件**：B2 提交的评论（`20261011t190054-vpys`）在提交约 20 秒后、无任何操作期间从磁盘消失
  （dev 日志 3:01:14 有它的 hmr update + 「文件不存在」记录），受控复现（再提交+再删除）未再现多删。
  原因未查明，证据在 `logs/dev-b.log`。

## 未验证 / 未完成（如实列出）

1. **Vitest 测试未写**：用户中途收住实验，`tests/` 目录不存在，根 `package.json` 的 `test` 脚本无处指向。
   HTTP/文件层证据来自真实浏览器操作与 dev 日志，未做自动化回归。
2. build / start（生产形态）未测；多页、真实身份、布局、覆盖层均不在本 probe 范围。
3. `vpys` 消失事件未查明（见 D）；B 站 touch 延迟现象未深挖（见 C）。
4. 「正文子树重挂」「form 内非受控丢失」两条已知代价未尝试缓解（如评论内组件状态上提、草稿受控化），
   属于后续集成决策。

## 给需求讨论的事实素材（用户问「为什么要费劲」）

摩擦的唯一来源是「评论正文是 MDX 模块、走 Vite 编译链」：dev 下写评论必然触发模块图更新。
如果评论改为纯文本/结构化数据渲染（不走 MDX），dev 下写评论就只是数据变化——A4 实测零 HMR 事件、
零状态丢失。A/B 两站正是这个取舍的对照面：**MDX 评论 = 亚秒级无错热更新 + 上述两条已知代价；
非 MDX 评论 = 与热开发完全无交集**。评论内容能力（富文本、评论内组件）与实时显示需求怎么取舍，
留给主会话与用户讨论。

## 版本与环境

React Router 8.4.0、Vite 8.3.4、fumadocs-core 16.17.1、fumadocs-mdx 15.4.7（`index.target: 'default'`）、
React 19.3.0、TypeScript 5.9.2、pnpm 12.4.2（`allowBuilds: esbuild`），Windows 11。隔离 workspace
（自己的 `pnpm-lock.yaml`），未改任何仓的 packages / 父 workspace / 正式站，未提交、未发版。
两站 `react-router typegen && tsc --noEmit` 通过。真实浏览器为 ZCode 内置浏览器（IAB），
输入与点击均为真实交互。

## 复跑

见 README 第一行。浏览器实验步骤：打开 `/page` → 操作计数器与草稿 → 提交/删除评论；
dev 日志对照 `logs/`（本轮原始日志已保留，含全部 HMR 事件与报错原文）。
