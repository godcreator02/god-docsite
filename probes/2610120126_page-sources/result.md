# 任务Q结果：页面来源与搜索原生适配（MDX / TSX / HTML）

日期：2026-10-12（Asia/Shanghai）。目录：`docsite-kit/probes/2610120126_page-sources`（本任务独占，此前不存在）。

## 交付

- **`lib/`（@probe/page-sources，普通导出，供主会话单写集成进 docsite-kit 来源模块）**
  - `tsxPageSource(metaOf, contentDir)` / `htmlPageSource(sourceOf, contentDir)`：把站点里 `import.meta.glob` 的清单换成 fumadocs 公开 `StaticSource`（不用已弃用的 `Source` 类型）。TSX 的标题/描述/搜索文本/Markdown 在页面文件导出的 `meta` 里明确提供；HTML 的全部从文本静态提取（`extractHtmlPage`：title、fumadocs:title 覆盖、description、h1–h6 序号锚点、段落按标题归属、Markdown 派生）。不装任何运行时编译器，不解析 ReactNode 内部形状，不碰 loader/search 内部缓存。
  - `searchServerOf(getSource)`：`createFromSource` 传函数（公开约定：loader 实例变化重建索引）+ 中文参数 `tolerance: 0, threshold: 0`（继承旧实现的功能基线经验；16.17.1 底层是 zbsearch，默认 multilingual 分词，中文零配置可切词，实测两项默认值对中文过宽）。
  - `contentFileUrlOf` / `contentFileResponse`：HTML 原样展示的地址规则。iframe 文档地址 = 文件地址（`/api/content/` + content 相对路径），页面内相对地址的图片、样式不用改写即照常解析；resolve + 前缀检查防路径逃逸。
- **`site/`（最小 fixture 站，React Router 框架模式，非五套站点的复制）**
  - MDX 集合：`source.config.ts` 放 `defineConfig`（Config API 配置入口），集合定义用宏式 `defineDocs({ dir: 'content', async: true, postprocess: { includeProcessedMarkdown: true } })`——官方全部 React Router 示例（react-router / -min / -i18n / -spa）与官方文档站在 16.17.1 的现行形态。server/browser 分离体现为：frontmatter（标题/树/搜索数据）两端同步、正文懒加载（`page.load()` + `use()`，官方按需正文入口），浏览器端不打包全量正文与 HTML 原文（`.server.ts` 文件只进服务端包）。
  - 三来源合一个 loader：`loader({ source: { mdx: docs.toFumadocsSource(), tsx: tsxPageSource(...), html: htmlPageSource(...) } }, { baseUrl: '/' })`，`page.type` 区分，路由按类型分支渲染。
  - 三格式**同目录混排**的中文样本（`content/guide/` 下 quickstart.mdx、counter.page.tsx（引用同目录 counter-model.ts）、waveform.html（自带样式/脚本/相对图片 demo.svg）），MDX 页引用同目录 mdx-demo.svg（走 remarkImage → import）。
  - 互动/展示边界：TSX 页是 React 组件进站点组件树（状态、事件、目录由 MutationObserver 从渲染出的 h2/h3 收集）；HTML 页 iframe 原样展示（样式脚本独立运行，不进组件树，目录来自来源提取的标题 + 正文区定位点，锚点是 HTML 里标题自带的 id，三处一致：structuredData.headings[].id = toc url = DOM 定位点 id；高度与定位点由 iframe 加载/ResizeObserver/字体就绪事件更新，无周期轮询）。
  - 路由：splat 内容页 + `api/search`（createFromSource GET，查询参数是 `query` 不是 `q`）+ `api/content/*` + `api/markdown?path=`（MDX 走 `getText('processed')`，TSX/HTML 走 data.markdown——三格式统一的 Markdown 形式约定）。

## 验证（全部 Vitest + 真实浏览器）

- 类型：lib `tsc --noEmit` 0 错误；site `react-router typegen` + `tsc --noEmit` 0 错误。
- lib 单元 20/20：HTML 提取（标题/描述/锚点/归属/实体解码含非法数字、script/style/注释剔除、无 body、Markdown）、TSX meta 校验（缺 title / 类型不对 / 路径不对都直接报错并写修法）、来源构造、`searchServerOf` 中文检索（命中、缺字词拒绝、锚点一致、GET 参数、loader 实例变化重建索引）。
- site 集成 10/10（真实 Vite 管线；第二轮返工后，含「构建后改源/移走源仍是快照」）：
  - `source-conventions.test.ts`：createServer + ssrLoadModule 加载真实来源模块——页面清单/URL/type、structuredData、Markdown 三通道、页面树（root meta「指南」分组三格式混排、顺序照 meta.json）。
  - `dev-server.test.ts`：createServer 驱动 react-router dev（5500）——三格式 200 + SSR 中文标题、侧栏三格式导航、中文搜索（标题/正文/锚点命中、缺字词空）、内容文件路由（svg 200、逃逸 404）、Markdown 三格式；**内容增删/改名**：TSX 新建→1 秒 200 + 搜索命中，改名→旧 404 新 200，删除→404 + 搜索清空；HTML 新建/删除同样 1 秒生效；MDX 新建 8 秒仍 404（回归探针，见下）。
  - `build-start.test.ts`：一次 `react-router build` + serve（5501）——页面/搜索/锚点/Markdown/内容文件/404 全部照常（构建快照形态分别验证）。
