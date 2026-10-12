---
name: docsite
description: 用基础包 @godcreator/docsite-kit 搭的文档站（协作站也是）：从空目录建站、启动停止托管站点、把自己加进站点、读写站点评论、写页面时读。
---

# 文档站（docsite-kit）

基础包 `@godcreator/docsite-kit` 搭的站：fumadocs + React Router + Vite，站点目录里 `content/` 放页面、`comments/` 放评论、`people.json` 列出人员。
基础包的完整说明在它的自述站（`oz47p-docsite-kit` 单元，仓 `docsite-kit/` 的 `site/content/`），这里只写 agent 常做的几件事。

## 始终照做

- 站点由工作台托管，不在会话里自己 `pnpm dev`：会话一停站点就没了，几个会话还会占用同一个端口，自己启动的没有身份码、站点只读
- 要看页面，把 `docsite.site.list` 回的 url 交给 VS Code 插件打开，不由这个插件开窗口
- 只写站点目录里的文件，不碰 git；要提交由各站自己的流程（协作站是 `collab.submit`）
- 评论只经网页或下面的 `docsite.comment.*` 写，不自己写评论文件

## 与站点的契约（v1）

插件升级后要能托管按旧约定运行的站点；碰到不再支持的旧版本会明确报错、写明站点要升到哪版：

| 条目 | 约定 | 正本在哪 |
| --- | --- | --- |
| 启动方式 | 插件在站点目录里运行 `pnpm dev` | 站点 `package.json` |
| 传身份 | 环境变量 `DOCSITE_IDENTITY_CODE`＝本 home 的身份码；不经插件启动的站点只读 | 常量名从 `@godcreator/docsite-identity/server` 的 `identityCodeEnvName` 取 |
| 推送口令 | 环境变量与请求头的名字、端点前缀 | `@godcreator/docsite-feed` |
| 地址 | 站点 `scripts.dev` 写死 `--port`，只绑本机 | 站点 `package.json` |
| 人员列表 | `people.json` 的读写与校验只经 identity 包的函数 | `@godcreator/docsite-identity` |
| 评论目录 | `comments/` 的读写只经 comments 包的函数；写入经站点 action（站点自己校验） | `@godcreator/docsite-comments` |
| 功能包列表 | `package.json` 的 `docsite.features` | gwb-docsite 的建站器（校验）与 `@godcreator/docsite-kit/feature`（类型） |
| 版本核对 | 启动站点前读站点装的 `@godcreator/docsite-kit` 版本，低于插件支持的最低版（`MIN_KIT_VERSION`，当前 0.2.0）就拒绝并写明要升到哪版 | 插件里的常量 `MIN_KIT_VERSION` |

## 命令

| 命令 | 做什么 |
| --- | --- |
| `docsite.site.init` | 一条命令从空目录建站（见下） |
| `docsite.site.add` / `remove` | 登记进设置 `sites` 并启动（工作台每次启动时也启动登记着的站）/ 从设置里去掉，在运行就停掉 |
| `docsite.site.start` / `stop` | 启动 / 停掉站点的开发服务；start 先做版本核对与目录有效性，已在运行就回现状 |
| `docsite.site.list` | 托管着的站点与状态：每个站 `{ dir, state, url, expectedUrl, error }`，`state` 是 running / stopped / failed（`error` 记退出码与最后几行输出） |
| `docsite.identity` | 本 home 的身份码 |
| `docsite.people.join` | 把本 home 的码加进站点的 `people.json` |
| `docsite.comments` | 列出评论，可按页面、和谁有关筛 |
| `docsite.comment.create` / `reply` | 写评论（`create` 给页面与可选的元素锚点）；agent 以自己的名义写时给 `as` |
| `docsite.comment.resolve` / `reopen` | 还不支持（评论模型没有已解决状态），调了直接报错 |

每条命令的参数与回执写在它的 usage 里（MCP 入口 `search {"prefix":"docsite."}`）。

## 新建站点

```text
docsite.site.init {"dir":"<站点目录>","port":<开发端口>,"title":"<站名>"}
```

- 从空目录（或只有 package.json，`name` 会留下）一步建站：插件在内存里组装骨架模板与功能包模板 → 一次写盘 → 一次 `pnpm install` → 启动一遍检查能运行；检查通过后登记进设置 `sites` 的站保持运行、没登记的停掉
- 骨架建完就归站点：`app/` 与根目录的配置从此随便改。已有站点（`package.json` 有 `docsite.features`）再调就拒绝，要重建删掉目录再来
- 协作站由 gwb-collab 的命令建（要往站点里装功能包 `@godcreator/collab-site`），docfirst 站由 docfirst 插件的建站命令建（装 `@godcreator/docfirst-site`），都不直接调这里
- 只写文件、不碰 git

## 我是谁

每个 gwb home 有一串身份码（`docsite.identity` 查，设置 `docsite` 分区的 `identity-code`），站点按 `people.json` 里各人的 `codes` 认人。
站点侧栏底部写「只读」、悬停提示码不在 `people.json` 里时：

```text
docsite.people.join {"dir":"<站点目录>","id":"<字母数字>","name":"<显示名>"}
```

已有这个 `id` 就把码加进它的 `codes`，没有就新加一项。只写文件，要别人也看到得提交。

## 评论

- 读：`docsite.comments {"dir":…, "page"?: "<页面在 docs 集合里的路径>", "about"?: "<人员 id>"}`，读文件，不要站点在运行。
  `page` 如 `"writing/collapse-test.mdx"`；`about` 给了只列和他有关的（他发起的、正文或回复里 @ 了他的）
- 写：`docsite.comment.create`（给 `page`（页面在 docs 集合里的路径，与 `docsite.comments` 的 `page` 同一写法）与 `body`；给 `anchor` 批页面上带这个 id 的元素，不给批整页）、
  `docsite.comment.reply`。要站点在运行。agent 以自己的名义写时给 `as`（`people.json` 里 `"agent": true` 的 id），不给就署本 home 的人
- 正文是 MDX：字面的 `<`、`{` 写成 `\<`、`\{` 或放进反引号；`@<id>` 是 @ 某人
- 人让你照某条评论改页面时：先 `docsite.comments` 找到它，改完页面再 `docsite.comment.reply` 说明改了什么

## 写页面

- 页面放在 `content/`：`名字.mdx`（frontmatter 写 `title`、可选 `description`）、`名字.page.tsx`（导出 `meta = { title }` 与默认组件）、`名字.html`（`<title>` 是标题）
- 一页要用几个组件：页面放外面，组件放进同名文件夹，`content/notes/waveform.mdx` 从 `./waveform/` 引用
- 文件夹的 `meta.json` 写 `title`、`pages`（顺序，写文件名去掉扩展名，TSX 页面也去掉 `.page`）、`icon`（lucide 图标名）；写了 `"root": true` 的是侧栏顶上切换下拉框的一项
- 地址就是 `content/` 下的路径；`/api`、`/comments` 留给站点自己。改了页面，开发服务自己刷新
