# @godcreator/docsite-comments

文档站评论（fumadocs 原生机制）。评论是 fumadocs-mdx 集合里的文件（`<threadId>/index.mdx` 串头 +
`<replyId>.mdx` 回复 + 同目录 tsx/图片附件），与页面走同一个编译链（Vite + fumadocs-mdx）；
不在运行时编译评论正文。

## 出口

| 出口 | 内容 |
| --- | --- |
| `.` | 模型纯函数与类型：`threadsForPage` 分组、`serializeCommentFile`、`COMMENT_ID_PATTERN`；不含 Node 与 React |
| `./server` | 文件读写（Node）：`createThread` / `createReply` / `deleteReply` / `deleteThread`；授权由宿主先完成 |
| `./overlay` | 正文外批注覆盖层：徽章、元素框、高亮（CSS Custom Highlight API）、卡片定位；只测量正文，不改正文 |
| `./react` | 评论界面：`CommentsSidebar`（本页评论列表与编辑器），表单按约定字段 POST 到宿主路由的 action |
| `./styles.css` | 旁栏与评论卡样式 |

## 与宿主的分工

- 站点组合身份与评论：授权（身份码、Origin、as）用 `@godcreator/docsite-identity` 的
  `authorizeWrite`，通过后把作者 id 交给本包的写函数；读侧由站点把 authorId 解析成可信的
  `{id, name}` 再传给界面组件。本包不依赖身份包。
- 评论正文由宿主站点经 fumadocs 的 client loader 按路径渲染，组件接收 `BodyComponent`。
- 锚点：串头 frontmatter 可写 `anchor`（页面元素 id），覆盖层按宿主给的定位函数找元素；
  文字级锚点与正文改动后的快照映射不在当前版本。
