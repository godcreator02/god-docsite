# 结果：纯 Vite 能否复现 Fumadocs 新增正文失效（责任定位）

2026-10-12，任务 U。样本：纯 Vite 8.3.4，无 Fumadocs / React Router / React，
数据用普通 txt。只记录实际观察；每条结论都给出复跑命令与日志位置。

## 0. 一句话结论

**纯 Vite 8.3.4 完整复现了 T 的「dev 运行中新增文件不被 import.meta.glob 发现」，且仅相对
base 形态失效（A），根相对 base（B）与无 base（C）两个对照全部正常。责任定位在 Vite 对
`import.meta.glob` 相对 `base` 的 Windows 处理——`toAbsoluteGlob` 用 `node:path` 的
`posix.resolve` 解析相对 base，把 `D:/…` 的 importer 当相对路径拼上 cwd 前缀，产出不含盘符的
假绝对 glob，热更新匹配永不命中。** fumadocs-mdx codegen 在 Windows 上恰好生成这种相对 base
（公开 Vite 用法），所以 T 的症状与本实验 A 变体同源；Fumadocs 只是撞上者，不是制造者。

## 1. 样本与三变体设计

每个变体是独立最小 Vite 站（`cases/variant-*/`：`index.html` + `src/main.js` +
`content/initial-*.txt`），**唯一差异是 `src/main.js` 里 import.meta.glob 的参数**：

| 变体 | import.meta.glob 写法 | 对应 toAbsoluteGlob 分支 |
| --- | --- | --- |
| A | `['./**/*.txt'], { base: './../content', query:'?raw', import:'default', eager:true }` | 相对 base：`posix.resolve(dirname(importer), base)` |
| B | 同 A 但 `base: '/content'` | `posix.join(root, base)` |
| C | `['../content/**/*.txt'], { query:'?raw', import:'default', eager:true }` | 无 base：`posix.join(dirname(importer), glob)` |

A 的形态与 fumadocs-mdx 15.4.7 的 codegen 产物一致（`vendor/evidence`…实际为 T 样本
`site/node_modules/fumadocs-mdx/dist/codegen-CNSKFlLn.js:30-37`：
`base: normalizeViteGlobPath(path.relative(outDir, base))`，Windows 上即 `'./../content/docs'`）。
相对 base 是 Vite 公开支持的用法（`vite/dist/node/chunks/node.js:27941` 的选项校验明确接受
`'/'`、`'./'`、`'../'` 开头），不先判 fumadocs 非法。

诊断用只读插件（`diag/diagnostics.mjs`）：`enforce: 'pre'` 与 `'post'` 两个实例分别记录
`server.watcher` 的 `all` 事件与插件容器 `hotUpdate` 调用（type/file/moduleIds），hook 一律
返回 `undefined`，不 invalidate、不 reload、不增删模块。三变体独立 root、独立 content、
唯一新增文件名，串行执行（Vitest 内），互不命中。

## 2. 判定标准（先于结果写死）

「新增失效」必须在同一变体内同时满足三条观察，缺一不可：
1. watcher 收到新文件的 `add`（否则失败在 watcher 层，结论不成立）；
2. 该文件的 `hotUpdate(type=create)` 里，glob 使用模块（`src/main.js`）**没有**被加入更新列表；
3. 此后 `transformRequest('/src/main.js')` 的产物键集合**不含**新文件（模块未失效重转）。
浏览器层再加一条：页面打开后写入新文件、不刷新，DOM 清单 10 秒内是否自动出现新键。

## 3. 结果（Vitest 集成，两轮，8/8 通过；logs/vitest.log）

| 变体 | watcher add | hotUpdate(create) moduleIds 含 main.js | transform 产物含新键 | 浏览器自动更新 |
| --- | --- | --- | --- | --- |
| A 相对 base | ✅ 到达 | ❌ 空 | ❌ 不含 | ❌ 10 秒不变 |
| B '/content' | ✅ 到达 | ✅ 含 | ✅ 含 | ✅ 自动出现 |
| C 无 base | ✅ 到达 | ✅ 含 | ✅ 含 | （未开浏览器，服务端证据一致） |

- A：产物键始终 `["./initial-a.txt"]`；`hotUpdate:pre` 与 `hotUpdate:post` 的 moduleIds 均为
  `[]`——`vite:import-glob` 的 matcher 没把 main.js 追加进更新列表（事件样例见
  `logs/events-variant-a.json`）。
