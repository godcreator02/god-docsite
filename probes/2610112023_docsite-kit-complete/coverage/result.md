# 任务 A 功能盘点 — 结果

会话：docsite-kit 第一阶段 ZCode 执行会话 A（功能盘点）。日期：2026-10-11。本版含主会话定点复审后的返工修正（见「返工记录」）。

## 改动文件清单

| 文件 | 内容 |
| --- | --- |
| `probes/2610112023_docsite-kit-complete/coverage/coverage.md` | 八组功能清单正文 + 环境基线说明 + 自检 |
| `probes/2610112023_docsite-kit-complete/coverage/coverage.json` | 同内容的结构化数据，76 条，含 meta 计数与证据口径 |
| `probes/2610112023_docsite-kit-complete/coverage/result.md` | 本文件 |

未改动其他任何文件（生产包、插件、site/、design/、其他仓、仓级配置与 lockfile 均只读）。未提交、未推送、未发布、未改 default home、未对外发消息、未派子会话。

## 交付概要

- 清单共 **76 条**＝**第一步 72 条** + 第二步 1 条（TL-self-site，登记在 G7）+ 后续登记 3 条（第 4/5 步），后续合计 4 条。八组分类保留：G1 页面与资源 8、G2 正文与写作组件 5、G3 布局导航搜索 11、G4 评论 14、G5 身份与写入 9、G6 推送 5、G7 新建模板扩展 9（含 1 条第二步）、G8 托管检查运行 12。
- **第一步全范围 ≠ 本轮范围**：72 条是第一步全范围清单；本轮 1.1 只做 A/B 集合基础接线（直接条目：PG-config-api、TL-compile-plugins，以及 WR-per-collection-plugins 的 1.1 部分——Node 插件隔离；三类页面+侧栏/搜索的完整条件属 PG-multi-source 的 1.2，公式/评论等真实插件组合也属 1.2）。机器口径在 json 的 `counts.currentSliceItems`。
- 去向：保留 46、替换 13、新增 11、弃用→替代 2（旧推送通道、功能包机制，均写明能力去向）、后续 4。
- 状态：未开始 64、已具局部证据 8（含 1 条部分证据）——**没有任何条目标通过**：本轮未实跑任何功能验收；**B 会话（基础验证站）的自述不算通过证据**（主会话尚未最终验收）。已具局部证据的条目只引用探针/复核报告路径（E-2/E-3/E-5/E-6/E-7、接口审计、Markdown 公开接口复核）。
- 计划号覆盖：K-01～K-12、K-14 逐条有落点（K-13 在环境基线说明）；P-01～P-06 全部落点（P-06 标后续）；D/C 只出现在后续登记条目（按派单不纳入第一步）。
- 每条有稳定 id、功能组、现有用户行为、目标行为、去向、源文件定位（file:line）、关联计划号、可观察的通过条件、验收小段、当前状态；json 与 md 的 id 一一对应（机器核对通过）。

## 返工记录（主会话定点复审，2026-10-11 第二轮）

1. **PG-multi-source 归段**：完整条件（三类页面 + 侧栏/搜索）从 1.1 改为 1.2；1.1 只保留 PG-config-api / TL-compile-plugins 的 A/B 基础接线；条目加注归属说明。
2. **计数口径**：撤掉 firstRoundItems=73（混入了第二步的 TL-self-site）。改为 step1Items=72、step2Items=1、laterRegistryItems=3、laterTotal=4；正文自检、本文件同步。区分「第一步全范围（72）」与「本轮 1.1（currentSliceItems 三个 id）」。id 与八组分类不变，组内总数保留并注明纳入/排除。
3. **HS-service 表述**：由「接口形状保持」改为「不受变更影响的方法（十个）保留」；init 的更新语义按 P-01 变更为只新建一次，属行为变更，不声称与现有 init 完全兼容；新命令名称/参数以未来细化的派单为准，清单不预定协议或实现。
4. **证据口径**：md 头部与自检、json 的 `meta.evidencePolicy` 均写明 B 会话自述在主会话最终验收前不算通过证据；未验证条目保持未开始/已具局部证据，无一条标通过。

## 实跑命令与退出码

全部为只读命令（pwsh 7），无写入类命令（文件写入用客户端 Write/Edit 工具完成）：

