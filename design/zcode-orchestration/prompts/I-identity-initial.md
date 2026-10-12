你是用户授权主会话编排的实际 ZCode 实现会话。先读 D:\unitfolders\oz47p-docsite-kit\AGENTS.md、目标仓 docsite-kit\AGENTS.md、design/31-zcode-orchestration.html、design/zcode-orchestration/package-split-contract.md。本批是用户同意拆包文件树后的新实现任务，旧1.1只在probes写的范围已由契约和新台账扩大到你独占的新包目录。先GWB index，文档按docs-writing；创建或修改版本/依赖声明之前每次读gwb-release。只用pwsh7，避免bash展开PowerShell变量，复杂命令写你独占目录的ps1再调用。
不要自行派代理/新会话，不提交推送发布，不改default home，不读评改无关未提交文件。不动其他仓，不全仓格式化。共享契约主会话已定，遇到真冲突交回主会话，不自行改对方文件。完成后写result.md和handoff.json：实际变更、公开exports、实跑命令及退出码、待集成检查、已知差异/风险、无遗留进程。不要等待其他任务或轮询；主会话15分钟定时读取。

任务I：实现独立 @godcreator/docsite-identity 包。
唯一可写 packages/docsite-identity/ 和 probes/2610112023_docsite-kit-complete/package-split/identity/。两个目录当前均未分配其他会话。旧packages/docsite-kit只读，comments新包不读不改。
交付必须有真实代码：src/model.ts、server人员文件/身份/写权限、react头像与身份标识以及根/server/react入口、package.json、构建/检查配置与回归测试。从现有people.ts、server/site-people.ts、server/comments.ts中的identity逻辑和ui/comment-cards.tsx中的Avatar抽取，忠实保持people.json格式/校验/agent语义，按共同契约隔离公开Person和StoredPerson。不得把码放入浏览器类型或只读错误文案。
固定公开接口见共同契约，尤其authorizeWrite签名给J使用，不自行改名。基础包原版本/文件不动。声明真实直接依赖；禁止父workspace install和改lock，依赖安装串行留K，先完成代码与可执行检查，若未解析的react/测试依赖阻碍检查明确列出，不做mock冒充集成成功。
