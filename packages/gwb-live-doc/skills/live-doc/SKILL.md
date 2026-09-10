---
name: live-doc
description: 要跑 livedoc 的命令行（check / confirm / render / trajectory）、要知道一个站里哪几页的现状漂了该重写、要给一个刚建好的 fumadocs 骨架装上 livedoc 的六区、或者要把反馈投进别的仓的文档站时用。这个件管的是站里内容的正确性；扫站、起停、建骨架那半归站件 gwb-docs-site，两个件互不依赖。
---

# livedoc 件：站里内容的正确性

本件管一件事——**站里的内容对不对**：钉码、核对、确认、渲染、装配六区、列待重写页、跨仓
投反馈。它不知道站是谁建的、有没有在跑。

**站的一生归站件**（`@godcreator02/gwb-docs-site`，命令 `docs-site.*`）：扫容器根找站、
铺标准 fumadocs 骨架、判 build 新鲜度、现挑空口起停、到点自动关、那一格窗格。要「有哪些站」
先调 `docs-site.list`，本件那几条命令的 `dir` 就是它回包里的 `dir`，别自己拼。

## 五条命令（都经 `gwb_command_run` 按名调，没有顶层的）

| 命令 | 参数 | 干什么 |
| --- | --- | --- |
| `live-doc.cli` | `{ args: string[], cwd? }` | livedoc 的命令行。`cwd` 不给就落在**选中单元的站**（清单问站件要） |
| `live-doc.attach` | `{ dir, title? }` | 给一个**已经建好的 fumadocs 骨架**装上六区。`dir` 是站目录的绝对路径 |
| `live-doc.stale` | `{ dir }` | 那个站里哪几页的现状漂了（内部跑 `check --json`） |
| `live-doc.feedback` | `{ dir, title, body, from? }` | 往那个站的反馈区追加一条 |
| `live-doc.feedback-list` | `{ dir }` | 把那个站反馈区里的条目读回来 |

另有一条 `live-doc.cli-raw`：运行器登记出来的裸口，`cwd` 必须自己给。它存在只是因为运行器
登记什么名字就往总线上挂同一个名字，缺省那一层没地方塞。**别用它。**

## 这个件要另外装一个包

`@godcreator02/livedoc` 是本件的 **peer**，装本件**不会**顺带把它装进 home——它是那个真干活
的 npm 包（命令行与那两份 skill 都在它里面）。没装的时候件照样挂上，但上表前三条一调就回
`code: 'no-livedoc'`：

```
plugins.install {"pkg":"@godcreator02/livedoc"}
```

装完那三条命令立刻能用，**不必重挂本件**——件每次现查 `<home>/node_modules/@godcreator02/livedoc`，
不缓存路径。只有随那个包发的两份 skill（`livedoc-docs` / `trajectory`）例外：目录是挂载那一刻
报给 skills 件的，装完得把本件停用再启用一次才挂得上。

peer 而不是普通依赖是有原因的：普通依赖只会被 pnpm 塞进件私有的 `node_modules`，件就只能
拿模块解析出来的**真实路径**（带版本号），而 pnpm 升级不清旧目录——升过版之后件照读旧文件，
读得通、零报错。装成 home 的直接依赖，那条路才是一条随 `pnpm add 包@新版本` 改指向的软链。

## 建一个新站是两步，不是一步

```
docs-site.create {"dir":"<仓>/docs-site"}     站件：铺标准 fumadocs 骨架（一个集合、一条路由、一页 index）
live-doc.attach  {"dir":"<仓>/docs-site"}     本件：在骨架上装六区、livedoc.config.mjs、mdx 接线、名册脚本
```

**顺序不能反，中间不要改文件。** `attach` 只在刚铺好的骨架上跑：站里已经有
`livedoc.config.mjs`、或者 `content/` 下已经有骨架之外的内容，它报一句「这个站已有内容，
请人工接线」退非零，一个字不改写。给一个跑了半年的站加 livedoc 就是这条路——人工接线，
比自作聪明地 AST 改写安全。

`attach` 装的东西：六个集合（`source.config.ts`）、六条路由与侧栏六个根节、`livedoc.config.mjs`、
mdx 接线（投影块与术语组件）、名册脚本、五个区的骨架页，`package.json` 里补上 livedoc 的依赖
与 `doc` / `doc:confirm` / `doc:render` 三条脚本。**只写文件**：不跑 `pnpm install`。装完接着做：
在站目录 `pnpm install`、`pnpm doc:render`（摆出仓根 AGENTS.md / README.md）、`pnpm doc`（check）。
起手页写了第一条引用怎么钉。

实现在 livedoc 命令行那边（`livedoc attach`），本件只是入口——**livedoc 得能在没装工作台的
仓里独立用**。

## 跑 livedoc：`live-doc.cli`

livedoc 是个 CLI 包、不是件，自己挂不上工作台。本件把它包内那个 `dist/cli.mjs` 登记进
`gwbNodeCli`，`live-doc.cli` 在它外面包了一层缺省 cwd。

