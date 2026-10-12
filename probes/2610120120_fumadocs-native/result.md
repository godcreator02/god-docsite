# result.md：N 线（Fumadocs 原生评论闭环）

日期：2026-10-12。派单：design/zcode-orchestration/package-split-contract.md（2026-10-12 重申版）与
parallel-rewrite-contract.md。交付范围：原生页面 + 当前页评论读写 + 按需正文的最小闭环，不含覆盖层。

## 交付概览

- 站点 `site/`：标准 Fumadocs + React Router（框架模式）接线。`source.config.ts` 用 Config API 定义
  `docs`（页面，`async: true`）与 `comments`（评论，`async: true`）两个集合；服务端从生成的
  `.source/server` 组 `loader()`，浏览器从 `.source/browser` 用官方 `createClientLoader` /
  `useContent` 渲染正文与评论正文（`site/app/lib/source.server.ts`、`site/app/lib/client-content.tsx`）。
- 评论模型 `packages/comments-model/`：评论串的文件形状（`comments/<threadId>/index.mdx` 串头 +
  `<replyId>.mdx` 回复 + 同目录 tsx/图片附件）、`threadsForPage` 分组、`createThread` / `createReply` /
  `deleteReply` / `deleteThread`。不 import 身份包、不认识身份码 / Origin / as；文件里作者只存人员 id。
- 站点组合：路由 `site/app/routes/docs.tsx` 的 loader 只交付本页评论的元数据（路径、作者 `{id,name}`、
  时间；分组在 loader 内逐请求做，不在模块顶层）；action 承接四个写意图（新建、回复、删回复、删串），
  先过身份（环境变量身份码 → people.json）、Origin、as 校验，再调模型写文件。界面层：不可写时隐藏
  表单并显示只读原因，接口层独立拒绝——两层分开验证。

## 通过的功能与机制（证据）

全部证据来自 `pnpm test`（31 个用例，Vitest；真实文件、真实 HTTP、真实构建产物），日志在 `tests/logs/`。

| 项 | 证据 |
| --- | --- |
| 按需正文（官方 client loader 入口） | `tests/dev-loop.test.ts`：SSR HTML 含页面正文；构建产物里每条评论是独立异步 chunk（`site/build/client/assets/20261012t080000-seed1-*.js` 等，client 与 server 两侧都是） |
| 评论仍是集合、同一编译链 | 串头 MDX、回复 MDX、评论内同目录 `counter.tsx`（`'use client'` 交互组件）、`dot.png` 在 dev SSR 与 build/start 快照里都渲染（`dev-loop` + `build-start` 两套断言） |
| loader 只送本页评论元数据 | loader 返回 `comments: ThreadSummary[]`（无正文）；页面树 `serializePageTree`；`comments.server.ts` 的分组在函数内逐请求执行 |
| 新建 / 回复 / 删回复 / 删串 | `dev：写闭环` 5 个用例：action 200 → 文件落盘（`comments/<id>/…`）→ SSR 在约 0.3–0.8 秒内反映增删（轮询断言，本机实测） |
| 身份与写入边界 | 无身份码 / 码不认得：界面只读 + 接口 403（`dev-readonly` 两组）；缺 Origin 403、跨站 Origin 拒绝、`as` 指向不存在或非 agent 人员 403 且无文件落盘（`dev：写入保护` 5 个用例）；build/start 启动无身份码，POST 403（`build-start`） |
| 评论正文 MDX | 写入的 `**加粗**` 在 SSR 里渲染为 `<strong>`（断言分别查前缀与标签） |
| 图片 | dev：`/comments/<串>/dot.png` 200 `image/png`；build：小图被 Vite 内联为 data URI（默认 4KB 阈值），两种形态都断言 |
| 模型纯度 | `packages/comments-model/src/index.ts` 无任何身份 / HTTP 概念（grep 为证）；作者跨边界按 `{id,name}` 由站点解析传递 |

另外两层保险值得记录：React Router 8.4 自带文档 POST 的 Origin 核对
（`throwIfPotentialCSRFAttack`，无 Origin / 跨站直接中止），站点的 `sameOrigin` 是第二道显式校验；
两者都被测试覆盖。

## `index: { target: 'default' }` 的调查结论（本段的关键选型）

背景：root-cause 复盘（`2610112023_docsite-kit-complete/review/20261012-0008-root-cause.md`）确认
Windows + Vite 8.3.4 下，fumadocs-mdx 默认（`target: 'vite'`）生成的 `.source/*.ts` 用
`import.meta.glob` + 相对 base（`./../comments`），Vite 的 `toAbsoluteGlob` 对 `D:/...` importer 会算出
错误绝对匹配路径，集合文件新增后进不了清单。

- 公开性分级：`PluginOptions.index?: boolean | IndexFilePluginOptions`、`IndexFilePluginOptions.target?:
  'default' | 'vite'` 在 `fumadocs-mdx/vite` 的公开类型里（15.4.7 `dist/vite/index.d.ts`），**官网文档未写
  该选项**——按接口审计的分级属 B 类（导出公开、文档较薄）：锁版本使用，升级时针对性回归。
- 行为（读 15.4.7 源码 + 本机实测）：`target: 'default'` 生成的 `server.ts` / `browser.ts` 用**静态枚举的
  import 列表**（tinyglobby 在生成时列目录），完全不再有 `import.meta.glob` 与相对 base；插件自己的
  watcher 在集合文件 add / unlink 时重新生成入口文件（`hasFile` 的 picomatch 在 win32 反斜杠路径上匹配
  正常，实测验证）。Windows 增删红例由此绕开，未改生成物、未碰 node_modules、未做 HMR 补丁。
