# 上游缺陷记录：评论写文件后路由组件被重挂（React Router dev）

2026-10-12 定点返工轮。三个评审问题（新增时浏览器入口暂缺、CommentBodyBoundary failed
不恢复、删除已加载正文后的 reload 错误、以及未提交草稿丢失）的真实浏览器复现、故障层
定性与选项。按用户指示：本轮不叠业务机制，试验代码已回退，本文件只交证据与选项。

## 环境

- React Router `react-router` / `@react-router/dev` 8.4.0，Vite 8.3.4，fumadocs-mdx 15.4.7
  （`index.target: 'default'`），Windows 11。
- dev 服务带身份码（`DOCSITE_IDENTITY_CODE=probe-code-owner`），页面 http://127.0.0.1:5470/docs，
  真实浏览器（ZCode 内置浏览器）操作，console/network/采样脚本经 `evaluate` 注入。

## 复现步骤（最小化）

1. 起服务 `DOCSITE_IDENTITY_CODE=probe-code-owner pnpm --filter probe-native-site dev`，打开 /docs。
2. 页面注入捕获：wrap `console.error/warn`、监听 `error`/`unhandledrejection`、
   wrap `window.fetch` 记录 POST、记录 `performance.timeOrigin`（变=整页刷新）。
3. 在「回复（支持 MDX）」框放入未提交草稿；点一次评论内 `data-comment-counter` 组件（状态探针）。
4. 提交「新建评论串」（`form[data-new-thread-form].requestSubmit()`；浏览器表单提交等价）。
5. 每 250–300ms 采样：卡片数、`[data-comment-pending]`（boundary fallback）、草稿值、
   counter 文本、`timeOrigin` 变化、console 条数。

对照实验：直接 `touch`（追加空行）`app/lib/comments.server.ts`——一个**纯服务端模块**，
不涉及任何浏览器模块，观察客户端 HMR。

## 实测证据

### 提交新评论（POST /docs.data → 200）

| 时刻 | 观察 |
| --- | --- |
| t≈300ms | 卡片数 +1（fetcher 重验证的 loaderData 已含新串），`[data-comment-pending]` 出现 |
| console | `Error: [createClientLoader] 20261012t021641-nbj7/index.mdx does not exist in available entries … occurred in the <Renderer> component. React will try to recreate this component tree from scratch using the error boundary you provided, CommentBodyBoundary.` |
| t≈0.7–1.5s | pending 消失、新评论正文渲染、**无整页刷新**（timeOrigin 不变）；同一时刻：草稿变空、counter 从 1 归零 |
| dev 日志 | `[MDX] generated files` → `(client) hmr update /app/routes/docs.tsx` → `(ssr) page reload .source/server.ts` |

### MutationObserver（定位草稿丢失方式）

提交瞬间，旁栏内所有 `fetcher.Form` 的 DOM 节点被 removed+added（含 seed1 卡片的回复表单），
采样确认 `document.querySelector('[data-reply-form] textarea')` **不是**提交前的节点
（sameNode=false）。卡片 `<section>` 复用而内部 form 全换 = ThreadCard 组件实例重挂
（`useFetcher` 的 `fetcherKey` 默认 `useId()`，重挂后 id 变、`fetcher.Form` 组件类型随之变）。

### 对照实验（touch 纯服务端模块）

对 `app/lib/comments.server.ts` 追加一个空行（不进客户端 bundle 的模块），同样出现：

```
(client) hmr update /app/routes/docs.tsx
(ssr) page reload app/lib/comments.server.ts
```

→ 客户端 route 模块的更新**由 SSR 模块图失效驱动**，与浏览器侧模块是否变化无关。
浏览器侧 HMR 边界（`import.meta.hot.accept` 拦 `.source/browser.ts` → client-content）
实测生效（日志出现 `hmr update /app/lib/client-content.tsx`）**但拦不住**后续的
`hmr update /app/routes/docs.tsx`——驱动不在客户端链上。

### 附带发现并修复的真实 bug（已保留）

浏览器表单提交总是带 `as` 下拉的当前值；第一段实现的下拉把「本人」作为
`value={本人id}` 的选项提交，`resolveAuthor` 按「as 目标必须是 agent:true」拒绝本人 id，
导致**浏览器 UI 的所有写操作 403 as-not-agent**（HTTP 测试不带 as 字段所以没踩到）。
修复：本人选项 `value=""`（提交空 as = 对号入座），`site/app/routes/docs.tsx` AuthorSelect。

## 故障层定位（依赖版本与源码位置）

`node_modules/@react-router/dev/dist/vite.js`（8.4.0）中的内部插件：

```js
{
  name: "react-router-server-change-trigger-client-hmr",
  hotUpdate({ server, modules }) {
    if (this.environment.name !== "ssr" && modules.length <= 0) return;
    let clientModules = modules.flatMap((mod) =>
      getParentClientNodes(server.environments.client.moduleGraph, mod));
    for (let clientModule of clientModules) server.environments.client.reloadModule(clientModule);
  }
}
```

