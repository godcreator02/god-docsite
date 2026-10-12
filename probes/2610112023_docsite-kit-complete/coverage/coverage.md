# docsite-kit 完整功能清单（任务 A 功能盘点）

日期：2026-10-11。本轮材料根：`probes/2610112023_docsite-kit-complete/`，本清单在其 `coverage/` 子目录。

## 这份清单是什么、怎么读

第 1 步（docsite-kit 完整功能验证站）的功能清单：把现有能力与计划新增/替换能力逐项展开。每项有稳定 id、现有用户行为、目标行为、去向、源文件定位、关联计划号（`design/30-refactor-plan.html` 的 K/P/D/C 编号）、可观察的通过条件、计划验收小段（1.1～1.6）、当前状态。

- **现状依据**是本地代码与自述站页面（`site/content/(kit)/`），不是计划文档。生产包现状：`@godcreator/docsite-kit` 0.1.9（peer 锁 fumadocs-core/base-ui 16.16.2），插件 `@godcreator/gwb-docsite` 0.1.3。
- **目标依据**是 `design/30-refactor-plan.html`。目标验证环境沿用已复核版本：core/base-ui 16.17.1、fumadocs-mdx 15.4.7、Vite 8.3.4、React Router 8.4.0（K-13；与生产包 16.16.2 明确区分，不把生产包当作已适配目标版本）。
- **去向口径**：保留＝行为不变（实现可搬家）；替换＝行为保持或升级、实现重做；新增＝现在没有；弃用→替代＝删除旧机制并写明能力由什么承接；后续＝不在第一步范围（第 2/4/5 步）。
- **状态口径**：`未开始`＝验证站尚未实现或验证；`已具局部证据`＝探针或独立复核已验证目标做法的某个环节（证据路径列出），但验证站未交付；`后续步骤`＝不在第一步范围。**本轮没有实跑功能验收，任何条目都不标通过；B 会话（基础验证站）的自述在主会话最终验收前不算证据。** 现有功能在生产自述站与插件中长期运行，但那不等于验证站验收，清单里只作为现状描述。
- 已读的独立复核：`probes/2610111940_api-audit-hmr/README.md`（E-2/E-5/E-7 复跑）、`probes/2610111941_api-audit-markdown/README.md`（E-8/D-02 公开接口）、`design/research-2026-10-11-api-surface-audit.md`（47 条逐项接口分级）、`trajectory/2026-10-11-fumadocs-16-probe-batch.mdx`（E-3/E-4/E-6/E-7 原始批次）。可只读这些报告，未重跑实验。

源文件定位相对仓根 `docsite-kit/`。结构化数据见同目录 `coverage.json`。

---

## 组 1：页面与资源（段 1.1/1.2）

### PG-multi-source（保留｜K-03、K-11｜段 1.2）
- 现有：MDX、TSX、HTML 三种页面经 `loader({ source: { mdx, tsx, html } })` 进同一棵页面树、同一个侧栏与搜索；TSX/HTML 文件清单由骨架的 `import.meta.glob` 列出（`packages/docsite-kit/template/skeleton/app/lib/source.ts:9-17`）。
- 目标：同一行为；集合与入口接线改成 Config API 生成的 server/browser 入口（服务端由 server 入口取集合并调 loader，浏览器由 browser 入口加载正文），不把两边强行并成一个 source.ts。
- 通过条件：验证站里三种页面同时存在，侧栏/搜索/路由都能取到三者；服务端与浏览器入口各自只含该侧需要的代码。
- 状态：未开始。1.1 只做 A/B 集合基础接线（见 PG-config-api、TL-compile-plugins）；三类页面 + 侧栏/搜索的完整条件属 1.2。

### PG-config-api（新增｜K-03｜段 1.1）
- 现有：没有 Config API 命名集合样板；集合在 `collections.ts` 用 `defineDocs/defineCollections` 宏定义，remark 插件只能走 `source.config.ts` 全局配置（`template/skeleton/source.config.ts:12-17`）。
- 目标：`source.config.ts` 用 Config API（`fumadocs-mdx/config` 的 `defineDocs` + `applyMdxPreset`）定义命名集合，A/B 两集合按需接不同 Node 插件；生成的 `.source/server` 只进 loader，`.source/browser` 用 `createClientLoader/useContent` 进浏览器。
- 通过条件：浏览器交互证据——A 集合正文含 Node 插件产物、B 集合不含；浏览器端无 node-only 模块；hydration 正常（按钮可点）。1.1 交付接线样板。
- 状态：**已具局部证据**：`probes/2610111940_api-audit-hmr/README.md` E-2 `config` 变体（serverA/browserA 带 A 专属 marker、serverB/browserB 不带，hydration 0→1，04-config.log）。

### PG-mdx-page（保留｜K-03｜段 1.2）
- 现有：`content/` 下 `名字.mdx` 或 `名字/index.mdx` 是页面，标题来自 frontmatter `title`，搜索收全文，改文件由 fumadocs-mdx 自己刷新（`site/content/(kit)/page-types/index.mdx`；`template/skeleton/app/lib/collections.ts:9`）。
- 目标：行为不变，集合定义换到 Config API。
- 通过条件：MDX 页面正常渲染；改标题后浏览器立即更新；搜索能命中正文词。
- 状态：未开始。

### PG-tsx-page（保留，适配器迁公开类型｜K-11｜段 1.2）
- 现有：`名字.page.tsx` 导出 `meta = { title, description? }` 与默认组件；没导出 meta 或 title 为空时开发服务直接报错（`src/page-sources.ts:28-35`）；搜索只收标题与 description（`src/page-sources.ts:41-48`）；本页目录在浏览器渲染出正文后找 `<h2>/<h3>`，组件后来画出内容时重找（`src/ui/page-bodies.tsx:40-57`）。
- 目标：行为不变；来源适配器从已弃用的 `Source` 类型迁到公开 `StaticSource`（接口审计判定 `Source`/`multiple()` 为 D 类已弃用公开，`src/page-sources.ts:16` 现用 `Source`）。
- 通过条件：TSX 页面交互组件可运行；缺 meta/title 时启动报错并指明文件；搜索只收标题与描述；目录随内容更新。
- 状态：未开始。

### PG-html-page（保留，适配器迁公开类型｜K-11｜段 1.2）
- 现有：`名字.html` 整个文件放进 iframe，由 `/api/content/` 原样送出（`template/skeleton/app/routes/page.tsx:78-85`、`src/server/index.ts:39-52`）；标题取 `<title>`，没有时报错（`src/page-sources.ts:75-83`）；iframe 高度跟内容走；标题定位点对准 iframe 内 `<h2>/<h3>`（`src/ui/page-bodies.tsx:59-107`）；iframe 跟站点主题（`color-scheme` 继承）；搜索收正文纯文字（`src/page-sources.ts:50-69`）。
- 目标：行为不变；适配器迁 `StaticSource`。
- 通过条件：相对路径图片/样式可用、无第二条滚动条、目录点击跳到对应标题、深浅色跟随、搜正文文字能命中。
- 状态：未开始。

### PG-reserved-slugs（保留｜—｜段 1.2）
- 现有：页面占用站点路由第一段地址（`api`、`comments` 及功能包路由首段）时启动报错，一次列出全部冲突文件（`src/page-sources.ts:90-97`；骨架 `app/lib/source.ts:21`）。
- 目标：行为不变（保留地址清单随功能包机制删除而调整为站点自写）。
- 通过条件：造一个 `api.mdx` 能看到报错列出该文件；正常页面不受影响。
- 状态：未开始。