- B：第一条 `create` 事件 `hotUpdate:post.moduleIds` 含 `…/src/main.js`（pre 为空，post 补上，
  正是 import-glob 在核心插件阶段追加的）；产物键含 `./added-…txt`。
- C：同 B，键形态为 `../content/added-…txt`（无 base 时键相对 importer）。
- 浏览器对照（真实 dev server + 真实磁盘写入，无合成事件、无刷新）：
  - `serve-events-variant-a.json`：watcher `add`（2 次）+ hotUpdate `create`（pre/post 各 2 次）
    全部 `moduleIds: []`；页面 `#glob-keys` 10 秒后仍为旧清单。
  - `serve-events-variant-b.json`：第一条 `create` post 含 `src/main.js`；页面清单自动出现
    `./added-variant-b-browser-1791772442293.txt`。
- 第一轮（断言固化前）与第二轮（断言固化后）结果一致，可复现。

## 4. 路径层与 matcher 层证明（Vitest 内，`pnpm test` 前两个 describe）

本机 node v24.14.1 / Windows：

```
posix.isAbsolute("D:/unitfolders/…/src") = false          ← 根因
posix.resolve("D:/unitfolders/…/src", "./../content")
  = "/unitfolders/oz47p-docsite-kit/D:/unitfolders/…/variant-a/content"   ← 假绝对路径
win32.resolve(同参数)
  = "D:/unitfolders/…/variant-a/content"                  ← 正确
```

posix.resolve 把 cwd（`D:\unitfolders\oz47p-docsite-kit`）去盘符转为 `/unitfolders/…` 前缀，
再把 `D:/…` 当相对路径拼接，产出**不以盘符开头**的假绝对路径。随后
`posix.join(dir, '**/*.txt')` 得到的 globsResolved 与 watcher 事件文件（`D:/…` 开头）：

```
picomatch(假glob, {noextglob:true})("D:/…/content/initial-a.txt") = false   ← A 失败
picomatch(posix.join(root,'/content/**/*.txt'))(同文件)            = true    ← B 正常
picomatch(posix.join(importerDir,'../content/**/*.txt'))(同文件)   = true    ← C 正常
```

对应 vite 8.3.4 编译产物 `dist/node/chunks/node.js`：
- `27965-27968`：`toAbsoluteGlob` 的 base 分支（`dir = posix.resolve(globSafePath(dirname(importer)), base)`）
- `27862`：初次扫描 `glob(globsResolved, …)`（tinyglobby）
- `27668-27689`：transform 时把 `globsResolved` 编译成 picomatch matcher 存入 `importGlobMaps`
- `27694-27704`：`hotUpdate({type:'create'|'delete'|…})` 用 `matcher(file)` 匹配，匹配不上就不把
  glob 使用模块加入更新列表

（T 样本与本 probe 各自安装的 vite 8.3.4 为同一版本；行号取自 T 的 node_modules 副本，
本 probe 副本同版本未改动。）

## 5. 为什么「已有文件正常、新增失效」（初始扫描的容错）

`tinyglobby-check.mjs` 实测：同一个假 glob 传给 tinyglobby（vite 初次 transform 用的扫描器），
无论 cwd 是 root 还是假前缀，**都能返回全部真实文件**。原因在 tinyglobby 0.2.17
`dist/index.mjs:136-143` 的 `normalizePattern`：pattern 先经 **win32 语义的 `isAbsolute`**
判定，再 `posix.relative(escapedCwd, pattern)` 相对化，之后从 cwd 爬目录树、按相对路径匹配，
前缀差异被这套相对化容错吸收。而 `vite:import-glob` 热更新用的 `pm(globsResolved)(file)` 是
**原样字符串匹配绝对路径**：假 glob 静态前缀 `/unitfolders/…` 与事件文件 `D:/unitfolders/…`
开头即不同，永不匹配。

即：同一份 globsResolved，两个消费者行为不同——扫描（tinyglobby）容错命中 → 初始与重启后
文件都在；热更新匹配（picomatch）失败 → 运行中新增的文件不触发模块失效。这与 T 观察到的
「运行中新增 404 / 无 HMR 消息、重启后 200」完全同构。

## 6. 与 T（官方 fumadocs 模板）的对齐

- T 的 vite 版本 8.3.4，与本实验一致；症状（运行中新增不被发现、无 HMR 日志、重启后发现）与
  A 变体逐条吻合。
