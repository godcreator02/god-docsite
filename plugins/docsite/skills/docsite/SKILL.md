---
name: docsite
description: 用基础包 @godcreator/docsite-kit 搭的文档站（协作站也是）：开站、看站、把自己加进站点、读写站点评论、写页面时读。
---

# 文档站（docsite-kit）

基础包 `@godcreator/docsite-kit` 搭的站：fumadocs + React Router + Vite，站点目录里 `content/` 放页面、`comments/` 放评论、`people.json` 列出人员。
基础包的完整说明在它的自述站（`oz47p-docsite-kit` 单元，仓 `docsite-kit/` 的 `site/content/`），这里只写 agent 常做的几件事。

## 始终照做

- 站点由工作台托管，不在会话里自己 `pnpm dev`：会话一停站就掉，还会抢端口，自己启动的也没有身份码、只读
- 只写站点目录里的文件，不碰 git；要提交由各站自己的流程（协作站是 `collab.submit`）
- 评论只经网页或下面的 `docsite.comment.*` 写，不手拼评论文件

## 开站、看站

| 要做什么 | 命令 |
| --- | --- |
| 托管一个站（常驻，插件加载时启动） | `docsite.site.add {"dir":"<站点目录>"}` |
| 打开（没在运行就先启动） | `docsite.site.start {"dir":…}`；只启动不打开加 `"open": false` |
| 看状态、启动失败的原因 | `docsite.site.list` |
| 停掉 / 不再托管 | `docsite.site.stop` / `docsite.site.remove` |

协作站的项目由 gwb-collab 托管，不用 `docsite.site.add`，但 `start`、`stop`、`list` 一样能用。
启动前插件查一遍站点（装没装依赖、`people.json` 与评论文件对不对），不过就把每条问题写在 `error` 里，照原话改。

## 我是谁

每个 gwb home 有一串身份码（`docsite.identity` 查，设置 `docsite` 分区的 `identity-code`），站点按 `people.json` 里各人的 `codes` 认人。
站点侧栏底部写「只读」、鼠标停上去说码不在 `people.json` 里时：

```text
docsite.people.join {"dir":"<站点目录>","id":"<字母数字>","name":"<显示名>"}
```

已有这个 `id` 就把码加进它的 `codes`，没有就新加一项。只写文件，要别人也看到得提交。

## 评论

- 读：`docsite.comments {"dir":…, "page"?: "/页面地址", "status"?: "open"|"resolved", "about"?: "<人员 id>"}`，读文件，不要站点在运行。
  `page` 没有的是不挂在页面上的评论；`body` 是 MDX 原文
- 写：`docsite.comment.create`（给 `page` 与 `quote` 批那一页第 `occurrence` 处的字；只给 `page` 批整页；都不给是不挂在页面上的）、
  `docsite.comment.reply`、`docsite.comment.resolve`、`docsite.comment.reopen`。要站点在运行。
  agent 以自己的名义写时给 `as`（`people.json` 里 `"agent": true` 的 id），不给就署本 home 的人
- 正文是 MDX：字面的 `<`、`{` 写成 `\<`、`\{` 或放进反引号；`@<id>` 是 @ 某人
- 人让你照某条评论改页面时：先 `docsite.comments` 找到它，改完页面再 `docsite.comment.reply` 说明改了什么；要不要标已解决问人

## 写页面

- 页面放在 `content/`：`名字.mdx`（frontmatter 写 `title`、可选 `description`）、`名字.page.tsx`（导出 `meta = { title }` 与默认组件）、`名字.html`（`<title>` 是标题）
- 一页要用几个组件：页面放外面，组件放进同名文件夹，`content/notes/waveform.mdx` 从 `./waveform/` 引用
- 文件夹的 `meta.json` 写 `title`、`pages`（顺序，写文件名去掉扩展名，TSX 页面也去掉 `.page`）、`icon`（lucide 图标名）；写了 `"root": true` 的是侧栏顶上切换下拉框的一项
- 地址就是 `content/` 下的路径；`/api`、`/comments` 留给站点自己。改了页面，开发服务自己刷新
