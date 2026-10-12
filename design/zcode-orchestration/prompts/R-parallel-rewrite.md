任务R：写作组件与集合编译插件

这是用户授权的实际ZCode并行重写任务。先读D:\unitfolders\oz47p-docsite-kit\AGENTS.md、docsite-kit\AGENTS.md、design/zcode-orchestration/package-split-contract.md和parallel-rewrite-contract.md；最新用户目标是按Fumadocs最适配形式重写，旧实现只作功能基线，不能整份搬迁、再补丁叠加。
只写本任务指定的独占probe目录（此前不存在），src/test/最小fixture/自己的package与lock均放这里，先列小文件树再实现。不得改其他probe、packages、父workspace/lock、正式site、台账或其他仓；N/O/P/Q/R目录不能交叉读正在写的实现。需要依赖时先读gwb-release并用自己的隔离workspace，固定计划版本，不自动追新。不用跨包src导入/假alias/整目录node_modules junction代替依赖。不得提交推送发布、拿default验插件、再派子会话、归档或自动扩展其他任务。
交付真实代码和可运行最小样本，普通导出供后续单写集成；别复制五套完整站点。全用Vitest，检查类型、构建及所需实际浏览器行为，HTTP200/DOM字符串不是完整UI验收。主会话最终独立复核。端口先检查空闲，localhost，停止自己的服务再交回。README第一行复跑命令，result.md、结构化handoff.json记录改动、检查、导出、依赖、未完成与写入释放。

独占docsite-kit/probes/2610120123_writing。实现写作能力的普通库导出与Fumadocs原生配置样本，最终归docsite-kit写作模块；不要造第二套编译器。范围：术语remark插件与Term、TSX公式Tex及MDX数学配置，代码块/表格/Tabs/Files/折叠/图片优先直接复用锁定版Fumadocs公开组件与预设，不包装一层空洞的同名框架。
以现有功能清单为行为基线，核对约定的术语样式与Markdown输出，避免术语替换打坏代码、链接、数学或多次处理。集合A启用自有Node插件、集合B不启用，server/browser皆应反映配置差异；浏览器不得静态导入Node-only编译插件。组件表与source.config的组合由fixture站点负责，库只导出组件/插件/必要类型。完整MDX/TSX/图片走Vite+fumadocs-mdx，使用getText/asMarkdown/replaceSource等只在相应公开契约范围，不直接使用私有_compiler。
给表格、代码、公式、术语、Tabs/Files/折叠与图片各一个紧凑样本，保留互动；正文语义标记如确有必要须在组件/编译期定义并记录，不加入评论运行时注入标志，不自行发明与O不一致的锚点协议。
Vitest验证术语编译/Markdown边界与集合隔离；真实构建、类型、浏览器互动由相应样本证明。不要把纯文本快照当交互通过。建议端口5510/5511。只实现当前写作范围，不做布局复制、来源引擎、docfirst钉码或评论。
