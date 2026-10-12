# 任务 R 结果：写作组件与集合编译插件（定点返工后）

日期：2026-10-12。本文件记录重点复核后的定点返工；首轮交付见 git 历史与本文件末尾的变更对照。
独占目录 `probes/2610120123_writing`（主会话已改名并重接），独立 workspace 与 lock，未动其他 probe、父 workspace/lock、正式 packages/site、台账或其他仓。未提交、未推送、未发布、未用 default 验插件。

## 本轮返工的四个点与结果

### ① 依赖基线纠正

fixture 从 core/base-ui 16.16.2、mdx 15.4.4 改回本批基线 **16.17.1 / 15.4.7**，vite 钉 **8.3.4**（React Router 8.4.0 不变）。改前读了 gwb-release；只改 fixture-site/package.json 与本 probe 的 lock，未动其他依赖。库（packages/writing）不依赖 fumadocs，无需改。

### ② 集合隔离改回 Config API（方向纠正）

删掉了「全局 remarkGlossary + skipFile 按路径过滤 + 断言集合级 mdxOptions 不可用」的错误方案。照已完成实验 `2610111940_api-audit-hmr` E-4 的 config 变体重接：

- `source.config.ts`：`defineDocs`（from `fumadocs-mdx/config`）**命名导出** `docs`（集合 A）与 `notes`（集合 B），各自 `docs.mdxOptions = applyMdxPreset({ remarkPlugins: [remarkMath, 术语插件?], rehypePlugins: (list) => [rehypeKatex, ...list] })`——集合级 mdxOptions 会替换默认工序，数学插件每集合完整配
- 服务端：`.source/server`（生成入口，命名导出集合）→ `app/source.ts` 的两条 `loader(...toFumadocsSource())`；页面 loader 只交本页元数据（标题、目录收成字符串后过 React Router 序列化），`await clientLoader.preload(page.path)` 预载
- 浏览器：`.source/browser` 的 `createClientLoader` + `useContent` 渲染正文（组件表在这里传给 MDX）——只 type-import 配置，不运行时导入编译插件
- 删了 `app/collections.ts`（macro 版集合声明）与 skipFile 分发逻辑；`skipFile` 仍是库选项（术语页自己跳过用），不再承担集合分发
- 全部走公开契约：`.source/server|browser`、`createClientLoader`、`useContent`、`applyMdxPreset`、`defineDocs`；未碰 `_compiler`

### ③ Term 的 id 改 useId（SSR 假设纠正）

删掉模块级 `seq` 计数器与「没有 use client 便是服务端组件、useId 要求 use client」的错误注释（React Router 是同构渲染，Term 实际在客户端产物里）。`Term` 改用 `useId()`，保留普通组件实现（无状态、CSS hover/focus 展开）。验证：

- Vitest：同一页多个术语 id 互不重复且 `aria-describedby` 各指向自己的定义框；两次独立 SSR 渲染 id 形态为 useId 输出（非手拼序号）
- 浏览器（真实构建产物）：SSR HTML 与 hydrate 后 DOM 的 id 完全一致（`_R_8vaaj5_` 等 React 19 useId 形态），3 个 Term 全部配对成功，hydration 无错误

### ④ Markdown 输出改真实公开输出验收

删掉 `termMarkdownRule`、`TERM_COMPONENT_NAME` 导出（内联为插件内部常量）与两个手工 mdast 序列化测试——它们不能证明 Fumadocs 实际输出。改为：

- 两个集合的 `postprocess.includeProcessedMarkdown = { output: 'function', headingIds: false }`
- 新增 `fixture-site/test/processed-markdown.test.ts`（Vitest，配置只挂 `fumadocsMdx()` 插件，import 真实 `.source/server`）：断言 `getText('processed')` 的实际文本
- 实测结论（写进断言）：**Remark LLMs 链路把 `<Term>` 还原为 children 原词**——输出里无 `<Term` 标记、无 def 属性泄漏、句子连贯；集合 B 的输出无任何痕迹。库侧不再有第二套还原协议；需要别的形态时在导出调用处传 `GetTextOptions.components`（公开契约）

## 检查结果（返工后全绿）

