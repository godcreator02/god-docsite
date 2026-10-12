你是用户授权主会话编排的实际 ZCode 实现会话。先读 D:\unitfolders\oz47p-docsite-kit\AGENTS.md、目标仓 docsite-kit\AGENTS.md、design/31-zcode-orchestration.html、design/zcode-orchestration/package-split-contract.md。本批是用户同意拆包文件树后的新实现任务，旧1.1只在probes写的范围已由契约和新台账扩大到你独占的新包目录。先GWB index，文档按docs-writing；创建或修改版本/依赖声明之前每次读gwb-release。只用pwsh7，避免bash展开PowerShell变量，复杂命令写你独占目录的ps1再调用。
不要自行派代理/新会话，不提交推送发布，不改default home，不读评改无关未提交文件。不动其他仓，不全仓格式化。共享契约主会话已定，遇到真冲突交回主会话，不自行改对方文件。完成后写result.md和handoff.json：实际变更、公开exports、实跑命令及退出码、待集成检查、已知差异/风险、无遗留进程。不要等待其他任务或轮询；主会话15分钟定时读取。

任务J：实现独立 @godcreator/docsite-comments 包。
唯一可写 packages/docsite-comments/ 和 probes/2610112023_docsite-kit-complete/package-split/comments/。identity新包由I独占，你只按共同契约写public imports，不读改其在途文件。旧packages/docsite-kit只读。
从旧comments.ts/comment-ranges.ts/page-text-rules.ts/server/comments.ts/server/comment-files.ts/server/page-text.ts/ui/comment-anchors.ts/ui/comment-cards.tsx/ui/comments.tsx/ui/all-comments.tsx及相关CSS提取完整实际功能；保留数据格式和主要行为，模型/定位/server/browser/react按目标树组织。复制是本批迁移暂态，旧包调用方还没迁，不删旧实现。
移除对docsite-kit、Fumadocs、Vite、React Router的包依赖及导入。Person/mentions/Avatar等用docsite-identity公开入口（同仓workspace:*）；站点主题切换/整体布局不在评论包。评论根入口不得拉Node或React；Node文件只由/server引入。渲染正文由renderBody传入。不要用空组件、假API、仅TODO目录替代原功能。
HTTP入口保留主要CommentRequestOptions并加siteOrigin，按契约调用身份包authorizeWrite；作者编辑/删除鉴权保留。公开评论检查不能偷偷用process.cwd读取另一包人员配置，要求调用方显式提供人员/页面信息。MDX编译校验先保留实际可用路径，若其配置与宿主集合的对齐尚未实现，明确记录，不宣称已完成后续编译插件整合。
测试迁移旧comments/comment-files/comment-requests/comment-ranges/page-text行为用例，更新新入口和Origin预期；不写仅检查目录存在的假验收。不改父workspace/lock，不执行共享install；身份实现和依赖安装未到位导致的检查缺口如实交给K。输出handoff必须说明exports、站点所需props/请求options、样式如何加载。
