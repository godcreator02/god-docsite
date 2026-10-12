# docs-add-result.md：React Router + Fumadocs 新增正文页面的真实表现（S 线第二轮）

日期：2026-10-12。第一优先且唯一交付：在最小标准正文站上测「dev 运行中新增一篇 docs 集合 MDX
（带自己的相对导入 TSX 与图片）」的真实表现。前一轮评论实验（A/B/C/D）的证据保留在 result.md。

## 结论（直接回答重点问题）

在 `index: { target: 'default' }`（fumadocs-mdx 15.4.7 的公开 IndexFilePluginOptions）下：

1. **新增正文成功**：先写 TSX 与图片、再写 MDX 后，**约 300ms 内**（首帧 200ms 采样粒度）新页自动出现在
   已打开页面的导航列表（pageTree 经 revalidate 更新，无需手动刷新或重启）。
2. **不需要整页刷新**：导航出现与进入新页全程 `performance.timeOrigin` 不变（Link 客户端路由导航）。
3. **外壳状态与草稿保留**：页面组件计数、受控与非受控未提交输入全部保留，console 零新增错误。
4. **未改动的 MDX 内 TSX 计数器归零**（不混报为「状态全保留」）：当前正文经官方
   `createClientLoader().useContent` 渲染，`.source` 重新生成使该模块重求值、内部 Renderer 类型更换，
   已打开正文的子树重挂（本轮实测 3→0）。这是已知代价，不是整页/整路由重挂。
5. **客户端导航与直开分别**：点导航 Link 进入新页 = 客户端路由（timeOrigin 不变、外壳 state 与草稿
   保留、新正文/新 TSX 可交互、图片加载）；直接打开新 URL = 整页加载，内容、交互组件、图片同样正常。

在**默认接线**（不设 `index.target`，即 `import.meta.glob` + 相对 base 形态）下，**同一份渲染代码、
同一组步骤**：新增 MDX 后 33 秒轮询内导航**不出现**、无任何 watcher/HMR 事件（route 模块求值计数不变）、
直接访问新 URL **404**。已打开页面状态无损（因为什么都没发生）。与 2610112023 root-cause 复盘在
Windows + Vite 8.3.4 上的记录一致。

## 对照设计与更正

- **对照变量只有一个**：`fumadocsMdx({ index: { target: 'default' } })` 与 `fumadocsMdx()`。
  渲染代码（官方 `createClientLoader`/`useContent` + raw 预查）、步骤、真实浏览器操作两边完全相同。
- **作废声明**：中途某轮「默认 target 下报 async Client Component 错误」的结论**作废**——该错误出自
  本 probe 自己写的 `use(promise).default` 渲染组合（及一次标签页绑定错误），在两个 target 下都会出现，
  与接线无关；换成官方 `useContent` 后两种接线均无此错误。
- **raw 预查不是官方标准示例的一部分**：`browserCollections.<name>.raw[path]`（含兼容 vite-target 的
  `./` 前缀 key）是本 probe 加的防护，用来在入口未到时渲染占位、避免 `createClientLoader` 内部
  `getLoader` 的同步 throw。官方示例直接调 `useContent(path)`。它在两种接线下行为一致。

## default-target 时间线（真实浏览器，坐标级真实点击与输入）

页面探针：外壳（路由组件）计数、未提交输入（受控/非受控）、正文内自写 TSX 计数器（`PageCounter`）、
图片（SVG，Vite 内联为 data URI）。基线：外壳=2、正文内计数=3、双草稿已填。

| 时刻 | 观察 |
| --- | --- |
| 写入 new-page.mdx 后 ~300ms | 导航出现 `/docs/new-page`；route 模块求值 +4；外壳=2、双草稿保留；timeOrigin 不变；console 零新增错误；**正文内计数 3→0（Renderer 子树重挂）** |
| 真实点击导航 Link | URL→/docs/new-page，新正文（h2、`NewPageCounter`、图片）渲染；timeOrigin 不变；外壳=1（该页自身 state）、双草稿保留；零错误 |
| 直接打开 /docs/new-page（新标签） | 整页加载，正文/组件/图片正常，组件点击 0→1 交互有效；导航含两页；零错误 |

（default-target 基线页在观察 8 秒窗口内 hydration 稳定、零错误。）

## 默认接线（vite-target）时间线

- `.source/server.ts` 生成形态：5 个 `import.meta.glob(["./**/*.{mdx,md}"], { base: "./../content/docs", ... })`
  （相对 base，原文已录日志）。
- 基线页本身正常（SSR 200、正文/组件/图片渲染、hydration 零错误）——**默认接线对已有文件无问题**。
- 写入 second-page.mdx（同样先 TSX+SVG 后 MDX）后：33 秒轮询导航不出现、dev 日志无该文件的
  watcher/HMR 事件、route 模块求值不变；直接访问 `/docs/second-page` 返回 404；已打开页面状态无损。

## Vitest

`pnpm test`（2 个用例，通过，日志 `logs/vitest-docs-add.log`）：起 dev（5520）→ SSR 含已有正文/
`data-docs-counter`/导航 → 运行中写入 `vitest-page.mdx` → 轮询直到新 URL 可直达（含正文）→ afterAll
清理。覆盖 default-target 形态的 HTTP 层；浏览器层状态证据为本文件的真实浏览器实测。

## 未验证 / 边界

- 删除正文页、多页树结构、meta.json 分组未测（不在本轮范围）。
- `index: { target: 'default' }` 的公开性分级沿用 N 线结论（公开类型、官网文档未写）。
- 正文内计数归零（Renderer 换实例）未尝试缓解——缓解方案（纯组件模块 + `use()` 渲染）在本 probe
  评论轮曾实现并验证过「未改动评论状态保留」，但该渲染组合在两个 target 下都触发
  async Client Component 错误，未在本轮继续排查，材料见 result.md 的 C 线记录。

## 版本与环境

React Router 8.4.0、Vite 8.3.4、fumadocs-core 16.17.1、fumadocs-mdx 15.4.7、React 19.3.0、
TypeScript 5.9.2、Vitest 5.0.3、Windows 11；真实浏览器为 ZCode 内置浏览器（坐标级真实点击与输入）。
站点为 `site-b` 的 `/docs/*` 路由（`app/routes/docs.tsx`，无评论、无 action、无 fetcher）；
评论实验路由 `/page` 与证据（result.md）保留。未升级依赖、未提交推送、未改其他 probe。
