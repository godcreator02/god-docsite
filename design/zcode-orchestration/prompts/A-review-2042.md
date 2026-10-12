继续你原来的 A 功能清单任务，这是主会话对首轮交付的定点复审返工。同一连续上下文；仅允许写 probes/2610112023_docsite-kit-complete/coverage/，其他目录只读。先重新确认单元与仓 AGENTS.md、design/31-zcode-orchestration.html，文档遵守已读 docs-writing；只用 pwsh 7（不要再走 bash，之前未执行的解析错误如实保留即可）。不提交推送发布、不派子会话。

主会话已核验 coverage.json 的 76 个 id 唯一、必填字段齐全，抽检源码/计划路径；但以下边界要修正：
1. PG-multi-source 的完整条件是 MDX/TSX/HTML 三类页面 + 侧栏/搜索，它目前 slice=1.1，实际属于 1.2。把完整条目改成 1.2；1.1 只引用 PG-config-api / TL-compile-plugins 的 A/B 基础接线。WR-per-collection-plugins 分清 1.1 已允许的 A/B Node 插件隔离与 1.2 公式/评论等真实组合。
2. 76 条中 72 条属于第一步，TL-self-site 属第二步，加另外 3 条后续合计 4 条后续。目前 firstRoundItems=73 把第二步混进去，也混淆“第一步全范围”和“本轮1.1”。修正机器计数、正文、result.md 口径，保留 id 与八组分类，可同时保留组内总数但明确纳入/排除。K-13 环境基线仍保留。
3. HS-service 的 target 说“接口形状保持”，同时 init 要按 P-01 换成只新建一次。请限定“不受变更影响的方法保留”；init 的名称/参数最终以未来细化为准，现有更新语义改变不能声称完全兼容。只修清单表述，不自行决定协议/版本或实现。
4. 不把本轮 B 的自述当成通过证据；主会话尚未最终验收。未实际验证项继续未开始或局部证据。

更新 coverage.md、coverage.json、result.md，复跑计数/字段/MD与JSON一致性检查，记录命令退出码。完成后交回，不等其他会话，不读取状态。
