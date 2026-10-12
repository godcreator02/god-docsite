继续同一任务 O，执行用户已批准的定点返工。重要：主会话已完成目录改名与依赖重接；你现在唯一独占写入目录是 D:/unitfolders/oz47p-docsite-kit/docsite-kit/probes/2610120120_comments-overlay。不要再创建或使用旧日期目录。先读单元和仓 AGENTS.md，以及 design/zcode-orchestration/package-split-contract.md、parallel-rewrite-contract.md、parallel-focused-review.md。主会话确认其他会话不写你的目录；你也不读其他正在写的模块，不动父 workspace/lock、正式 packages/site、旧实验、编排台账或其他仓。保留无关已有工作。本轮只修以下点，不自动扩展功能。

全部自动化测试用 Vitest。修改任何依赖版本前，先 GWB index 再 skill.read gwb-release；只许本目录依赖/lock 的必要修改，基线 core/base-ui16.17.1、mdx15.4.7、Vite8.3.4、React Router8.4.0，不擅自升级。避免 pnpm exec 的共享 workspace install；从自己隔离目录调用本地工具。不提交、推送、发布、不用 default home 验插件、不归档。真实浏览器若受工具限制，记录缺口，合成事件只算自检，不声称真实操作通过。

完成后更新自己 result.md/handoff.json，写实际文件、关键检查命令/结果、仍未解决项与复跑方法；停自己服务，释放写入。保留可用部分，不做全量重写或为工具故障叠加产品机制。

1. src/highlight.ts 使用固定全局 CSS Highlight 名称，两个实例会覆盖，卸载一个会清除另一个。改为每实例拥有的注册名和清理，只清自己的资源；补有意义的双实例/卸载验证。
2. 卡片靠视口底部会越界。基于实际卡片尺寸和可用空间作必要翻转/夹限，窄屏及滚动下验证，不引入大型布局管理器。
3. 保留正文外兄弟覆盖层和 Range 只读测量，不能插节点/属性/包裹/拆文本。现150ms事件触发兜底不是持续轮询，不要误改为另一套轮询；若调整调度，只消除重复和清理问题。
4. 针对双实例高亮、底部卡片、滚动/折叠做少量真实交互检查；正文子树不被标注机制改动。不要为 IAB 输入问题扩张产品机制。
