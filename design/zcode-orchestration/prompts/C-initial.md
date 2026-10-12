你是 docsite-kit 第一阶段的 ZCode 执行会话。主会话负责编排、审查与验收；你只完成本派单并交回，不自行创建其他 ZCode/子代理会话，不抢别人的文件或进程。

先读：
1. D:\unitfolders\oz47p-docsite-kit\AGENTS.md
2. D:\unitfolders\oz47p-docsite-kit\docsite-kit\AGENTS.md
3. D:\unitfolders\oz47p-docsite-kit\docsite-kit\design\30-refactor-plan.html（第一步及 1.1）
4. D:\unitfolders\oz47p-docsite-kit\docsite-kit\design\31-zcode-orchestration.html
经 GWB 先 index，再按需 skill.read。文档内容先读 docs-writing；涉及版本或依赖变化每次读 gwb-release；写或验插件先读 gwb-devkit。旧 skills 与已明确批准的改造方向有冲突时，保留证据交主会话裁决，不自行升级或扩范围。

执行纪律：只用 pwsh 7；修改仅限下面指定目录；原实验、生产包、插件、site/、design/、仓级配置与 lockfile、其他仓只读。不提交、不推送、不发布、不改 default home、不对外发消息。读取其他仓之前先读其 AGENTS。保留其他会话未提交工作，不评无关 diff。

当前只做 1.1。后续完整功能覆盖是清单，不代表本轮实现全部功能。结束时在自己目录写 result.md：改动文件清单、实跑命令和退出码、证据路径、未验证项、遗留进程/端口（正常应已停止）；最终回复给出这份结果路径。接受派单不等于完成，不编造测试或浏览器证据。不循环等待其他会话；完成自己独立部分即交回，主会话每15分钟统一读状态。

任务 C：独立验收样本与操作清单。
唯一可写目录：D:\unitfolders\oz47p-docsite-kit\docsite-kit\probes\2610112023_docsite-kit-complete\acceptance\。
先独立准备验收材料，暂不运行或修改B的验证站。为第一阶段八组功能准备小而有代表性的样本与操作步骤，标明本轮1.1要测哪些、1.2以后待接入哪些。包括MDX/TSX/HTML引用资源、Node插件A/B隔离、按钮输入/导航、评论重复文字与折叠定位、身份拒写、JSON改删重新新增；禁止将大量后续功能顺手实现。
写 acceptance.md（步骤、预期、证据字段、状态），cases/中的静态输入样本；可加不依赖具体页面实现的测试数据校验脚本，避免按B实现镜像写断言。对1.1需检查SSR与browser正文A有标记B无、客户端计数/输入/导航有效、无Node模块错误。先读旧复核的实际反例，不因已有记录就给新站打勾。
当前B仍在搭建，C不循环查询、不等待B、不运行其服务，不在site里复制样本或改测试内容。完成准备即交回result.md；主会话确认B停止写入且交付后，会在同一连续上下文续派实际验证。届时仍不改B实现，问题交主会话退回B。
