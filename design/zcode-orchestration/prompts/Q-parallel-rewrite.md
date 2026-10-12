任务Q：页面来源与搜索原生适配

这是用户授权的实际ZCode并行重写任务。先读D:\unitfolders\oz47p-docsite-kit\AGENTS.md、docsite-kit\AGENTS.md、design/zcode-orchestration/package-split-contract.md和parallel-rewrite-contract.md；最新用户目标是按Fumadocs最适配形式重写，旧实现只作功能基线，不能整份搬迁、再补丁叠加。
只写本任务指定的独占probe目录（此前不存在），src/test/最小fixture/自己的package与lock均放这里，先列小文件树再实现。不得改其他probe、packages、父workspace/lock、正式site、台账或其他仓；N/O/P/Q/R目录不能交叉读正在写的实现。需要依赖时先读gwb-release并用自己的隔离workspace，固定计划版本，不自动追新。不用跨包src导入/假alias/整目录node_modules junction代替依赖。不得提交推送发布、拿default验插件、再派子会话、归档或自动扩展其他任务。
交付真实代码和可运行最小样本，普通导出供后续单写集成；别复制五套完整站点。全用Vitest，检查类型、构建及所需实际浏览器行为，HTTP200/DOM字符串不是完整UI验收。主会话最终独立复核。端口先检查空闲，localhost，停止自己的服务再交回。README第一行复跑命令，result.md、结构化handoff.json记录改动、检查、导出、依赖、未完成与写入释放。

独占docsite-kit/probes/2610120126_page-sources。实现MDX/TSX/HTML的页面来源和搜索适配，最终归docsite-kit来源模块及站点接线示例。采用Fumadocs公开StaticSource、loader、structuredData和已文档化Markdown接口；核对实际固定版本与官方/tag源码，不用已弃用Source类型，不操作loader/search内部缓存，不解析ReactNode内部形状。
MDX走Config API集合server/browser；TSX/HTML的标题、描述、URL、搜索内容、Markdown形式在内容定义处明确提供/派生，不装一套新的运行时编译器。保持同目录组件/图片等资源引用与地址规则；每种格式提供一个最小真实内容样本，证明导航/来源树/搜索返回有效URL，中文检索可用。区分TSX互动与HTML展示边界，不假称所有格式都有不存在的MDX元数据。
输出普通来源/索引适配函数及最小fixture，不接N主站路由、不改全站布局、不做评论或身份。索引更新遵循公开createFromSource等能力，并以实际内容增删/改名验证，不能只首建搜索成功。已知Vite Windows相对glob base问题见主会话review/20261012-0008-root-cause.md，遇到共同阻碍交证据给主会话，别各造HMR补丁或改生成代码。
Vitest对三格式数据/URL/搜索/Markdown约定进行有价值测试，dev与build/start快照分别验；建议端口5500/5501。缺口必须具体列明，不盲目扩大到docfirst钉码、协作站或迁旧站。
