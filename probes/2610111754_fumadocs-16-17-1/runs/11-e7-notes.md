# E-7 观察记录（2026-10-11，日志 10-dev-e7.log）

## 前置发现：defineCollections({ type: 'meta' }) 在 fumadocs-mdx 15.4.7 单独使用是坏的

宏展开成 `runtime.meta({ base, meta })`（transform 生成 `meta:` 参数，实测转换后的
`app/lib/source.ts` 即如此），而运行时 `dist/runtime/macro.js` 的 `meta(args)` 读的是
`args.entries`，传给 `dist/runtime/server.js` 的 `Object.entries(glob)` 是 undefined，
每次请求 500：`Cannot convert undefined or null to object`。
`defineDocs` 内置的 meta 集合不受影响（`docs(args)` 读 `args.meta`）。
15.4.7 是当时 npm 最新版，尚无修复版本。
实验改用手写宏展开的等价形式（eager `import.meta.glob('/feeds/*.json')`）继续。

## 数据更新行为（dev，4446）

页面：/docs，布局层显示 `feeds.entries` 里 demo.json 的 message，旁边一个计数器按钮。
判断整页刷新用 `window.__probe` 标记（刷新即丢）。

1. 18:16:26.118 写 feeds/demo.json → 同一秒 dev 日志：`(client) page reload feeds/demo.json`、
   `(ssr) page reload feeds/demo.json` + program reload。
2. 浏览器：feed 文字更新为新值，计数器（已点 3 次）归零，window 标记丢失 → **整页刷新**。
3. 计时（第二轮）：写文件 → SSR HTML 出现新值，**277 ms**。

结论：**不成立**（按「不刷新整页就更新」的要求）。文件一变数据到页面很快（<300ms），
但机制是 Vite 让 glob 模块失效 → 整页 reload（客户端 + SSR 程序重载）；
页面上未保存的交互状态（计数器、输入草稿）会丢。