### PG-content-files（保留｜—｜段 1.2）
- 现有：页面引用的组件放同名文件夹不进侧栏（写作约定，`site/content/(kit)/page-types/index.mdx`）；`content/` 里的文件原样经 `/api/content/*` 送出、扩展名白名单、只送 content 目录内（`src/server/index.ts:39-52`；`src/page-sources.ts:99-106`）；页面引用的文件晚于页面建出时要再保存一次页面（dev-plugin.mdx 记录的现况）。
- 目标：行为不变，dev 与 build/start 分别验。
- 通过条件：页面引用图片/SVG/HTML 资源在 dev 与 build/start 都能取到；越界路径被拒绝。
- 状态：未开始。

### PG-list-refresh（替换｜K-04｜段 1.2）
- 现有：`content/`、`comments/` 增删、改名（一删一增）与改 TSX 页面时，插件让 `collections.ts`、`source.ts` 在浏览器与服务端都失效再整页刷新（`src/vite/index.ts:59-123`）；访问 Vite Environment/ModuleRunner 内部接口（接口审计 E 类：RC/experimental，成熟度不能由导出证明）。已知缺口：新建评论文件夹要重启（E-3）。
- 目标：内容、评论三种页面及评论文件增删、改名后清单和浏览器更新；实现按第 1 步验收结果重做，公开 `server.restart()` 路线是候选；**只恢复 SSR 清单、浏览器仍旧清单不算完成**（K-04 原文）。
- 通过条件：新增页面进侧栏/搜索且能打开；删除后不 500；改名后新旧地址正确；浏览器自动更新（不手动刷新）；自动刷新是否丢状态有记录。
- 状态：**已具局部证据**：`probes/2610111940_api-audit-hmr/README.md` E-5——原失败已复现；公开 `restart` 变体恢复服务端清单（新增 MDX 200、评论出现、删除后消失），但浏览器删除后旧侧栏项仍留（05-public-restart.log），浏览器闭环未解决。

---

## 组 2：正文与写作组件（段 1.1/1.2）

### WR-default-components（保留｜—｜段 1.2）
- 现有：MDX 不用 import 直接写 fumadocs 组件：`Callout`、`Card/Cards`、`Tabs/Tab`、`Steps/Step`、`Accordions/Accordion`、`Files/Folder/File`、`TypeTable`、`Banner`、`InlineTOC`，图片换成 `ImageZoom`（`template/skeleton/app/lib/mdx-components.ts:14`；示例 `site/content/writing/components.mdx`）。
- 目标：行为不变；组件表由站点维护（模板生成一次后归站点）。
- 通过条件：验证站一页用齐这些组件，浏览器渲染与交互正常（标签页切换、折叠开合、图片放大）。
- 状态：未开始。

### WR-math-mdx（保留｜—｜段 1.2）
- 现有：MDX 写 `$…$`、`$$…$$`，全局 `source.config.ts` 配 `remark-math` + `rehype-katex`（排在代码高亮前），写错的公式页面标红显示原式（`template/skeleton/source.config.ts:13-16`）；提交前检查用同样插件编译并拒绝（`src/server/mdx-problems.ts:32-43`）。
- 目标：行为不变；全局配置只留共同插件，按集合差异走 Config API。
- 通过条件：行内与块级公式渲染正确；写错公式页面标红且提交前检查报出第几行。
- 状态：未开始。

### WR-math-tsx（保留｜—｜段 1.2）
- 现有：TSX 页面里 `<Tex>{String.raw`\frac{a}{b}`}</Tex>`，写错直接报错（`src/ui/tex.tsx:7-10`；示例 `site/content/(kit)/page-types/tsx-page.page.tsx`）。
- 目标：行为不变。
- 通过条件：TSX 页面公式渲染正确；错误公式报错可见。
- 状态：未开始。

### WR-term（新增｜K-10（旧实现在 D-14，第 4 步删）｜段 1.2）
- 现有：基础包无术语能力；docfirst 仓有 remark 术语插件与 `Term` 组件（`gwb-docfirst/`，本轮只读其 AGENTS 未读实现细节）。
- 目标：术语的 remark 插件与 `Term` 组件移进基础包，术语表作为插件选项由站点传；`Term` 是插件生成节点，Markdown 形式自动是原文那个词，不用登记（M4 推论，有 `probes/2610111941_api-audit-markdown/README.md` 第 5 条源码级佐证）。
- 通过条件：正文出现术语表里的词时渲染成 Term（带释义浮层一类可见效果）；正文的纯文字/机读输出仍是原词；A/B 集合可只有一方启用术语。
- 状态：未开始（术语 Markdown 形式的机制有独立复核佐证，组件迁移无实验）。

### WR-per-collection-plugins（新增，替换全局聚合路线｜K-03、K-01｜段 1.1+1.2）
- 现有：编译期 remark 插件只能经 `source.config.ts` 全局配置：功能包 `./content` 出口的插件接在默认后面，`content/` 与 `comments/` 的 MDX 都经过（`template/skeleton/source.config.ts:12-17`；`src/feature.ts:15-18`）。此路线的成因（宏模块浏览器共享、动态 import 报 module runner closed）记录在 `site/content/(kit)/features.mdx` 与轨迹卡。
- 目标：Config API 按集合配置 `mdxOptions`（`applyMdxPreset`），浏览器端不导入 Node-only 模块；原「15.4.7 不能按集合挑插件」的概括已被复核撤回。
- 通过条件分两段：**1.1**（A/B 两集合分别接/不接 Node 插件，浏览器端无 node-only 模块、hydration 正常）；**1.2**（全局配置仍承载共同插件（公式），评论集合与正文集合用不同插件，用公式、评论正文这类实际内容验插件组合）。
- 状态：**已具局部证据（1.1 部分）**：E-2 `config` 变体（见 PG-config-api）；`design/research-2026-10-11-api-surface-audit.md` §同轮实验回报第 1 条。1.2 的真实内容组合未验证。

---

## 组 3：布局、导航与搜索（段 1.2）

### LN-groups（保留｜—｜段 1.2）
- 现有：`meta.json` 写 `"root": true` 的文件夹是侧栏切换下拉框的一项，切换后侧栏只列那一组（`site/content/(kit)/index.mdx` 侧栏节）。
- 目标：行为不变；复制布局后组标识要用稳定组标识或 URL（见 LN-group-keeping）。
- 通过条件：两个 root 组切换正常；侧栏列表与下拉一致。
- 状态：未开始。

### LN-group-keeping（替换｜K-09｜段 1.2）
- 现有：全部评论页这类不在页面树里的页面上，侧栏停在最近看过的组：实现是往页面树塞一个隐藏页面项并改树 `$id`（`src/sidebar-tree.ts:38-45`、`src/ui/sidebar.tsx:9-31`，styles.css 藏起该页项）。面包屑/上下页仍按真实页面树。
- 目标：布局复制进站点后由站点实现停组，用自有稳定组标识或 URL，不解析 ReactNode 内部结构（接口审计：旧 E-6 实验读 `dangerouslySetInnerHTML.__html` 属实现耦合，须改写）。
- 通过条件：站点自己的页面（全部评论页）上侧栏与切换下拉不变；刷新后从第一组开始；面包屑/上下页照旧没有。
- 状态：未开始。

### LN-copied-layout（新增｜K-09｜段 1.2）
- 现有：骨架直接用 fumadocs `DocsLayout`，只换 `slots.sidebar`、`slots.searchTrigger`、`slots.themeSwitch`（`template/skeleton/app/routes/layout.tsx:32-39`）；宽屏布局靠 `styles.css` 覆盖（改铺满）。
- 目标：用 fumadocs CLI `customise` 复制布局源码进站点（`app/components/layout/`），宽屏用 `DocsPage` 的 `full` 等公开部件；CLI 版本与复制源码分别固定；不再覆盖 `#nd-*`/`--fd-*`、不再塞假页面。
- 通过条件：复制出的布局完整交互可用（侧栏、搜索、主题、移动端抽屉）；宽屏铺满；侧栏顶部组下拉的已知边界（不跟随显示）有记录。
- 状态：**已具局部证据**：E-6（`trajectory/2026-10-11-fumadocs-16-probe-batch.mdx`：customise@1.7.5 直接可用、宽屏与停组在复制布局里可做、三张截图 `probes/2610111754_fumadocs-16-17-1/out/e6/`）。

