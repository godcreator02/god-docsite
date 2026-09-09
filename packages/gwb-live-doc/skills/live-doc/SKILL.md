---
name: live-doc
description: 用户要看某个单元 / 某个仓的文档站、问「哪些仓有文档站」「这个站 build 过没有」、要把一个 fumadocs 站起起来在浏览器里打开或停掉、要跑 livedoc 的命令行（check / confirm / render / init）、要知道一个站里哪几页的现状漂了该重写、或者要把反馈投进别的仓的文档站时用。这个件把 units-root 下所有 fumadocs 站扫出来（退役单元不列），十条命令管起停、跑 livedoc、列待重写页、投反馈。
---

# 文档站：在工作台里管所有仓的文档站

两摊事：**起停**（坐在工作台里看某个单元时，把它的文档站起起来看——认站、判 build 新不新鲜、
现挑端口起 `next start`、杀整棵树、到点自动关），与**接 livedoc**（跑命令行、列待重写页、
跨仓投反馈）。

## 十条命令（都经 `gwb_command_run` 按名调，没有顶层的）

**起停那五条加一条清单**

| 命令 | 参数 | 干什么 |
| --- | --- | --- |
| `live-doc.sites` | 无参数 | 扫一遍容器根，回 `{ root, rootExists, currentUnit, retired: { count, units }, sites }`。每条站带 `dir` / `label` / `unit` / `unitPurpose` / `livedoc` / `buildState` / `nodeModules` / `phase` / `running?` / `lastError?` |
| `live-doc.start` | `{ dir, rebuild? }` | 起。`dir` 是站目录的绝对路径（**要在容器根内**）。没 build 过的先 `pnpm run build`；`rebuild: true` 强制重建。回 `{ port, url, pid, deadline, buildState, built, alreadyRunning, note? }` |
| `live-doc.stop` | `{ dir }` | 停，杀整棵进程树。正在 build / 起的也停得了 |
| `live-doc.open` | `{ dir }` | 在系统浏览器里打开一个在跑的站 |
| `live-doc.extend` | `{ dir }` | 到期时刻从此刻按设置重算 |
| `live-doc.running` | 无参数 | 此刻不在 idle 的站 |

**接 livedoc 那四条**

| 命令 | 参数 | 干什么 |
| --- | --- | --- |
| `live-doc.cli` | `{ args: string[], cwd? }` | livedoc 的命令行。`cwd` 不给就落在**选中单元的站** |
| `live-doc.stale` | `{ dir }` | 那个站里哪几页的现状漂了（内部跑 `check --json`） |
| `live-doc.feedback` | `{ dir, title, body, from? }` | 往那个站的反馈区追加一条 |
| `live-doc.feedback-list` | `{ dir }` | 把那个站反馈区里的条目读回来 |

**先 `sites` 再别的**：那几条 `dir` 就是 `sites` 回包里的 `dir`，别自己拼。

## 认站判据

`package.json` 的 `dependencies` 与 `devDependencies` 里有 `fumadocs-core` / `fumadocs-mdx` /
`fumadocs-ui` **任一**就是站——**泛 fumadocs 站，不只认 livedoc 站**。站根另有
`livedoc.config.mjs` 的多亮一个 `livedoc: true` 记号，只是记号，不影响能不能起。

扫法：读容器根（见下），根下一层一个单元目录，**每个单元限深三层**找 `package.json`
（单元根算第一层，`<单元>/<仓>/docs-site` 正是第三层），跳过 `node_modules` / `dist` / `out`
与所有点开头的目录。站的显示名：目录叫 `docs-site` 就用上一级目录名（仓名），否则用自己的名。

**退役单元整个不扫**：单元出生证 `unit.json` 里写了 `retired: true` 的，那个单元一层都不进。
退役单元里的站还在盘上、还起得来，但它讲的是已经作废的东西，列出来会被当成现状读。
跳了几个在回执的 `retired: { count, units }` 里说得出——静默少几条站比多几条更难查。
只认布尔的真（`"true"`、`1` 都不算），宁可多列一个站也不要把在用的单元藏起来。

## 容器根从哪来

设置项 `units-root`（本件自己声明的那项）优先；**留空就借单元文件夹件的同名设置**——经命令总线
`settings.get { section: 'unit-folder', key: 'units-root' }` 按位置读，所以那条条目得叫
`unit-folder`（default home 里正是）。两个件看的是同一个根，不必填两遍。两条路都空回
`code: 'unconfigured'`——那不是出错，是还没配。

## build 判据：三态

`.next/BUILD_ID` 是 `next build` 成功的唯一标志（`next dev` 不写它）：

