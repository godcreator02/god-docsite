新会话N：按Fumadocs原生方式重写第一个评论闭环。用户明确重申目标是重写以适配Fumadocs，拒绝旧机制搬家、身份评论互依赖和正文DOM注入。先读单元/仓AGENTS、design/zcode-orchestration/package-split-contract.md、design/30-refactor-plan.html M1-M5/K03/K05/K06和接口审计。旧K正收尾停工，不在旧上下文继续修补。

唯一可写目录 D:\unitfolders\oz47p-docsite-kit\docsite-kit\probes\2610120120_fumadocs-native\，此前不存在，你独占。实际站点、局部纯库、Vitest、自己的lock/隔离workspace、README均放这里。禁止改K目录、packages、父workspace/lock、正式site、其他仓。不复制旧站/评论UI作骨架；可阅读稳定的功能清单与Config API样板，不读K尚未交回的进行中文件。不再派会话、不提交推送发布。

本小段交付真实可运行代码：标准Fumadocs + React Router站点，source.config集合/server/browser分离/官方createClientLoader、useContent按需入口；一页正文+当前页评论列表与编辑器（先旁栏，不做行内标记）；站点action/fetcher实现新建、回复、删回复、删串。评论仍是集合，页面/评论同一编译链，不模块顶层分组全站评论。纯评论文件/模型函数与站点组合分开，评论函数不import身份包，站点校验身份/Origin/as，不能取消写入保护。评论中真实同目录可交互TSX与图片，在dev及build/start只读快照验证；不运行时compile/evaluate/function-body/AsyncFunction。覆盖层后续独立小段，本段不引入任何splitText/标记span/正文属性。列当前文件树、复跑命令、哪些功能和机制通过，哪些未完成。

官方参考 https://www.fumadocs.dev/docs/manual-installation/react-router 、https://www.fumadocs.dev/docs/mdx/entry/browser 、https://www.fumadocs.dev/docs/mdx/entry 、https://reactrouter.com/how-to/fetchers 。以原计划已固定core/base-ui16.17.1、mdx15.4.7、Vite8.3.4、RR8.4.0为基线，不自动追新；官网示例命名与锁定版本不一致则核对对应tag和真实exports。声明依赖先读gwb-release，只在自己隔离workspace安装，不用跨包src/假alias/整目录node_modules junction。

已知：当前Windows相对glob base监听增删有红例，review/20261012-0008-root-cause.md可只读。root-relative实验恢复SSR但已加载正文删除仍有reload错误。HTTP不加载浏览器模块，日志空不能当浏览器无错。不要重做utimes、生成代码replaceAll或hotUpdate过滤。优先核对官方配置/入口：本机fumadocsMdx公开PluginOptions.index可接IndexFilePluginOptions，若考察不同index target，区分公开类型与文档承诺，实测再决定。若框架缺陷阻止闭环，交付最小原生代码、失败证据、公开配置替代或上游修复/固定版本的明确选项；需改上游/升依赖时交回主会话，不为绿灯另造编译器和更新框架。

全部测试Vitest，真实文件/HTTP/快照检查，最终浏览器由主会话复核。IAB输入故障不循环耗时。端口先检查，建议5470/5471，localhost，停自己服务再交回。result.md/handoff.json，README第一行复跑命令。只完成当前小段，不自动展开47项或旧站迁移。
