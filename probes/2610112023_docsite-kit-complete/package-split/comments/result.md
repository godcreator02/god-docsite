# 任务J：@godcreator/docsite-comments 实现结果

日期：2026-10-11。独占目录：`packages/docsite-comments/` 与本目录。旧 `packages/docsite-kit/` 只读未动，identity 包（I 会话在途）只按契约写导入、未读改。

## 实际变更

新建 `packages/docsite-comments/`，从旧包迁移评论全部实际功能，按模型 / server / browser / react 分层：

| 新文件 | 来源 | 改动 |
| --- | --- | --- |
| `src/comments.ts` | 旧 `src/comments.ts` | Person/peopleFile 改从 `@godcreator/docsite-identity` 导入；删掉对身份功能的 re-export（身份由身份包直接提供）；Standard Schema vendor 改为 `docsite-comments` |
| `src/comment-ranges.ts` | 旧同名 | 逐字一致 |
| `src/page-text-rules.ts` | 旧同名 | 逐字一致 |
| `src/comment-links.ts` | 旧 `src/site-link-targets.ts` 的评论部分 | 只取 `linkedCommentParam`、`commentLinkOf`；`siteLinkTargetOf`/`sitePathOf` 属站点通用链接，不迁 |
| `src/index.ts` | 新 | 根入口：模型层全量导出，无 Node、无 React |
| `src/server/comments.ts` | 旧 `src/server/comments.ts` | 删 `siteIdentity`/`siteCommenter`/`sitePeople`/`actorOf`（身份包职责）；`CommentRequestOptions` 新增必填 `siteOrigin` 与 `identity`；谁在操作改由身份包 `authorizeWrite` 统一校验（Origin 精确匹配、as 只给已登记 agent），`WriteAccessError` 按 status 转响应；只读 403 与作者编辑/删除鉴权保留；默认 `pageHtmlOf` 改从 `siteOrigin` 起请求 |
| `src/server/comment-files.ts` | 旧同名 | `siteProblems(siteDir)` 改为 `commentSiteProblems(commentsDir, people)`：不再自己读站点目录的 people.json，人员由调用方显式传入；人员列表格式与页面存在校验留给宿主组合 |
| `src/server/page-text.ts` | 旧同名 | 逐字一致 |
| `src/server/index.ts` | 旧 `src/server/index.ts` 的评论部分 | 只导出评论功能；`contentFileResponse`/`siteFeedOf`/`siteSearchServer` 属旧包其余功能，不迁 |
| `src/browser/comment-anchors.ts` | 旧 `src/ui/comment-anchors.ts` | 逐字一致（DOM 定位，无 React） |
| `src/browser/index.ts` | 新 | browser 入口 |
| `src/react/comment-cards.tsx` | 旧 `src/ui/comment-cards.tsx` | `Avatar` 改用 `@godcreator/docsite-identity/react`（本地定义与 `hueOfId` 删除）；`personOf`/`mentionBeingTyped`/`peopleMatching` 从身份包；`CommenterChip` 不迁（侧栏身份显示属身份包 `IdentityBadge`）；sessionStorage key 改为 `docsite-comments:open-comment-thread` |
| `src/react/comments.tsx` | 旧 `src/ui/comments.tsx` | `PageComments` 全量保留；删 `themeSwitchWithIdentity`（主题切换属站点）；`linkedCommentParam` 从本包；评论右侧栏宽度 token 由 `--docsite-side-column-width` 改为本包自有 `--docsite-comments-sidebar-width` |
| `src/react/all-comments.tsx` | 旧同名 | `commentLinkOf` 从本包 comment-links；其余一致 |
| `src/react/index.ts` | 新 | react 入口（导出见下） |
| `styles.css` | 旧包根 `styles.css` 评论部分 | 保留高亮、被批元素画框、批注十字光标；新增 `:root` 自有 token `--docsite-comments-sidebar-width: 340px`；fumadocs 布局改写（`#nd-docs-layout`、目录让位、全宽）不迁，属站点布局 |
| `test/*.test.ts` ×5 | 旧 `test/` 对应用例 | 导入路径更新；`comment-files` 改显式传 people；`comment-requests` 增加 `identity`/`siteOrigin`/请求 Origin 头，新增「Origin 不一致/缺失 403」用例，as 拒绝路径改按契约断言状态码（403 人 / 400 未知），消息文本由身份包定不再断言 |
| `package.json` / `tsconfig*.json` / `README.md` | 新 | 见下 |

依赖：dependencies 为 `@godcreator/docsite-identity: workspace:*`、`@mdx-js/mdx 3.1.1`、`diff-match-patch 1.0.5`、`parse5 7.3.0`、`yaml 2.9.1`（与旧包同版本）；peer 为 `react`/`react-dom ^19.3.0`；**无 fumadocs、无 vite、无 react-router**。`private: true`、version `0.0.0`，版本与发布由 K 按发版规则处理。

## 公开 exports

