# E-8 观察记录（2026-10-11，输出 out/e8/）

## 写法

- docs 集合 `postprocess: { includeProcessedMarkdown: { output: 'function', headingIds: false } }`。
- `app/lib/e8-entry.ts`（站点内、经 Vite ssrLoadModule 加载，react/fumadocs-core 都是站点那份实例）：
  `docs.getPage(path)` → `page.load()` → **async 集合的导出在 `mod._exports._markdown`**（不是模块顶层，
  模块顶层是 body/toc/structuredData/_exports…）→ `renderToMarkdown(createElement(_markdown, { components: jsxComponents(组件表) }))`。
- `scripts/render-outputs.mjs`：`createServer({ root: site, server: { middlewareMode: true }, appType: 'custom' })`。
- 坑两枚：`@/` 别名对 content/ 下 mdx 的 import 不生效（dev 与 middlewareMode 都 500），正本里要用相对路径；
  `fumadocs-mdx/config`（applyMdxPreset）与 probe-dep 是 Node-only，写在 source.ts 里实测浏览器端没炸
  （宏把 defineDocs 调用整体替换后这些 import 不进客户端模块图）。

## A / B / C 的输出（out/e8/e8.mdx.md）

| 组件 | 写法 | 机读输出 |
| --- | --- | --- |
| A | 普通组件，`if (asMarkdown()) return '纯文字'` | 「组件A的机读文字：把界面上的示意讲成一句话。」✓ |
| B | 同 A，但文件第一行 `'use client'` | 「组件B的机读文字：client 组件也能给 Markdown 形式。」✓ **'use client' 在 React Router 非 RSC 模式下不影响**：模块照常在 Node 端加载执行，asMarkdown() 照常为真 |
| C | 不调 asMarkdown | **原样保留 JSX**：`<ComponentC>↵界面上的C↵</ComponentC>` |

「没给 Markdown 形式的组件」的可靠找法（e8-entry.ts 的 findUnresolvedComponents）：扫描输出里残留的大写
JSX 标签 `^[\t ]*<\/?([A-Z][\w$]*)`——给了形式的组件不会以标签出现在输出里，没给的会原样保留。
实测输出精确点名 `['ComponentC']`。生成正本时跑一遍这个扫描、非空即报错，即可落实 D-16。

## probePin（钉码经 replaceSource 登记）

<Pin file="pinned/a.ts" lines="1-1" /> 的机读输出是登记的文字原文（在登记里加过独特标记验证过，
不是组件渲染的兜底）：

````text
```ts title="pinned/a.ts:1-1"
export const pinnedValue = 'v2';
```
````

机制：replaceSource 登记在**原 Pin 节点**（有原文 position 的编辑才生效）；替换出的 PinBlock 节点
继承原 position，remarkLLMs（output:'function'）对大写组件的 marker 编辑与预登记同 range，
createStringifier 的 Map 按插入序稳定排序——**预登记先应用、marker 被跳过**。
网页侧 PinBlock 包普通 code 节点照常渲染。
fence 计算要与 renderAi 完全一致（`max(3, 最长反引号串+1)`；把 +1 加在 max 外会多一档）。

## 耗时（render-outputs.mjs 自报）

- 1 页（e8.mdx）：Vite 启动 951ms + 加载渲染 1349ms = **总 2300ms**；首页含首次编译 343ms。
- 25 页（20 份 e8 副本 + 站内 5 页）：Vite 启动 946ms + 加载渲染 1643ms = **总 2589ms**；
  首份副本编译 351ms，其余每页 10–16ms。页数增长几乎全在每页编译上，一次启动可复用。

## 结论

成立：命令行里经 Vite 加载站点、取 `_markdown`（output:'function'）、renderToMarkdown + jsxComponents
渲染成文字这条路全部走通；组件的 asMarkdown（含 'use client' 文件）、插件的 replaceSource 同时生效；
未给 Markdown 形式的组件可用输出扫描可靠点名。
