继续同一任务 Q，执行用户已批准的定点返工。重要：主会话已完成目录改名与依赖重接；你现在唯一独占写入目录是 D:/unitfolders/oz47p-docsite-kit/docsite-kit/probes/2610120126_page-sources。不要再创建或使用旧日期目录。先读单元和仓 AGENTS.md，以及 design/zcode-orchestration/package-split-contract.md、parallel-rewrite-contract.md、parallel-focused-review.md。主会话确认其他会话不写你的目录；你也不读其他正在写的模块，不动父 workspace/lock、正式 packages/site、旧实验、编排台账或其他仓。保留无关已有工作。本轮只修以下点，不自动扩展功能。

全部自动化测试用 Vitest。修改任何依赖版本前，先 GWB index 再 skill.read gwb-release；只许本目录依赖/lock 的必要修改，基线 core/base-ui16.17.1、mdx15.4.7、Vite8.3.4、React Router8.4.0，不擅自升级。避免 pnpm exec 的共享 workspace install；从自己隔离目录调用本地工具。不提交、推送、发布、不用 default home 验插件、不归档。真实浏览器若受工具限制，记录缺口，合成事件只算自检，不声称真实操作通过。

完成后更新自己 result.md/handoff.json，写实际文件、关键检查命令/结果、仍未解决项与复跑方法；停自己服务，释放写入。保留可用部分，不做全量重写或为工具故障叠加产品机制。

1. 保留公开 StaticSource/loader/search 的方向，以及 HTML iframe 原样展示（保留其脚本、样式、相对资源）；不要改成 local-html 的剥离转换。
2. 修 build/start 快照：lib/src/content-files.ts 当前每请求读源 content，site api.content 路由也指源目录，HTML/图片会随源修改而变，标题/索引却是构建时，不能接受。用标准 Vite/静态构建资产路径，在 build 时产出所需 HTML 和相对资源，start 只读产物；dev 可读源。明确复制入口/资源范围，别复制整个仓、别造新资产服务。
3. 加真实有区分度的 Vitest：build 后修改/移走自己 fixture 的源 HTML 与图片，start 的正文、资源、元数据仍为构建快照。测试自行恢复源文件，且应先证明原实现失败。
4. page-bodies.tsx 不再用永久500ms测量循环。以 iframe load、相关 ResizeObserver/图片字体就绪等必要事件更新；优先真实 heading id 和 iframe 内导航，减少 html-0 人工序号锚点那一套。确保真实导航与几何一致，别设计复杂跨框架协议。
5. MDX新增清单问题由N主查，不在Q另堆HMR补丁。SSR本地图像及HTML表格/持久锚点未完成如实列出；本次只针对快照和iframe接线收敛。
