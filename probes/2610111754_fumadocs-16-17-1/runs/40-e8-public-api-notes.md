# E-8 补做观察记录（2026-10-11，公开接口替代内部 _exports._markdown）

## 改动

`app/lib/e8-entry.ts` 的 `renderPageMarkdown` 不再读 `mod._exports._markdown` 自己 createElement +
renderToMarkdown，改用公开接口：

```ts
page.getText('processed', { components: jsxComponents({ ...getMDXComponents(), ComponentA, ComponentB,
  ComponentC, PinBlock, PinTreeBlock }) })
```

- 接口位置：集合条目（`docs.getPage(path)` 的返回）的顶层方法 `getText(type, options?)`，
  `fumadocs-mdx/dist/types-*.d.ts` 的 `DocMethods`：`'processed'` 只在集合开了
  `includeProcessedMarkdown` 时可用，`options.components` 只在 `output: 'function'` 时可用——
  正是生成正本要的组合。
- 内部实现（dist/runtime/server.js 的 createDocMethods）：取 `data._markdown ?? data._exports?._markdown`，
  字符串直接返回，组件则 `renderToMarkdown(createElement(markdown, { components }))`——
  就是上一轮手写的那套，公开接口把它们包好了。
- 组件表仍用 `jsxComponents(...)` 包装（getText 不自动包，缺的组件要 stub 成 null 才不炸）。

## 结果

| 项 | 上一轮（内部 `_exports._markdown`） | 本轮（公开 `getText`） |
| --- | --- | --- |
| e8.mdx 单页输出 | 196 字符 | **逐字节一致**（git diff 0 行） |
| 全部页面输出 | —（分两批跑：25 页 + E-1 的 6 页） | 31 页一次跑完，**与上次全部逐字节一致**（git diff 0 行） |
| 单页耗时 | 总 2300 ms（启动 951） | 总 2721 ms（启动 1571，页面渲染 347 vs 343） |
| 全量耗时 | 25 页总 2589 ms | 31 页总 4073 ms（启动 1635 + 渲染 2438；页多 6 页、冷启动慢约 0.7 s） |

输出一致同时验证了另一件事：E-2 的插件从「集合 mdxOptions」挪到全局 `source.config.ts`（同一个
applyMdxPreset，插件顺序不变）后，编译结果不变——E-1 的 6 份正本输出也逐字节一致。

## 结论

成立：生成正本用公开接口 `getText('processed', { components })` 即可，不必碰 `_exports._markdown`
这个内部结构；输出逐字节一致，耗时同量级（每次跑的主要成本还是 Vite 启动约 1–1.6 s，页面渲染
每页 10–350 ms）。
