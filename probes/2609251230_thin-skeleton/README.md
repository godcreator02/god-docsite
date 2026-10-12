# 薄骨架验证

## 问什么

把 fumadocs 站点的应用代码（布局、页面路由、集合定义、MDX 组件表、样式）放进一个 npm 包，项目仓里每个骨架文件只留一两行转发，在 Next 16 加 Turbopack 下能不能构建、运行正常。

## 怎么跑

```powershell
cd pkg; pnpm install; pnpm build; pnpm pack; cd ..\site; pnpm install; pnpm build
```

构建通过后用 `pnpm start` 启动（端口 4399），在浏览器里打开首页，执行 `runs/05-browser-check.txt` 里那段脚本。

改了 `pkg/` 要重测时，先把 `pkg/package.json` 的版本号加一，再 `pnpm pack`，然后在 `site/` 里 `pnpm remove @godcreator/collab-site` 并按新 tgz 文件名重新 `pnpm add file:../pkg/<新文件名>`。版本号和文件名不变时，pnpm 会沿用 `node_modules/.pnpm` 里的旧目录，装进去的还是旧包（`runs/02`、`runs/03` 就是这样测到旧代码的）。

包按 tgz 安装，而不是用 `link:` 或 workspace 指向源码目录：只有这样，包在 `node_modules` 里的位置和它的同级依赖，才和以后从 npm 源安装时一样。

## 结论

可行。项目仓的骨架只剩这几行：`next.config.mjs` 一行 `withCollab()`，`source.config.ts` 一行转发导出，`src/lib/source.ts` 一行 `createSource(docs)`，`layout.tsx` 与 `[[...slug]]/page.tsx` 各两三行，`global.css` 一行 `@import` 包里的样式。

`runs/04` 构建通过，`runs/05` 四项都成立：包里带 `'use client'` 的组件读得到 fumadocs-ui 的树上下文，点击能更新状态，说明 React 与 fumadocs-ui 各只有一份；包里组件和项目组件的 Tailwind 类名都生效；段落、标题、列表项都带上了 `data-src="文件:行号"`，行号与源文件一致；项目自己的组件能在 MDX 里直接用。

路上撞到的两处，都要照这样写进正式的包：

- 包里导出的集合 `docs` 要显式标注类型 `DocsCollection<typeof frontmatterSchema, typeof metaSchema>`，否则 `tsc` 生成类型声明时报 TS2883，说推断出的类型引用了 fumadocs-mdx 依赖里的 zod、写不出名字。把 zod 加进包的依赖不解决问题。
- 包装 `loader` 的函数要把集合类型当泛型参数传下去（`createSource<CollectionSource extends Source>`），参数类型写宽了会丢掉页面数据里的 `toc`、`body`，项目侧类型检查失败（`runs/01`）。

没测：`next dev` 开发模式；包里的组件接收项目传入的服务端组件作为子元素；Next 与 fumadocs 升版本之后。

## 跑那次的环境

2026-09-25，Windows 11 Pro 10.0.26200，Node v24.14.1，pnpm 12.4.2，next 16.3.0（Turbopack），fumadocs-core 16.15.1，fumadocs-mdx 15.3.1，fumadocs-ui 为 `@fumadocs/base-ui` 16.15.1，TypeScript 6.0。被测对象就是本目录的 `pkg/` 与 `site/`，实验时仓还没有第一个提交。
