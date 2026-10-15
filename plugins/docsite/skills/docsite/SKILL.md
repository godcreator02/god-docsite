---
name: docsite
description: 平台包 @godcreator/god-docsite 建的站（协作站、docfirst 站也是）：建站、加功能、升级已有站点、启停托管的站、把自己加进站点、读写评论、写页面时读。
---

# 平台建的站（gwb-docsite）

站点建在平台包 `@godcreator/god-docsite` 上（fumadocs + React Router + Vite）：`content/` 放页面，`comments/` 放评论，`people.json` 列出人员，
`app/features/<功能名>/` 是各功能包的接线文件。基础站自带身份（`@godcreator/identity`）与评论（`@godcreator/comments`）。
每条命令的参数与回执以 usage 为准（`search {"prefix":"docsite."}`）；`dir` 一律是站点目录的绝对路径。

## 始终照做

- 开发服务由工作台托管，不在会话里自己 `pnpm dev`：会话一停站点就没了，几个会话还会抢同一个端口；自己启动的拿不到身份码，站点只读
- 要看页面，把 `docsite.site.list` 回的 `url` 交给 VS Code 插件打开（说明书 `vscode`）
- 这些命令只写站点目录里的文件，不碰 git；提交由各站自己的流程做（协作站是 `collab.submit`）
- 评论只经网页或 `docsite.comment.*` 写，不自己写评论文件

## 建站与加功能

```text
docsite.site.init    {"dir":…,"port":4310,"title":"站名"}
docsite.feature.add  {"dir":…,"package":"@godcreator/trajectory","version":"^0.1.0"}
```

- `docsite.site.init`：`dir` 要不存在或是空目录，`port`（写进 `scripts.dev` 的 `--port`）与 `title`（写进 `content/meta.json`）必给。
  复制平台包的 `template/`，平台包、身份、评论三个包写成插件旁边装着的那一版的 `^<版本>`，`pnpm install`，补上评论功能的接线文件，再启动服务检查首页。
  `people.json` 里只有 agent `claude`，人用 `docsite.people.join` 把自己加进来
- `docsite.feature.add`：在站点里 `pnpm add <package>@<version>`，把功能包 `template/` 里站点还没有的文件补进 `app/features/<功能名>/`（已有的不覆盖），
  重写 `app/features/` 下文件名带 `generated` 的汇总文件，再启动服务检查首页。`version` 不给就用 gwb-docsite 旁边装着的那一版，没装就拒绝。
  可以重复运行，只补缺的；站点在运行时拒绝，先 `docsite.site.stop`
- 启动服务检查时看首页回不回 200：通过后登记在设置 `sites` 里的站保持运行，没登记的停掉；没通过就报错，站点留着运行，报错在浏览器里看，看完 `docsite.site.stop`
- 协作站由 `collab.site.init` 建（说明书 `collab`），docfirst 站由 `docfirst.create` 建（说明书 `docs-site`），它们经下面的服务调这两步，不直接调这两条命令

## 升级已有站点

没有升级命令：骨架写完就归站点，`docsite.site.init` 只建新站，`docsite.feature.add` 不覆盖已有文件。要跟上新版的平台包或功能包时：

1. 站点停着时在站点目录里把包升到要的版本（`pnpm add <包>@^<版本>`；功能包也可以 `docsite.feature.add` 带 `version`，顺带补上新加的接线文件）
2. 由 agent 对照平台包与功能包的 `template/` 逐个判断要改哪些文件：平台包的 `node_modules/@godcreator/god-docsite/template/` 对站点根，
   功能包的 `node_modules/<包名>/template/` 对 `app/features/<功能名>/`。站点自己改过的地方保留，只把模板里新的改动并进去
3. 改动给人过目，再启动检查、按站点自己的流程提交

## 托管与启停

```text
docsite.site.add     {"dir":…}   登记进设置 sites 并启动；工作台每次启动时也启动登记着的站
docsite.site.start   {"dir":…}   启动；已在运行或正在启动就回现状
docsite.site.stop    {"dir":…}   停掉；没在运行就拒绝
docsite.site.list    {}          每个站 { dir, state, url, expectedUrl, error }，state 是 running / stopped / failed
docsite.site.remove  {"dir":…}   从设置 sites 里去掉，在运行就停掉；没登记过就拒绝
```

- 启动前核对站点的 `node_modules` 里装着 `@godcreator/god-docsite`（建在旧包 `@godcreator/docsite-kit` 上的站拒绝），`scripts.dev` 写了 `--port`
- 启动时经环境变量交给站点本 home 的身份码 `DOCSITE_IDENTITY_CODE` 与这次的推送令牌 `DOCSITE_FEED_TOKEN`
- `failed` 时 `error` 写着退出码与最后几行输出；进程退出了不自动重启，修好后 `docsite.site.start`
- 别的插件托管的站（如协作站）不在设置 `sites` 里，由那个插件启停

## 我是谁

