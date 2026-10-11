# fumadocs 16.17.1 八个探针：页面清单增删、评论 .tsx、feeds 写文件、库共用上下文、复制布局、插件登记依赖、生成正本经编译器、新旧输出逐字节比

## 问什么

文档站基础包与 docfirst 改造（`design/30-refactor-plan.html` 第 0 节 M1–M5、第 2 节、3.4 节）开工前的第 0 批实验，E-1 到 E-8 共用一个站点，各自回答：

- **E-5** 不加自写 Vite 插件时，dev 下增删内容文件，页面清单会不会自动更新
- **E-3** 评论文件夹里的 `.tsx` 组件能不能用；dev 运行时新增评论文件夹要不要重启；build + start 下能不能显示
- **E-7** 不进 git 的 `feeds/` 当集合读，dev 下文件一变，页面能不能不整页刷新就更新
- **E-4** 构建好的普通库与站点共用同一份 fumadocs 的 React 上下文，还要不要 `ssr.noExternal`
- **E-6** `customise` 复制布局进站点能不能直接用；全宽切换、侧栏停在最近看过的组，能不能在复制出的布局里做（不覆盖 `#nd-*`、`--fd-*`，不塞假页面项）
- **E-2** 站点的 remark 插件经 `_compiler.addDependency` 登记文件与目录，dev 下改文件 / 目录增删能不能触发重编
- **E-8** 命令行里用 Vite 加载站点、取一页 `_markdown`（`output: 'function'`）、`renderToMarkdown` 渲染；`asMarkdown`（含 `'use client'` 文件）与钉码的 `replaceSource` 同时生效吗；耗时多少
- **E-1** 同一份正本，新的生成正本与现在 `renderAi` 的输出逐字节比，差在哪

## 怎么运行

底子：fumadocs 官方示例 examples/react-router，tag `fumadocs@16.17.1`（浅克隆在 `_upstream/`，不进 git），复制到 `site/`，
依赖固定为 fumadocs-core 16.17.1、fumadocs-mdx 15.4.7、`fumadocs-ui: npm:@fumadocs/base-ui@16.17.1`（og 路由与 takumi-js 装得上，没删）。
`site/`、`lib/`、`tools/` 各自有 `pnpm-workspace.yaml` 截断向上查找（否则会被 docsite-kit 仓的 workspace 吸收）。

```text
cd site && pnpm install && pnpm dev      # dev 在 http://127.0.0.1:4446
pnpm build && PORT=4447 HOSTNAME=127.0.0.1 pnpm start   # start 在 http://127.0.0.1:4447
node ../scripts/stop-dev.mjs             # 停掉 4446/4447 上的进程
```

各实验：观察记录在 `runs/<编号>-<名字>.md`（日志同名 .log），产物在 `out/`；E-6 截图在 `out/e6/`，E-8/E-1 输出在 `out/e8/`、比对报告 `out/e1-compare-report.txt`；fumadocs-mdx 15.4.7 meta 集合 bug 的最小复现在 `repro-meta-collection/`（英文 issue 草稿 `ISSUE.md`，`pnpm dev` 后打开 http://127.0.0.1:5199/ 即 500）。
E-8 生成正本：`node scripts/render-outputs.mjs [页面path…]`（不传参渲染全部 docs 页）。E-1 复制正本：`node scripts/e1-copy-sources.mjs`，比对：`node scripts/e1-compare.mjs`。
E-6 的 customise 交互：`node scripts/e6-customise.mjs`（伪终端驱动，node-pty 装在 `tools/`）。

## 结论

**E-5（不成立，影响 K-04）** 新建 `content/docs/new.mdx`：侧栏与页面树不变、`/docs/new` 404，等 22 秒也不出现，dev 日志无重编译——**要重启才进清单**。改标题（文件已在清单里）：1 秒内生效，方式是**整页刷新**（`window` 标记丢失，日志 `page reload … Could not Fast Refresh`）。删除已有文件：侧栏 1 秒内清掉该页，但虚拟模块仍引用已删文件，SSR 报 `Failed to load url … only=frontmatter`，**整站 /docs 一起 500 不自愈**，浏览器弹 Vite 错误浮层；重启后恢复。fumadocs-mdx 15.4.7 自己处理不了增删，`docsite()` 里「文件增删后让模块失效」的逻辑要保留，且失效时机要在集合虚拟模块重新解析之前，否则出现删除后的 500（runs/02、03、04）。

