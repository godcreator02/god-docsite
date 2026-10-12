任务P：身份包与站点授权边界

这是用户授权的实际ZCode并行重写任务。先读D:\unitfolders\oz47p-docsite-kit\AGENTS.md、docsite-kit\AGENTS.md、design/zcode-orchestration/package-split-contract.md和parallel-rewrite-contract.md；最新用户目标是按Fumadocs最适配形式重写，旧实现只作功能基线，不能整份搬迁、再补丁叠加。
只写本任务指定的独占probe目录（此前不存在），src/test/最小fixture/自己的package与lock均放这里，先列小文件树再实现。不得改其他probe、packages、父workspace/lock、正式site、台账或其他仓；N/O/P/Q/R目录不能交叉读正在写的实现。需要依赖时先读gwb-release并用自己的隔离workspace，固定计划版本，不自动追新。不用跨包src导入/假alias/整目录node_modules junction代替依赖。不得提交推送发布、拿default验插件、再派子会话、归档或自动扩展其他任务。
交付真实代码和可运行最小样本，普通导出供后续单写集成；别复制五套完整站点。全用Vitest，检查类型、构建及所需实际浏览器行为，HTTP200/DOM字符串不是完整UI验收。主会话最终独立复核。端口先检查空闲，localhost，停止自己的服务再交回。README第一行复跑命令，result.md、结构化handoff.json记录改动、检查、导出、依赖、未完成与写入释放。

独占docsite-kit/probes/2610120119_identity-boundary。实现/收敛身份能力与宿主授权适配，最终归身份包及站点组合示例。K已停止且释放packages/docsite-identity，可只读审查该已验22测试的实现，明确复用哪些纯函数，不为了重写机械重造；不要改原包。你的交付是独立可运行小模块与组合样本，不另加身份框架、登录系统或角色系统。
输入people/身份码/可信origin等由宿主明确提供；公开作者至少{id,name}，codes等绝不返回给浏览器或错误文本。无身份为只读；合法身份写入；Origin精确校验；as仅已有agent，未知/空字符串/非字符串400、冒充人403；普通作者身份由服务端解析，不能信任form自报actor。保留people.json既有存储与码规则，不无故改盘协议，样本只用虚构码。
给React Router资源路由一份最小组合示例：宿主调用身份校验得到可信actor，再调接收actor的纯评论业务函数/测试桩；不得让评论模块import身份包。身份包也不依赖评论包。Avatar/Badge可作为身份公开组件，展示插槽由宿主接；不引入Fumadocs依赖或用户登录。
Vitest测全部拒绝/允许路径、公开投影不泄露码、请求失败不触发业务写入、合法as传给下游的是agent，验证不靠DEV判断。已有纯函数测试可有意义复用，不为打勾抄大量镜像测试。类型检查和最小HTTP组合样本，必要端口5490/5491。
