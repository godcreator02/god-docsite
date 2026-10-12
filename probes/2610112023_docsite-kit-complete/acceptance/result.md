# 任务 C 交付结果：验收材料 + 1.1 实际验收

日期：2026-10-11（两轮）。状态：**1.1 四项已实测交回，等主会话下一次 15 分钟检查复核**。
本轮未改 B 实现与任何冻结文件；未提交、未发布、未动 default home。

## 第一轮（材料准备，已按主会话退回意见修正）

八组功能验收清单（`acceptance.md`，约 50 条，标 1.1～1.6 轮次）+ `cases/` 静态样本 +
`check-cases.mjs` 样本自洽校验。主会话审查退回三处，本轮已改：

1. **G4-05 样本不可成立**（step2 与 step3 字节相同却要求不同定位结论）：改为两组——
   「完全相同重复文本」保留为**信息不足边界样本**（预期：算法按自身对齐认定一处删除，
   被认定处上的评论找不到、不挂错，不要求识别删除意图，也不宣称产品采用新策略）；
   新增「可区分邻接样本」`distinct-neighborhood.*`（三句重复各有唯一邻居，两种删除
   最终文本不同、预期明确：删前一处→评论仍标黄，删被批处→原文找不到了）。
   引用已纠正：旧实验 02-anchor-mapping 证明的是差分选择与不可分辨局限，没证明可识别
   删除意图。新增评论串契约样例 `2026-10-11-distinct-second/`（快照与 range 经精确计算自洽）。
2. **A-4「三页」是占位**：改为实站两条路由的映射记录（`/` 四段正文 + `/second` B 正文），
   写进 `acceptance.md` 的「1.1 实站参数映射」。
3. **result 身份码文字与 people.json 对齐**：明确 zhou=acc1111code1、li=acc2222code2、
   agent 不写码，均为编造样本值。

修正后样本自检 **84/84 通过，退出码 0**（`check-cases.log`；主会话上一轮独立复跑的
70/70 对应修正前的样本）。

## 第二轮：1.1 实际验收（A-1～A-4）

站点：B 交付的 `../site/`，dev 服务由本轮在 5460 启动（启动器 PID 99756，隐藏窗口，
日志 `evidence/dev-server.log`）。验收前 5460/5461 空闲、18 个源文件 SHA256 与主会话
manifest 全一致；验收后整树终止（7 个进程）、两端口释放、哈希复验 0 差异。

| 条目 | 状态 | 摘要 |
| --- | --- | --- |
| A-1 A 集合标记 | **通过（待复核）** | SSR 分段断言 16/16：server-a/browser-a 各恰 1 处 `A-ONLY-NODE-COMPILED` + A 锚段；整页第 3 处在 loader 序列化的 A 数据里（上下文已录）；浏览器面一致 |
| A-2 B 集合无标记 | **通过（待复核）** | server-b/browser-b/second-browser-b 三个面均 0 标记 + B 锚段 |
| A-3 计数/输入/导航 | **通过（附降级说明）** | 首页 0→1→2→3 逐次、输入回显、/ →/second→/ 客户端导航、第二页本页计数 0→1→2；交互经页面内事件派发完成（本会话 IAB 真实输入通道不可用，判别记录在转录） |
| A-4 无 Node 模块错误 | **通过（附缺口说明）** | SSR HTML 无 externalized/module-runner-closed；模块 24 个全 200；交互期捕获器 0 条 error/warn；dev 日志干净。缺口：加载期 console 未捕获、IAB 无控制台 API，未宣称「console 无错误」 |

**未发现 B 实现的问题**；发现的环境问题（IAB 输入通道、隐藏窗格期间事件不投递与渲染挂起）
只作证据记录，不退回 B。两项「附说明」状态请主会话裁决。

## 实跑命令与退出码（第二轮全部）

| 命令（pwsh 7 或经 pwsh 调 node） | 退出码 |
| --- | --- |
| `node check-cases.mjs`（修正后重跑） | 0（84/84） |
| `pwsh -NoProfile -File check-port-and-hash.ps1`（启动前：端口 + 18 文件哈希） | 0 |
| `pwsh -NoProfile -File start-dev.ps1`（Start-Process 隐藏窗口 + 条件轮询就绪，9 秒） | 0 |
| `pwsh -NoProfile -File fetch-ssr.ps1`（两路由 SSR HTML + 分段检查；首跑退出 1 系整页计数断言写错，查明第 3 处标记为 loader 数据后修正断言重跑） | 首跑 1 → 重跑 0（16/16） |
| 浏览器操作（IAB，经 node_repl js 调用，过程见转录） | n/a（无退出码；错误均已记录并处理） |
| `pwsh -NoProfile -File stop-dev.ps1`（taskkill 整树 + 端口核对 + 哈希复验） | 0 |

## 证据路径

- `evidence/20261011-C2-precheck.txt`（启动前端口与哈希）、`20261011-C2-postcheck.txt`（收尾）
- `evidence/01-ssr-home.html`、`02-ssr-second.html`、`20261011-C2-ssr-sections.txt`（SSR 分段报告）
- `evidence/20261011-C2-browser-transcript.md`（浏览器过程与判别记录）
- `evidence/G2-01.md`、`G2-02.md`、`G3-01.md`、`A-4.md`（四项条目证据）
- `evidence/dev-server.log`、`dev-server.err.log`、`dev-pid.txt`
- 工具脚本（在 acceptance/ 根，可复跑）：`check-port-and-hash.ps1`、`start-dev.ps1`、
  `fetch-ssr.ps1`、`ssr-section-split.mjs`、`stop-dev.ps1`、`check-cases.mjs`

## 未验证项 / 缺口

1. 1.2～1.6 全部条目保持待测（本轮只做 1.1 四项，未实现任何后续功能）。
2. A-3 真实输入事件（isTrusted）未在本会话走通（IAB 环境通道问题）；B 会话曾以坐标点击
   真实验证，主会话可复核或在其环境重放。
3. A-4 浏览器加载期 console 无直接捕获（缺口说明见 `evidence/A-4.md`）。
4. 样本仍未经真实站点编译验证（静态输入，B 采用时才见分晓）；评论快照仍是手工构造的
   近似（README 已写明替代用法）。

## 遗留进程 / 端口

无。dev 进程树（PID 99756 + 6 子进程）已终止；5460/5461 均空闲；验收浏览器标签页已关闭。
本轮对 site/ 的写入只有 dev 工具的正常生成物（.source/、.react-router/、.probe-vite-cache/、
node_modules/.vite-temp），源文件（含 package.json、lockfile）验收前后哈希均与 manifest 一致。