`getParentClientNodes`：从 SSR 失效模块沿 importers 向上，遇到第一个同时存在于客户端
模块图的模块（这里是 route 模块 `app/routes/docs.tsx`，两个图都有）即对它
`reloadModule` → 客户端按普通 HMR 传播 → React Router 热替换路由组件 → 整棵路由组件
remount。链上的 `.source/server.ts`、`source.server.ts`、`comments.server.ts` 都是
SSR-only 模块，**没有公开 API 能在这条链上插入断点**（HMR accept 是客户端模块图的概念）。

## 定性：预期行为 vs 错误

- **React Router 预期的开发行为**：`server-change-trigger-client-hmr` 本身是有意设计
  （loader/action 依赖的服务端模块变更后，客户端路由模块同步换新，保证一致性）。
  没有公开配置开关（8.4.0 的 `Config` 里无对应项）。代价：任何触发 SSR 模块图失效的
  写路径（本站：评论写文件 → fumadocs-mdx 重新生成 `.source/server.ts`）都会重挂路由
  组件、丢失未提交输入与组件状态。
- **缺陷（错误）**：`fumadocs-mdx` 的 `createClientLoader` 在 `getLoader(path)` 未命中时
  **同步 throw**（`[createClientLoader] … does not exist in available entries`）。
  在「服务端元数据先到、浏览器入口表后到」的窗口（实测约 0.3–1.5s）里，这把一个可预期的
  时序状态变成渲染错误；React error boundary 捕获后 `failed` 状态没有恢复路径
  （React 不会自动重试），实际收敛依赖上面的 remount/刷新。这是 fumadocs client loader
  API 与 React 生命周期的组合缺陷：没有「入口未到达」的非抛错查询、没有到达通知。
- **删除已加载正文**：删除后 loaderData 不再含该评论、卡片卸载，浏览器侧不会主动加载
  已删模块；dev 日志里 Vite 对删除文件的 `page reload` 报错（root-cause 复盘已记录）
  属 Vite 模块图对已删除已加载模块的处理，本轮未再深挖、未修复。

## 选项（均未实施，需主会话/用户决定）

1. **上游修复（React Router，最小）**：给 `react-router-server-change-trigger-client-hmr`
   增加公开配置（如 `dev.serverChangeClientHmr: 'off' | 'routes-only'`）或缩小触发面
   （仅当失效模块在客户端图有**对应变更**时才 reload）。成本：提 issue + 最小复现
   （上面的 touch 对照实验就是）；限制：等上游发版，升级需按 gwb-release 单独评估。
2. **上游修复（fumadocs，较小）**：`createClientLoader` 提供非抛错的入口查询（例如导出
   `has(path)`）或未命中时渲染占位而非 throw，让站点能以正常渲染分支处理时序窗口。
   成本：提 issue；限制：同样等版本，且不解决 remount 本身。
3. **公开配置绕开（本站侧，代价大，不推荐默认）**：`react-router.config.ts` 改
   `ssr: false` 可让「SSR 模块图失效」这条链不存在——但放弃 SSR、改变站点形态，
   与本站设计冲突；仅列出证明「公开配置里没有无损开关」。
4. **版本选择**：核对 React Router 后续版本是否已调整该行为——本轮不升级、不跨仓改上游。

## 本轮试验代码的去向（已回退，不算交付）

按用户指示回退，不作为默认实现：

- `app/lib/client-content.ts`（HMR store：hot.data + accept + revision 通知）→ 已回退为
  第一段的模块级 `docsContent`/`commentContent` 导出。
- `app/lib/content-renderers.tsx`、`app/lib/draft-storage.ts`（受控草稿持久化）→ 已删除。
- `app/routes/docs.tsx` 里 CommentBody 的入口占位/revision key/Suspense、表单的草稿
  保存逻辑 → 已回退为第一段的 boundary 版本。
- 实测结论存档：client 侧 HMR 边界**技术上可行**（accept 生效、新评论在无 remount 时
  ~1s 内自动渲染、无错误），但被 SSR 侧驱动的 route remount 盖过；混合导出会触发
  react-refresh「Could not Fast Refresh」击穿自建边界（拆纯组件模块可避）——这些留给
  上游修复后的集成参考。

## 复跑方法

1. `cd probes/2610120120_fumadocs-native && pnpm install && pnpm dev`
   （PowerShell 先 `$env:DOCSITE_IDENTITY_CODE='probe-code-owner'`）。
2. 打开 http://127.0.0.1:5470/docs，按「复现步骤」操作；dev 日志在
   `tests/logs/dev-repro.log`（本轮原始日志已保留）。
3. 对照实验：`Add-Content site/app/lib/comments.server.ts ''`，观察终端 HMR 输出。
