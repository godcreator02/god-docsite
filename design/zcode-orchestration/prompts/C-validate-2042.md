继续你原来的 C 验收任务：主会话已审查 B 的实际源码、handoff/lockfile，独立重跑 pnpm types:check 退出0；B 在本次唯一状态读取中 completed + roundIsOver=true + mode=yolo，已停止服务，5460/5461 无监听。B 已释放写入占用，现在授权你开始 1.1 实际验收，并修正下面的样本问题。不要自行查询 B 或任何会话状态。

先读单元和仓 AGENTS.md、design/31-zcode-orchestration.html、implementation/handoff.json 与 result.md、site/README.md。主会话审查证据在 review/20261011-2042-review.md。只用 pwsh 7。唯一源文件写入范围仍为 acceptance/；site/ 源码、package.json、lockfile、依赖声明都冻结，不修改 B 实现、不装或升依赖。允许在现有 site/ 启停你自己的 dev 服务，并允许工具正常写 .source/、.react-router/、.probe-vite-cache/、node_modules/.vite-temp 等构建临时生成物；这只是验收的临时执行占用。启动前确认5460空闲，若被占不要结束别人的进程而交回；所有日志/PID/证据放 acceptance/evidence/。Start-Process 必须隐藏窗口，不用 $pid/$home 等自动变量。完毕只停自己明确记录的进程树、核对端口释放。不得改 coverage、implementation 或主会话台账。

先修正验收材料：
- G4-05 目前 step2 与 step3 字节完全相同，但要求同一评论从相同 before/after 文本得到两个不同定位结论，这不能作为验收契约；70/70 自检甚至只证明最终文本相等。旧实验 probes/2610102215_comment-anchor-page-text/runs/02-anchor-mapping.txt 明说“三句一模一样，单看文字分不出删的是哪一句，算法认定最后一句”，并未证明可识别人实际删哪一句。纠正引用与预期，保留完全相同重复文本作为信息不足边界样本（不要求凭空识别编辑意图，也不擅自宣布产品改为某种新策略），再用有可区分邻接上下文的样本定义可验证的“删前一处”和“删被批一处”。只修样本、文档和样本自检，不实现1.3、不实跑评论功能。result.md 的假身份码文字与实际 people.json 对齐。
- A-4 的“三页”是占位模板，当前实站只有 / 与 /second，不要求新造第三页。以这两个真实路由覆盖首页四段正文及第二页 B 正文即可，更新操作描述并记录映射。

实际执行只限 1.1 A-1～A-4：
- 保持 B 的现有样本，marker 是 A-ONLY-NODE-COMPILED；不要注入 cases 的未来页面/评论/身份/feeds。
- SSR 与真实浏览器分别核对首页 server A/browser A 含marker，server B/browser B无marker，/second B无marker。SSR不要仅搜索整页字符串（整页同时有A与B），记录对应可见正文段的隔离证据。
- 浏览器刷新后每次真实点击逐次确认0→1→2→3；输入一段文字看回显；点击站内链接 /→/second→/，第二页自己的计数也真点。工具超时可能已发生点击，先读实际状态，不盲重试导致叠加后宣称一次点击多加。
- 对两个路由与导航后收集实际 console error/warn；Node externalized、module runner closed、hydration错误都记为问题。若浏览器工具不提供控制台读取，明确证据缺口，不把“交互正常”写成“console无错误”。
- 留存可复核的浏览器快照/交互步骤/console原文、SSR片段、命令退出码。截图不是单独的通过依据。
- 发现实现问题只记证据交回，不能修 B。源文件是否变化可与 review/20261011-2042-site-source-hashes.json 对照；该manifest由主会话生成，禁止修改。

样本自检再跑，更新 acceptance.md 当前四项状态、evidence/ 和 result.md。后续1.2～1.6保持待测。不发布、不提交、不推送、不改default home、不归档、不派新会话。完成交回等主会话下一次15分钟检查，不轮询或长等待。
