# Markdown 公开接口审计：`pwsh -File ./run.ps1`（复用旧探针已安装依赖，不安装、不改版本）

本实验的人工写入都在本目录，不修改原计划、旧探针源文件与输出、生产源码、锁文件，不提交、不发版。`site/node_modules` 是指向旧探针依赖目录的 junction；Vite `cacheDir` 指向本目录 `out/vite-cache`。**缓存隔离限制**：同轮 HMR 复核发现 Vite 默认配置加载器仍可能在依赖目录的 `.vite-temp` 写入或清理临时配置文件，`cacheDir` 不覆盖这一路径；本实验使用相同的整目录 junction，不能声称所有临时文件都与旧目录隔离。包源码与依赖版本没有修改，也没有清理旧目录的临时缓存。没有调用浏览器或 build/start，也没有启动监听端口。每次 Vite middleware 实例都在 `finally` 中 `server.close()`，运行本次实验的 Node 子进程均已正常退出。

## 结论与边界

1. **D-02 / E-8 公开接口成立。** 新副本用 `getText('processed', { components: jsxComponents(...) })` 复跑旧 31 页，31/31 与旧 `out/e8` 逐字节一致，见 `out/baseline-report.json`。这包含原 E-1 的六份正本，但不重新调用旧 `renderAi`，也不验证最终落点 frontmatter 与空行写入器。
2. **显式 `jsxComponents` 包装不是必要条件。** 另外 25 个针对性样本中，24 个可渲染样本的原组件表与显式包装后的组件表输出一致，包括缺失组件；另一个是故意在 opt-in 后抛错的样本。`remarkLLMs` 生成的 `_markdown` 函数内部已调用该 helper。旧 runs/40 所说“缺组件须自己 stub”不准确。官方推荐调用形式直接传 `components`，更少依赖一层 helper。
3. **D-05 的同 range 新对象优先顺序只由当前源码确认，公开文档未承诺。** 旧 `probe-pin` 原对象 `replaceSource`，新 `PinBlock` 对象继承 position，LLMs marker 对新对象再登记，依赖两个不同对象但同位置的 edits 的排序。此版本排序只比 start/end，Map 插入顺序与稳定 Array.sort 导致旧对象的第一项胜出；这不是官方“同一个 node 最后编辑胜出”规则。实测原对象就地改 name 会被 LLMs 后编辑覆盖，两个不同对象再登记第二个也仍是第一个胜出，见下表。
4. **可以避免这一处竞争。** `replaceSource(file, 原有position的Pin节点, markdown)` 后，用没有 `position` 的新展示节点替换 AST；官方 source slicing 规则规定无位置生成节点不自行改变 Markdown。实际 Pin/PinTree 样本经这条路仍输出代码/目录树，公开 `node.data.structuredData` 给出窄搜索记录。见 `audit-pin-lowcoupling.mdx`。这是低耦合候选，只验证了本探针组合；未宣称所有未来插件、浏览器渲染、完整 Files/Folder/File 目录树组合都已通过。
5. **Term 保留原词有事实基础。** 已读当前 `gwb-docfirst/.../glossary-plugin.ts`，`splitText` 把 text 换成新 text/Term 片段，均无 position，父 paragraph 的 source range 保留。针对性样本按这个形态转换，Markdown 与搜索仍是 `prefix TermWord suffix`，组件表甚至无需提供 Term。机制是原文 slice 保留词，不是 Term 组件自动获得 Markdown 能力。手写 `<Term>`、给生成节点错误继承 position、或改写原文不是同一情况，未验证。
6. **D-16 / D-02 的“行首大写标签扫描可靠点名”不成立。** 有漏报、误报、名称丢失；详情见下表。Fumadocs 公开行为是未 opt-in 的组件保留 JSX，并不替项目执行“所有组件须给 Markdown”的报错政策。该政策要另做语法感知检查，排除围栏/行内代码并覆盖 flow/text JSX、命名空间、别名及组件产出的内容，不能用现有一条正则承担完整契约。本实验不实现最终验证器。
7. **搜索需与机读生成分别验收。** 旧 E-8 Pin 的 `structuredData` 包含完整代码，旧 PinTree 的记录包含围栏与树正文。旧探针没有实现 `node.data.structuredData`，这不是否定公开 API。新增最小公开属性样本只收路径/标题文本；实际 Pin/PinTree 无 position + `data.structuredData` 样本只收 `pinned/a.ts:1-1` 与 `pinned/dir/`，机读仍有全部正文。尚未实现生产代码中的具体标题提取逻辑。
8. **补 E-1 / D-13 素材缺口。** 实际 1×1 PNG 节点保留 `![Local real PNG](./audit-image.png)`，无 bundler URL 泄漏；MDX include 展开真实正文，所含 Good 组件的 asMarkdown 生效；TS include 成普通 ts 围栏；npm/package-install 多个块均保持原围栏输入，不泄露生成的 Tabs。仅核对 Markdown/structuredData，不作网页图片视觉验收，也未拿这些新素材与旧 renderAi 比较。

