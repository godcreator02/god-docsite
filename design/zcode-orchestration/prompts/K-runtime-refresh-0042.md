K继续同一评论集成任务，用户已明确批准机制简化并解锁实现。先读单元/仓AGENTS、design/zcode-orchestration/package-split-contract.md与本条最新约定；旧utimes/glob替换/删除过滤方向全部被替代。本轮你独占原K两包、验证站、integration及必要本次依赖接线；L只写create-docsite，勿碰。所有自动化测试Vitest，不提交/推送/发布、不升级无关依赖。

目标只做最简单完整链：写成功 → 宿主明确重新读取评论 → 刷新页面。先整页刷新，不做局部缓存同步。评论包继续不依赖Fumadocs、Vite、Router；宿主决定刷新。给评论UI一个小的可选写成功回调（或同等简单公开接缝），在成功写入、必要的返回thread记录完成后通知宿主。错误不能触发刷新。覆盖create/reply/edit/delete/resolve/reopen，不靠HMR或全局事件猜变更。不要把location.reload写死到通用评论包。

服务器loader每次调用已公开的readCommentThreads，按现有CommentEntry/Thread形状投影并用同一次读取算aboutMe、page列表和正文；不要从.source/server导入comments，不要模块顶层固化allThreads。评论正文也不再走.source/browser的MDX glob。保留现有MDX能力：模型明确支持组件、同目录组件引用和图片，不能偷偷改成纯Markdown/HTML字符串或丢交互。
先走官方@mdx-js/mdx compile(outputFormat:'function-body') + run的最小宿主适配（https://mdxjs.com/packages/mdx/#run-code-options，有官方server compile/client run示例），源码只在Node编译，浏览器运行编译结果；React函数不能经loader序列化。不要新增自制编译服务/插件平台/多层缓存。不要在服务器evaluate执行评论组件。现有身份授权不变。
本机当前验证站是开发/只读验证站：同目录TSX组件与图片的URL和运行能力必须做真实样本，别只验粗体链接；清楚记录dev与未来production bundling边界。若完整组件导入必须上全新bundler/服务，先把最小适配与具体不兼容证据交回主会话，不擅自删能力或膨胀架构。不要引入比原来更大的机制。

删掉这批无用同步补丁：commentsGlobRootBase插件及接线、source.config中的comments集合、旧正文路径Promise缓存、专为等HMR而加的removedKeys/onDeleted链（若无独立用途）、无用的碰配置逻辑。文档正文A/B/Demo仍正常用Fumadocs。不改旧生产包/旧站。主会话review中的临时实验仅供只读，不带进产品。

验证：先用真实运行时读盘/MDX编译Vitest与HTTP增删完整路径断言；关键增加关闭HMR（server.hmr=false）的验证站测试，新建/回复/编辑/删回复/删串/解决重开后新GET必须正确，不能靠source.config变化。检查写失败不触发宿主刷新、Origin/as/只读权限仍对、图片与交互组件样本保留。浏览器真实回调刷新和console由主会话最终复核；你IAB若仍点击异常，交证据，不循环耗时。不把HTTP logger无错当浏览器无错。
版本/依赖变更先现读gwb-release，仅必要的本站MDX直接依赖允许按已有版本声明并更新本站lock；不要用跨包node_modules运行时导入替代声明。确认源码编译器不进入浏览器bundle。停止自己的服务、写integration/result.md和结构化handoff、明确替代旧结论后交回。
