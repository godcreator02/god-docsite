# 协作站任务与日历：重写收尾 + 测试协作站 方案

日期：2026-10-13 深夜起执行。来源：与用户在冻结讨论里对齐的方案（M1–M4），本文件是执行正本，做完一项勾一项。

**目标**：任务页与日历页在新地基（@godcreator/docsite-kit 0.3.0）上真实可用；本仓里有测试协作站（像 `site/` 之于 docsite）；Gitea 上开着这个项目；carol 的隔离 home 里把通知、QQ 私聊、QQ 任务组整条链路测通。**代码改动只落在本仓**，已有站点（hybrid-mmc 等）一概不管、不迁移、不适配。

## 四份东西的关系

| 东西 | 位置 | 角色 |
| --- | --- | --- |
| 正本（开发台） | 本仓 `collab-test/` | 内容进主仓 git；依赖 `workspace:*`，改包即见效；gwb-docsite 托管（端口 4450） |
| Gitea 仓 | 测试组织里的协作仓 | 远端；从正本**导出**推送（导出时依赖从 `workspace:*` 切成发版号） |
| default 的克隆 | 标准项目文件夹 `<组织名>/collab-test` | godcreator 本人加入项目：插件盯、站点常驻、通知 |
| carol 的克隆 | carol 隔离 home 里的项目文件夹 | 集成测试的「另一个成员」，全链路验证 |

正本唯一；运行实例的数据漂移不回写正本，实例烂了从正本重导（导出流程写成 collab 分区文档）。

## 背景事实（调查结论）

- 协作站三包一插件 2026-10-13 自旧仓并入本仓，代码完整（任务页、日历、通知、写入接口、插件命令全在），但整体钉在旧地基 `^0.1.x` 上，从未在 0.3.0 上跑过。
- 0.3.0 的破坏点：`@godcreator/docsite-kit` 删了出口 `./init`（`featureRouteFilesOf` 挪到 `./routes`，新站由新版建站器写、协作站侧无需改 import）；`gwbDocsite.init` 的 `port`、`title` 变必给，已有站点再调 init 直接拒绝（「重写已有站点骨架」通道没了——接受新语义，文档如实改）。
- carol 的旧隔离 home `carol-2610021856`（身份 carol-test）已于 10-10 删除；Gitea 用户 carol-test 还在，hybrid-mmc 组织还在，上次回归流程记录在旧仓轨迹卡 `2026-10-08-regression-run-0-25-6.mdx`。
- 测试 QQ 机器人凭据：用户已提供（AppID 1905731977，secret 经凭据通道写入 carol home，不落任何文件）。default 的机器人（1905731313）不能共用：同 AppID 两个 home 互踢。

## M1 重写 + 开发台（改动全在本仓）

用户中途定调（2026-10-13 深夜）：**按 fumadocs 最原生的方式重写，不是做兼容；重写版不考虑任何已存在的站点，唯一正确性标准是本仓 docsite 体系内部正确。**旧代码（自旧仓搬入的 collab-site 实现）只当功能参考——要哪些功能（任务页三块、记录页、写入接口、日历日志、通知栏、RecordLink、repo: 链接）、写入规则与数据形状（collab-model），实现全部照 0.3 地基的约定与 fumadocs / React Router framework 的原生模式重写。

### M1a 重写与跟升

- **collab-site 功能包（重写主体）**：照地基 0.3 的功能包约定（`docsite.features` → 站点 `app/site/` 接线）与 fumadocs 原生组件重写：feature 出口（`./routes`、`./site`、`./site-server`）、路由模块（React Router framework 的 route module：loader/action）、UI（fumadocs 主题色与 base-ui 组件，不自带旧 UI 壳）、站点检查。旧 src 实现删除，git 留史。
- **collab-model（跟升）**：纯逻辑无 fumadocs 色彩，`comments` 出口的 import 改为直接依赖 `@godcreator/docsite-comments`，peer 升 `^0.3.0` 对齐地基线。
- **plugins/collab（跟升）**：`gwbDocsite.init` 调用按新签名（port/title 必给、已有站点拒绝），`files` 出口 import 改能力包直连，peer/dev 全部跟升。
- 站点协议号等「对外部旧站的兼容」机制一律不为旧站留分支；仓内插件↔功能包的一致性照常保证。
- 文档同一个提交里改：collab 分区相关页、AGENTS「暂钉 ^0.1.x」一句、钉码黄灯照 docs-site 说明书处理。
- 边界：不碰地基包；发现必须改地基的事单独拎出来说。

### M1b 测试协作站（正本）

- `collab-test/`：`collab/records/` 测试数据（任务横跨 todo/doing/done、模块含过期截止日、指派给 carol/bob/godcreator）+ `site/`（手写骨架：`docsite.features: ["@godcreator/collab-site"]`、依赖 `workspace:*`、`app/site/` 六个接线文件照 docs-site 的接法、`app/` 其余照地基骨架）+ `site/people.json`（godcreator、carol、bob）+ `site/journal/` 两三天日志（含 RecordLink）+ `content/` 一两页。
- 不 git init（内容归主仓 git）；`pnpm-workspace.yaml` 收录；`docsite.site.add` 托管，端口 4450。
- 验收（flashworker 视觉 + 手动流）：
  - 任务页三块（人员卡片计数、模块甘特图、看板）与两层筛选联动
  - 任务/模块各自页的编辑权限差异（作者 vs 非作者字段、删除按钮只给作者与负责人）
  - 新建/改/删走 `/api/collab` 的完整来回（含被写入规则拒绝时的原话展示）
  - 日历月历切换、截止日记号、日志页与前后日跳转、无日志的虚线日
  - RecordLink 在页面/日志/评论三处；评论挂在任务页
