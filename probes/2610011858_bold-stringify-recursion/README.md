# fumadocs 的 stringifier 遇到粗体为什么无限递归

## 问什么

`docfirst.create` 建出的站（脚手架 `create-fumadocs-app@16.2.8`，写死 fumadocs-core 16.15.14），`pnpm build` 时凡是含粗体的 mdx 页面都报
`RangeError: Maximum call stack size exceeded`，栈在 fumadocs-core 的 `dist/mdx-plugins/stringifier.js` 与 mdast-util-to-markdown 的
`lib/handle/strong.js` 之间来回。问题出在哪个版本组合上，换哪一边能修好。

## 怎么运行

```
node run.mjs
```

`cases/` 下三个目录各是一个版本组合，各带 `package.json`、`pnpm-workspace.yaml`（用 `overrides` 定下 mdast-util-to-markdown 的版本，
不装 fumadocs-core 的 peer）与锁文件。`run.mjs` 在每个目录里 `pnpm install --frozen-lockfile`，再在那里运行 `repro.mjs`：
用 mdast-util-from-markdown 解析几段 markdown，交给 fumadocs-core 的 `defaultStringifier` 序列化，打印每段通过还是失败。
要联网装依赖（首次）。

## 结论

`runs/01-three-combinations.txt`：

| 组合 | 粗体 | 斜体 | 没有强调 |
| --- | --- | --- | --- |
| fumadocs-core 16.15.14 + mdast-util-to-markdown 2.1.3 | 失败 | 失败 | 通过 |
| fumadocs-core 16.15.14 + mdast-util-to-markdown 2.1.2 | 通过 | 通过 | 通过 |
| fumadocs-core 16.15.17 + mdast-util-to-markdown 2.1.3 | 通过 | 通过 | 通过 |

mdast-util-to-markdown 2.1.3（2026-09-27 发布）把粗体、斜体改成由 `containerPhrasing` 按处理函数上挂的 `attention` 属性处理，
`strong()` 本身只是调用 `containerPhrasing({type: 'root', children: [node]})`。fumadocs-core 16.15.14 的 `defaultStringifier`
把每个处理函数包一层新函数，`attention` 没带过去，于是 `containerPhrasing` 又调回包过的 `strong`，无限递归。
16.15.17 包完之后 `Object.assign(wrapped, handler)`，把 `attention`、`peek` 这些属性复制回去，所以修好了。

## 运行那次的环境

2026-10-01 18:58，Windows 11 Pro 10.0.26200，node v24.14.1，pnpm 12.4.2。被测对象是 npm 上发布的 fumadocs-core 16.15.14、16.15.17
与 mdast-util-to-markdown 2.1.2、2.1.3，不涉及本仓代码；本仓当时在 61fb42e。
