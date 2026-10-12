你是 docsite-kit 第一阶段的 ZCode 执行会话。主会话负责编排、审查与验收；你只完成本派单并交回，不自行创建其他 ZCode/子代理会话，不抢别人的文件或进程。

先读：
1. D:\unitfolders\oz47p-docsite-kit\AGENTS.md
2. D:\unitfolders\oz47p-docsite-kit\docsite-kit\AGENTS.md
3. D:\unitfolders\oz47p-docsite-kit\docsite-kit\design\30-refactor-plan.html（第一步及 1.1）
4. D:\unitfolders\oz47p-docsite-kit\docsite-kit\design\31-zcode-orchestration.html
经 GWB 先 index，再按需 skill.read。文档内容先读 docs-writing；涉及版本或依赖变化每次读 gwb-release；写或验插件先读 gwb-devkit。旧 skills 与已明确批准的改造方向有冲突时，保留证据交主会话裁决，不自行升级或扩范围。

执行纪律：只用 pwsh 7；修改仅限下面指定目录；原实验、生产包、插件、site/、design/、仓级配置与 lockfile、其他仓只读。不提交、不推送、不发布、不改 default home、不对外发消息。读取其他仓之前先读其 AGENTS。保留其他会话未提交工作，不评无关 diff。

当前只做 1.1。后续完整功能覆盖是清单，不代表本轮实现全部功能。结束时在自己目录写 result.md：改动文件清单、实跑命令和退出码、证据路径、未验证项、遗留进程/端口（正常应已停止）；最终回复给出这份结果路径。接受派单不等于完成，不编造测试或浏览器证据。不循环等待其他会话；完成自己独立部分即交回，主会话每15分钟统一读状态。

任务 B：建立 1.1 基础验证站。
唯一可写目录：D:\unitfolders\oz47p-docsite-kit\docsite-kit\probes\2610112023_docsite-kit-complete\site\ 和同级 implementation\。
建立最小可运行基础接线，为后续完整功能验证预留位置，本轮只做A/B集合、正文与交互。优先复用 ../2610111940_api-audit-hmr/ 中已通过的 config 变体：source.config.ts 使用 fumadocs-mdx/config 命名集合，各自mdxOptions；A的remark插件确实执行Node操作并加标记，B无该效果；server入口只进服务端loader，browser入口实际加载两集合正文。网页显示A/B正文、按钮计数、输入框与站内导航。
目标已验证组合 core/base-ui 16.17.1、mdx15.4.7、Vite8.3.4、React Router8.4.0；使用当前依赖，记录实际解析版本，不追最新版。若创建/调整依赖声明先读gwb-release，不抬正式包版本。避免node_modules整目录junction导致旧 .vite-temp 写入，采用自己依赖容器/缓存与临时文件目录；不要修改或清理原实验node_modules。新实验必须用pnpm-workspace.yaml隔离父workspace。
可读取原实验源码和已装依赖作为参考，不复制无关25个样本/全站历史，不导入 docfirst/collab 业务。只用公开Config/运行时入口，不读取 _exports._markdown、_compiler 或私有缓存。
开发端口预留5460，仅在确认空闲后使用；若占用不要结束占用进程，在implementation/result.md记录并改用5461。启动进程带自身PID记录，结束停止自己启动的服务。基础交互若可用现有浏览器工具，实际点按钮、输入、导航核对hydration；仅HTTP200不能冒称浏览器通过。若工具不可用，明确列主会话待验，不自己制造截图。
提供单一、明确的复跑命令、types检查、最低限度基础验证与退出码，避免为了看效果跑生产全站build。不要修内容增删/JSON新建/HMR等1.2以后问题，发现只记。不得改coverage或acceptance目录。结束写implementation/result.md和机器可读handoff.json，列siteDir、启动命令、检查命令、地址、实际版本、已验/待验、服务已停止状态。
