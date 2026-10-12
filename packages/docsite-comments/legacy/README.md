# @godcreator/docsite-comments

文档站评论的独立包：评论串的模型与校验、页面文字快照与定位、Node 服务端接口与文件检查、浏览器定位与 React 界面。
站点集合、路由、正文渲染和整体布局由宿主站点提供；人员与身份（people.json、身份码、as 校验、头像）在 `@godcreator/docsite-identity`。

评论的存储格式不变：一个评论串一个文件夹，`index.mdx` 是发起的那条，`snapshot.txt` 是发起那一刻的整页文字，`range` 在它里面数。
磁盘格式与定位算法的说明见 docsite-kit 仓自述站的评论页。

## 入口

| 入口 | 内容 | 运行环境 |
| --- | --- | --- |
| `.` | 评论模型（frontmatter 校验、评论串分组、能批的页面）、快照位置推算（diff-match-patch）、取字规则、评论链接协议 | 纯 TS，无 Node、无 React |
| `./server` | `commentRequestResponse`（HTTP 入口）、`commentSourceResponse`（取一条评论原文）、`commentSnapshotsOf`（loader 读快照）、`readCommentThreads`、`commentSiteProblems`、`commentThreadIdsAbout`、`pageTextOfHtml` | 只给 Node |
| `./browser` | `pageTextOf`、`placeOfThread`、`elementKindOf` 等：在页面 DOM 上换算评论批的位置 | 浏览器，无 React |
| `./react` | `PageComments`（一页上的评论）、`AllComments`（全部评论页）、`CommentEditor` / `CommentItem` / `ThreadView`、`PeopleContext`、`postComment`、`commentScopeProps` | 浏览器 + React 19 |
| `./styles.css` | 原文高亮（CSS Custom Highlight API）、被批元素画框、批注模式十字光标、颜色 token（`--docsite-comments-*`，含深色）、评论正文排版（`.dc-comment-body`）、侧栏宽度 token | 站点的 app.css 引入 |

根入口不拉 Node、也不拉 React：`./server` 的文件只由 Node 引入，`./react` 只由浏览器引入。

## 站点接线

**正文**：`<PageComments page={page} threads={threads} snapshots={snapshots} commenter={commenter} people={people} renderBody={renderBody} apiUrl?>{children}</PageComments>`，
`children` 里的正文容器带 `{...commentScopeProps}`（即 `data-comment-scope`）。评论正文由 `renderBody` 传入——包不导入站点的组件表，项目在这里把 MDX 组件交给编译好的正文。

**样式**：站点的 app.css 里 `@import '@godcreator/docsite-comments/styles.css'`（或等价引入）。两点要求与边界：

- 组件的布局类（flex、圆角、阴影等）由宿主的 **Tailwind v4** 生成：这份 styles.css 带 `@source './src'`，宿主 app.css 按上面的方式引入它，Tailwind 就能扫到组件类名（v3 的宿主把本包的 `src` 加进 content 配置）。
- 颜色全部用包自己的 token（`--docsite-comments-card`、`--docsite-comments-primary`、`--docsite-comments-border` 等），浅色是默认值，`.dark` 下换深色一套，宿主覆盖变量即可换肤；**不依赖 fumadocs 或别的主题**。评论正文（MDX）的排版也在这一份里（`.dc-comment-body`），不需要 typography 插件。
- 评论右侧栏的宽度用 `--docsite-comments-sidebar-width`（默认 340px）；站点要让目录那一列与它同宽，把两边设成同一个值。

**HTTP 入口**：`route('api/comments', …)` 的 action 调 `commentRequestResponse(request, options)`，`options`：

- `commenter`：写评论的人（身份包 `siteIdentity().person`，宿主服务端解析好的可信身份）；只读（`person` 为 null）传 null，接口 403
- `people`：身份包 `sitePeople()` 读出的人员列表
- `pageUrls`（与可选 `commentRoutes`）：能批的页面
- `siteOrigin`（必填）：站点的完整 origin，宿主可信配置传入——谁在操作由身份包 `authorizeWrite` 按它核对请求 Origin 并校验 `as`（agent 说明自己是谁；`as` 不是字符串按坏请求 400，空字符串按未知 id 400，只有缺省才以本人身份执行）
- `commentsDir`、`pageHtmlOf`：可选，评论目录（默认 `<cwd>/comments`）与取页面 HTML 的函数（agent 传 `{ quote, occurrence }` 时服务端算页面文字用）

**检查**：`commentSiteProblems(commentsDir, people)` 只查评论（格式、作者、快照），人员列表与页面存在校验由宿主用根入口的 `assertCommentAuthorsKnown` / `assertCommentPagesExist` 组合。

## 边界

- 不依赖 fumadocs、Vite、React Router；也不做站点主题切换与整体布局（右侧栏打开时在 `<html>` 上放 `data-comments-sidebar-open`，站点样式按需让位）。布局类要宿主的 Tailwind 生成，颜色与正文排版用包自己的 tokens/样式（见上「样式」）
- MDX 编译校验用 `@mdx-js/mdx` 默认配置，与宿主 fumadocs-mdx 集合配置（remark、rehype 插件）的对齐尚未实现
- 评论文件里的正文原样存取；怎么编译成组件由宿主经 `renderBody` 提供，包只给正文容器的默认排版样式