- 实测链：POST 写文件 → watcher add → 重新生成 `.source/server.ts` + `.source/browser.ts` → Vite 失效
  （dev 日志可见 `page reload .source/server.ts`）→ 下一个 SSR 请求看到新评论。本机全程亚秒级。
- 注意：`fumadocs-mdx` 的 postInstall CLI **不带插件选项**（`bin.js` 只收 configPath/outDir），会生成
  vite-target 的临时产物；首次 `dev` / `build` 会按插件配置重写为 default-target，不影响结果。

## 未完成 / 边界（不标完成的部分）

1. **真实浏览器未复核**（按派单留给主会话）：dev 下「action 返回 → fetcher 重验 → 浏览器渲染新评论」
   存在已知窗口——浏览器里已加载的 `.source/browser` 还没有新评论的入口，`useContent` 会抛
   「does not exist」。站点为每条评论加了错误边界（显示「刚写入，等编译入口」），同时 Vite 重新生成
   browser.ts 会触发整页刷新收敛。窗口大小、草稿是否因整页刷新丢失，需要真实浏览器测量。
2. **删除已加载评论的 Vite reload 报错**：root-cause 里已知（`page reload` 指向已删除 MDX 报错）。
   按派单不修（不做 utimes / hotUpdate 过滤 / 生成代码改写），本段只在 SSR / 文件层面验证删除闭环。
3. 评论编辑、@ 提及、无页面评论、元素定位、快照映射等旧功能不在本段（覆盖层归 O 线，其余后续小段）。
4. `as` 的授权面较宽：任何通过身份码认证的人都可 `as` 人员表里 `agent: true` 的人（同一 home 共码的
   语义）。更细的所有权规则归 P 线身份边界。
5. 评论集合未写 schema：frontmatter 字段运行时直接在条目上（K-05 已知形状），站点侧按 unknown 收窄后
   交给模型，缺字段由 `threadsForPage` 抛错点名条目。
6. SSR 渲染评论正文使用 `.source/browser` 在服务端的执行（官方 client loader 模式的 SSR 形态），
   页面与评论正文都会在 SSR 中编译；loader 数据本身仍只含元数据。

## 2026-10-12 定点返工轮（浏览器复现与上游定性）

评审点名的三个未闭环问题已在真实浏览器复现并定性，证据、故障层与选项全文见
**`tests/repro/upstream-rr-server-hmr-remount.md`**（原始 dev 日志 `tests/logs/dev-repro-20261012.log`）。
摘要：

- **复现**：POST 200 后约 300ms，loaderData 已含新串而浏览器入口表未到，
  `useContent` 抛 `[createClientLoader] … does not exist in available entries`（console 有原文）；
  约 0.7–1.5s 后评论正文渲染、无整页刷新，但同一时刻未提交草稿清空、组件状态归零。
  MutationObserver 证实卡片内所有 `fetcher.Form` DOM 被整体替换（组件实例重挂）。
- **故障层**：React Router `@react-router/dev` 8.4.0 内部插件
  `react-router-server-change-trigger-client-hmr`——SSR 模块图失效（评论写文件 →
  `.source/server.ts` 重新生成）即 reload 客户端 route 模块并重挂组件；无公开配置开关，
  客户端 HMR 边界拦不住（对照实验：touch 纯服务端模块同样触发客户端 route 更新）。
  该插件行为本身是 RR 预期的开发行为；**错误的部分**是 fumadocs `createClientLoader`
  在入口未到时同步 throw，把可预期时序变成渲染错误且 boundary failed 后无恢复路径。
- **本轮修掉的真实 bug（保留）**：署名下拉把「本人」作为带 id 的 as 选项提交，
  浏览器表单全部写操作被 403 `as-not-agent` 拒绝（HTTP 测试不带 as 未踩到）；
  本人选项改为 `value=""`（`site/app/routes/docs.tsx` AuthorSelect）。
- **按用户指示回退的试验代码（不作为交付）**：client 侧 HMR store（accept + hot.data +
  revision 通知）、草稿 sessionStorage 持久化、CommentBody 入口占位/版本 key——实测技术可行
  但被 SSR 侧驱动的 remount 盖过，已在收尾时回退；结论存档在 repro 文档供上游修复后参考。
- **仍未通过**：新增评论的浏览器端窗口（错误+boundary+草稿丢失）在 RR 当前行为下无公开
  无损解，**标未完成**，等上游选项决定（见 repro 文档四个选项：RR 加开关/缩触发面、
  fumadocs 提供非抛错入口查询、ssr:false（代价大不推荐）、后续版本核对）。
- 回退后基线复跑：`pnpm test` 31/31 通过（`tests/logs/vitest-focused-revision2.log`）。

## 版本与依赖

core/base-ui 16.17.1、fumadocs-mdx 15.4.7、Vite 8.3.4、RR 8.4.0、React 19.3、tailwindcss 4.3、
Vitest 5.0.3；`@probe/comments-model` 以 `workspace:*` 链接、发布 TS 源码，站点
`ssr.noExternal` 列上它（E-4 结论的应用）。全程未改任何仓的 packages / 父 workspace / 正式站，
未提交、未发版。

## 复跑

见 README 第一行：`pnpm install && pnpm test`（31 用例；会临时起停 5470/5471 上的服务并自行清理）。