- `.`：`commentFrontmatterSchema`、`commentThreadsOf`、`commentThreadsByPage`、`commentablePagesOf`、`assertCommentPagesExist`、`assertCommentAuthorsKnown`、`commentRoutePatternOf`、`commentFileName`、`isThreadHeadFile`、`isCommentRange`、`isCommentOpeners`、`snapshotMismatchOf`、`commentElementKinds`、`commentSnapshotFile`、`diffOfTexts`、`mapRangeThroughDiff`、`createRangeMapper`、`atomicCharacter`、`commentScopeAttribute`、`commentUiAttribute`、`pageTextRoleOf`、`commentLinkOf`、`linkedCommentParam`，类型 `CommentEntry`/`CommentThread`/`CommentFrontmatter`/`CommentThreadFrontmatter`/`CommentReplyFrontmatter`/`CommentFrontmatterSchema`/`CommentStatus`/`Commenter`/`CommentElementKind`/`CommentRange`/`MappedRange`/`RangeMapper`/`PageTextRole`
- `./server`：`commentRequestResponse`、`commentSourceResponse`、`commentSnapshotsOf`、`readCommentThreads`、`commentSiteProblems`、`commentThreadIdsAbout`、`pageTextOfHtml`，类型 `CommentOperation`/`CommentRequestOptions`/`PageHtmlOf`/`CommentFile`/`CommentThreadFile`
- `./browser`：`pageTextOf`、`rangeOfOffsets`、`offsetsOfRange`、`elementOffsetsOf`、`elementKindOf`、`pickedElementOf`、`openerRangesOf`、`openerLabelOf`、`placeOfThread`、`elementLabelOf`、`anchorLabelOf`、`commentUiAttribute`，类型 `PageText`/`ThreadPlace`
- `./react`：`PageComments`、`AllComments`、`commentScopeAttribute`、`commentScopeProps`、`CommentEditor`、`CommentItem`、`ThreadView`、`PeopleContext`、`postComment`、`rememberThreadToOpen`、`recentThreadToOpen`，类型 `PageCommentsProps`/`AllCommentsProps`/`CommentApi`
- `./styles.css`

站点接线所需 props / 请求 options 见包内 README（PageComments 的 `page`/`threads`/`snapshots`/`commenter`/`people`/`renderBody`/`apiUrl`；`CommentRequestOptions` 的 `commenter`/`identity`/`people`/`pageUrls`/`commentRoutes?`/`commentsDir?`/`pageHtmlOf?`/`siteOrigin` 必填）。

## 实跑命令及退出码

pwsh 7，全部在新包目录：

| 命令 | 结果 |
| --- | --- |
| `pnpm exec tsc --noEmit`（首次） | **意外触发 pnpm 隐式安装**（见风险节）；报告 1 个 JSX 笔误后修 |
| `./node_modules/.bin/tsc --noEmit`（修复后） | 退出码 2：8 处 `Cannot find module '@godcreator/docsite-identity(…)'`（identity 无 dist，见待集成）+ 2 处连带 TS18046（`instanceof` 无法收窄 unknown，identity 就位后消失，同一写法旧包无错） |
| `./node_modules/.bin/vitest run test/comment-ranges.test.ts test/page-text.test.ts` | 退出码 0：**13/13 通过**（修过一处抄写丢失的 U+00A0 字面量后） |
| `./node_modules/.bin/vitest run test/comments.test.ts test/comment-files.test.ts test/comment-requests.test.ts` | 退出码 1：3 个文件全部挂在模块解析（identity 无 dist），0 个用例执行——待集成 |

对照验证：旧包 `packages/docsite-kit` 同名 page-text 测试实跑 6/6 通过，确认 U+00A0 修复方向正确；`diff` 复核 `comment-ranges.ts`、`page-text-rules.ts`、`browser/comment-anchors.ts`、`server/page-text.ts` 与旧实现逐字一致。

## 待集成检查（交给 K）

1. I 会话交付 identity 包并构建出 `dist/` 后：新包 `tsc --noEmit` 应只剩真实类型错误；`comments`/`comment-files`/`comment-requests` 三个测试文件待实跑（用例已按新入口写好）
2. `authorizeWrite` 的 Origin 缺失/不匹配 403、as 未知 400、as 冒充人 403 的具体消息文本未断言（由身份包定），K 集成后建议实站过一遍
3. 仓根正式 `pnpm install`（重建 lock 的新包条目）+ 全套 `pnpm check`
4. 验证站接入：读评论、写回复、解决/重开、只读拒写、collapse-test 等价定位样本

## 已知差异 / 风险

- **行为差异（有意）**：`siteProblems(siteDir)` → `commentSiteProblems(commentsDir, people)`，人员显式传入；`CommentRequestOptions` 新增必填 `siteOrigin` 与 `identity`；身份/as/Origin 校验移交身份包
- **样式 token**：评论侧栏宽度 `--docsite-side-column-width`（旧，语义是「侧栏列宽」）改为包自有 `--docsite-comments-sidebar-width`（默认同为 340px）；旧包 styles.css 里 fumadocs 布局让位（目录列同宽、`#nd-toc` 隐藏、toc 下拉条）属站点布局，K 接站时站点自备
- **组件类名仍用 `fd-*`**（fumadocs 主题色）：实际宿主是 docsite 站（fumadocs），高亮/画框/光标样式不依赖 fd 变量；「避免强制 Fumadocs CSS 变量」做到了不强制造布局，但站点须提供 fd-* 主题类
- **MDX 编译校验**用 `@mdx-js/mdx` 默认配置，与宿主 fumadocs-mdx 集合（remark/rehype 插件）的对齐未实现，代码注释与 README 已写明
- **sessionStorage key** 改名（`docsite-comments:…`）：旧新实现各自记住「刷新后重开的评论串」，15 秒窗口内跨实现不互通，实际无影响
- 折叠适配与取字沿用旧 DOM/ARIA 假设（`role="tab"`、`aria-expanded`、`<details>`、`hidden="until-found"`），未做替换，等价样本由 K 在站上抽检
- 旧 `themeSwitchWithIdentity`、`CommenterChip`、旧包对 `Avatar` 的转出口不迁：主题切换属站点，身份显示用身份包 `/react` 的 `IdentityBadge`/`Avatar`
- 复制是本批迁移暂态：旧包调用方未迁，旧实现未删

## 遗留进程

无。只运行过 tsc 与 vitest（均已退出），未启动开发服务或其他长驻进程。
