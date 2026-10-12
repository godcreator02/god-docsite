任务M：将gwb-zcode的status单次等待上限由240秒改为900秒。用户已明确说“ZCode 单次等待参数最多 4 分钟 改成15分钟呗”，这是对仓AGENTS原240限制的直接更新授权。用户要求主会话只编排审查、实际代码由ZCode执行。你是独立新上下文，不接触docsite代码任务。

仓：D:\unitfolders\evew5-gwbapps\gwb-agents。先读该仓AGENTS.md（是生成物，正本在docs-site/content/docs/outputs/agents.mdx），机器/祖先链规矩。GWB先index，读gwb-devkit、gwb-release、docs-writing；文档钉码/生成按docs-site。当前该仓git status干净。主会话已定位：
plugins/zcode/src/api.ts MAX_WAIT_SECONDS=240；
checks.ts范围校验使用此常量；
commands.ts usage动态使用此常量；
round.ts readRound在本插件循环，每次独立snapshot RPC，总deadline=waitSeconds*1000；
desktop.ts RPC_TIMEOUT_MS=30_000是单次调试调用，不是readRound整体deadline。
本机Codex config中gwb.tool_timeout_sec=1260（主会话只读该数值，未读取凭据），足够900+余量。不要改个人配置/凭据，不读输出token，不为总等待把所有RPC超时改成900秒。

允许写：
plugins/zcode/源码、必要测试与构建产物；
docs-site/content/docs/outputs/agents.mdx、outputs/skills/zcode.mdx以及实际引用240上限的本插件文档正本，必要对应钉码确认；
由正规doc:render产生的仓AGENTS/CLAUDE/README与plugins/zcode/skills/zcode/SKILL.md（不要手改生成物）；
probes/261011_zcode-wait-900/：实验/检查日志.txt、result.md、handoff.json。
claudecode插件及其他仓只读。不要改其他未归属文件、不全仓格式化，不改mcp/commands/内核共享服务或本机正在运行的安装目录。

实现：
- 上限900，默认waitSeconds=0和“轮次完成提前返回”语义不变。900接受、超过900拒绝，负数/NaN/Infinity仍拒绝。
- 同步命令用法/服务类型注释/正本说明：需要客户端工具超时大于等待值且留传输余量；旧客户端可能300秒时应选更短等待。删除“所有客户端最多240”的错误概括。
- 补有意义回归：900参数经命令/服务校验接受，901及非法值拒绝；readRound在fake timers下能等待超过240到900附近仍正常，提前完成提前返回，wait0立即返回。测试时间虚拟推进，不真忙等15分钟、不创建额外ZCode会话。
- 核对外层插件/MCP超时有没有独立硬限制。可只读D:\unitfolders\igldu-gwbkernel\gwb-base-plugins（先读该仓AGENTS），但不要修改。30秒RPC保留；检查这种独立短请求循环不会被一条RPC总时长误杀。
- 本批不抬版本、不提交推送发布，不更新default。用户以前要求先看具体改动再提交/发布，这一步留主会话。先把改动做成可审查产物。禁止直接改任何home node_modules/dist。
- 跑zcode包build/check及必要文档检查；按gwb-devkit可新建你专用隔离home验证开发包（只用隔离home，不碰default、不借别人home）。如隔离home验证需额外安装/长期900秒测试而不能在本轮完成，明确列证据层级；模拟时间测试不是实际900秒MCP端到端。不要自己zcode.create测试会话、读K/L任务或消耗额外全局会话名额。若使用隔离home，记录名字并交主会话接续，不自行删除保留的证据。
- 完成结果说明源码支持900与当前default安装版本是否仍240，绝不能把源码改好说成当前工具已生效。给出实现文件、exact diff、tests/文档/build结果、调用链超时分析、隔离验证情况、安装/发版还需哪一步。
- 命令只用pwsh7；任务完成交回，不轮询其他任务、不自行归档。

主会话正在把轮询改为当前会话长等待，heartbeat已暂停；不再依赖定时唤醒。完成后result与handoff写probes/261011_zcode-wait-900/，供主会话15分钟间隔读取。
