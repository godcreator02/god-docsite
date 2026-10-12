# 页面来源与搜索：MDX / TSX / HTML 三格式进同一棵树与同一个搜索索引

```bash
cd docsite-kit/probes/2610120126_page-sources && pnpm install && (cd lib && pnpm check && pnpm test) && (cd site && pnpm types:check && pnpm test)
```

跑完上一行得到：lib 类型检查 + 20 个单元测试；site 类型检查 + 10 个集成测试（真实 Vite dev 服务的 HTTP 验证、内容增删改名、一次完整 build 与 start 快照——含「构建后改源/移走源仍是快照」）。要看站：`(cd site && pnpm dev)`（http://127.0.0.1:5500）或 `(cd site && pnpm build && pnpm start --port 5501)`。

## 目录

```
2610120126_page-sources/
├── pnpm-workspace.yaml      # 截断向上的 workspace 查找；lock 留在本目录
├── lib/                     # 来源模块 @probe/page-sources（普通导出，供正式包集成）
│   ├── src/
│   │   ├── sources.ts       # tsxPageSource / htmlPageSource → StaticSource
│   │   ├── html-text.ts     # HTML 静态提取：标题/描述/标题锚点/搜索分段/Markdown
│   │   ├── search.ts        # searchServerOf：createFromSource 包装（中文参数）
│   │   ├── content-files.ts # /api/content/ 地址规则 + 服务端文件响应
│   │   ├── index.ts / server.ts  # 浏览器安全导出 / Node 端导出
│   └── test/                # 20 个 Vitest 单元测试
└── site/                    # 最小 fixture 站（React Router 框架模式 + fumadocs）
    ├── source.config.ts     # Config API 配置入口（defineConfig）
    ├── app/lib/collections.ts        # 宏式 async MDX 集合 + TSX 模块懒 glob（两端共用）
    ├── app/lib/source.server.ts      # 三来源 loader 接线（仅服务端）
    ├── app/lib/page-bodies.tsx       # TSX 按需组件正文 / HTML iframe 正文（事件驱动测量）
    ├── app/routes/{page,home,api.search,api.markdown,api.content.$}.tsx
    ├── vite.config.ts       # build 收尾把 content 资产复制进 build/client/api/content（start 只读产物）
    ├── content/             # 三格式同目录混排的中文样本（guide/ 下 mdx + page.tsx + html + svg）
    ├── test/                # 10 个 Vitest 集成测试（约定 / dev 增删 / build+start 快照）
    └── out/                 # 浏览器验收截图
```

## 三格式的约定

| 格式 | 页面清单 | 元数据 | 搜索内容 | Markdown 形式 | 正文展示 |
| --- | --- | --- | --- | --- | --- |
| MDX | fumadocs-mdx 宏式 async 集合（Config API + server/browser 分离：frontmatter 两端同步、正文按需加载） | frontmatter | remark structure 插件 | 官方 `getText('processed')` | 编译组件 |
| TSX | `import.meta.glob('/content/**/*.page.tsx', { eager: true, import: 'meta' })` → `tsxPageSource` | 页面文件导出的 `meta`（title 必填；description / searchText / markdown 可选） | meta 显式给出的文字 | meta.markdown，缺省由标题与描述派生 | 按需加载的 React 组件（互动边界） |
| HTML | `import.meta.glob('/content/**/*.html', { eager: true, query: '?raw' })` → `htmlPageSource` | `<title>`（可被 `<meta name="fumadocs:title">` 覆盖）、`<meta name="description">` | 从正文提取：标题锚点 + 段落按标题归属 | 从结构派生（标题层级/段落/链接/图片） | iframe 原样渲染（展示边界：自带样式脚本，经 `/api/content/` 送出，相对地址的图片照常解析） |

URL 约定：`guide/demo.page.tsx` 的地址是 `/guide/demo`（`.page` 去掉，与 meta.json 的 pages 名字一致）；`guide/waveform.html` 的地址是 `/guide/waveform`。HTML 页的目录锚点是**HTML 里标题自带的 id**（`<h2 id="…">`）：目录、搜索结果的 `#锚点` 与正文区定位点共用它（三处一致，标题不写 id 就没有锚点、其段落归上一个有 id 的标题）；iframe 内部自己的 `#id` 导航由浏览器原生处理。高度与定位点在 iframe 加载、内容尺寸变化（ResizeObserver）、字体就绪时更新，不做周期轮询。

`/api/content/` 的两种来源：dev 由路由读 content 源目录；build 由 vite 插件把 content 里**可被服务的扩展名**（与 `contentFileResponse` 同一张表：html/图片/字体等）复制成 `build/client/api/content/` 静态资产，start 只读产物——正文/资源与构建时的标题、搜索索引来自同一份快照，构建后源里增删改不会出现在 start 站上（路由在 PROD 下落到即 404）。

搜索：`searchServerOf(() => source)`——`createFromSource` 的公开约定是传函数、loader 实例变化时重建索引；中文参数 `tolerance: 0, threshold: 0`（multilingual 分词默认可用，这两项默认值对中文过宽）。

## 已知边界

MDX 集合在 Windows dev 下新建文件不进清单：fumadocs-mdx 15.4.7 生成的集合 glob base 恒为相对 `.source/` 的相对路径，本机 Vite 的 `toAbsoluteGlob` 相对分支在 Windows 上算出错误匹配路径（见 `probes/2610112023_docsite-kit-complete/review/20261012-0008-root-cause.md`）。本 probe 的 TSX/HTML 来源用根路径 glob（`/content/...`、不带 base）不受影响，增删改名 1 秒内生效；MDX 侧维持现状、交主会话决策，测试 `dev-server.test.ts` 里有该行为的回归探针。