### LN-wide-toggle（保留，随复制布局搬家｜K-09｜段 1.2）
- 现有：每页标题右「全宽」按钮，开关记在浏览器、全站生效；`root.tsx` `<head>` 里 `widePageScript` 预打标记避免先窄后宽（`src/ui/wide-page.tsx:13-51`）。
- 目标：行为不变，实现并进站点自己维护的复制布局。
- 通过条件：开关后正文不限宽、目录列让位；刷新与跨页保持；打开页面无宽度跳动。
- 状态：未开始。

### LN-route-links（保留｜—｜段 1.2）
- 现有：侧栏下拉框下面一横排：最左只有图标的搜索按钮（Ctrl K 可用、悬停提示），后面各入口图标加短名字、当前地址在其下时高亮，等宽、竖线分隔；`slots.searchTrigger` 用 `routeLinksSearchTrigger` 去掉整行搜索框（`src/ui/sidebar.tsx:34-64`；`template/skeleton/app/routes/layout.tsx:23-24`）。
- 目标：行为不变（入口清单随功能包机制删除由站点自写）。
- 通过条件：搜索按钮打开搜索对话框；入口高亮规则正确；窄屏顶栏搜索按钮照旧。
- 状态：未开始。

### LN-identity-switch（保留｜—｜段 1.2/1.4）
- 现有：侧栏底部一栏左边本机身份（头像+名字），只读时写「只读」、悬停看原因，右边主题切换（`src/ui/comments.tsx:825-840`；装配 `layout.tsx:30,34`）。
- 目标：行为不变。
- 通过条件：带身份的开发服务显示人名；无身份时显示「只读」+原因。
- 状态：未开始。

### LN-translations（保留｜—｜段 1.2）
- 现有：`zhTranslations` 传给 `RootProvider` 的 i18n，覆盖搜索、目录、上下页、主题、复制等界面文字（`src/ui/translations.ts:7-42`；`template/skeleton/app/root.tsx`）。
- 目标：行为不变。
- 通过条件：主要界面文字为中文（搜索框、目录标题、上下页、404）。
- 状态：未开始。

### LN-search（保留｜—｜段 1.2）
- 现有：`siteSearchServer` 在 fumadocs 搜索接口上关掉 tolerance/threshold 两项默认（每个词原样出现），三种页面一起搜；TSX 收标题+description、HTML 收正文纯文字、MDX 收全文；代码块文字不进搜索（`src/server/search.ts:10-12`；`template/skeleton/app/routes/search.ts`）。
- 目标：行为不变；来源与索引更新一起验（增删页面后搜索跟着变）。
- 通过条件：中文搜索「滑块」不命中「模块」；「页面树」不只凭「页面」命中；三种页面各自约定内容可搜到；新增/删除页面后搜索结果更新（与 PG-list-refresh 同站验证）。
- 状态：未开始。

### LN-link-chips（保留｜—｜段 1.2）
- 现有：正文与评论里的链接显示成带图标小卡片：站内页面（显示标题）、评论（显示批注摘要与解决状态）、侧栏入口、`/api/content/` 文件（显示文件名）；找不到的页面标红；站外链接带箭头开新标签；没写链接文字时显示目标现在的名字（`src/ui/site-links.tsx:61-144`；数据 `commentLinkTargetsOf`、`SiteLinksProvider`；目标解析 `src/site-link-targets.ts:20-30`）。
- 目标：行为不变；链接种类的扩展点从功能包 `linkKinds` 聚合改为站点直接传（见 TL-custom-components）。
- 通过条件：四类站内目标与失效链接各有正确卡片；从全部评论页带 `?comment=` 跳到那一页并打开那串（配合 CM-all-comments）。
- 状态：未开始。

### LN-breadcrumb-pager（保留｜—｜段 1.2）
- 现有：正文上方面包屑与页尾上一页/下一页按真实页面树（fumadocs 默认），站点自己的页面上没有（`site/content/(kit)/index.mdx` 侧栏节末段）。
- 目标：行为不变。
- 通过条件：内容页有面包屑与上下页；全部评论页没有。
- 状态：未开始。

### LN-panel-layout（替换｜K-06、K-09｜段 1.3）
- 现有：评论右侧栏宽屏时盖在本页目录列上（同宽同位），打开时目录改成正文上方下拉条、正文位置宽度不变；窄屏盖在页面上（`src/ui/comments.tsx:740-742`；布局配合 `styles.css` 与 `<html>` 属性 `data-comments-sidebar-open`）。
- 目标：随覆盖层与复制布局重排后保持同样可观察行为（目录与宽窄屏协同是 1.3 验收的一部分）。
- 通过条件：宽屏开右侧栏正文不挪、目录变下拉条；窄屏盖住正文；与全宽开关叠加正确。
- 状态：未开始。

---

## 组 4：评论数据与交互（段 1.3）

### CM-thread-format（保留｜K-05｜段 1.3）
- 现有：一个评论串一个文件夹：`index.mdx`（发起，frontmatter 写 author/createdAt/page/status/quote|element/range/openers/resolvedBy/resolvedAt）+ 其余 `.mdx` 回复 + `snapshot.txt`（发起那一刻整页文字）+ 图片/组件文件。校验：字段全集、quote/element 互斥、range/openers 配对、页面存在、作者在人员列表、快照与 range/quote 一致；一律 `.mdx`；错误一次列出全部（`src/comments.ts:111-172,202-279`；`src/server/comments.ts:366-386`）。
- 目标：行为不变；评论仍是集合，评论文件夹里的 `.tsx`、图片照旧能用；评论集合不写 schema 时 frontmatter 字段直接在条目上（K-05 记录的口径）。
- 通过条件：合法评论读写正常；每类写错（缺字段、互斥、超快照、.md、放错层、页面不存在、作者不在）都有明确报错。
- 状态：未开始。

### CM-display（保留行为、替换实现｜K-06｜段 1.3）
- 现有：未解决评论串被批文字标黄（CSS Custom Highlight API）、行内按钮跟文字排版；被批图片/公式/代码块/表格/组件画框、角标按钮在右上角；同元素多串共用按钮（数字为总数）、卡片依次列出；长串先收起「展开 N 条回复」、卡片内滚动；点别处关卡片、同时只开一张（`src/ui/comments.tsx:36,154-158,186-207,280-650`）。
- 目标：外观与交互行为保持；按钮与框的实现换覆盖层（见 CM-anchor-overlay）。
- 通过条件：文字类标黄+按钮、块级画框+角标、多串共按钮、长串收起、单开卡片全部照旧。
- 状态：未开始。

### CM-anchor-overlay（替换｜K-06｜段 1.3）
- 现有：行内评论数按钮用 `splitText` 切开文字节点插进原文末尾、撤掉时拼回；被批元素加 `data-commented-element` 属性由 CSS 画框（`src/ui/comments.tsx:32,92-123,287,298`）。
- 目标：评论数按钮、被批元素的框都画在正文上方的覆盖层里，按 `Range.getBoundingClientRect()` 定位；删掉节点切开与 DOM 属性；高亮照旧用 CSS Custom Highlight API。
- 通过条件：浏览器里按钮跟随文字换行/滚动、框贴合元素尺寸（窗口缩放、字号变化后仍对）；DOM 里不再出现切开的文字节点与 `data-commented-element`；取页面文字的结果不含按钮文字。
- 状态：未开始。