- 真实浏览器（ZCode 内置浏览器，build 产物）：MDX 页图片 hydrate 后显示、侧栏三格式混排、搜索弹层输入「波形」返回页面/标题/图片/段落五类结果、键盘选择跳转到 `/guide/waveform#html-0` 且 DOM 定位点存在、TSX 页点三次「加一」显示「点了 3 次」再重置、HTML 页 iframe 卡片渲染（高 442px 自适应）、同目录 svg 加载（naturalWidth>0）、iframe 内脚本点「换个颜色」后 borderColor 实际改变、TSX 页目录含「怎么互动/边界说明」。截图四张在 `site/out/browser-{mdx,tsx,html,search}.png`。

## Windows 相对 glob base 的共同阻碍（交主会话，未自行打补丁）

- 复现一致：fumadocs-mdx 15.4.7 的 codegen（`generateViteGlobImport`）把集合 glob 的 base 写成 `path.relative(outDir, dir)`（相对 `.source/`），**没有任何配置能改成根相对**；Windows 上 Vite `toAbsoluteGlob` 的相对 base 分支因此让 watcher 认不出新建文件——dev 下新建 MDX 12 秒不进清单（本 probe 实测），与 E-5、`review/20261012-0008-root-cause.md` 相同结论。删除 MDX 未在本 probe 测试（会把 SSR 打死、污染后续断言），依根因文档记录。
- 本 probe 的对应做法：TSX/HTML 来源的 glob 全部用**根路径模式**（`/content/**`，不带 base 选项），实测增删改名 1 秒生效——正是根因文档「修复方向」里「基于公开的 Vite import.meta.glob 根路径模式」的验证数据。MDX 集合维持上游现状，没有改生成代码、没有 HMR 补丁、没有动 node_modules。

## 已知缺口（明确列出，不扩大范围）

- **MDX dev 增删**（上述上游缺陷）：等待上游修复或主会话按根因文档方向统一决策；`dev-server.test.ts` 最后一个测试是它的回归探针（上游修好后该测试失败即是提醒）。
- **SSR HTML 里 MDX 本地图片缺位**：remarkImage 把本地图片交给打包器懒加载，SSR 流在挂起边界结束前不含 `<img>`；浏览器端 hydrate 后正常显示（已验）。HTTP 断言不断言 img，实际渲染由浏览器验收覆盖。
- **HTML 提取是轻量文本级**：`<pre>` 代码块在搜索分段与 Markdown 里会被压平成单行；未处理表格的逐行结构化（fumadocs 的 remark structure 对表格按行切块）。够当前用例，集成进正式包时按需补。
- **HTML 锚点依赖内容写 id**（第二轮返工后为标题自带的真实 id，不再是序号式）：不写 id 的标题没有目录/搜索锚点（其段落归上一个有 id 的标题）；手写持久锚点链接因此可用。
- **未做**（按任务边界排除）：接 N 主站路由、全站布局定制、评论/身份、docfirst 钉码、协作站、llms.txt 完整路由（Markdown 形式只提供 `api/markdown` 单页通道与数据约定）、`multiple()` 迁移（直接用对象形式多来源，未碰已弃用 API）。
- `serializePageTree` 返回 `{$fumadocs_loader:'page-tree', data}` 壳（`useFumadocsLoader` 消费），树结构断言用原树——这是使用层面的记录，不是缺口。

## 版本与依赖（固定，未追新；发版规矩读自 gwb-release）

fumadocs-core 16.17.1（精确）、fumadocs-mdx 15.4.7（精确）、fumadocs-ui→`npm:@fumadocs/base-ui@16.17.1`（精确）、react/react-dom ^19.3.0、react-router ^8.4.0、vite ^8.3.2（实装 8.3.4）、@tailwindcss/vite ^4.3.3、typescript ^7.0.2（实装见 lock）、vitest ^5.0.1（实装 5.0.3）。照 2610111754_fumadocs-16-17-1 实验站与主会话根因文档固定的现行版本；probe 私有包不发版、不改生态依赖。

## 选型记录：官方 `@fumadocs/local-html`（2026-10-12 用户确认不采用）

