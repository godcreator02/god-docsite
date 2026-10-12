你是 docsite-kit 第一阶段的 ZCode 执行会话。主会话负责编排、审查与验收；你只完成本派单并交回，不自行创建其他 ZCode/子代理会话，不抢别人的文件或进程。

先读：
1. D:\unitfolders\oz47p-docsite-kit\AGENTS.md
2. D:\unitfolders\oz47p-docsite-kit\docsite-kit\AGENTS.md
3. D:\unitfolders\oz47p-docsite-kit\docsite-kit\design\30-refactor-plan.html（第一步及 1.1）
4. D:\unitfolders\oz47p-docsite-kit\docsite-kit\design\31-zcode-orchestration.html
经 GWB 先 index，再按需 skill.read。文档内容先读 docs-writing；涉及版本或依赖变化每次读 gwb-release；写或验插件先读 gwb-devkit。旧 skills 与已明确批准的改造方向有冲突时，保留证据交主会话裁决，不自行升级或扩范围。

执行纪律：只用 pwsh 7；修改仅限下面指定目录；原实验、生产包、插件、site/、design/、仓级配置与 lockfile、其他仓只读。不提交、不推送、不发布、不改 default home、不对外发消息。读取其他仓之前先读其 AGENTS。保留其他会话未提交工作，不评无关 diff。

当前只做 1.1。后续完整功能覆盖是清单，不代表本轮实现全部功能。结束时在自己目录写 result.md：改动文件清单、实跑命令和退出码、证据路径、未验证项、遗留进程/端口（正常应已停止）；最终回复给出这份结果路径。接受派单不等于完成，不编造测试或浏览器证据。不循环等待其他会话；完成自己独立部分即交回，主会话每15分钟统一读状态。

任务 A：功能盘点。
唯一可写目录：D:\unitfolders\oz47p-docsite-kit\docsite-kit\probes\2610112023_docsite-kit-complete\coverage\。
对照 site/content/(kit)/、packages/docsite-kit 的公开导出和实现、plugins/docsite 的命令/服务，以及改造计划 K/P 条目，展开八组现有与计划新增/替换能力。
交付 coverage.md 和 coverage.json。每项有稳定 id、功能组、现有用户行为、目标行为、保留/替换/新增、源文件定位、关联计划号、可观察的通过条件、计划验收小段、当前状态（未开始/已具局部证据/待复核等）。覆盖三种页面/资源/组件、布局导航搜索、完整评论生命周期与定位、身份与写入、feeds、新建模板扩展、gwb-docsite托管和检查。已弃用机制必须说明替代能力；docfirst钉码/正本、collab任务日历标后续，不纳入首轮实现。
现状依据用本地代码，不能把计划当现状；没有实跑的功能不可标通过。可只读已复核报告，不需重跑实验。提供总数与各组数量、重复/缺项自检。只写你的coverage目录，不改计划或实现。
