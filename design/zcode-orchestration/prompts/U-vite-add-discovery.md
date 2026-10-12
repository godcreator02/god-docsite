任务U：责任定位——纯Vite能否复现Fumadocs新增正文失效。用户问“是Vite还是Fumadocs的问题”。新独立上下文，唯一写入目录 D:/unitfolders/oz47p-docsite-kit/docsite-kit/probes/2610121018_vite-add-discovery。先读单元/仓AGENTS.md。可只读T官方样本 probes/2610120354_official-react-router 和本机依赖源码；不修改T、其他probe、正式包、父workspace/lock或其他仓。主会话台账你不改。

目标用尽量小的纯Vite8.3.4样本，完全不加载Fumadocs/React Router/React，区分：watcher add事件是否收到、import.meta.glob集合是否失效更新。使用普通txt/json数据即可，无需MDX编译。测试全部Vitest，依赖声明前每次GWB index + skill.read gwb-release，隔离安装与锁，不升级任何现有包。

主会话从已安装Vite8.3.4 dist/node/chunks/node.js查到强嫌疑（需实验证实，别仅照抄结论）：
toAbsoluteGlob(glob,root,importer,resolveId,base)在相对base时执行
dir = posix.resolve(importer ? globSafePath(dirname(importer)) : root, base)
Windows规范化importer是D:/...，node:path.posix.resolve可能把D:/当相对路径再前缀cwd，产出不能匹配watcher文件的绝对glob。此globsResolved给vite:import-glob hotUpdate(type add/delete)匹配。初始文件扫描可能走不同实现，所以已有文件正常、新增失效。
Fumadocs codegen生成相对base，如 import.meta.glob(['./**/*.txt'], {base:'./../content',query:'?raw',import:'default',eager:true})，这是公开Vite用法，不先判fumadocs非法。

实验要求：
1. 干净纯Vite页面，模块在src/或.sources/，有初始数据文件；渲染Object.keys(glob)清单。用只读诊断plugin的configureServer监听server.watcher add/change、hotUpdate记录type/file，不能invalidate/reload改行为。
2. 同一站点分别串行测试三种唯一差异：A 相对base（仿官方生成形态）；B 根相对base '/content'；C 不用base直接'../content/**/*.txt'。隔离启动/窗口/新增文件，避免B/C命中同一文件触发全页更新而掩盖A失败。不手动刷新。新增文件后记录watcher已收add? transform产物/glob条目是否更新? 浏览器是否更新? 不只看日志有没有HMR字样。
3. 用本机node:path.posix.resolve和win32/path对应对照打印真实路径，结合Vite函数位置说明具体匹配错误（若成立）。可写一个Vitest证明路径字符串问题，同时真实Vite server+新增文件的集成验证证明行为；不能只镜像实现测试。
4. 若纯Vite A失败且B/C成功、watcher add到达，则可定位Vite相对base处理。若纯Vite正常，交回反证，再谈Fumadocs/ReactRouter，不扩大调查。
5. 不改已安装Vite源码/全局依赖/其他仓。不发布issue不提交推送不发版不归档。无需修复实现；最多说明潜在上游修复位置和公开配置可行性，Fumadocs如何适配留后续。

优先独立可复跑证据，避免大型站点/过多脚手架。端口5540/5541（先确认空闲）；可用Vite公开createServer和transformRequest/SSR API在Vitest内启动，真实浏览器验证新增清单时用实际页面读取，工具缺口就标记。不用注入合成事件声称交互通过，本场景只需要观察页面。结束停自己服务，交result.md/handoff.json、源码与命令、精确版本/日志。
