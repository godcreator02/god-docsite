pnpm install && pnpm build:lib && pnpm test && pnpm --filter fixture-site test && pnpm --filter fixture-site check && pnpm build:site

# 任务 R：写作组件与集合编译插件

按 Fumadocs 最适配形式重写文档站写作能力（旧实现只作功能基线）。交付两样东西：

- **`packages/writing`（`@probe/writing`）**：写作库，最终归 docsite-kit 写作模块
  - `.` 出口（浏览器安全）：`Term`（点线下划线术语词，CSS `:hover`/`:focus-within` 展开，无状态；id 用 `useId`——同构渲染 SSR 与 hydrate 一致）、`Tex`（TSX 公式，KaTeX）
  - `./compile` 出口（构建期 Node-only）：`remarkGlossary`（unified 插件形态，直接进集合的 `remarkPlugins`）、`buildTermIndex`/`findTerms`（纯匹配逻辑）
  - `./styles.css`：术语样式（fd- CSS 变量，类名前缀 `docsite-term`）
- **`fixture-site/`**：Fumadocs 原生配置样本站（React Router 框架模式 + fumadocs-mdx）
  - 集合用 **Config API 命名导出**（`source.config.ts` 的 `defineDocs`）：集合 A（`content/docs/`）与集合 B（`content/notes/`）各自 `docs.mdxOptions = applyMdxPreset(...)`，A 配术语插件、B 不配
  - 服务端入口 `.source/server`（进 loader），浏览器正文走官方 `.source/browser` 的 `createClientLoader`/`useContent`（客户端按需、只 type-import 配置，不运行时导入编译插件）
  - 数学配置每个集合完整配（集合级 mdxOptions 会替换默认工序）：`remark-math` 排在术语插件**前**、`rehype-katex` 用函数形式排到代码高亮**前**
  - `postprocess.includeProcessedMarkdown`（output: 'function'）：`getText('processed')` 是术语标注后 Markdown 的真实公开输出——Remark LLMs 把 `<Term>` 还原为原词（`test/processed-markdown.test.ts` 断言实际文本，非手工序列化）
  - 组件表 `app/mdx-components.ts`：锁定版 `@fumadocs/base-ui` 公开组件原样登记（Tabs/Files/Accordion/TypeTable/ImageZoom 等），库只添 `Term` 一个，不包装
  - 样本页：`/docs/writing-demo`（表格/代码/公式/Tabs/Files/折叠/图片）、`/docs/glossary-demo`（术语边界）、`/notes`（集合 B 对照）、`/tex`（TSX 公式）

## 复跑

完整复跑（在 `2610120123_writing/` 目录，第一行即同一条命令）：

```bash
pnpm install                          # 独立 workspace（pnpm-workspace.yaml 截断向上查找）
pnpm build:lib                        # 构建写作库 dist（fixture 用它的产物）
pnpm test                             # 库的 3 个 Vitest 套件（30 用例）
pnpm --filter fixture-site test       # fixture 的 getText('processed') 真实输出测试（3 用例）
pnpm --filter fixture-site check      # 站点 typegen + tsc
pnpm build:site                       # react-router build
cd fixture-site && PORT=5510 HOSTNAME=127.0.0.1 pnpm start   # 起在 http://127.0.0.1:5510
```

开发模式：`pnpm dev:site`（5511）。停服务：Windows 上 `netstat -ano | findstr :5510` 找 PID 后 `taskkill /F /PID <pid>`。

## 版本锁定（不追新）

本批基线：`@fumadocs/base-ui` **16.17.1**、`fumadocs-core` **16.17.1**、`fumadocs-mdx` **15.4.7**、`vite` **8.3.4**、React Router **8.4.0**；其余照旧：`@mdx-js/mdx` 3.1.1、`katex ^0.16.47`、`remark-math ^6`、`rehype-katex ^7`、react ^19.3.0、tailwind ^4.3.3、typescript ^6.0.3、vitest ^5.0.1。

## 集合隔离的接法与证据

按已完成实验 `2610111940_api-audit-hmr` 的 E-4（config 变体）接线：**Config API 命名集合 + 各自 mdxOptions/applyMdxPreset**，不是全局插件 + skipFile 按路径过滤（那条路已被该实验否掉）。证据：

- `build/client` 里 `buildTermIndex`/`remarkGlossary` **0 命中**；`.source/browser` 只 type-import `source.config`，无运行时 Node 插件导入
- server 编译产物：集合 A 的页面有 `jsx(Term, {def: …})` 调用，集合 B 的 **0 处**；浏览器侧集合 A 的模块含标注结果（def 文本），集合 B 的没有
- SSR HTML 与浏览器 DOM：`/docs` 3 处 `docsite-term`、`/notes` 0 处
- `getText('processed')`：集合 A 的输出里 `<Term>` 已还原为原词，集合 B 无任何痕迹

## 约定记录

- **术语 Markdown 输出**：不设库侧还原协议——`getText('processed')`（fumadocs-mdx 公开的 includeProcessedMarkdown / Remark LLMs 链路）实测把 `<Term>` 还原为 children 原词；需要别的形态时在导出调用处传 `components`（公开契约 `GetTextOptions.components`）
- **术语样式**：行为与 gwb-docfirst 基线一致（点线下划线、hover/focus 展开、fd- 变量、窄屏适配）；类名前缀 `docsite-term`
- **Term 的 id**：`useId`（React 同构渲染下 SSR 与 hydrate 得同一值），不再用模块级计数器
- **正文语义标记**：只有 `Term` 一个（编译期定义、构建期注入），无评论运行时注入标志、无锚点协议（那是 O 的范围）
