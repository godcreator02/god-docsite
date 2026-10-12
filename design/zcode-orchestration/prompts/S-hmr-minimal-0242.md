任务S：评论dev热更新的最小独立实验。用户已批准“稳定页面组件 + 原生MDX热更新 + 正文入口就绪后显示”的验证。新会话是为了从最小样本重新判断，不能继承N的“无公开无损解”结论。

先读 D:/unitfolders/oz47p-docsite-kit/AGENTS.md、docsite-kit/AGENTS.md 和 design/zcode-orchestration/package-split-contract.md、parallel-rewrite-contract.md。唯一独占写入目录：D:/unitfolders/oz47p-docsite-kit/docsite-kit/probes/2610120242_comment-hmr-minimal。主会话确认此新目录无人写。可以只读已停止N的 probes/2610120120_fumadocs-native、已完成 probes/2610111940_api-audit-hmr，及本机对应版本依赖源码。不要改N/O/P/Q/R、父workspace/lock、正式包/站、旧实验或其他仓。只选择必要配置参考，不复制node_modules或整份大验证站。新实验命名已按用户yymmddhhmm_用途规范。

目标只有一个：一页包含稳定计数器、未提交的输入框，以及可新增/删除的MDX评论（再含一个已加载MDX中的计数器用于区分正文组件重挂）。新增评论可先反馈已保存，正文入口就绪后才调用官方正文加载；删除已加载评论不报模块reload错误。不要加真实身份包/布局/覆盖层/搜索或完整评论业务。站点action写文件，维持唯一Vite+fumadocs-mdx链、Config API命名集合及server/browser分离、SSR不关闭。

主会话核对发现N推理有两处跳跃：
- @react-router/dev/dist/vite.js 的 server-change-trigger-client-hmr 调用 reloadModule 只是触发模块HMR，其后REACT_REFRESH_FOOTER仍有validateRefreshBoundaryAndEnqueueUpdate。模块更新不等于整树必重挂。官方 https://reactrouter.com/explanation/hot-module-replacement 明确标准loader/action被特殊处理且普通命名函数组件可保状态。不能只凭日志/client route update或form DOM替换判整棵路由remount。
- fumadocs的公开browserCollections.<name>.raw本来就可查入口，无需为has(path)等上游新接口等待。
- 特别核对：useFetcher返回Form的useMemo在Fast Refresh下是否重新计算导致Form类型换掉；createClientLoader在模块重求值时新生成内部Renderer是否只导致正文子树重挂；这些与顶层路由被卸载不同。不要把effect清理重跑当作React卸载证据。

实验方法（小步对照，每次只改一处）：
A. 最小标准RR route，用纯服务端数据模块，单独触发该模块更新，记录稳定组件state/useRef、输入值、DOM身份及timeOrigin；路由标准导出，UI采用命名函数组件，区分同文件组件与独立纯组件模块。验证正常Fast Refresh到底保不保状态。
B. 加入Fumadocs原生docs/comments集合，复现新增/已加载后删除。先用官方createClientLoader，在正文调用前通过raw查询准备状态；只用普通React组件与稳定id/key。新入口经原生HMR更新时应重渲染并自动脱离占位，不能永久“准备中”或靠刷新。
C. 若A过而B状态丢，精确识别哪个组件类型/边界失稳；优先把编辑器、稳定页面UI与正文入口模块合理分开，而非引入HMR状态总线。可对照公开raw入口配普通React Suspense/组件加载以确定factory组件身份问题，但仍由Vite编译，不造运行时MDX编译器或业务缓存体系。
D. 删除报错独立记录处理，不能用“卡片消失”代替console通过。遇到上游缺陷交最小可执行样本和准确源码，不为得到绿灯叠补丁。

禁止：自建hot.data/store/version通知机制、local/sessionStorage草稿持久化、整页刷新、touch配置、改写生成代码、私有runner缓存、hotUpdate删除过滤、固定sleep/重试500掩盖问题、第二编译链、擅自升级。index.target=default为受约束公开类型选项，可作已知对照；若默认Vite glob在Windows异常，单列变量，勿混成SSR必失败。

依赖基线 core/base-ui16.17.1、mdx15.4.7、Vite8.3.4、React Router8.4.0。依赖声明/版本操作之前每次先GWB index、skill.read gwb-release，只在自己隔离probe内安装、lock；不调用可能触发父workspace安装的pnpm exec。全部测试Vitest（不能node:test）。端口5520/5521先确认空闲，不杀别人的进程。不提交推送发布、不给default home验插件、不再派子会话。

交付：最小代码、README首行复跑命令、result.md/handoff.json，区分A/B/C各对照证据、保留和丢失的状态、console、尚未解决项。真实浏览器输入可用才称真实交互；工具不可用直接标缺口，禁止花大量时间合成点击再自称验收。停止自己服务并释放写入即可交回。追求能说明根因的最小方案，不要求一次解决所有未知项。