### CM-lifecycle（保留｜—｜段 1.3）
- 现有：六种操作经同一接口 `POST /api/comments`：create（批文字/元素/整页/无页面）、reply、edit（仅作者）、delete（仅作者；删发起=删整串）、resolve/reopen（任何人）；写前按 MDX 编译一遍、编译不过拒绝并回行列；图片粘贴存进评论串文件夹；接口只改 `comments/` 不碰 git（`src/server/comments.ts:43,60-102,286-359`；UI `src/ui/comment-cards.tsx:9-16,286-355,371-434`）。
- 目标：行为不变。
- 通过条件：六种操作在浏览器里各做一遍成功；编辑/删除别人的评论被 403 拒绝并显示原话；MDX 编译不过的正文被拒。
- 状态：未开始。

### CM-all-comments（保留｜—｜段 1.3）
- 现有：`/comments` 全部评论页：按最近活动排，筛选未解决/已解决/全部、按页面（含「不挂在页面上的」）、「和我有关」（我发起/回复过/@了我）；挂页面的点击带 `?comment=<id>` 去那一页；无页面评论在本页发起、展开、回复（`src/ui/all-comments.tsx:26-120`；骨架 `app/routes/all-comments.tsx`）。
- 目标：行为不变。
- 通过条件：各筛选正确；从该页跳转后目标页找好位置打开那串（收起内容先点开，配合 CM-collapsed）。
- 状态：未开始。

### CM-mentions（保留｜—｜段 1.3）
- 现有：正文写 `@<id>`（人员列表里的 id）算提及；写评论打 `@` 弹人员名单（按 id/名字筛、id 前缀排前、上下键+Enter/Tab、Esc 只关名单）；「和我有关」含被 @（`src/people.ts:88-108`；`src/ui/comment-cards.tsx:127-152,159-273`）。
- 目标：行为不变。
- 通过条件：打 @ 出名单并正确填入；被 @ 的人的「和我有关」出现该串。
- 状态：未开始。

### CM-mdx-body（保留｜—｜段 1.3）
- 现有：评论正文是 MDX：纯文字、Markdown、组件（fumadocs 默认或评论里现 export 的组件）都行；编译不过存不进去（报行列）；编译过但运行时出错只在该评论位置写出错原话、整页与别的评论照常；粘贴图片插入引用并随正文发送（`src/server/comments.ts:70-81`；`src/ui/comment-cards.tsx:116-125,190-198`）。
- 目标：行为不变。
- 通过条件：写组件的评论正常渲染；运行时错误隔离；粘贴图片成功且引用有效。
- 状态：未开始。

### CM-page-text（保留｜K-12｜段 1.3）
- 现有：页面文字从带 `data-comment-scope` 的正文容器按序拼接：图片/SVG/画布/视频/iframe/KaTeX 公式整个记一个 `U+FFFC`；`sr-only` 读屏文字不算；评论自己放的东西（`data-comment-ui`）不算；浏览器（DOM）与服务端（parse5 解析 HTML）共用同一份规则（`src/page-text-rules.ts`；`src/ui/comment-anchors.ts:28-50`；`src/server/page-text.ts:49-55`）。
- 目标：行为不变；DOM 类名依赖（`.sr-only`、`.katex`）列为受控例外并在升级 fumadocs 时跑回归（K-12）。
- 通过条件：换界面语言快照不变；公式记一个字；回归页（CM-collapsed）通过。
- 状态：未开始。

### CM-snapshot-diff（保留｜K-12｜段 1.3）
- 现有：打开页面时拿现在的页面文字与快照逐字对比（diff-match-patch，1 秒超时），把 range 推算到现在的位置：前后插删段落准确落位；段内改几个字但首尾还在照样挂上并标「原文改过」（卡片与右侧栏写当时原文）；首尾被改/整段重写/挪走则找不到，右侧栏标红「原文找不到了」不去猜；重复文字删其一定位失败有说明（`src/comment-ranges.ts:22-74`；`src/ui/comment-anchors.ts:283-293`；文档 `site/content/(kit)/commenting.mdx` 怎么找到批的是哪里）。
- 目标：行为不变。
- 通过条件：三类情形（准确落位/改过标注/找不到）各有样本可复现。
- 状态：未开始。

### CM-collapsed（保留｜K-12｜段 1.3）
- 现有：被批内容收在标签页/折叠块/文件夹里时：发起时记 `openers`（各层打开按钮在快照中的位置，按 ARIA 认：tab、aria-expanded、summary、aria-labelledby/controls）；打开时由外到里找第一个收着的按钮，右侧栏写「在收起的「npm」里」，点它替你点开、逐层直到找到（5 秒超时提示）；按钮文字改过按「最长相同段过半」认；内容在页面上但看不见（hidden until-found）用 checkVisibility 判；没按 ARIA 写的组件认不出（提示原文找不到了）（`src/ui/comment-anchors.ts:155-281`；`src/ui/comments.tsx:509-535`）。回归页 `site/content/writing/collapse-test.mdx`（标签页/折叠/文件树/ARIA 自定义/无 ARIA 五类样本）。
- 目标：行为不变；该页是 fumadocs 升级必跑回归（K-12）。
- 通过条件：回归页五类样本各自表现符合文档（能点开两层、无 ARIA 报找不到）；图/公式/代码/重复文字的定位回归一起过。
- 状态：未开始（现状由生产长期使用背书，本轮未复验）。

### CM-per-page（替换｜K-05｜段 1.3）
- 现有：骨架 `comment-threads.tsx` 在模块顶层把全站评论分组、每页 loader 都带上全站评论串集合引用；正文渲染用 `use(entry.load())` 按需取（`template/skeleton/app/lib/comment-threads.tsx`；`app/routes/page.tsx:20,48`；`app/lib/commenter.server.ts`）。
- 目标：loader 只把**本页**评论串的 frontmatter 传给页面，不在模块顶层给全站评论分组；正文按需 `load()`；`snapshot.txt` 照旧由 loader 读。
- 通过条件：网络/loader 数据里只有本页评论元数据；另一页的评论更新不触发本页重载；评论显示行为不变。
- 状态：未开始。

### CM-agent-anchor（保留｜—｜段 1.3）
- 现有：agent 调接口给 `{ quote, occurrence }`（不给浏览器快照）：服务端向开发服务自己请求那一页 HTML，`pageTextOfHtml` 算页面文字当快照，找第 occurrence 处 quote；找不到回原话（「没有第 2 处…一共有 1 处」）；SSR 与浏览器渲染差异由打开时的差异推算吸收（`src/server/comments.ts:113-136,148-172`；`src/server/page-text.ts:49`）。
- 目标：行为不变。
- 通过条件：agent 按接口发起评论落在正确位置；occurrence 越界报原话；TSX 页（浏览器才着色）跨差异定位符合「没跨就准、跨了标改过」。
- 状态：未开始。

### CM-refresh-reopen（保留｜—｜段 1.3）
- 现有：发评论/改状态后开发服务看到 `comments/` 文件变整页刷新：滚动位置不变、刚才那串自动重新打开（sessionStorage 记 15 秒）；正在写的草稿点到别处不丢，要点取消才关（`src/ui/comment-cards.tsx:28-48`；`src/ui/comments.tsx:254-258`；文档 commenting.mdx「怎么写」）。
- 目标：行为不变；1.3 验收要求「正文变化和新增评论不会丢失当前草稿」。
- 通过条件：发评论后页面刷新、原串重开；刷新前正在输入的草稿内容不丢。
- 状态：未开始。