- **T 命中已闭合（源码实测，追问补验 2026-10-12）**：fumadocs-mdx 15.4.7 在 dev（vite 环境）下
  宏展开固定 `target: "vite"`（`dist/vite/index.js:100`、`dist/transform-YLS_tnU6.js:268-271`），
  `async: true` 与否都经 `generateGlobImport` → `generateViteGlobImport` 生成相对 base：
  `transform-YLS_tnU6.js:282` 算出绝对 base（`path.resolve(root, dir)`），codegen 再
  `path.relative(outDir, base)` 折回 `'./../content/docs'`（`codegen-CNSKFlLn.js:30-37`）。
  **没有任何公开选项可以改这个写法**（`defineDocs` 的 `dir` 只决定内容目录；target 固定）。
- fumadocs-mdx 自己的 watcher（`dist/vite/index.js:125-131`）只处理 `fumadocs.config.ts` 变更
  （比对 `core.configPath`），**对内容文件新增不做任何处理**，完全依赖 vite 的 glob 热更新链路——
  即本实验证明坏掉的那条。
- 结论口径：**「是 Vite 还是 Fumadocs 的问题」→ 缺陷在 Vite 的相对 base Windows 处理；
  Fumadocs 的生成形态只是触发条件，且该形态是公开合法用法。**

## 6a. 降级 Vite 是否可行（追问补验，实测）

| vite 版本 | 相对 base 分支 `posix.resolve(importer…)` | 结论 |
| --- | --- | --- |
| 8.3.4（本 probe + T） | 存在（node.js:27967），缺陷已复现 | 命中 |
| 7.3.7 | **存在同一分支**（dist/node/chunks/config.js，`else dir = posix.resolve(importer ? globSafePath(dirname$2(importer)) : root, base);`） | 同样命中 |
| 6.4.4 / 5.4.21 | `toAbsoluteGlob` 只有 4 参，**无 base 选项**（base 是 vite 7 新增） | 无此缺陷，但见下 |

peer 范围把降级路线封死：fumadocs-mdx 15.4.7 的 peer 是 `vite: "7.x.x || 8.x.x"`，
@react-router/dev 8.4.0 是 `vite: ^7.0.0 || ^8.0.0`。**能降到的最低版本 vite 7 恰好同样命中**；
降到 vite 5/6 则 fumadocs-mdx 15.4.7 生成的 `base:` 选项直接报「Unknown glob option」起不来，
需要连 fumadocs-mdx / fumadocs-core / react-router 全家一起降——工程量大、引入一堆未知差异，
只为绕一个一行可修的缺陷。tarball 副本与对照记录在 `logs/vite-history/`。

## 7a. 实验补丁验证（probe 内，未扩散）

指令来源：用户在 ZCode 会话追加原话「改vite只有一行是吗？加上试试呢」（2026-10-12）；
随后主会话收口：补丁只留本 probe、保留原版基线与补丁对照双轨证据、标实验补丁不宣称通用修复。

- 补丁内容：`patches/vite@8.3.4.patch`（`pnpm patch` 正规流程生成并经 `pnpm-workspace.yaml`
  的 `patchedDependencies` 挂载），改 `dist/node/chunks/node.js:27967` 相对 base 分支一个词：
  `posix.resolve(…)` → `posix.join(…)`（diff 里另有 4 行无害缩进变化；不碰全局 pnpm store，
  pnpm 把包复制进本目录 `.pnpm` 后打补丁）。
- 改法依据：与 `base[0]==='/'` 分支（`posix.join(root, base)`）和 `'../'` 分支（`posix.join(dir, glob)`）
  同构；`patch-check.mjs` 实测 4 组 base 用例（含 `./../../` 深层上跳）`posix.join` 输出与
  `win32.resolve` 完全一致，且 `posix.join` 不做绝对路径判断、纯字符串拼接，不会把 cwd 前缀拼进
  盘符路径。
- 验证（双轨，测试自动探测已安装 vite 是原版还是补丁版并套对应断言组，两组证据互不覆盖）：
  - **原版基线**：`pnpm run test:original`（脚本临时移除补丁→install→跑→finally 恢复）→ 8/8：
    A 失效断言成立（模块不进更新列表、产物键不含新增）、B/C 成功。与 2026-10-12 上午三轮一致
    （`logs/vitest.log`、`logs/vitest-original.log`）。
  - **补丁对照**：`pnpm test`（补丁态）→ 8/8：三变体全部成功（`logs/vitest-patched.log`）。
  - 同一断言补丁前失败（A 组反向断言通过）、补丁后通过，证明该行即缺陷与修复的分界。