每个 home 有一串身份码（`docsite.identity` 查，设置 `identity-code`，第一次加载时生成），站点按 `people.json` 里各人的 `codes` 认人。
只有本机由工作台托管的开发服务（`pnpm dev`）能写评论、改任务；`pnpm build` 之后用 `pnpm start` 跑的是发布版，全面只读，环境变量里有身份码也不认。
协作就是各人在自己电脑上改、经 git 同步，不做多人共用一个网站写入。
侧栏底部写「只读」、悬停提示码不在 `people.json` 里时：

```text
docsite.people.join {"dir":…,"id":"<字母数字_->","name":"<显示名>","gitea":"<可选>"}
```

已有这个 `id` 就把码加进它的 `codes`，没有就新加一项；码已在别人名下、`id` 是 agent 时拒绝。只写文件，要别人也看到得提交。
换电脑时把旧电脑的码填进新电脑的设置 `identity-code`，之后启动的开发服务才用新的码。

## 评论

- 读：`docsite.comments {"dir":…,"page"?:…,"about"?:…}`，读文件，不要站点在运行。`page` 是页面在 `content/` 里的路径（如 `writing/collapse-test.mdx`），
  `about` 是人员 id，只列和他有关的（他发起的、正文或回复里 @ 了他的）。评论串在 `comments/<id>/`：`index.mdx` 是发起的那条，回复各一个 `.mdx`
- 写：`docsite.comment.create {"dir":…,"page":…,"body":…,"anchor"?:…,"as"?:…}` 批整页，给 `anchor`（页面元素的 id）批那个元素；
  `docsite.comment.reply {"dir":…,"thread":…,"body":…,"as"?:…}`，`thread` 是 `docsite.comments` 回的 `id`。两条都要站点在运行。
  agent 以自己的名义写时给 `as`（`people.json` 里 `"agent": true` 的 id），不给就署本 home 的人
- 正文是 MDX：字面的 `<`、`{` 写成 `\<`、`\{` 或放进反引号；`@<id>` 是 @ 某人
- 每串评论有状态：`index.mdx` 的 `status` 是 `open` 或 `resolved`，`resolved` 时还有 `resolvedBy`（谁标的）与 `resolvedAt`；`docsite.comments` 每串带着它们。
  `docsite.comment.resolve {"dir":…,"thread":…,"as"?:…}` 标为已解决，`docsite.comment.reopen` 重新打开，要站点在运行；已经是那个状态就拒绝。网页上点开一串评论、鼠标移到发起的那条上，有同样的按钮（对勾是标为已解决，回转箭头是重新打开），发布版没有。
  标了以后这串带来的 @ 与回复不再算待办；替人标之前先问人
- 人让你照某条评论改页面时：先 `docsite.comments` 找到它，改完页面再 `docsite.comment.reply` 说明改了什么

## 写页面

- 页面放在 `content/`：`名字.mdx`（frontmatter 写 `title`、可选 `description`、`icon`）、`名字.page.tsx`（导出 `meta = { title }` 与默认组件）、`名字.html`（`<title>` 是标题）
- 一页要用几个组件：页面放外面，组件放进同名文件夹，`content/notes/waveform.mdx` 从 `./waveform/` 引用；图片放在页面旁边，用相对路径
- 文件夹的 `meta.json` 写 `title`、`pages`（顺序，写文件名去掉扩展名，TSX 页面也去掉 `.page`）、`icon`（lucide 图标名）；写了 `"root": true` 的是侧栏顶上切换下拉框的一项，不在任何一项里的页面收成以站名命名的一项
- 首页 `/` 是站点的 `app/routes/home.tsx`（fumadocs 的 `HomeLayout`，没有侧栏），不在 `content/` 里：`content/` 根上不放 `index` 页，放了打开首页报错
- 地址就是 `content/` 下的路径；`/api`、`/comments`、`/llms.txt` 与功能包的页面（如协作站的 `/tasks`、`/calendar`）留给站点自己。改了页面，开发服务自己刷新

## 服务 gwbDocsite

别的插件 `inject: ['gwbDocsite']` 后调用，`dir` 都是绝对路径，大小写、斜杠不同的写法算同一个站：

| 方法 | 做什么 |
| --- | --- |
| `init(dir, { port, title })` | 同 `docsite.site.init`，回 `{ dir, platformDependencies }` |
| `addFeature(dir, { packageName, specifier? })` | 同 `docsite.feature.add`；`specifier` 还可以写 `link:` / `file:` 加绝对路径 |
| `start(dir)` / `stop(dir)` / `status(dir)` | 启停与此刻的状态，形状同 `docsite.site.*`；托管与否由调用方自己记，不写设置 `sites` |
| `onStatus(listener)` | 某个站启动、停止、出错时调用 `listener(dir)`，返回撤掉的函数 |
| `push(dir, channel, data)` | 往站点的推送通道推一份 JSON（频道只用字母、数字、`_`、`-`）；站点没在运行就报错 |
| `join(dir, { id, name, gitea? })` | 同 `docsite.people.join`，回 `{ changed }` |
| `identityCode()` | 本 home 的身份码 |