## D-16 输入、输出与原扫描结果

原扫描：`/^[\t ]*<\/?([A-Z][\w$]*)/gm`。所有输入文件在 `site/content/docs/audit-*.mdx`，输出在 `out/audit/*.md`，完整数据在 `out/audit-report.json`。

| 样本 | 输入或组件返回 | 实际输出 | 原扫描 | 含义 |
|---|---|---|---|---|
| flow | `<Inner />` | `<Inner />` | Inner | 控制样本通过 |
| inline | `prefix <Inner /> suffix` | 原样 | 空 | 漏报作者行内组件 |
| fence | 围栏内 `<ExampleOnly />` | 保持围栏 | ExampleOnly | 误报代码示例 |
| inlinecode | 行内 code `<ExampleOnly />` | 保持行内 code | 空 | 控制样本通过 |
| nested | Outer 包 Inner | 两个 JSX 标签 | Outer、Inner | 普通嵌套能抓到 |
| good-nested | opt-in 的 Good 包 Inner | `<Inner />` | Inner | 只剩子组件 |
| missing | `<Missing />`，表里缺失 | `<Missing />` | Missing | 缺组件不会自动抛错 |
| alias | `<Alias />` 对应函数 RenamedImplementation | `<RenamedImplementation />` | RenamedImplementation | 丢了作者标签名 |
| lower-alias | `<LowerAlias />` 对应函数 lowerImplementation | `<lowerImplementation />` | 空 | 漏报函数小写名 |
| member | `<UI.Box />` | `<UI.Box />` | UI | 名称截断 |
| produced-inline | InlineProducer opt-in 返回 p 包 Inner | `text <Inner /> tail` | 空 | 漏报组件生成的行内组件 |
| produced-raw | HiddenProducer opt-in 返回 raw Markdown/JSX 文字 | `text <MissingInline /> tail` | 空 | 漏报生成内容 |
| html-container | `<p>prefix <Inner /> suffix</p>` | 原样 | 空 | 不能只加行首 JSX 判定 |
| throw-before | 组件先抛错，没有 asMarkdown | `<ThrowBefore />` | ThrowBefore | 当前实现降级为 JSX |
| throw-after | 调 asMarkdown 后抛错 | 报错 `after opt-in` | 无输出 | opt-in 后错误继续抛出 |

## Pin 替换优先顺序对照

| 展示 AST 的改法 | `getText` 实际输出 | 证据 |
|---|---|---|
| 原对象登记后就地改名 Outer | `<Outer mode="same-node" />` | 同一对象最后编辑胜出，预登记被 marker 覆盖 |
| 新对象继承原 position | `PIN_REGISTERED_distinct-position` | 当前不同对象同 range 首项胜出 |
| 新对象继承原 position 并再次 replaceSource | `PIN_REGISTERED_second-edit` | 即使新对象再登记，仍首个对象胜出 |
| 新对象不带 position | `PIN_REGISTERED_no-position` | 原登记生效，新对象不产生 range 编辑 |
| 新对象挂公开搜索记录 | `PIN_REGISTERED_search-record`；搜索 `src/needle.ts : Heading only` | 搜索覆写与 Markdown 独立 |

