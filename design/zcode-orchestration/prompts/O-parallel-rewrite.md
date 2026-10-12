任务O：正文外评论悬浮层重写

这是用户授权的实际ZCode并行重写任务。先读D:\unitfolders\oz47p-docsite-kit\AGENTS.md、docsite-kit\AGENTS.md、design/zcode-orchestration/package-split-contract.md和parallel-rewrite-contract.md；最新用户目标是按Fumadocs最适配形式重写，旧实现只作功能基线，不能整份搬迁、再补丁叠加。
只写本任务指定的独占probe目录（此前不存在），src/test/最小fixture/自己的package与lock均放这里，先列小文件树再实现。不得改其他probe、packages、父workspace/lock、正式site、台账或其他仓；N/O/P/Q/R目录不能交叉读正在写的实现。需要依赖时先读gwb-release并用自己的隔离workspace，固定计划版本，不自动追新。不用跨包src导入/假alias/整目录node_modules junction代替依赖。不得提交推送发布、拿default验插件、再派子会话、归档或自动扩展其他任务。
交付真实代码和可运行最小样本，普通导出供后续单写集成；别复制五套完整站点。全用Vitest，检查类型、构建及所需实际浏览器行为，HTTP200/DOM字符串不是完整UI验收。主会话最终独立复核。端口先检查空闲，localhost，停止自己的服务再交回。README第一行复跑命令，result.md、结构化handoff.json记录改动、检查、导出、依赖、未完成与写入释放。

独占docsite-kit/probes/2610120120_comments-overlay。实现纯React/浏览器评论悬浮层，最终归评论包。不要读写评论文件、解析身份或编译MDX。输入按共享契约：正文根、评论id/数量、只读resolveTarget(id)返回Range|Element|null、onActivate回调；组件导出由你定最小名字，记录类型供站点接入。
按钮、元素框以及需要的浮层DOM放正文容器外；不splitText、不surroundContents、不向正文插span/按钮、不写data-commented-element等标注属性，不靠正文CSS伪元素注入。Range测量、CSS Custom Highlight可用；只在覆盖层维护必要样式与事件。默认覆盖层不拦正文选择、链接或控件，标志/卡片可交互。对找不到/折叠中不可见目标明确无定位，不乱飘。
适配滚动容器和窗口滚动、换行、resize、字号变化、图片load、正文局部更新；观察正文可以，但不要因观察自己overlay而循环。采用简单集中测量/调度，不每条评论造整套管理器。不新增持久化快照协议；旧range映射可作为独立输入边界，不复制旧inline UI。fixture由你提供固定文字Range、Element、重复文本、代码/图片、details和aria-expanded样本，明确自动展开是宿主交互职责而非偷偷改正文。
Vitest验证定位/事件/卸载清理和DOM结构不被标注修改；真实浏览器看滚动/换行/缩放/折叠、覆盖层位置和正文交互。fixture可以正常生成Range/交互，最终浏览器由主会话真实操作，不用合成事件冒充验收。建议端口5480/5481。