- **定位：实验补丁，仅在本 probe 内证明因果，不宣称通用修复。** 未测场景随全面验证收敛
  （2026-10-12 追加验证后剩余）：非 Windows 平台（`posix.join` 纯字符串拼接、语义平台无关，
  但无环境实测）；真实虚拟模块端到端（`importer` 缺省走 root 锚点——patch-check 用例证明
  `posix.join` 正确且原版 `posix.resolve` 同样坏，即补丁对该分支是修复，但未起真实虚拟模块跑）。
  **已关闭的未测项**：build 路径（补丁版 `react-router build` 成功，`/`、`/docs`、`/docs/test`
  全部预渲染，`logs/fumadocs-build-patched.log`）；否定 glob（变体 D：相对 base +
  `!./skip-*.txt`，双轨 10/10，skip 文件在初始键与新增中均被正确排除）；`'**'` 开头 glob
  （代码事实：`toAbsoluteGlob` 对其直接原样返回、不读 dir，补丁零影响）。rolldown-vite 变体
  不适用（本栈用 vite 正式版 8.3.4）。
- 注意事项：`pnpm run test:original` 中途被杀会留下无补丁状态（finally 不执行）；重跑
  `pnpm install` 即恢复补丁态。
- 边界：补丁与 lock 变更只存在于本 probe 目录；T 官方样本、docsite-kit 正式仓、父 workspace、
  全局依赖均未动；未提交、未发布。

## 7b. 补丁在真实 fumadocs 站上的验证（probe 内两阶段，2026-10-12）

指令来源：用户在 ZCode 会话追加原话「那你把这个补丁加上fumadocs看看能不能成功运行」。
做法：在本 probe 内复制 T 的官方快照 25 文件为 `fumadocs-site/`（依赖同 T：fumadocs-core /
@fumadocs/base-ui 16.17.1、fumadocs-mdx 15.4.7、react 19.3.0、react-router 8.4.0、
tailwindcss 4.3.3、vite 8.3.4），**不碰 T 本体与正式仓**；同一站点、同一条启动命令
（`react-router dev --port 5540 --host 127.0.0.1`），两阶段唯一变量是 vite 是否打了 7a 的实验补丁。

| 阶段 | vite | 站点 | 运行中新增 mdx 后的观察 |
| --- | --- | --- | --- |
| 一（复现） | 原版（posix.resolve） | 正常启动，`/docs` 200 | `probe-add-original.mdx` 写入后 29 次/秒轮询 **全部 404**；`/docs` 索引无新页链接；dev 日志零新行（无编译、无 HMR）——与 T 的观察一致（`logs/fumadocs-dev-original.log`） |
| 二（修复） | 补丁版（posix.join，pnpm-workspace 恢复 patchedDependencies 后 install） | 正常启动，`/docs` 200；重启扫描照常发现阶段一的 `probe-add-original`（**基线不回归**） | `probe-add-patched.mdx` 写入后**第 1 秒轮询即 200**；SSR HTML 含标题；`/docs` 索引含新页链接；dev 日志出现 `[vite] (ssr) page reload content/docs/probe-add-patched.mdx`（`logs/fumadocs-dev-patched.log`） |

结论：**实验补丁 + fumadocs 能成功运行，且把「运行中新增正文失效」修复为写入即被发现**；
重启扫描发现（本来正常的行为）不受补丁影响。仍属 probe 内实验验证：7a 列出的未测场景
不因此关闭；转正式采用前照旧需补。

## 7c. 补丁进入 docsite-kit 正式仓与全面验证（2026-10-12，用户授权）

用户在 ZCode 会话明确指示「这个属于关键改动，你在 agents.md 里记录一下……把补丁方案全面
验证一下没有问题先」。执行记录：

- **全面验证（probe 内）**：四变体双轨（新增变体 D：相对 base + 否定 glob `!./skip-*.txt`，
  证明补丁对否定形式同样生效且排除正确）各 10/10；补丁版 `react-router build` 成功（`/`、
  `/docs`、`/docs/test` 全部预渲染）；patch-check 扩展无 importer（root 锚点）用例（原版
  `posix.resolve` 同样坏、补丁 `posix.join` 正确）；`'**'` 分支不读 dir 的代码事实核实。
- **进正式仓**：`patches/vite@8.3.4.patch` 复制到仓根 `patches/`、`pnpm-workspace.yaml` 登记
  `patchedDependencies`、`pnpm install`；lock 中全部 vite 实例（vitest / fumadocs-mdx /
  @react-router/dev / @tailwindcss/vite 的 peer）均为补丁版，磁盘上两个无补丁 vite 目录为
  孤儿残留（lock 引用计数 0，无害）。