- **missing**：没有它。`start` 会先 build 再起
- **fresh**：它比 `content/` `src/` `public/` 与站根下所有文件都新
- **stale**：源比它新。改完 mdx 起旧产物看到的是旧页面，会以为没生效。**`start` 不传
  `rebuild` 就直接起旧产物**，回执 `buildState: 'stale'` 加一句 `note`——不弹框、不替人决定；
  界面上是「重建再起 / 直接起」两颗按钮。要看新内容传 `rebuild: true`

没 `node_modules` 的站回 `code: 'no-node-modules'`：先在那个目录 `pnpm install`，本件不替人装。

## 端口策略

**现挑空口，不用站脚本里钉的端口**（`listen(0)` 拿到号就关，再 `pnpm exec next start -p <口>`）。
钉的口只对手跑有意义：容器里已经有四对站钉了同一个口（4313 / 4314 / 4315 / 4320），
按钉的口起第二个必撞。回执里 `url` 才是真地址。

## 到点自动关

设置项 `auto-stop-minutes`（默认 120，0 = 不自动关）。起的时候记一个**绝对到期时刻**，每半分钟
对一次表（`setTimeout` 睡眠后会漂，对表不会）；到点前五分钟界面上给「延长」，`live-doc.extend`
是同一件事。**件卸载 / 工作台关闭时杀光自己起的全部站**——不会留 node 占着端口。

## 界面上的置顶

装了 `gwb-unit-folder` 0.3.0 起，本件局部注入它的选中：当前选中单元的站那组顶到最上并高亮，
选中一变跟着换。没装它清单照常显示，只是没有置顶。`sites` 回包里的 `currentUnit` 就是它。

## 跑 livedoc：`live-doc.cli`

livedoc 是个 CLI 包、不是件，自己挂不上工作台。本件把它包内那个 `dist/cli.mjs` 登记进
`gwbNodeCli`，于是有两个口：

- **`live-doc.cli { args, cwd? }`** —— 平常用这个。`args` 原样递给 livedoc；`cwd` 是站目录的
  绝对路径，**不给就落在选中单元的站**（`gwb-unit-folder` 的选中；那个单元里名字正好叫
  `docs-site` 的优先，只有一个站时就是它）。选中的单元没有站、有好几个、或根本没选中，
  回一句 `code: 'no-site'` 让你给 `cwd`——不替你猜，猜错的代价是在错误的仓里跑了一次 confirm
- **`live-doc.cli-raw`** —— 运行器登记出来的裸口，`cwd` 必须自己给。它存在只是因为运行器
  登记什么名字就往总线上挂同一个名字，缺省那一层没地方塞。别用它

常用调法（`cwd` 按需给）：

```
live-doc.cli {"args":["check"]}                      核对，有红退出码 1
live-doc.cli {"args":["check","--json"]}             机读报告（live-doc.stale 吃的就是它）
live-doc.cli {"args":["confirm"]}                    确认、换记号。**先 commit**：git 记忆只对已提交、工作区干净的内容钉
live-doc.cli {"args":["render","--target","ai"]}     重摆 outputs 生成物（README / AGENTS / SKILL.md 那类）
live-doc.cli {"args":["init","--dir","<仓的绝对路径>"]}  给一个还没有站的仓铺一个六区站（这条跟 cwd 无关）
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
             outputs: [{ to, status: missing|stale|no-frontmatter, missing? }] }],
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

## 起不来的时候

- 回执 `error` 带 `60 秒内端口没应答` / `next start 还没就绪就退了`：多半是站自己起不来，
  看日志（`logger.backlog`，本件把 build 与 next 的输出压在 debug 级）
- 回执 `error` 带 `不是站` / `不在容器根内`：`dir` 给错了，从 `sites` 回包里抄
- 起是起了但页面是旧的：`buildState` 是 `stale`，停了传 `rebuild: true` 再起
- `live-doc.cli` / `live-doc.stale` 回 `code: 'no-node-cli'`：这个 home 里没装 node-cli 件
  （`@godcreator02/gwb-node-cli`），或者解析不到 `@godcreator02/live-doc-cli`

## 本件还代挂三份说明书

livedoc 随包发三份 skill，本件在挂自己那份时把它们一起挂上（cli 包自己挂不上工作台）：
**`livedoc-docs`**（文档站怎么写：六区、五类引用、通用纪律）、**`trajectory`**（什么时候记一张
轨迹卡、怎么落）、**`spec-grill`**（一句话需求先盘问再动手）。写或改任何仓的文档站之前、
记卡之前、接到「要做个什么」之前，先把对得上的那份读出来。