### CM-tsx-comments（保留｜K-05（E-3）｜段 1.3）
- 现有：评论文件夹里的 `.tsx`、图片照旧是集合内容：评论 import 同文件夹组件，dev 与 build+start 都能渲染（生产包行为；骨架 `comment-threads.tsx` 的 `renderCommentBody`）。
- 目标：行为不变（K-05 明确保留）。
- 通过条件：dev 下新建带 `.tsx` 的评论渲染正常（新建文件夹进清单的问题归 PG-list-refresh，单独记录）。
- 状态：**已具局部证据**：E-3（轨迹卡：dev 与 build+start 都正常；新建文件夹要重启与 E-5 同根）。

---

## 组 5：身份与写入边界（段 1.4）

### ID-people（保留｜—｜段 1.4）
- 现有：站点目录 `people.json` 列人员：`id`（署名用）、`name`、`codes`（身份码数组，一码一人）、`gitea?`、`agent: true`（无码）；格式校验一次列出全部问题；每次请求重新读、改了不用重启（`src/people.ts:12-53`；`src/server/site-people.ts:16-19`）。
- 目标：行为不变。
- 通过条件：合法列表通过；每类写错（码重复、agent 带码、未知字段）报错；改文件后不重启生效。
- 状态：未开始。

### ID-identity（保留｜—｜段 1.4）
- 现有：每个 gwb home 的设置 `identity-code`（插件首次加载生成 12 位）；gwb-docsite 启动开发服务时放进环境变量 `DOCSITE_IDENTITY_CODE`；站点按码在 people.json 认人；没码/码不在列表时只读并写原因（`plugins/docsite/src/index.ts:38-44,71-79`；`src/server/comments.ts:32-40`；`src/people.ts:58-63`）。
- 目标：认人机制不变；「只读」的判定不再看运行模式（见 ID-no-dev-flag）。
- 通过条件：带码启动显示人名可写；无码只读且原因正确。
- 状态：未开始。

### ID-join（保留｜—｜段 1.4）
- 现有：`docsite.people.join { dir, id, name, gitea? }` 把本 home 的码加进 people.json：已有 id 加进 codes（gitea 核对或补上）、没有就新加一项；码在别人名下/id 是 agent/gitea 不符时拒绝；写回保持一项一行（`plugins/docsite/src/people-file.ts:24-48`；`src/people.ts:76-86`；命令 `plugins/docsite/src/commands.ts:174-187`）。
- 目标：行为不变。
- 通过条件：新人加入、老人换码两途成功；三类拒绝各有原话。
- 状态：未开始。

### ID-agent-as（保留｜—｜段 1.4）
- 现有：agent 经接口写评论带 `as`（people.json 里 `agent: true` 的 id）；`as` 写人的 id 拒绝（人的身份只按本机身份码认）；不带 as 署本 home 的人（`src/server/comments.ts:246-256`；命令侧 `plugins/docsite/src/comments.ts:35-63`）。
- 目标：行为不变；网页和命令共用这套规则。
- 通过条件：as=agent 成功署名；as=人被 403；网页路径与命令路径行为一致。
- 状态：未开始。

### ID-origin（新增｜K-07｜段 1.4）
- 现有：写接口（`POST /api/comments`）不核对请求来源 `Origin`——本机浏览器里打开的别的网页可向本机端口提交表单（机制 M3 推论里的缺口，代码现状 `src/server/comments.ts:347-359` 无检查）。
- 目标：写接口核对 `Origin` 等于站点自己，不等就 403。
- 通过条件：正常网页写入成功；伪造 Origin 的请求（跨站表单模拟）被 403 拒绝；读接口不受影响。
- 状态：未开始。

### ID-no-dev-flag（替换｜K-07｜段 1.4）
- 现有：`siteIdentity` 里 `if (!import.meta.env.DEV) return 只读`——只读与否由编译模式决定（`src/server/comments.ts:33`）。
- 目标：删掉 `import.meta.env.DEV` 判断，按身份（有没有可写的人）决定是否可写；代码不判断运行模式（M2/M3）。
- 通过条件：不给身份码的 build/start 站点接口拒写（403 只读）；给身份的 dev 站可写；界面隐藏（无输入框）与接口拒写分别验。
- 状态：未开始。

### ID-localhost（替换｜P-02｜段 1.4）
- 现有：dev 脚本在模板里写死 `--host 127.0.0.1`（`plugins/docsite/src/site-init.ts:45`），监听本机是脚本行为，不随身份决定；启动时给身份码（`plugins/docsite/src/dev-server.ts:119-126`）。
- 目标：本机编辑的站点用 dev，启动时给身份码；**给了身份码就只监听 127.0.0.1**，地址不是本机就报错、不启动（M3）。
- 通过条件：带身份启动的进程只绑 127.0.0.1（外机不可达）；配置成非本机地址时报错不启动。
- 状态：未开始。

### ID-published-readonly（替换｜P-03、K-07｜段 1.4）
- 现有：发布站只读由 `import.meta.env.DEV` 判断实现（见 ID-no-dev-flag）；gwb-docsite 只托管 dev，无 build/start 托管（`plugins/docsite/src/gwb-plugin` 文档「不做的事」）。
- 目标：发布给别人看的站用 build + start，启动时不给身份码，进程不知道把写入记在谁名下就不写——只读是机制结果不是代码判断；界面与接口一致（无输入框 + 接口拒写）。
- 通过条件：build/start 站点能看评论、无写入口、接口 403；与 dev 可写站对照。
- 状态：未开始。

### ID-shared-rules（保留｜—｜段 1.4）
- 现有：网页与命令（`docsite.comment.*`）共用同一个评论接口与全部规则（MDX 编译校验、作者校验、anchor 校验、as 规则）（`plugins/docsite/src/comments.ts:40-63`；`src/server/comments.ts`）。
- 目标：行为不变。
- 通过条件：同一操作（如编辑别人评论）在网页与命令两路径得到同样的拒绝原话。
- 状态：未开始。

---

## 组 6：数据推送 feeds（段 1.5）

### FD-old-channel（弃用→替代｜K-08、P-04｜段 1.5）
- 现有：gwb 插件推送走开发服务内存通道：启动时环境变量 `DOCSITE_FEED_TOKEN` 给随机口令；`POST /__docsite/feed/<频道>`（头 `x-docsite-token`，频道名限 `[\w-]`）存最新一份并经 Vite WebSocket 发事件 `docsite:feed`；`GET` 回最新（没推过 null）；浏览器 `useSiteFeed(频道)`、服务端 `siteFeedOf(频道)`；gwb 侧每频道记最新、站点重启补推（`src/site-feed.ts:7-29`；`src/vite/index.ts:141-174`；`src/ui/site-feed.ts:9-33`；`src/server/index.ts:11-13`；`plugins/docsite/src/site-host.ts:189-210`）。
- 目标：改为写 `feeds/<频道>.json` 文件（协议类型由基础包导出）；服务端模块 `import.meta.glob` 读、只经 loader 给页面。**文件协议与插件写入一起验收后**，第 2、3 步收敛时再删旧中间件、自定义 HMR 事件与 `useSiteFeed`，不提前中断现有使用方（K-08）。
- 通过条件：新链路全通（见 FD-feeds-files/FD-ops）；旧链路删除时机与替代记录在案（能力去向：频道数据、补推语义改由文件与插件重写实现）。
- 状态：未开始（替代链路局部证据见 FD-feeds-files）。

### FD-feeds-files（新增｜K-08｜段 1.5）
- 现有：无文件式 feeds（见 FD-old-channel）。
- 目标：`feeds/*.json` 由 `*.server.ts` 里 `import.meta.glob('/feeds/*.json', { eager: true, import: 'default' })` 读取，只在路由 loader 里调用；页面从 loader 数据取值。
- 通过条件：真实写入文件后，已打开页面（无手动刷新）出现新值；SSR 与浏览器一致；发布站读的是构建时快照。
- 状态：**已具局部证据**：E-7 复跑（`probes/2610111940_api-audit-hmr/README.md` §E-7）——server-only 写法下**修改、删除**已有文件：浏览器更新且计数器/未保存 input/窗口 UUID 全保留（01-baseline.log、browser-observations.json）；原第一轮（代码进浏览器 bundle）会整页刷新丢状态，server-only 是必要写法。

