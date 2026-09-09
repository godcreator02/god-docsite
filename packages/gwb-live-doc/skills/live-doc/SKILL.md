---
name: live-doc
description: 用户要看某个单元 / 某个仓的文档站、问「哪些仓有文档站」「这个站 build 过没有」、要把一个 fumadocs 站起起来在浏览器里打开、停掉、或者站起不来时用。这个件把 units-root 下所有 fumadocs 站扫出来，六条命令能列站（带 build 新鲜度与运行态）、现挑空口起、停、系统浏览器打开、延长自动关、列在跑的。
---

# 文档站：在工作台里一键起某个仓的文档站

一句话：坐在工作台里看某个单元时，把它的文档站起起来看。它是 vscode-docs-site 那个扩展在
gwb 里的形态——认站、判 build 新不新鲜、现挑端口起 `next start`、杀整棵树、到点自动关，
逻辑是同一套。

## 六条命令（都经 `gwb_command_run` 按名调，没有顶层的）

| 命令 | 参数 | 干什么 |
| --- | --- | --- |
| `live-doc.sites` | 无参数 | 扫一遍容器根，回 `{ root, rootExists, currentUnit, sites }`。每条站带 `dir` / `label` / `unit` / `unitPurpose` / `livedoc` / `buildState` / `nodeModules` / `phase` / `running?` / `lastError?` |
| `live-doc.start` | `{ dir, rebuild? }` | 起。`dir` 是站目录的绝对路径（**要在容器根内**）。没 build 过的先 `pnpm run build`；`rebuild: true` 强制重建。回 `{ port, url, pid, deadline, buildState, built, alreadyRunning, note? }` |
| `live-doc.stop` | `{ dir }` | 停，杀整棵进程树。正在 build / 起的也停得了 |
| `live-doc.open` | `{ dir }` | 在系统浏览器里打开一个在跑的站 |
| `live-doc.extend` | `{ dir }` | 到期时刻从此刻按设置重算 |
| `live-doc.running` | 无参数 | 此刻不在 idle 的站 |

**先 `sites` 再 `start`**：`start` 要的 `dir` 就是 `sites` 回包里的 `dir`，别自己拼。

## 认站判据

`package.json` 的 `dependencies` 与 `devDependencies` 里有 `fumadocs-core` / `fumadocs-mdx` /
`fumadocs-ui` **任一**就是站——**泛 fumadocs 站，不只认 livedoc 站**。站根另有
`livedoc.config.mjs` 的多亮一个 `livedoc: true` 记号，只是记号，不影响能不能起。

扫法：读容器根（见下），根下一层一个单元目录，**每个单元限深三层**找 `package.json`
（单元根算第一层，`<单元>/<仓>/docs-site` 正是第三层），跳过 `node_modules` / `dist` / `out`
与所有点开头的目录。站的显示名：目录叫 `docs-site` 就用上一级目录名（仓名），否则用自己的名。

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

## 起不来的时候

- 回执 `error` 带 `60 秒内端口没应答` / `next start 还没就绪就退了`：多半是站自己起不来，
  看日志（`logger.backlog`，本件把 build 与 next 的输出压在 debug 级）
- 回执 `error` 带 `不是站` / `不在容器根内`：`dir` 给错了，从 `sites` 回包里抄
- 起是起了但页面是旧的：`buildState` 是 `stale`，停了传 `rebuild: true` 再起
