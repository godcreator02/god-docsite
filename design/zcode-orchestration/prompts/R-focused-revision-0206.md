继续同一任务 R，执行用户已批准的定点返工。重要：主会话已完成目录改名与依赖重接；你现在唯一独占写入目录是 D:/unitfolders/oz47p-docsite-kit/docsite-kit/probes/2610120123_writing。不要再创建或使用旧日期目录。先读单元和仓 AGENTS.md，以及 design/zcode-orchestration/package-split-contract.md、parallel-rewrite-contract.md、parallel-focused-review.md。主会话确认其他会话不写你的目录；你也不读其他正在写的模块，不动父 workspace/lock、正式 packages/site、旧实验、编排台账或其他仓。保留无关已有工作。本轮只修以下点，不自动扩展功能。

全部自动化测试用 Vitest。修改任何依赖版本前，先 GWB index 再 skill.read gwb-release；只许本目录依赖/lock 的必要修改，基线 core/base-ui16.17.1、mdx15.4.7、Vite8.3.4、React Router8.4.0，不擅自升级。避免 pnpm exec 的共享 workspace install；从自己隔离目录调用本地工具。不提交、推送、发布、不用 default home 验插件、不归档。真实浏览器若受工具限制，记录缺口，合成事件只算自检，不声称真实操作通过。

完成后更新自己 result.md/handoff.json，写实际文件、关键检查命令/结果、仍未解决项与复跑方法；停自己服务，释放写入。保留可用部分，不做全量重写或为工具故障叠加产品机制。

1. fixture 当前 core/base-ui16.16.2 与 mdx15.4.4 用错基线。读 gwb-release 后在自己隔离目录改回 core/base-ui16.17.1、mdx15.4.7（其它锁定基线如上，不升级无关依赖）。
2. source.config.ts 全局 remarkGlossary + skipFile 按路径过滤，且说集合级 mdxOptions 不可用，是方向错误。参照已完成只读证据 probes/2610111940_api-audit-hmr/README.md 的E4和 .fixtures/config.baseline.ts/config.collections.ts：用 Config API 命名集合各自 mdxOptions/applyMdxPreset；编译插件留服务端配置，不从浏览器入口导入。
3. Term 全局 seq 生成id不安全；React Router 下没有 use client 不代表服务端专用组件，useId也不要求写这个指令。实际浏览器产物含 Term。改为 React SSR 安全的ID方式，修相关注释，验证重复SSR和hydrate的相关场景，保留普通组件实现。
4. termMarkdownRule + 手工 mdast 序列化不能证明 Fumadocs 实际输出。验实际公开 getText('processed') 或站点 markdown 输出，避免再造旧式组件名称注册/第二套协议。能删的重复约定删掉；输出文本满足预期才算。
5. 原纯 glossary/Term/Tex 算法合理部分保留。合成click/key只能标自检，不能把旧结论写成真实浏览器全通过。只跑这几处关键回归、types/build。
