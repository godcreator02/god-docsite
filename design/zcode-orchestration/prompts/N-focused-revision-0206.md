继续同一任务 N，执行用户已批准的定点返工。重要：主会话已完成目录改名与依赖重接；你现在唯一独占写入目录是 D:/unitfolders/oz47p-docsite-kit/docsite-kit/probes/2610120120_fumadocs-native。不要再创建或使用旧日期目录。先读单元和仓 AGENTS.md，以及 design/zcode-orchestration/package-split-contract.md、parallel-rewrite-contract.md、parallel-focused-review.md。主会话确认其他会话不写你的目录；你也不读其他正在写的模块，不动父 workspace/lock、正式 packages/site、旧实验、编排台账或其他仓。保留无关已有工作。本轮只修以下点，不自动扩展功能。

全部自动化测试用 Vitest。修改任何依赖版本前，先 GWB index 再 skill.read gwb-release；只许本目录依赖/lock 的必要修改，基线 core/base-ui16.17.1、mdx15.4.7、Vite8.3.4、React Router8.4.0，不擅自升级。避免 pnpm exec 的共享 workspace install；从自己隔离目录调用本地工具。不提交、推送、发布、不用 default home 验插件、不归档。真实浏览器若受工具限制，记录缺口，合成事件只算自检，不声称真实操作通过。

完成后更新自己 result.md/handoff.json，写实际文件、关键检查命令/结果、仍未解决项与复跑方法；停自己服务，释放写入。保留可用部分，不做全量重写或为工具故障叠加产品机制。

1. 保留 Config API 命名集合、server/browser 分离、官方 createClientLoader 及唯一 Vite+fumadocs-mdx 编译链。
2. 重点复现新增评论时 server metadata 先于浏览器入口到达、CommentBodyBoundary failed 后不能恢复，以及删除已加载正文后的 Vite reload 错误。已有 tests/helpers.ts 的短暂500重试只证明最终收敛，不是修复。error boundary 确实能捕获子 Renderer 错误，本次不纠缠错误的“捕获不到”说法；问题是生命周期和恢复。
3. 用真实浏览器验证已加载回复后删除、连续新增/删除、更新时未提交草稿不丢失；记录 console。不要靠整页刷新、边界吞错、500重试、延时、touch配置、改写生成代码、私有runner缓存、hotUpdate删除过滤或第二编译器实现通过。
4. 若原生机制确有上游缺陷，交最小复现、准确故障层与两个尽量小的公开配置/上游修复选项；标未完成，不堆业务补丁。公开但未文档化 index.target=default 的稳定性如实记录。
本轮不扩展编辑、提及、resolve/reopen、覆盖层或身份集成。