**E-3（有条件成立，影响 K-05）** `comments` 集合（`type: 'doc'`，`async: true`，无 schema）里 `t1/index.mdx` import 同文件夹 `./diagram.tsx`（带 CSS 动画）：dev 下整页正常渲染、`.tsx` 组件进 SSR HTML，改 `.tsx` 整页刷新后 3 秒内生效；build + start 下 t1、t2 连同组件都正常。条件：**dev 运行时新增评论文件夹（新集合成员）要重启才显示**（与 E-5 同根）。另：无 schema 时条目把 frontmatter 字段摊平在 `entry` 顶层（`entry.author`），没有 `entry.data`（runs/06、07、08、09）。

**E-7（第一轮不成立；补做后成立——根因是写法，影响 K-08）** 第一轮把读 feeds 的代码放在 `app/lib/source.ts`（浏览器端也加载它）：写 `feeds/demo.json` 后同一秒 dev 日志记 `(client) page reload` + `(ssr) page reload`，浏览器里数据 277 ms 就更新，但计数器归零、`window` 标记丢失——整页刷新，未保存的交互状态会丢。**补做**：读 feeds 的代码挪进 `app/lib/feeds.server.ts`（`.server.ts` 不进客户端 bundle），只在 `docs.tsx` 的 loader 里 import，浏览器端代码不碰它，source.ts 里的 feeds 删掉——写文件后 **292 ms SSR 出新值，页面上数据更新、计数器保持 3、window 标记保留（不整页刷新）**，dev 日志客户端侧只有 `hmr update` 没有 page reload（SSR 程序重载对浏览器透明），两轮稳定复现。**K-08 按 server-only 写法实现即可**。另两个发现：① `defineCollections({ type: 'meta' })` 单独使用在 fumadocs-mdx 15.4.7 直接 500——宏展开成 `runtime.meta({ base, meta })`，运行时读 `args.entries`，`Object.entries(undefined)` 报错；`defineDocs` 内置的 meta 集合不受影响。最小复现与英文 issue 草稿在 `repro-meta-collection/`（打开即 500）。② 补做时发现上次提交态浏览器端 hydration 是死的（见 E-2 段的修正），顺带修复（runs/36–39）。

**E-4（有条件成立，影响 K-04）** 构建好的 ESM 库（tsc 产物，对 `fumadocs-ui/contexts/tree` 保持外部 import）要和站点共用同一份 fumadocs 的 React 上下文，**`ssr.noExternal` 点名这个库仍然必须**：不加时 dev 直接 500（`You must wrap this component under <DocsLayout />`，堆栈走 lib 的 peer 副本，Context 双实例）、build 在 prerender 就红；加了以后 dev、build + start、浏览器 hydration 全部正常（runs/14–18）。

**E-6（成立，影响 K-09）** `pnpm dlx @fumadocs/cli@1.7.5 customise`（伪终端跑，问了两个问题：选哪种布局——Docs/Notebook/Flux/Glass/Spacious/Home；是否用 pnpm 装六个新依赖）把布局写进 `app/layouts/`、`app/components/{docs-sidebar,ui}` 等，并自动改写 `docs.tsx` 的 import，改完直接可用。两件事都在复制出的文件里做到，没碰 `#nd-*`、`--fd-*`、没塞假页面项：全宽用 `DocsPage` 自带的 `full` prop（右侧目录自动不渲染）+ `page/slots/container.tsx` 的 full 分支改 `max-w-none` + 页面里一个按钮；侧栏停组改 `components/docs-sidebar/page-tree.tsx`：`useTreePath()` 为空（地址不在树里，如 `/comments`）时按缓存的根组名在整树里找回那个 root folder 渲染（根组 name 是 revive 出的 React 元素，文字在 `props.dangerouslySetInnerHTML.__html`，要抽出来比）。SSR 与客户端导航都验证，视觉验收三张截图全过。边界：侧栏顶部的**组下拉**不跟随（`useTabsGroups` 基于空 path 没有.active 组，下拉不显示）（runs/20、22–25，out/e6/）。

