# E-1 观察记录（2026-10-11，报告 out/e1-compare-report.txt；新输出 out/e8/）

## 做法

1. `scripts/e1-copy-sources.mjs`：把 gwb-docfirst 的 6 份正本（outputs/{readme,claude}.mdx、
   outputs/skills/{docs-site,docs-writing,trajectory}.mdx、maintain/agents.mdx）复制进实验站，
   并把**独占一行**的 `{/* ref … */}`、`{/* tree … */}` 改写成 `<Pin>`、`<PinTree>`。
   认法与 renderAi 的 markerOf 对齐（mdxFlowExpression 才是记号；行内与围栏代码块里的示例文字不算，
   改写脚本同样跳过围栏内部）。结果：**这 6 份正本没有任何可被认的记号**——示例记号全在
   行内（README 第 56–58 行，行尾带说明文字）或 ```mdx 代码块里（docs-writing 第 171–172 行），
   两条管线都原样保留。改写 0 处。
2. `scripts/render-outputs.mjs` 渲染 6 页（共 4939ms，Vite 启动 1406ms）。
3. `scripts/e1-compare.mjs`：新输出与现在的生成物（README.md / AGENTS.md / CLAUDE.md /
   plugins/docfirst/skills/*/SKILL.md，对应关系照 docfirst.config.mjs 的 outputs）比对，
   两边都剥 frontmatter，只比正文。

## 结果：6 份正文全部逐字节一致，差异共 12 处、全部是空行

| 类别 | 差异 | 归属 |
| --- | --- | --- |
| 空行与换行 | 每份旧生成物末尾比新输出多一个空行（renderAi 不 trim 尾换行，renderToMarkdown trim） | 可接受的变化；D-02 写落点时统一补尾换行即可零 diff |
| 空行与换行 | 三份 SKILL.md 旧生成物在 frontmatter 与正文之间有一个空行（docfirst 落点写入器加的），剥 frontmatter 后错位一行 | 不是新流水线的问题；落点写入格式的事，D-02 对齐即可 |
| 标题 id | 无差异（`headingIds: false` 生效，新输出没有 `{#id}`，与 renderAi 照抄一致） | — |
| 图片 / include / npm 代码块 | **无素材**：正本里唯一的「图片」是行内 code 里的文字（`` `![说明](/p2/x.png)` ``），不是图片节点；npm 命令都在 ```bash 块里（remarkNpm 只动 ```npm 块）；没有 include | remarkImage 对真图片节点的机读形式未经这批正本检验，D-02/D-13 实施时要单独补验 |
| 钉码块格式 | **无素材**（正本无可认记号）；E-8 已单独验证 probePin 的 fence（`max(3, 最长反引号串+1)`）与 title（`语言 title="file:起-止"`、`text title="dir/ glob"`）与 renderAi 的 blockOf 一致 | — |
| 组件 | **无素材**（正本无 JSX 组件）；E-8 已验 A/B/C | — |
| 其他 | 无 | — |

值得记录的正向证据：readme 10 个围栏、docs-site 6 行表格与 8 个围栏、行内 code、GFM 表格
全部逐字节一致——fumadocs 默认工序（remarkGfm、remarkStructure、remarkHeading、remarkCodeTab 等）
对这批纯 markdown 的序列化与 renderAi 的「逐字节照抄」等价。

## 结论

成立：同一份正本，新流水线（fumadocs 工序 + `_markdown`(output:'function') + renderToMarkdown）
的输出与现在 renderAi 的生成物正文一致；仅剩的空行差异由落点写入格式处理（D-02 写落点时
补尾换行、沿用 frontmatter+空行+正文的拼接），生成物可做到零 diff。
真图片节点、```npm 块、include、真钉码与组件在这批正本里没有素材，已分别在 E-8 验过钉码与组件，
图片与 npm 块留给 D-02 实施时补验。
