你是新的ZCode任务K：身份/评论独立包集成与验证站实现。用户已批准功能分包并明确要求实际代码；主会话负责编排和最终审查。I/J均已completed、roundIsOver=true、mode=yolo并交回，主会话已释放它们的写入占用，本轮由你单写两个新包和验证站，不与其他实现会话重叠。

先读 D:\unitfolders\oz47p-docsite-kit\AGENTS.md、docsite-kit\AGENTS.md、design/31-zcode-orchestration.html、design/zcode-orchestration/package-split-contract.md、probes/2610112023_docsite-kit-complete/review/20261011-2206-review.md、package-split/identity及comments各自result/handoff、site/README.md。先GWB index；文档按docs-writing，任何依赖/版本声明变更每次读gwb-release。只用pwsh7；复杂命令用你独占目录的ps1。不得派子会话，不提交推送发布，不改其他仓或default home。

独占允许写入：
- packages/docsite-identity/、packages/docsite-comments/（本轮必要修正、构建、测试与README）。
- probes/2610112023_docsite-kit-complete/site/（接入实际功能、隔离实验依赖和可复跑样本）。
- probes/2610112023_docsite-kit-complete/package-split/integration/（脚本、日志.txt、证据、result.md、handoff.json）。
- 仓根pnpm-lock.yaml，只允许登记这两个新包及所需解析，必须保留旧importer版本与其他内容；pnpm-workspace.yaml已有packages/*，通常不用改。根package.json/workspace配置只有真实必要才可最小调整并解释。主会话本次定点git status看到三文件干净；你修改前再核对，若出现其他未归属改动就停止共享写入并交回，不覆盖或收取他人工作。修改前存这三个文件基线到integration，不用git checkout/reset全文件回退。
- 允许各目录正常node_modules/缓存/dist生成。旧packages/docsite-kit、plugins/docsite、正式site自述站、原实验、coverage、acceptance、design、trajectory、主会话review全只读。

主会话已实际验证：I投影反例修复；I 22 tests+typecheck+build通过；J 40 tests+typecheck通过。日志见review/20261011-2206-*。identity/dist已生成，这是实际公开入口，不需再造alias。根lock尚无新包importer，现有依赖来自J误触发pnpm exec的隐式安装，本轮必须把安装与声明一致性真正闭合。可在独占状态正式pnpm install，但不要更新旧包依赖、抬旧包版本或追最新版；优先用已有锁定/本地可用版本。报告install、类型检查、测试、两包build及导出运行时解析各自结果。站点必须通过公开exports消费构建产物，不能跨包src相对导入、tsconfig paths或stub伪造包集成；选择local package/打包产物等正常依赖方案并记录，保持probes站点与旧实验依赖容器隔离，避免重复React和身份包类实例导致instanceof不一致。

集成前先修主会话已发现问题：
1. J的CommentRequestOptions额外要求identity，与契约不符。保留可信commenter+people+pageUrls+siteOrigin等既定字段，内部从commenter构造SiteIdentity交authorizeWrite，去掉重复身份输入；更新正式测试与README，不改变共同接口文档。
2. HTTP form的as非字符串（包括Blob/File）应400，空字符串保持旧未知id行为400；只有缺省才使用本人。现在将异常值转null会静默按本人执行，要修并加请求层回归。
3. 评论组件fd-*颜色类和要求宿主提供Fumadocs颜色的README仍有耦合。改成包自己的tokens/默认样式，明确Tailwind消费要求或提供可用CSS，验证站导入本包样式后能正常显示。不能靠引入Fumadocs/base-ui CSS补洞。Identity的Avatar/Badge通用工具类也要确实有样式。
4. 暂不重写快照差分、DOM锚点/展开算法或splitText覆盖层，不修整个内容HMR；这些属于后续。对.katex/.sr-only等旧假设列明保留边界。MDX默认校验配置与宿主插件尚未对齐时如实记录，不能说全功能已稳定。

实际站点实现：
- 保留现有 / 与 /second 的A/B Config API、Node插件隔离及交互基线，可另加 /comments-demo 与 /comments 路由和api/comments入口。
- 使用新身份包从站点专用people.json读取人员，DOCSITE_IDENTITY_CODE只用编造的验收码。环境只设在本次子进程；带身份站仅127.0.0.1。loader向浏览器只传publicPeopleOf和公开identity，不把codes或环境值写入HTML/错误。
- 使用新评论包实际PageComments/AllComments与server函数；渲染正文由宿主经公开MDX能力提供，不能把评论正文简单当转义原文伪装MDX支持。显示至少含格式/链接的评论正文，明确本批已验的正文能力。
- 真正评论文件落到本实验site/comments目录；不得写正式站评论。创建/回复/编辑/删除/解决/重开应有文件证据，合法agent as能署名，非作者编辑/删除拒绝。
- 写后页面应能看到新结果，不能只有磁盘成功。若本批使用显式刷新/revalidation保留旧行为要说明；不把已知新MDX成员失效问题藏起来，也不擅自把整套内容更新机制重写。无法闭环就给最小复现与具体原因。
- 验无身份只读站（可串行切换重启，或独立5461）和Origin缺失/错误、as冒充人员、未知agent及畸形as；拒绝请求不得改文件。
- 定位至少验文字选中后评论、原文改动保留映射，以及原collapse-test的等价ARIA折叠样本，批注后关闭再定位展开。若完整collapse-test集成难，明确覆盖了哪些/哪些未验，不拿样本自检代替实站验收。

检查纪律：
端口5460主站/5461只读，先确认空闲，不杀已有占用进程。记录自己启动的PID/进程树，Start-Process隐藏窗口，禁用$pid/$home自动变量名。结果回交前停自己服务并核对端口。留一个清楚的复跑入口和身份开关说明。
浏览器使用真实click/typeText/键盘选择，不用dispatchEvent、DOM click、React内部props模拟真实验收；CUA可访问性索引操作已在主会话验证可用，Playwright超时先读状态勿盲重试。tab.dev.logs({levels:['error','warn'],limit:100})可读console，不能声称没有API而略过加载期。若工具限制，用证据记录缺口，由主会话补验；不得包装成“通过附说明”。SSR200和截图都不能单独证明功能。
只做必要行为回归，不造镜像实现的测试或单纯目录存在断言。关键检查通过后不无故反复跑全套。正文包构建可以跑；不跑旧生产站全站build。

完成写integration/result.md和handoff.json：实际文件列表、修复点、版本/安装方式/lock变化、每项命令退出码、exports验证、浏览器步骤与console、文件读写证据、已验/未验、服务停止、复跑命令、下一步准确范围。只交真实可运行结果。完成等主会话15分钟定时检查，不轮询其他会话或持续读台账，不自动归档。
