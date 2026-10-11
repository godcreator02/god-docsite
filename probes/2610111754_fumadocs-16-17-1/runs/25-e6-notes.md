# E-6 观察记录（2026-10-11，日志 20、22；截图 out/e6/）

## customise 交互与产物

`pnpm dlx @fumadocs/cli@1.7.5 customise`（伪终端驱动：scripts/e6-customise.mjs，node-pty，
回车选默认项；管道直接喂 stdin 会因 clack 检测非 TTY 退出，exit 13）。

问了两个问题：
1. What do you want to customize?——Docs Layout（默认）/ Notebook / Flux / Glass / Spacious / Home Layout
2. 列出 6 个新依赖（@fuma-translate/react、@fumadocs/base-ui、class-variance-authority、
   @base-ui/react、next-themes、scroll-into-view-if-needed）后问 Do you want to install with pnpm?

写出（app/ 下）：`layouts/docs/`（index、client、page/index、page/slots/{breadcrumb,container,footer,toc}、
slots/{container,header,sidebar}）、`layouts/shared/`（client、slots/{language-select,search-trigger,theme-switch}）、
`components/docs-sidebar/`（base、link-item、page-tree、tabs/dropdown）、`components/ui/button` 等；
并自动改写 `app/routes/docs.tsx` 的 import：`fumadocs-ui/layouts/docs` → `@/layouts/docs`。
复制出的布局直接可用：改完重启 dev，/docs 200（runs/23-dev-e6.log）。

## 全宽模式（成立）

- `DocsPage` 自带 `full` prop：full 时 `tocEnabled = !full`，右侧目录自动不渲染（复制出的 page/index.tsx）。
- `page/slots/container.tsx`：full 分支原来是 `max-w-[1168px]`，改成 `max-w-none` 让正文真正占满。
- 切换按钮在 `app/routes/docs.tsx`（useState 管 full），不覆盖 `#nd-*`、不动 `--fd-*`。
- 浏览器验证：点击后右侧目录消失、正文延展到窗口右缘、按钮变「退出全宽」（out/e6/2-full-width.png）。

## 侧栏停在最近看过的组（成立，有一个边界）

改复制出的 `app/components/docs-sidebar/page-tree.tsx` 的 `SidebarPageTree`：

- 在树里的页面（`useTreePath()` 非空）：把当前根组的名字记进模块级变量；
  根组的 `name` 是 revive 出来的 React 元素（`<span dangerouslySetInnerHTML>`），文字在
  `props.dangerouslySetInnerHTML.__html`，要抽出来比较。
- 不在树里的地址（path 为空，如 /comments）：按记下的根组名在 `useTreeContext().full` 整树里
  找回那个 root folder，用它的 children 渲染侧栏。
- `/comments` 路由挂进 `DocsLayout`（loader 里 serializePageTree），侧栏显示「指南一 指南二」
  而不是顶层列表；SSR 与浏览器客户端导航都验证过（runs/24-dev-e6-final.log、out/e6/3-*.png）。
- 边界：侧栏顶部的**组下拉**（SidebarTabsDropdown）不跟随——它基于 `useTabsGroups(path)`，
  path 为空时没有 active 组，下拉不显示。组内容停住，组指示器没有。flashworker 视觉验收
  （out/e6/ 三张截图）A–D 全过，附注即此点。

## 结论

两件事都能在 customise 复制出的布局里做到，不需要覆盖 `#nd-*` id、`--fd-*` 变量，也不需要往页面树里塞假页面项。
改动的文件与位置：`app/layouts/docs/page/slots/container.tsx`（full 占满）、`app/routes/docs.tsx`（全宽按钮、
/comments 挂 DocsLayout）、`app/components/docs-sidebar/page-tree.tsx`（停组）、`app/routes/comments.tsx`。