- 完成判据：受影响包测试全量绿、docs-site `docfirst check`/`render`/`build` 过、上面验收清单过。

## M2 发版（本仓四包）

前置：读 skill gwb-release；发前跑 `pnpm test:verified`。顺序：collab-model → collab-merge-check → collab-site → plugins/collab。peer 范围 `^0.1.x`→`^0.3.0` 对下游是破坏性，预计升 x，具体照 gwb-release 契特定。`devkit.release` 发；发完升 default 的 gwb-collab。

## M3 Gitea 开组织放协作仓

1. 建私有组织（拟定名 `collab-test`）+ `members`/`bots` 团队、collab-bot 进 bots、组织密钥 `COLLAB_BOT_TOKEN` 复用现有令牌（Gitea 网页/管理员 API；执行器与 ntfy 是 NAS 共用，不用装）。
2. carol-test 加 members。
3. 导出运行实例：复制 `collab-test/` → 依赖切发版号 + `pnpm install` → git init → 带 `.gitea/workflows/collab-auto-merge.yaml`（collab-merge-check 模板）→ 推组织协作仓 main。
4. `collab.repo.setup` 配协作仓（负责人 godcreator）、`collab.org.setup` 配组织 webhook、people.json 加 carol 条目（负责人提交）。
5. default `collab.project.add`（标准位置克隆）：站点常驻、`collab.submit` 全链路（执行器合并）、通知出现。

## M4 重建 carol home 集成测试

1. `devkit.home.new` 开 home（拟名 carol）；装 gwb-gitea、gwb-docsite、gwb-collab（M2 发的正式版）、gwb-qq-bot、gwb-zcode。
2. 管理员 API 重建 carol-test 令牌（全权限读写）配进 gwb-gitea；qq-bot 配 AppID 1905731977 + secret（凭据通道）、`qq-bot.reconnect`、白名单与 owner-openid 照 qq-bot 说明书流程走。
3. `collab.project.clone` 克隆测试项目 → 插件自动启动站点、把 carol 身份码写进 people.json 自己那项 → `collab.submit` → 执行器放行合并。
4. 验证清单：
   - 指派给 carol 的任务出现在「找我的」并经 QQ 私聊通知（连续 1 分钟才发、按 id 只发一次）
   - `collab.project.qq-command` 设命令后手机发 `/命令 任务` 真的派给 ZCode、干完回报回手机
   - `collab.inbox` 待办、评论 @ 通知；协作窗格计数与网站提示栏一致
   - 参照上次回归卡逐项做（两 home 的 `qq-bot.messages` 核对）
5. 验完 carol home 留着（下次回归复用）。

## 风险与依赖顺序

- M3、M4 依赖 M2 发版；M1 开发台不依赖发版，先跑起来反复迭代。
- 导出时 `workspace:*` → 发版号是易错点，导出流程写成 collab 分区文档。
- 执行器装合并检查包按工作流里的版本范围走，模板随 M2 发版更新。
- 一仓一写手：docsite-kit 仓内改动本会话自己做（或串行派发）；flashworker 只做视觉验收。

## 状态

- [x] M1–M4 全部完成（见下）+ 交互全链路修复批（2026-10-13 中午）：
  - 用户反馈「点按钮没反应」引出三个叠着的地基 bug，全修复并发版：
    1. **水合静默死**：功能包服务端文件没带 `.server` 后缀，客户端链引到 node:fs——collab-site 0.31.1（改名）+ docsite-identity 0.1.1（纯解析进主出口）+ collab-model 0.6.1（改引主出口）
    2. **写评论一律 403**：骨架 origin 缺省写死 4430——改为从本站 dev 脚本读端口（自述站正本、docs-site、测试站、两运行实例同款；gwb-docsite 0.3.3 模板带上）
    3. **首条评论 500**：mkdir 不带 recursive——docsite-comments 0.2.1
  - **正文页与批注**：测试协作仓新增三页（重写方案 /plan、用法示例 /usage、回归记录 /regression），批注三条（「公式」元素锚点、「验收口径」元素锚点、回归页整页），经提交审核进 main（PR #8/#9/#10）
  - **批注与 @ 全链路**：carol「找我的」3→5，两条「站长在评论里 @了我」经 QQ 送达手机
  - 三个站全部水合正常、按钮可点、批注显示（4451 曾因 vite 优化缓存滞后，清 node_modules/.vite 重启后恢复）
- 发版累计：docsite-ui 0.2.1、identity 0.1.1、model 0.6.1、site 0.31.1、comments 0.2.1、gwb-docsite 0.3.3、gwb-collab 0.30.0；default 已全升
- 已建卡：2026-10-13-collab-site-native-rewrite（重写取舍）、2026-10-13-collab-hydration-origin-comments（三个 bug 与「按钮必须真点」的教训）

## 遗留与注意

- default 上三个真实项目（hybrid-mmc、chb-dab-sst、engineering-knowledge）在新插件下暂失效——预期破坏，等迁移批。
- 同机多克隆的 dev 端口在各自工作区错开（carol 本地 4452 未提交）；升级依赖动了 package.json 时会挡自动同步，人合一下再快进（今天 PR #10 就遇到了）。
- 评论正文里不能写 `$…$` 公式（评论集合不挂 remark-math，`{` 被 MDX 当表达式，症状是正文一直显示「刚写入」占位）——记进轨迹卡，将来可考虑评论集合也挂公式或在写入时提示。
- docsite-kit 仓有三个本地提交未推，推送由用户决定。