## API 契约来源（公开文档与锁定源码分别核对）

官方网页已访问，与旧探针 `_upstream` 的同 tag 文档相符：

- [Remark LLMs](https://www.fumadocs.dev/docs/headless/mdx/remark-llms)：`_markdown` 本身是文档化导出，不因前缀 `_` 判为私有；`output: 'function'`、`getText('processed', { components })` 有公开示例。
- [Markdown Rendering](https://www.fumadocs.dev/docs/headless/utils/markdown)：`asMarkdown` 与 `renderToMarkdown` 公开；未 opt-in 的组件保持 JSX 是明示行为。React Router 非 RSC 的 `'use client'` 文件在旧 31 页中有效；不能外推到 RSC client reference。
- [Stringification](https://www.fumadocs.dev/docs/headless/mdx/stringification)：source slicing、节点 position、`replaceSource`、`embedSource`、同 node 最后编辑胜出、search namespace 有公开说明。没有不同对象同 range 的优先顺序保证。
- [Remark Structure](https://www.fumadocs.dev/docs/headless/mdx/structure#plugins)：`node.data.structuredData.contents` 是公开扩展方式。
- [Include](https://www.fumadocs.dev/docs/mdx/include)：内容 include 与代码 include 是公开特性。

锁定源码：旧探针 `_upstream` 的 `fumadocs@16.17.1` tag，commit `d6cfc48d62aa9ea413f0fc5033617c0c923681ec`。

| 同 tag 文件 | 位置 | 用来证明什么 |
|---|---|---|
| `apps/docs/content/docs/headless/mdx/stringification.mdx` | 14–17、42–45、54 | 文档化 source/position/last-node-edit/search 规则 |
| `apps/docs/content/docs/headless/mdx/remark-llms.mdx` | 5、89–117 | `_markdown` 与公开 getText/components 写法 |
| `apps/docs/content/docs/headless/mdx/structure.mdx` | 86–98 | 公开搜索记录注入协议 |
| `packages/core/src/mdx-plugins/stringifier.ts` | 134–138、143–153、178 | Map 对象键、编辑排序、覆盖区间跳过是当前实现细节 |
| `packages/core/src/mdx-plugins/remark-llms.ts` | 106–128、224、259–260 | LLMs marker 后登记，生成函数内部包装 jsxComponents |
| `packages/core/src/server.ts` | 80–99、195–208、254–263 | helper stub、opt-in错误处理、实际函数名用于 JSX |
| 已安装 `fumadocs-mdx/dist/runtime/server.js` | 95–107 | 15.4.7 的 getText 包装内部取值与 renderToMarkdown；调用方不需要读取 `_exports` |

有公开 export 仅代表入口可调用；本报告把有官方文档承诺的规则与仅当前实现可见的同 range 排序分开。没有声明整个方案已摆脱所有内部接口，也没有验证 `_compiler` 依赖登记、HMR、页面清单或其他代理范围。

## 文件、日志与验证

- `run.ps1`：一次跑基线、25 个针对性样本、结果断言。
- `render-baseline.mjs`：只比旧 out 中已有的 31 页；不调用旧脚本、不写旧 out。
- `render-audit.mjs`：25 个针对性页面，24 成功、1 故意抛错。
- `verify-results.mjs`：12 组结果断言，涵盖反例与机制对照。
- `site/app/lib/audit-plugin.ts` / `audit-entry.tsx`：仅本目录的转换与组件。
- `out/baseline.log`、`out/audit.log`、`out/verification.json`：结果证据。
- `out/environment.json`：解析到的实际包版本与隔离说明。
- `out/new-files.txt`：本目录文件清单，跳过 junction 与 Vite 缓存。

为了给复跑保留独立输入，`site/` 复制旧站点的源文件、正本和配置；只在本目录修改全局插件与 Vite 最小配置。按任务约束只读使用原站依赖 junction，运行脚本不做 install。复跑耗时受本机缓存影响，本次 baseline 的 elapsedMs 只计算 Vite 创建之后的加载/渲染，不与旧探针包含启动的总时间直接比较。