官方有现成的 HTML 来源包 `@fumadocs/local-html`（fumadocs@16.17.1 tag 内 `packages/local-html`，npm 0.1.3，官方示例只有 `examples/next-local-html`）。它是运行时来源：请求时把 HTML 解析成 React、适配 docs 主题（限定 `main`/`article`，**删全部 script/style/iframe/form/内联事件与默认 class/style 属性**，标题生成 id 进目录搜索，代码块 Shiki），需换 `dynamicLoader` 并引入请求时编译链（`localContentPlugin` dev 失效 → full-reload）。不采用的理由：任务契约「TSX/HTML 不装一套新的运行时编译器」与 M2「只有一个编译链」；旧功能基线是 HTML 原样显示、自带样式脚本照常跑（官方包必删，`waveform.html` 这类页面的展示直接消失）；React Router 下无官方示例、dev 监视链未验。若将来出现「外部导出物料适配成站点排版」的需求，可另行引入它做第二种来源（loader 分键并存），与本实现不冲突。

## 定点返工（2026-10-12 第二轮，目录更名 2610120126_page-sources）

按主会话重点复核（`design/zcode-orchestration/parallel-focused-review.md` 的 Q 节）只修两处，方向保持：公开 StaticSource/loader/search 与 HTML iframe 原样展示（保留脚本、样式、相对资源），不改成 local-html 的剥离转换。

**快照（先红后绿）**：原实现 `contentFileResponse` 每请求 `fs.readFile` 读 content 源、api.content 路由指源目录，build/start 仍读源——先写「构建后修改、移走源 HTML 与图片，start 的正文/资源/元数据仍是构建快照」的 Vitest，在旧实现上跑出失败证据（`expected … to contain '波形图说明'`——/api/content 返回了被篡改的源内容）。修法：lib 新增 `copyContentAssetsToBuild`（复制范围=与 `contentFileResponse` 同一张 contentTypes 扩展名表：html/图片/字体等，内容源 .mdx/.tsx 不进产物），site 的 vite.config 在 client 环境收尾钩子复制到 `build/client/api/content/`；start 下这些地址由静态文件接管，api.content 路由 dev 读源、PROD 落到即 404（构建时没有的路径不出现）。修复后测试转绿。

**iframe 接线收敛**：`HtmlPageBody` 去掉永久 500ms 测量循环，改为事件驱动——iframe `onLoad` 接线（挂载时先接一次，跨 iframe 导航重接、接线前卸上一份）、iframe 文档 `documentElement` 的 ResizeObserver（脚本改 DOM、图片撑高）、`document.fonts.ready`；锚点从人工序号（`html-0`…）改为 **HTML 里标题自带的 id**：来源提取只收带 id 的标题（无 id 标题不产锚点、其段落归上一个有 id 的标题），目录/搜索 url/DOM 定位点/iframe 内 `getElementById` 共用同一个真实 id，iframe 内部自己的 `#id` 导航由浏览器原生处理。`waveform.html` 样本标题已写真实 id（`how-to-read`、`scripts-run`）。

**返工后的验证**：lib 类型 0 错误 + 20/20；site 类型 0 错误 + 10/10（含新快照测试）。真实浏览器（build 产物，坐标点击）：目录点「波形图怎么看」导航到 `#how-to-read`，外层定位点 top 210 vs iframe 内标题 top 209（几何对准）；点「脚本也在跑」到 `#scripts-run`，440 vs 439；iframe 高度 442px 由事件驱动自适应；iframe 内「换个颜色」按钮真实点击后 `borderColor` 变为 `rgb(112, 222, 159)`；搜索弹层「脚本也在跑」返回真实锚点记录。截图已更新（`out/browser-html.png`、`out/browser-search.png`）。工具缺口如实记录：waveform 页上侧栏搜索按钮的 Playwright 定位器点击两次超时（actionability 稳定判不过，疑与定位点重渲染有关），改用真实坐标点击完成同等操作——不算工具故障导致验收缺失，但定位器路径未深查。

**返工未扩展**：MDX dev 新建不进清单仍归 N 主查（未加任何 HMR 补丁）；SSR 本地图片缺位、HTML 表格逐行结构化、手写持久锚点之外的锚点稳定性（真实 id 方案下手写锚点已可用）如下列缺口。

## 写入与释放

只写了 `probes/2610120126_page-sources/`（含自己的 pnpm-workspace.yaml 截断与 pnpm-lock.yaml）。没动其他 probe、packages、plugins、site、父 workspace/lock、台账或其他仓。返工两轮的 dev（5500）与验收 serve（5501）均已停止，端口已确认释放（LISTENING 0 条）。未提交、未推送、未发布、未用 default home 验插件、未派子会话。