| 检查 | 命令 | 结果 |
| --- | --- | --- |
| 库类型 | `pnpm --filter @probe/writing typecheck` | 通过 |
| 库测试 | `pnpm test`（probe 根） | 3 文件 30 用例全过 |
| 库构建 | `pnpm build:lib` | dist 产出 |
| fixture 测试 | `pnpm --filter fixture-site test` | 1 文件 3 用例全过（真实 getText('processed')） |
| fixture 类型 | `pnpm --filter fixture-site check` | typegen + tsc 通过 |
| fixture 构建 | `pnpm build:site` | react-router build 通过 |
| 服务 | `PORT=5510 pnpm start` | docs/glossary-demo/writing-demo/notes/tex 全 200 |

## 浏览器验证（5510 真实构建产物）

真实浏览器输入与状态读取：

- **术语 hover（真实鼠标注入）**：`.docsite-term-pop` computed display `none → block`，移开 `→ none`
- **hydrate 一致性**：3 个 Term 的 `aria-describedby` 在 SSR HTML 与 hydrate 后 DOM 完全一致、目标 id 存在（React Router context 挂载、无 hydration 报错）
- **客户端导航**：站内链接点击（React Router 客户端路由）后 URL 变 `/docs`、新页正文经 `useContent` 按需加载并渲染出 1 处术语标注

浏览器 DOM 状态（非输入注入，读实际渲染结果）：

- 集合隔离：`/notes` 正文含同样词但 0 个 `.docsite-term`、公式照常；`/docs` 与 `/docs/glossary-demo` 分别 1/3 处
- writing-demo：表格 3 行、Tabs（pnpm/npm）、KaTeX 3 处、代码高亮 20 个着色 span、图片与折叠在

**如实标注的工具限制**：本机 IAB 后端的鼠标点击与键盘注入不落页面事件（hover 注入正常）。因此 Tabs 切换、Accordion 开合这类 JS 交互在上一轮用页面事件层派发 click 验证过（aria 状态与内容真实变化）——那属于**自检**，不声称真实鼠标操作通过；本轮返工未重做这部分（返工点未触及这些组件的接线）。真实鼠标路径验证过的交互：术语 hover 展开/收起（本轮）。

## 静态证据（返工后复查）

- `build/client`：`buildTermIndex`/`remarkGlossary` **0 命中**；`.source/browser` 仅 type-import 配置
- server 产物：集合 A 页面 `jsx(Term, {def…})`（glossary-demo 3 处、docs 1 处），集合 B **0 处**
- client 产物：集合 A 的浏览器模块含标注结果（def 文本），集合 B 无

## 保留的既有工作

术语匹配纯逻辑（长词优先/词边界/一篇每词条一次/建表三拒）、SKIP_TYPES 边界（含 math/inlineMath）、多次处理安全、Tex 组件、术语样式、`@probe/writing` 的出口形状（`.`/`./compile`/`./styles.css`）、fixture 的组件表与内容样本——均未重写，只动了返工单点名的部分。`skipFile` 库选项保留（用途改为「术语页自己跳过」，注释已改）。

## 未完成 / 留给主会话

- 未接入 `@godcreator/docsite-kit` 本体（契约规定主会话串行集成）
- 评论集合的术语接线未做（N/O 范围；库已支持无路径树照标，Vitest 有用例）
- `getText/asMarkdown/replaceSource` 只在公开契约范围使用（`getText('processed')`、`GetTextOptions.components`）；`_compiler` 未碰
- IAB 点击/键盘注入限制下，Tabs/Accordion/Files/ImageZoom 的真实鼠标操作验证仍缺（自检通过）；不为此增加产品机制

## 写入与释放

- 只写了 `probes/2610120123_writing/**`（含 fixture 的 `.source/`、`.react-router/`、`build/`、`node_modules/` 等生成物与依赖，均在本目录内）
- 5510/5511 服务已停（进程已杀，端口核对无监听）；浏览器标签页交回
- 依赖版本全部在本 probe 的 `pnpm-lock.yaml`；`pnpm-workspace.yaml` 截断向上查找，父 workspace/lock 未动

## 复跑

见 README 第一行；分步命令与说明在 README「复跑」一节。