### FD-ops（新增验收｜K-08｜段 1.5）
- 现有：旧通道按频道整体替换，无「重新新增」问题；新写法的缺口已知：删除后重新新增文件 SSR 已新、浏览器仍旧值（E-7 复跑结论）。
- 目标：修改、删除、重新新增三类操作都让已打开页面更新。
- 通过条件：三类操作各做一遍，浏览器数据全部到位；「SSR 更新但浏览器仍旧值不算通过」（1.5 停止点原文）。
- 状态：**已具局部证据（部分）**：修改/删除已过复跑；**重新新增未通过**（浏览器仍 missing，见 E-7 复跑表）。
- 状态细化：待复核→重新新增一条是本轮明确缺口。

### FD-state-kept（保留要求｜K-08｜段 1.5）
- 现有：旧通道经 WS 事件更新不整页刷新，页面交互状态保持（`src/ui/site-feed.ts`）；新写法在 E-7 里验证了计数器与未保存输入保留。
- 目标：feeds 更新不丢页面交互状态（评论草稿、输入框）。
- 通过条件：数据更新瞬间未保存输入与计数器不丢（对照 1.5「数据更新和输入状态都正确」）。
- 状态：**已具局部证据**（E-7 复跑：input、count、UUID、timeOrigin 全保留）。

### FD-plugin-writes（新增｜P-04｜段 1.5+1.6）
- 现有：gwb 侧推送是 `gwbDocsite.push(dir, channel, data)` 经 HTTP 交给运行中的开发服务、离线记存补推（`plugins/docsite/src/site-host.ts:189-210`；`plugins/docsite/src/dev-server.ts:106-113`）。
- 目标：gwb 插件改写站点目录下 `feeds/<频道>.json`（格式用基础包导出的类型，K-08）；第一步在隔离环境验证完整推送链（插件写文件→站点读到）。
- 通过条件：隔离 home 里调 push 等价命令/服务后文件落盘、已打开页面更新；站点未运行时写文件、启动后读到。
- 状态：未开始（需隔离 home，1.6 段实际执行）。

---

## 组 7：新建、模板与扩展（段 1.1/1.6）

### TL-init-once（替换｜P-01、K-02｜段 1.6）
- 现有：`docsite.site.init` 新站点写最少几样（package.json 带端口 dev 脚本、pnpm-workspace.yaml、content/meta.json）→ 装依赖 → `writeSiteSkeleton` 照装好的模板写骨架 → 新依赖再装一次；**已有站点再运行就是更新**：`app/` 先整个删掉再写（`plugins/docsite/src/site-init.ts:40-88`；`src/init.ts:117-162`）。
- 目标：`docsite.site.init`（每次覆盖 `app/`）删掉，换成只新建一次的命令；重复执行不得覆盖已有站点改动（30 计划八组表）。
- 通过条件：新建一次成功可跑；对已有站点再次执行被拒绝（或明确无操作），站点自己的改动原样保留。
- 状态：未开始。

### TL-template-merge（替换｜K-02｜段 1.6）
- 现有：模板分 `template/skeleton/`（每次整份覆盖，package.json 合并、dev 端口保留）与 `template/initial/`（顶层条目没有才写，现仅 people.json）；生成 `app/site/` 聚合功能包（`src/init.ts:13-19,117-162`）。
- 目标：两份合成一份 `template/`，只在新建站点时复制；里面直接写好 import，不再生成 `app/site/*`。
- 通过条件：新建站点得到完整骨架（含 people.json 初始）；不再有 skeleton/initial 区分与 `app/site/` 生成物。
- 状态：未开始。

### TL-preserve（保留｜P-01｜段 1.6）
- 现有：初始化不动 `content/`、`comments/`、`people.json` 已有内容；`comments/` 不预建（`src/init.ts:146-152`；文档 skeleton.mdx）。
- 目标：行为不变（正文、评论和人员文件保留是 30 计划八组表现有列）。
- 通过条件：带正文/评论/人员的目录走新建流程后三者原样。
- 状态：未开始。

### TL-feature-deprecated（弃用→替代｜K-01｜段 1.6）
- 现有：功能包机制：站点 package.json `docsite.features` 列包；初始化生成 `app/site/`（features.ts/routes.ts/ui.ts/data.server.ts/styles.css/content.ts）；功能包出口 `./routes`（FeatureRoutes，layout:false/comments:true/index）、`./site`（routeLinks/mdxComponents/linkKinds/Provider/PageTop）、`./site-server`（layoutData）、`./styles.css`、可选 `./content`（remarkPlugins）；路由模块留包里经别名 `@site` 读骨架、`featureRouteFilesOf` 换真实路径；`docsite()` 的 `featurePackages` 选项（`src/feature.ts` 全文；`src/init.ts:36-42,89-102,169-182`；`src/vite/index.ts:18-32,176-184`；`site/content/(kit)/features.mdx` 全文）。
- 目标：删除整套机制（K-01 点名：feature.ts、siteFeaturesOf、writeSiteSkeleton、featureRouteFilesOf、site-modules.d.ts、featurePackages 选项与 @site 别名、`./init`、`./feature` 出口）。**能力去向**：加页面/路由→站点自己写 `app/routes/*` 直接 import 库导出；侧栏入口/MDX 组件/Provider→站点在 layout.tsx、mdx-components.ts 直接组合；链接种类→站点直接传给 `siteLinkComponent`；编译插件→Config API 按集合（WR-per-collection-plugins）；布局数据→站点 loader 自己调库函数。协作站的等价改造是 C-01（第 5 步），不因 K-01 删除而中断现有使用方（第 2、3 步切换）。
- 通过条件：验证站不依赖功能包机制实现全部八组功能；每项旧能力都有「由什么承接」的记录（本条即记录）。
- 状态：未开始。