- **正式自述站端到端**：新起 dev（5542，避免动他人 4430 实例），运行中向 `site/content/writing/`
  新增 `probe-patch-check.mdx` → **第 1 秒 200**、页面含标题、`/writing` 索引即含链接、
  dev 日志出现 `(ssr) page reload`（`logs/selfsite-dev-patched.log`）。验证后测试页已删、
  服务已停。
- **记录**：仓 `AGENTS.md`「怎么跑」节新增补丁条目（为什么挂补丁、升级 vite 前先跑本 probe
  验上游、修了就撤）；轨迹卡 `trajectory/2026-10-12-vite-relative-base-patch.mdx`。
  `CLAUDE.md` 为引用式（`@AGENTS.md`）无需同步。未提交（等用户/主会话审后一并提交）。
- 环境事实：中途一次并行执行被取消，杀掉了 `test:original` 的恢复逻辑，probe 一度处于无补丁
  状态（那次「build 成功」因此跑在原版上，已作废重测）；该风险已写进 7a 注意事项。

## 7. 潜在修复位置与公开配置可行性（仅说明，未实施）

- 上游修复位置：`vite/src/node/plugins/importMetaGlob.ts` 的 `toAbsoluteGlob` 相对 base 分支
  （编译产物 node.js:27967）。把 `posix.resolve(dirname(importer), base)` 换成平台正确的
  resolve（如 `path.resolve` + `normalizePath`，与 `win32.resolve` 实测等价正确），产出以盘符
  开头的真绝对 glob，matcher 与扫描即一致。
- 站点侧公开配置规避：**不存在**。fumadocs-mdx 生成形态无公开选项（见第 6 节）；相对 base 是
  vite 公开用法，站点自身配置无法干预 fumadocs 的 codegen 输出。
- 现实可选路径（按推荐顺序）：
  1. `pnpm patch vite` 本地一行补丁修 `toAbsoluteGlob`（根因层，覆盖站点内一切相对 base 用法；
     **已在 probe 内做成实验补丁并双轨验证，见 7a**——正式采用前需补 7a 列出的未测场景）；
  2. `pnpm patch fumadocs-mdx` 把 `generateViteGlobImport` 的 base 改为根相对
     （`'/' + slash(path.relative(root, base))`，root 在 `transformMacroModule` 作用域可得）；
     只堵 fumadocs 一个来源，键集合语义不变（仍相对 base）；
  3. 向 vite 上游报 issue/PR（本 probe 即最小复现），修掉后撤补丁；可同时给 fumadocs 提
     「Windows 上生成根相对 base」的规避建议。
- 降级 vite 不可行，见第 6a 节。

## 8. 未验证 / 缺口

- ~~T 站 fumadocs 实际生成形态未验证~~ **已闭合**（第 6 节，源码实测：dev 宏展开必生成相对
  base，async 与否同形态，无公开选项）。
- 浏览器 console 流仍取不到（同 T 的工具缺口）；本实验用 DOM 文本 + 服务端诊断事件判定，
  页面无交互需求，无合成事件注入。
- C 变体未做浏览器层观察（服务端证据与 B 同构）；如需可按 README 第 4 步补。
- vite 5/6/7 的结论基于 dist 代码对照（同一函数同一分支），未各装一版跑行为实验（5/6 无
  base 选项，行为差异由选项校验直接决定，无需跑）。

## 9. 时间线（本地时刻）

| 时刻 | 事件 |
| --- | --- |
| ~10:15 | 读 T 样本与 vite 8.3.4 dist，确认 toAbsoluteGlob / hotUpdate / codegen 三处源码 |
| ~10:17 | path-check.mjs：posix.resolve 假路径实测成立 |
| ~10:22 | 隔离安装 vite 8.3.4 + vitest 5.0.3 |
| ~10:27 | 第一轮 Vitest：A 失效、B/C 正常（观察口径） |
| ~10:32 | 断言固化 + 路径/matcher 证明补入，第二轮 8/8 通过 |
| ~10:40 | 真实 server 5540/5541 + 浏览器对照：A 页面 10 秒不变、B 自动更新 |
| ~10:47 | tinyglobby 容错机制实测定位（normalizePattern win32 isAbsolute + posix.relative） |
| 收尾 | 停服务（5540/5541 无监听）、清理 added-* 残留、写 result/handoff |

## 10. 边界遵守

只写本 probe 目录；T 样本与其他 probe 只读引用；未改 vite 源码 / 全局依赖 / 父 workspace /
其他仓；未提交、未推送、未发版、未发 issue、未归档；主会话台账未动。