| 命令用途 | 退出码 |
| --- | --- |
| 列 site/content、packages/docsite-kit、plugins/docsite、probes、design、材料根的文件结构（rg --files / Get-ChildItem） | 1（末尾 rg 在空目录无匹配返回 1，前面输出完整，非失败） |
| 统计基础包/插件/模板各源文件行数 | 0 |
| 列 trajectory 轨迹卡文件名（两次） | 0 |
| coverage.json 机器自检（合法性、分组/去向/状态计数、id 唯一、md 交叉一致、计划号汇总） | 0 |
| 一次尝试用管道给 json 补键 | 2（bash 单引号解析错误，命令未执行、无副作用；改用 Edit 工具完成） |
| 查看 coverage.json 中 HS-identity-cmd 条目字段 | 0 |
| 修复后复查 json（字段完整性、meta 计数与实际一致） | 0 |

第二轮（定点返工，命令均 pwsh 7）：

| 命令用途 | 退出码 |
| --- | --- |
| 重读单元/仓 AGENTS.md 与 design/31-zcode-orchestration.html 确认未变 | 用客户端 Read（无 shell），文件未变 |
| 复检 json 合法性、必填字段、分步计数、md 与 json id 一致（第一次） | 0（发现 json 解析失败：本轮 Edit 引入两处语法错误——evidencePolicy 值后尾逗号、PG-multi-source 条目丢失闭合 `},`；随即用 Edit 修复） |
| 复检同上（第二次，修复后） | 0，全部通过 |

第二次复检通过项：json 合法 76 条；实际分步计数 step1=72 / step2=1（仅 TL-self-site）/ 后续登记=3，与 meta.counts 一致；去向分布 保留 46、替换 13、新增 11、弃用→替代 2、后续 4 一致；全部条目必填字段（id/group/disposition/current/target/passCriteria/slice/status/plan/sources）齐全；76 个 id 唯一且全部出现在 coverage.md；PG-multi-source slice=1.2；WR-per-collection-plugins 状态=已具局部证据（1.1 部分）；HS-service 的 target 含「不能声称与现有 init 完全兼容」；meta.evidencePolicy 与 md 的 B 自述声明均在。

## 证据路径

- 交付物：`probes/2610112023_docsite-kit-complete/coverage/coverage.md`、`coverage.json`。
- 现状依据（只读）：`packages/docsite-kit/src/**`、`packages/docsite-kit/template/skeleton/**`、`plugins/docsite/src/**`、`plugins/docsite/skills/docsite/SKILL.md`、两份 package.json、`site/content/(kit)/**`、`site/content/writing/{components,collapse-test}.mdx`。
- 局部证据引用（只读报告，未重跑）：`probes/2610111940_api-audit-hmr/README.md`（E-2/E-5/E-7 复跑）、`probes/2610111941_api-audit-markdown/README.md`（E-8/D-02 公开接口）、`design/research-2026-10-11-api-surface-audit.md`（47 条接口分级）、`trajectory/2026-10-11-fumadocs-16-probe-batch.mdx`（E-3/E-4/E-6/E-7 原始批次）。
- 计划依据：`design/30-refactor-plan.html`、`design/31-zcode-orchestration.html`。

## 未验证项

- 未运行任何站点、测试、构建或浏览器验收；全部现有行为描述来自代码与文档阅读，未在生产自述站上复验。任何条目均未标通过。
- E 系列结论只读自上述复核报告与轨迹卡，未重跑实验（派单允许）。
- `plugins/docsite/src/open-site.ts`、`errors.ts`、`electron.d.ts` 仅定位级阅读（行为从 `index.ts`、`gwb-plugin.mdx` 与命令 usage 确认，未逐行核）。
- `collab-site/`、`gwb-docfirst/` 两仓未读源码（后续登记条目 F-collab/F-docfirst 的 current 字段只引单元 AGENTS 与计划描述，未核实其内部现状）；读它们的源码前需先读各仓 AGENTS。
- WR-term 的 current 只写到「docfirst 仓有旧实现」，未读 gwb-docfirst 的 glossary 实现细节（迁移可行性留给实现段核实）。

## 遗留进程 / 端口

无。本轮未启动任何开发服务、站点、定时任务或后台进程，未占用端口。
