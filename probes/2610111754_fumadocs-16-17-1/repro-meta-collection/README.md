# fumadocs-mdx 15.4.7：defineCollections({ type: 'meta' }) 单独使用必 500 的最小复现

问题全文（英文，可直发 GitHub issue）在 [ISSUE.md](ISSUE.md)。

## 运行

```text
pnpm install
pnpm dev        # http://127.0.0.1:5199/
```

打开首页即 500：`Internal server error: Cannot convert undefined or null to object`，
堆栈指到 fumadocs-mdx 的 `dist/runtime/server.js:50`（`Object.entries(glob)` 收到 undefined）。
`app/lib/source.ts` 只有一个 meta 集合，`app/routes/index.tsx` 的 loader 读 `demo.entries`。

对照：把 `source.ts` 里的 `defineCollections({ type: 'meta', ... })` 换成 `defineDocs({ dir: 'data' })`
（内置 meta 集合）就正常——`docs(args)` 读的是 `args.meta`，与宏展开一致；只有单独的 meta 集合
（展开成 `meta:`，运行时读 `args.entries`）参数名对不上。