### TL-custom-routes（保留，写法变化｜K-01 语境｜段 1.6）
- 现有：站点加自己的路由只能靠功能包 `./routes`（或改骨架 app/routes.ts——但 app/ 会被下次 init 覆盖，文档明说 `app/` 里不放自己的文件）。
- 目标：模板只生成一次后 `app/` 归站点维护，站点直接写 `app/routes/*`；库导出服务端函数（评论、身份、搜索）供 loader/action 调（30 计划第 1 节「站点的集合与 source 入口」「app/routes.ts 和 app/routes/*」）。
- 通过条件：验证站加一条自定义路由（如示例页）正常工作且不被模板流程覆盖。
- 状态：未开始。

### TL-custom-components（保留，扩展点变化｜K-01、K-11｜段 1.6）
- 现有：MDX 组件与链接种类由功能包 `mdxComponents/linkKinds` 聚合进骨架（`template/skeleton/app/lib/mdx-components.ts:17-20`；`src/feature.ts:30-41`）；站点无功能包时不能加（app/ 不可手改）。
- 目标：站点自己在 `mdx-components.ts` 加组件、自己给 `siteLinkComponent` 传种类数组（`siteLinkComponent(linkKinds)` 本就是基础包公开导出，`src/ui/site-links.tsx:133`）。
- 通过条件：验证站加一个自定义 MDX 组件与一个自定义链接种类（如指向自定义路由的卡片）渲染正确。
- 状态：未开始。

### TL-compile-plugins（替换｜K-01、K-03｜段 1.1）
- 现有：编译期插件扩展经功能包 `./content` 出口聚合进 `source.config.ts` 全局（`template/skeleton/source.config.ts:4,14`；`src/init.ts:80-87`）。
- 目标：站点直接在 Config API 的集合 `mdxOptions` 里配自己的插件（含按集合挑选）；全局配置只放共同插件。
- 通过条件：验证站有非功能包途径加入一个 remark 插件且只影响指定集合（与 WR-per-collection-plugins 同一验证）。
- 状态：未开始（与 PG-config-api 共享证据）。

### TL-mdx-check（保留｜—｜段 1.6）
- 现有：`siteMdxProblems(站点目录, ['content','comments'])` 从站点装的基础包加载编译器，把目录下 `.md/.mdx` 按 skeleton 公式设置全编译一遍，每个编不过的文件回「路径 行:列：原话」，写错的公式也算（rehype-katex 的消息）；要几秒，提交前查（`src/server/files.ts:16-20`；`src/server/mdx-problems.ts:8-58`；命令侧由 gwb-collab 提交前调用）。
- 目标：行为不变；编译器仍从站点装的那版基础包加载。
- 通过条件：坏 MDX 与坏公式各一例被报出且行列正确。
- 状态：未开始。

### TL-self-site（后续步骤｜K-14｜第 2 步）
- 现有：自述站 `site/` 照模板生成，`pnpm site:skeleton` 重写，基础包测试检查 `site/app/` 与模板一致（仓 AGENTS「怎么跑」；测试在包内）。
- 目标：第 2 步用新模板重新生成一次后当普通站点维护，删 `pnpm site:skeleton` 与一致性测试。
- 通过条件：（第 2 步验收）自述站在新包上运行、模板一致性测试删除。
- 状态：后续步骤（第 2 步「收正式包并迁自述站」）。

---

## 组 8：托管、检查与运行方式（段 1.6）

### HS-identity-cmd（保留｜—｜段 1.6）
- 现有：`docsite.identity` 回本 home 身份码（`plugins/docsite/src/commands.ts:74-81`）。
- 目标：行为不变。
- 通过条件：隔离 home 里命令回码且与该 home 认人一致。
- 状态：未开始。

### HS-init-cmd（替换｜P-01｜段 1.6）
- 现有：`docsite.site.init { dir, features?, port?, title? }`：新站要 port/title，已有站可给 features 更新依赖与骨架；站点在运行先停后启；只写文件不提交（`plugins/docsite/src/commands.ts:148-172`；`plugins/docsite/src/site-init.ts:66-88`）。
- 目标：换成只新建一次的命令（与 TL-init-once 同一改造；插件侧命令与服务 `init()` 同步换）。
- 通过条件：隔离 home 新建一验证站成功；再次初始化被拒且站点改动保留。
- 状态：未开始。

### HS-registry（保留｜—｜段 1.6）
- 现有：`docsite.site.add/remove/list` 登记设置 `sites`、移除、列出状态 `{ dir, url, expectedUrl, running, kept, error }`；插件加载时常驻启动清单里的站（`plugins/docsite/src/commands.ts:83-120`；`plugins/docsite/src/index.ts:109-110`）。
- 目标：行为不变。
- 通过条件：add→重启 home 自动启动→list 状态正确→remove 停止并除名。
- 状态：未开始。

### HS-process（保留，P-02 影响启动参数｜P-02｜段 1.6）
- 现有：`docsite.site.start/stop` 与服务 `keep/forget/start/open/stop/whileStopped`：在站点目录 `pnpm dev`（端口写死 scripts.dev），等输出报出 Local 地址；常驻（意外退出重启、5 分钟 3 次失败停下记原因、人为停止本次加载不自动启动）；`whileStopped` 先停做完再按规矩启动；Windows 连子进程一起 taskkill（`plugins/docsite/src/site-host.ts:57-301`；`plugins/docsite/src/dev-server.ts:68-166`）。
- 目标：行为保持；启动参数按 P-02 调整（身份码→只监听本机，见 ID-localhost）。
- 通过条件：隔离 home 全周期（启动/打开/意外退出重启/停/再启）正常；状态字段如实。
- 状态：未开始。

### HS-launch-check（保留｜—｜段 1.6）
- 现有：启动前检查：有 package.json、装了依赖、`siteProblems` 全过；不过不启动、原因写进状态（`plugins/docsite/src/site-host.ts:141-146`）。
- 目标：行为不变；配合新检查（MDX 编译错误提示在「启动前文件检查」30 计划八组表里指 `siteMdxProblems` 类检查——注意现状：打开站点前不查 MDX 编译（要几秒），提交前才查；本条按现状记启动前检查三项，MDX 提示在 TL-mdx-check）。
- 通过条件：缺依赖/坏 people.json/坏评论文件三种站各有明确拒绝原因。
- 状态：未开始。

### HS-site-problems（保留｜—｜段 1.6）
- 现有：`siteProblems(站点目录)` 不启动服务检查：人员列表格式、评论文件格式、作者、快照对不对，返回全部问题（`src/server/comment-files.ts:109-124`）。
- 目标：行为不变。
- 通过条件：与 HS-launch-check 同一批坏样本全部报出。
- 状态：未开始。

### HS-comments-read（保留｜—｜段 1.6）
- 现有：`docsite.comments { dir, page?, status?, about? }` 直接读文件（不要站点运行），回每串含正文 MDX 原文、mentions、回复列表（`plugins/docsite/src/comments.ts:18-33`；`plugins/docsite/src/commands.ts:189-210`）。
- 目标：行为不变。
- 通过条件：三种筛选（页面/状态/与我有关）结果正确；无评论目录回空。
- 状态：未开始。

### HS-comment-write（保留｜—｜段 1.6）
- 现有：`docsite.comment.create/reply/resolve/reopen`：经运行中开发服务的评论接口写（与网页同一套规则），create 可给 page/quote/occurrence 与 as；站点没在运行时拒绝并提示先 start（`plugins/docsite/src/commands.ts:212-261`；`plugins/docsite/src/comments.ts:35-63`）。
- 目标：行为不变。
- 通过条件：四命令各成功一次；as=agent 署名正确；站点停止时拒绝。
- 状态：未开始。

### HS-service（保留，push/init 按计划变更｜P-04、P-01｜段 1.6）
- 现有：注入服务 `gwbDocsite` 十二个方法（identityCode/keep/forget/start/open/stop/status/whileStopped/push/join/onStatus/init），供 gwb-collab 等功能插件托管自己的站点（`plugins/docsite/src/service.ts:10-35`）。
- 目标：**不受本次变更影响的方法（identityCode/keep/forget/start/open/stop/status/whileStopped/join/onStatus）保留**；`push` 的实现换成写 feeds 文件（FD-plugin-writes）；`init` 现有「可更新已有站点骨架」的语义按 P-01 换成只新建一次，属于行为变更，不能声称与现有 init 完全兼容；新命令的名称/参数以对应小段开始前的细化为准，本清单不预定协议或实现。
- 通过条件：隔离 home 里功能插件链（至少一个注入方）正常走 keep/status/push/join；init 的新语义在 1.6 按细化后的定义验收。
- 状态：未开始。

### HS-build-start（新增｜P-03｜段 1.6）
- 现有：无发布托管——gwb-docsite 只托管 dev（文档「不做的事」明说发布服务还没有）。
- 目标：发布给别人看的站用 build + start 托管：启动时不给身份码，自然只读（M2/M3）；新命令与协议先在验证场景确认，不切主实例（30 计划接口边界节）。
- 通过条件：隔离 home 里 build→start 全流程可看（页面、资源、评论显示），无身份注入、接口拒写；与 dev 行为差异（写完马上看到只在 dev 成立）有记录。
- 状态：未开始。

### HS-protocol（新增｜P-05｜段 1.6）
- 现有：无站点协议号。
- 目标：协议号加一，只认新协议；旧协议的站点报错，说明要按新模板重建。
- 通过条件：构造旧协议站点启动时报错并给出重建指引；新协议站正常。
- 状态：未开始。

### HS-dev-build-parity（新增验收要求｜—｜段 1.6）
- 现有：生产链只验 dev（AGENTS「日常只用开发服务，不为了看效果运行 build；build 只在发布前做」）；E-3/E-7 各自做过 build+start 抽验。
- 目标：三种页面、资源、评论与 feeds 在 dev 和 build/start 下分别检查（30 计划总验收第 4 条）；快照与只读符合已声明契约，运行时读本机文件的地方不藏在「构建通过」里。
- 通过条件：同一验证站 dev 与 build/start 各过一轮核心清单，差异逐项记录。
- 状态：未开始。

---

## 后续步骤条目（登记，不在第一步范围）

### F-docfirst（后续步骤｜D-01～D-19、Q1/Q3｜第 4 步）
- docfirst 的钉码（Pin/PinTree 新记号、replaceSource、structuredData 窄搜索记录）、严格校验、生成正本经编译器（`getText('processed')`）、D-18 一次性迁移、D-19 插件只留说明书。公开接口已有独立复核（`probes/2610111941_api-audit-markdown/README.md`：31 页基线一致、`_markdown`/`asMarkdown`/`replaceSource`/`structuredData` 公开、行首正则检查不可靠须换语法感知检查）。
- 状态：后续步骤；上述复核证据可在第 4 步直接引用。

### F-docfirst-skill（后续步骤｜P-06、D-19｜第 4 步）
- gwb-docfirst 的 `docs-site` 说明书并入 gwb-docsite 的 `docsite` 说明书合成一份、按新做法重写。
- 状态：后续步骤（3.5 表把 P-06 排在第 4 步）。

### F-collab（后续步骤｜C-01～C-08、E-9｜第 5 步）
- 协作站：功能包改普通库、协作站模板、日历/进展从集合读、写接口核对 Origin（repo-links 起本机进程尤其要）、feeds/collab.json、gwb-collab 新建与托管、已有项目站点重建、任务记录经 Vite 读、真实任务记录增删改的 E-9。第 1 步的 JSON 样本是前提，不代替真实记录验收。
- 状态：后续步骤。

---

## 环境与基线说明（K-13，不单列功能条目）

- 目标验证版本：fumadocs-core / @fumadocs/base-ui 16.17.1、fumadocs-mdx 15.4.7、Vite 8.3.4、React Router 8.4.0、Node 24.14.1（探针已装环境）；沿用已复核版本，不自动追新补丁。
- 生产包现状：peer 锁 16.16.2（`packages/docsite-kit/package.json:69-71`），与目标版本是两回事；锁版本不能代替接口公开性检查（K-13 原文）。
- 涉及实际版本或依赖修改时先读 gwb-release skill（本轮未改任何版本）。

## 自检

- **总数与步骤口径**：76 条 = **第一步 72 条** + 第二步 1 条（TL-self-site，登记在 G7 内）+ 后续登记 3 条（第 4/5 步），后续合计 4 条。各组（八组分类口径，含跨步骤条目）：G1 页面与资源 8、G2 正文与写作组件 5、G3 布局导航搜索 11、G4 评论 14、G5 身份与写入 9、G6 推送 5、G7 新建模板扩展 9（其中 1 条属第二步）、G8 托管检查运行 12、后续登记 3。
- **第一步全范围 ≠ 本轮范围**：72 条是第一步（完整功能验证站）的全范围清单；本轮 1.1 只做 A/B 集合基础接线，直接条目是 PG-config-api、TL-compile-plugins，以及 WR-per-collection-plugins 的 1.1 部分（Node 插件隔离）；三类页面 + 侧栏/搜索的完整条件（PG-multi-source）与公式/评论等真实插件组合属 1.2。json 的 `counts.currentSliceItems` 是机器可读口径。
- **去向分布**：保留 46（含「保留、实现搬家/适配器迁公开类型」）、替换 13、新增 11、弃用→替代 2（FD-old-channel、TL-feature-deprecated）、后续 4（TL-self-site 第二步 + 后续登记 3）。已弃用/删除机制均写明替代：功能包机制（TL-feature-deprecated 列五条能力去向）、旧推送通道（FD-old-channel）、`Source` 类型（PG-tsx-page/PG-html-page 迁 StaticSource）、DEV 判断（ID-no-dev-flag）、覆盖 CSS/塞假页面（LN-copied-layout/LN-group-keeping）、splitText/属性画框（CM-anchor-overlay）。
- **计划号覆盖**：K-01（TL-feature-deprecated、TL-custom-routes/components、TL-compile-plugins）、K-02（TL-template-merge、TL-init-once）、K-03（PG-config-api、PG-multi-source、WR-per-collection-plugins、TL-compile-plugins）、K-04（PG-list-refresh）、K-05（CM-thread-format、CM-per-page、CM-tsx-comments）、K-06（CM-display、CM-anchor-overlay、LN-panel-layout）、K-07（ID-origin、ID-no-dev-flag、ID-published-readonly）、K-08（FD-old-channel、FD-feeds-files、FD-ops、FD-state-kept）、K-09（LN-copied-layout、LN-group-keeping、LN-wide-toggle、LN-panel-layout）、K-10（WR-term）、K-11（PG-tsx-page、PG-html-page、PG-multi-source、TL-custom-components）、K-12（CM-page-text、CM-snapshot-diff、CM-collapsed）、K-13（环境说明）、K-14（TL-self-site，第二步）；P-01（TL-init-once、TL-preserve、HS-init-cmd、HS-service）、P-02（ID-localhost、HS-process）、P-03（HS-build-start、ID-published-readonly）、P-04（FD-plugin-writes、FD-old-channel、HS-service）、P-05（HS-protocol）、P-06（F-docfirst-skill，后续）。第一步相关的 K/P 条目无遗漏；D/C 只出现在后续登记条目（按派单不纳入第一步）。
- **重复检查**：同一能力只在一个组登记；跨组关联已互相指名（CM-display↔LN-panel-layout、CM-all-comments↔LN-link-chips 的 `?comment=` 跳转、TL-init-once↔HS-init-cmd、FD-old-channel↔HS-service.push、PG-config-api↔WR-per-collection-plugins↔TL-compile-plugins 是同一验证的三个侧面，分别从「接线样板」「正文插件组合」「扩展途径」登记）。
- **缺项检查**：对照 30 计划八组表逐行（每行至少一条）；对照 `(kit)/` 五个页面与写作两页的具体行为（writing/collapse-test 全部五类样本进 CM-collapsed；components.mdx 组件表进 WR-default-components；features.mdx 各出口进 TL-feature-deprecated）；对照基础包全部出口（package.json exports 的 ./vite、./page-sources、./comments、./server、./files、./site-feed、./ui、./feature、./init、./site-modules、./styles.css 均有条目落点）；对照插件全部命令（identity/site.init/list/add/remove/start/stop/people.join/comments/comment.create/reply/resolve/reopen）与服务方法（12 个）。已知未单列项：`docsite()` 的 ssr.noExternal/optimizeDeps 接线（E-4 证明必要）并入 PG-config-api 与环境说明；`siteTitleOf`（窗口认站名）并入 HS-process；open-site.ts 的 Chrome 窗口细节并入 HS-process。
- **状态声明**：本清单只有「未开始」「已具局部证据」「后续步骤」三类状态；没有任何条目标通过——本轮未运行任何站点或命令做功能验收，全部现有行为描述来自代码与文档阅读，探针结论只覆盖其所验证的环节。**本轮 B 会话（基础验证站）的自述不作为通过证据**：主会话尚未最终验收，B 交付的接线样板在主会话验收前不影响本清单任何条目的状态。