`cwd` 是站目录的绝对路径（那儿有 `livedoc.config.mjs`），**不给就落在选中单元的站**——清单
问站件要（`docs-site.list` 回包里的 `currentUnit` 与 `sites`），那个单元里名字正好叫
`docs-site` 的优先，只有一个站时就是它。站件没装、选中的单元没有站、有好几个、或根本没选中，
回一句 `code: 'no-site'` 让你给 `cwd`——不替你猜，猜错的代价是在错误的仓里跑了一次 confirm。

```
live-doc.cli {"args":["check"]}                      核对，有红退出码 1
live-doc.cli {"args":["check","--json"]}             机读报告（live-doc.stale 吃的就是它）
live-doc.cli {"args":["confirm"]}                    确认、换记号。**先 commit**：git 记忆只对已提交、工作区干净的内容钉
live-doc.cli {"args":["confirm","content/docs/a.mdx"]}  按页限定：只动点名的那几篇
live-doc.cli {"args":["render"]}                     重摆 outputs 生成物（README / AGENTS / SKILL.md 那类）
live-doc.cli {"args":["trajectory"]}                 列轨迹卡的盘 / 树 / 主干
```

回执 `{ ok, cwd, exitCode, timedOut, durationMs, stdout, stderr }`。**`check` 有红时退出码是 1，
那是核对结果不是命令失败**——读 `stdout.text`。时限 110 秒。

## 哪几页该重写：`live-doc.stale { dir }`

内部跑 `livedoc check --json`，把整份报告收敛成「待重写页」：

```
{ dir, ok, red, docs,
  pages:  [{ doc, red,
             pins:    [{ target, kind, status: changed|missing, line, lines, reason?, diff? }],
             outputs: [{ to, status: missing|stale|no-frontmatter, fresh: false, missing? }] }],
  others: [{ doc, orphans, components }],
  strays: [...], trajectory: [...] }
```

- **`pages` 才是待重写页**：钉漂了（`changed` 内容变了 / `missing` 引用指向空气），或者
  outputs 落点不新鲜。`line` 是记号在文档里的第几行，`lines` 是被引段今天在源文件里的位置，
  `diff` 是变了的那几行——按这三样定位，**只改漂移的段落，不重排全页、不动固定块**
- **`others` 不用重写正文**：只有孤儿记录（`confirm` 清掉）或名册外组件（配置里补压平规则）
- `strays` 是记录簿里还留着、文档已经不在的；`trajectory` 是病卡
- `unconfirmed`（白，还没确认过）不算漂移，不进这张表

站根没有 `livedoc.config.mjs` 的回 `code: 'not-livedoc'`——这条只对接了 livedoc 的站有意义。

## 跨仓投反馈：`live-doc.feedback`

在 A 仓干活时发现 B 仓的东西不好用，不离开会话就能把话投进 B 的文档站：

```
live-doc.feedback {"dir":"<B 站目录>","title":"一句话说清是什么事","body":"正文，可多段","from":"A 仓（这个会话）"}
```

追加到 `<dir>/content/feedback/inbound.mdx` 末尾（页不在就先建），带今天的日期与来源。
格式是 livedoc 站模板定的那个（`## <日期> <标题>` + `来源：` 一行 + 正文），**只写这一页、
不 commit、不动别的页**——那个仓的人自己看了再提交、处理完删条目。`from` 不给是「未署名」，
写成「哪个仓 / 哪个会话」最有用。`live-doc.feedback-list { dir }` 把条目读回来
（`{ date, title, from, body }`），页还不在时 `exists: false`、空表，不是错。

本仓自己的重复操作候选不投这儿——那是站里 `content/feedback/hatch.mdx`，仓内直接编辑。

## 不顺的时候

- `live-doc.cli` 回 `code: 'no-site'`：这个 home 里没装站件，或者选中的单元挑不出唯一的站
  ——给 `cwd`，值从 `docs-site.list` 回包里抄
- `live-doc.attach` 回 `不是目录`：`dir` 给成了仓目录而不是站目录，或者骨架还没铺；
  退出码 1 且 stderr 里是 `这个站已有内容`：那站已经接过线或已经有内容了，人工接线
- `live-doc.stale` 回 `code: 'not-livedoc'`：那个站还没接 livedoc，先 `live-doc.attach`
- 任一条回 `code: 'no-livedoc'`：这个 home 里没装 `@godcreator02/livedoc`——见上面「这个件要
  另外装一个包」，回执里连路径带装法都写着
- 任一条回 `code: 'no-node-cli'`：这个 home 里没装 node-cli 件（`@godcreator02/gwb-node-cli`）

## 本件还代挂两份说明书

livedoc 随包发两份 skill，本件在挂自己那份时把它们一起挂上（那个包自己挂不上工作台）：
**`livedoc-docs`**（文档站怎么写：六区、五类引用、通用纪律）与 **`trajectory`**（什么时候记
一张轨迹卡、怎么落）。写或改任何仓的文档站之前、记卡之前，先把对得上的那份读出来。
通用开发方法论（盘需求、并行派活、自解释代码）不在这儿，随开发件 `gwb-dev-loop` 走。
