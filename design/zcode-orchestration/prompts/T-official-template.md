任务T：原样官方React Router模板的dev新增正文验证。这是用户最新明确要求“试官方模板吧”，不是续写N/S实验；请用独立上下文、原样官方模板，不复用我们之前拼出的站点实现。

先读 D:/unitfolders/oz47p-docsite-kit/AGENTS.md、docsite-kit/AGENTS.md，以及 design/zcode-orchestration/official-template-audit.md。唯一独占可写目录：D:/unitfolders/oz47p-docsite-kit/docsite-kit/probes/2610120354_official-react-router。主会话确认无人写该新目录。不得改旧probe、正式packages/site、父workspace/lock、编排文档或其他仓。不要再派子会话。

模板来源需可核验，优先完整取得官方提交 d6cfc48d62aa9ea413f0fc5033617c0c923681ec 的 examples/react-router（不是自己按文档拼；packages/create-app/scripts/sync.ts证实它是CLI react-router模板来源）。该提交mdx版本15.4.7。也可使用明确记录版本的官方create-fumadocs-app生成react-router模板，但要核对实际生成的Macro接线与官方一致，不能无说明改用别的版本/模板。原始文件快照/哈希清单留在自己的probe内，保存来源commit、完整依赖版本和必要差异。

最重要：app/lib/source.ts 的 fumadocs-mdx/macro defineDocs、app/routes/docs.tsx 的 docs.getPage/path + use(page.load()) + page.body、vite.config.ts 默认fumadocsMdx()/reactRouter()、root和路由保持官方原样。不要改成Config API、.source、createClientLoader；不要加raw入口防护、index.target、自建HMR、SSR身份探针、Math.random/计数根目录辅助逻辑。若模板本身启动失败，先记录准确错误及原因，只允许必要安装适配；不能悄悄改运行机制再叫官方模板。

安装适配：读gwb-release后，在独立probe内把官方workspace依赖转换为已发布的相同基线版本；core/base-ui16.17.1、mdx15.4.7、RR8.4.0、Vite8.3.4、React19.3.0。附上每处package/lock改动，别抬旧包版本或升无关依赖。不要执行共享install，不拿default home验插件。所有命令pwsh7；不要pnpm exec导致父workspace隐式install。以dev实验为主，不为了热更新实验额外做大规模build/测试套件。

流程：
1. 先完整启动官方模板，打开官方已有正文，确认能正常渲染及hydrate；读取console，此时若已有错误要单列。
2. 只在content/docs里加测试内容。准备一篇已存在的基线页和其自写TSX（useState计数器＋受控/非受控输入）与图片；先让这篇稳定渲染，再真实点击/输入，记录timeOrigin和状态。
3. 同一dev进程运行中新增另一篇MDX，引用它自己新写的同目录TSX及SVG/图片。先写依赖资源再写MDX以排除半文件。不要刷新/重启/touch配置。观察官方导航是否自动更新、已有内容里的组件计数和输入是否保留、有无console/HMR/HTTP错误。
4. 真实点新增导航到新页，确认新TSX计数器可交互、图片成功；新标签直开新URL也验证。可追加“新增页已打开后修改它自己的TSX”这一最直接原生HMR场景，但不做删除/评论/多集合矩阵。
5. 如果新增页不出现，记录等待窗口和新URL状态，以及模板原样文件哈希是否一致；本轮不要修复或切换其他API/config。若成功同样只报原样模板结果，不立即移植评论。

真实浏览器必须实际点击/输入与console证据；工具通道有问题直接标缺口，别大量合成事件自称通过，主会话可补。自动化测试如需新增只用Vitest，不node:test。端口5530/5531先确认空闲，只管自己服务。不提交推送发布，不归档。
交付README首行复跑命令、official-source.md/差异清单、result.md、handoff.json及日志；保留可重跑样本，停止自己服务并释放写入。回答要分：模板启动、新增发现、客户端导航、直开、新TSX交互、原TSX状态、编辑TSX的HMR。未经验证的不得写“全部通过”。