**E-2（部分成立，影响 D-05、D-08；E-7 补做时修正一处结论）** 站点 remark 插件经 `mdxOptions: applyMdxPreset({ remarkPlugins: [probeDep] })` 接进集合（`applyMdxPreset` 从 `fumadocs-mdx/config` 出口拿，插件排在默认工序后、remarkStructure 前）。`file.data._compiler.addDependency(文件绝对路径)`：**成立**——改 `pinned/a.ts` 1 秒内页面更新。登记目录：**不成立**——目录里增、删文件都不触发（10 秒无事件）。要目录增删生效需要 Vite 插件（`configureServer` 里 `watcher.add(dir)`，`add`/`unlink` 事件桥接成被钉文件的 change 事件走正常失效链），加了以后增删 1 秒内生效——D-08 选插件方案（runs/26、27、28）。**修正**：插件以静态 import 写进 `app/lib/source.ts`（浏览器端也加载它）会让客户端模块图带进 `node:fs`，**整站 hydration 死**（SSR 正常所以第一轮没发现；计数器点不动、点链接整页跳转，干净基线复现）；mdxOptions 改成异步函数内动态 import 又让 fumadocs-mdx 的宏求值报 `Vite module runner has been closed`。可行写法是**全局 `source.config.ts`**（只构建期在 Node 加载），插件顺序不变、编译输出逐字节不变——代价是 15.4.7 下不能按集合挑插件（runs/36–38）。

**E-8（成立，影响 D-02；补做改用公开接口后仍逐字节一致）** 全链路走通：集合开 `postprocess: { includeProcessedMarkdown: { output: 'function', headingIds: false } }`，`scripts/render-outputs.mjs` 用 `createServer({ middlewareMode: true, appType: 'custom' })` 加载站点、`docs.getPage(path)`。**补做后走公开接口** `page.getText('processed', { components: jsxComponents(组件表) })`（集合条目的顶层方法；它内部取 `_markdown` 组件并 renderToMarkdown，第一轮手写的 `mod._exports._markdown` 那套被它包好了）——**输出与第一轮逐字节一致**（单页与全部 31 页 git diff 均 0 行，连 E-1 的 6 份正本一起验证），耗时同量级：补做单页总 2721 ms、31 页总 4073 ms（Vite 启动 1–1.6 s 是主要成本，页面渲染每页 10–350 ms）。组件 A（普通）与 B（`'use client'` 文件）的 `asMarkdown()` 都给出机读文字——**'use client' 在 React Router 非 RSC 模式下不影响**；C（不调 asMarkdown）**原样保留 JSX**，可靠找法是扫描输出里残留的大写标签（`^[\t ]*<\/?([A-Z][\w$]*)`），实测精确点名 ComponentC——D-16 的检查可以这么做。钉码 `replaceSource` 登记的文字进了输出（用独特标记验证过走的是登记而不是组件兜底）：登记要在**原节点**上（无 position 的编辑被忽略），替换出的外层组件继承原 position，与 remarkLLMs 的 marker 同 range 时预登记先应用；外层组件（PinBlock 等）要注册进站点的 mdx-components 表，否则该页浏览器端渲染报 `Expected component … to be defined`。坑：`@/` 别名对 content/ 下 mdx 的 import 不生效（dev 与 middlewareMode 都 500），正本用相对路径（runs/30、40，out/e8/）。

**E-1（成立，影响 D-02、D-13）** 6 份正本（含 skills 三份与 agents.mdx）经新流水线的输出与现在的生成物（`renderAi` 产出）**正文逐字节一致**：12 处差异全是空行（旧生成物末尾多一个空行——renderToMarkdown 会 trim；三份 SKILL.md 的 frontmatter 后有一个空行——落点写入器加的），都属于落点写入格式，D-02 写落点时补齐即可零 diff。标题 id 无差异（`headingIds: false`）。**素材缺口**：这批正本里没有可被认的记号（示例记号都在行内或代码块里，改写 0 处）、没有真图片节点、没有 ` ```npm ` 块——钉码与组件的机读形式已由 E-8 单独验证，图片与 npm 块留给 D-02 实施时补验。正向证据：GFM 表格、十余处围栏代码块、行内 code 全部一致，fumadocs 默认工序对纯 markdown 的序列化与 renderAi 的「逐字节照抄」等价（runs/31，out/e1-compare-report.txt）。

## 运行那次的环境

2026-10-11，Windows 11，Node v24.14.1，pnpm 12.4.2，React Router 8.4.0，Vite 8.3.4；
fumadocs-core 16.17.1、@fumadocs/base-ui 16.17.1（以 `fumadocs-ui` 别名安装）、fumadocs-mdx 15.4.7（当时 npm 最新版）、
@fumadocs/cli 1.7.5；E-1 对照的 gwb-docfirst 生成物是 2026-10-11 的工作区状态。
