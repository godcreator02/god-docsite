任务L：实现create-docsite的一次性建站文件生成核心（与K评论集成独立并行）。用户刚明确授权增加一个可并行任务，并将主会话监控改为当前会话每15分钟轮询，自动定时任务已经停用。你只负责代码，主会话复核；不要自行派任何子会话。

先读 D:\unitfolders\oz47p-docsite-kit\AGENTS.md、docsite-kit\AGENTS.md、design/31-zcode-orchestration.html。先GWB index，写文档读docs-writing，涉及版本或依赖声明每次读gwb-release。只用pwsh7，复杂脚本放自己目录用-File运行，避免bash展开变量。不提交推送发布，不动default home、不改其他仓。

独占允许写入：
D:\unitfolders\oz47p-docsite-kit\docsite-kit\packages\create-docsite\
D:\unitfolders\oz47p-docsite-kit\docsite-kit\probes\2610112023_docsite-kit-complete\package-split\create-core\
这两个目录派单前均不存在。K正在写identity/comments包、主验证站和根lock，全部不要读在途实现、不改、不等。旧packages/docsite-kit/src/init.ts与template仅作只读现状参考，不执行旧初始化。主会话design/state/review只读。

为了不让K的workspace安装扫到一个写到一半的新包，本轮暂不创建create-docsite/package.json，也不执行pnpm（exec也可能隐式install），不改任何workspace或lock，不装依赖。交付正式目标目录中的实际src与测试；使用Node24内置fs/path及node:test，TS可用Node类型剥离配明确.ts相对import（不得依赖未声明第三方模块），若构建需要现成tsc可直接调用已有可执行文件，但不能改其他包。包manifest/bin导出/最终默认模板随后串行登记，不能因此交TODO空壳。README说明当前直接Node运行方式与未完成的打包步骤。

实现范围与小接口：
- createSite({dir, templateDir}) 接受明确目标目录及模板目录，返回创建文件与保留文件列表；CLI src/cli.ts提供 --dir 与 --template，错误退出非0，成功打印简洁结果。模板是普通文件树，不执行其中脚本、不运行install/git/启动站点。
- 这是一次性新建，不是升级覆盖器。已有站点（package.json、app/或本工具创建标记存在）明确拒绝，不改一个字节。目录只含content/、comments/、people.json等用户材料时允许创建骨架，但这些既有材料必须原样保留；模板里相应默认数据只填缺失，不能覆盖已有数据文件。
- 其他模板目标文件若已存在，先全量预检并列清冲突，拒绝且不留下半套骨架。不要把所有现有文件都默认为可覆盖。
- 模板路径、目标路径、相对文件路径必须真实限定在指定目录内，拒绝目录自包含/模板与目标重叠、符号链接穿越和不合理路径。安全检查围绕真实文件操作即可，不要另造平台框架。
- 文件写入用不覆盖的方式，预检与真正写入之间若发生冲突，也不得覆盖；失败尽可能只撤回本次明确新建的文件和空目录，保留原文件。任何清理先确认绝对路径在本任务测试输出/本次目标内，禁止广泛递归删除或跨shell删除。
- 可合理选内部模块如src/create.ts、src/plan.ts、src/cli.ts，别拆一堆只有转发作用的空模块。不要实现模板引擎、自动下载、依赖版本升级、gwb命令/服务、正式站迁移或新模板的Fumadocs接线。当前任务是可运行的创建核心，最终模板等K稳定后再组装。

必须实际测试的行为（真实临时目录IO，不仅mock/文件名断言）：
新空目录完整复制多层文件与二进制原样；同一目标再运行拒绝且全部hash不变；带content/comments/people的目录新建后旧材料hash不变；模板文件冲突发生在复制前而无局部残留；非法/重叠目录拒绝；失败回滚不删原文件；CLI成功与失败退出码。测试临时目录全部在自己的create-core范围，结束清理只处理测试自己创建的目标。
不编造未测试并发/断电恢复保证，若此批只保证常规失败回滚要写清边界。

交付src、test、README，以及create-core/result.md和handoff.json：真实文件列表、接口/CLI用法、实跑命令与退出码、行为通过情况、残留临时目录或进程（应无）、等待串行登记manifest/最终模板的准确范围。完成就交回，不轮询、不等K、不自行发消息给别会话。
