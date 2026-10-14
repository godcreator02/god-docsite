# 结果：功能包原生接进官方 React Router 模板

最终运行：`runs/20261014-1022/`（`console.txt` 是控制台全文，`report.json` 是全部检查项）。下文「两种装法」指 `linked`
（workspace 链接，包的真实路径在 `packages/` 下）与 `packed`（`pnpm pack` 出 tarball 再按 `file:` 装，真实路径在
`node_modules/.pnpm/demo-*@file+tarballs+…/` 下，与从 registry 装相同）。推荐写法（集合用 `config`）在两种装法 ×
dev、build + start 四格里，浏览器检查 16 项全部通过，没有打 `@react-router/dev` 补丁。

## 逐项结论

| 项 | 结论 | 证据 |
| --- | --- | --- |
| 1 集合写法 | Config API（`source.config.ts`）通过；macro 不通过 | 见下「1」 |
| 2 MDX 组件水合 | 通过（四格） | `2-mdx-component-hydrated`：点两下计数为 2，`usePathname` 与 CommonJS 依赖 `ms` 都正常 |
| 3 页面树插件 | 通过，不用退回 meta.json | `3-sidebar-entry`、`4-client-nav-sidebar` |
| 4 带数据的页面 | 通过（四格），有三个前提 | 见下「4」 |
| 5 Vite 处理 | 通过；packed 装法下不挂插件就有两份 fumadocs | 见下「5」 |
| 6 SSE 推送 | 通过（四格，含 build + start） | `6-sse-open`、`6-sse-push-from-other-page` |

### 1 集合写法：用 Config API

fumadocs-mdx 15.4.7 的 `getMDXOptions`（`dist/build-default-*.js`）对两种写法一样：集合写了 `mdxOptions`，全局的
`mdxOptions`（Config API 的 `defineConfig`、macro 的 `fumadocsMdx({ globalOptions })`）对这个集合就**整个不生效**。
对照组 `*-global-only`（公式插件只放全局、集合只放功能包插件）两种写法都是：remark 插件生效、公式不渲染、
正文里留着原样的 `$E = mc^2$`（`*-global-only-dev-docs.html`）。所以「集合级预设 + 全站插件」只能在每个集合的
`applyMdxPreset` 里把全站插件再列一次；全局那份只管集合外被 import 的 mdx。

两种写法的差别在**插件代码进不进浏览器**：

- **Config API**：`source.config.ts` 只在构建期由 Node 加载，运行时从 `.source/server`、`.source/browser` 取集合，
  正文由 `createClientLoader` 按需加载。四格全过；`build/client` 33 个 js、839.4 KB，搜不到 `__vite-browser-external`
- **macro，插件写在 `app/lib/source.ts` 顶部**（`macro` 写法）：macro 只把 `defineDocs(...)` 调用换掉，文件顶部的
  `import { applyMdxPreset } from 'fumadocs-mdx/config'`、`remark-math` 等留在运行时代码里，而 `source.ts` 会被
  `docs.tsx` 带进浏览器。dev 下文档页水合失败：`Module "node:url" has been externalized for browser compatibility.
  Cannot access "node:url.fileURLToPath"`，出自 `fumadocs-core/dist/mdx-plugins/remark-image.js`
  （`runs/20261014-0954/linked-macro-dev-dev-server.txt`；`runs/20261014-1009` 那次表现为 504 Outdated Optimize Dep 后
  同样水合失败）。build 能跑，但客户端产物 46 个 js、1065.9 KB（多 227 KB），文档页块里有 `__vite-browser-external`
- **macro，插件在 `mdxOptions` 函数里动态 import**（`macro-lazy-options` 写法，想让插件代码随调用一起消失）：
  `mdxOptions` 要等编译 MDX 时才被调用，那时 macro 求值用的模块运行器已关闭，dev 下 `/docs` 500
  （`Error: Vite module runner has been closed.`，`runs/20261014-0946/linked-macro-lazy-options-dev-dev-server.txt`），
  build 失败

macro 另外还有一条已知限制：它写死跳过 `node_modules/**`（`fumadocs-mdx/dist/options-*.js` 的 `DefaultExclude`），
功能包里不能定义集合。官方模板用 macro 是因为它没有集合级插件；一旦要挂功能包的 remark 插件，就该改用 Config API。

### 3 页面树插件

fumadocs-core 16.17.1 的 `LoaderPlugin.transformPageTree.root` 能直接往根节点追加链接项，侧栏渲染出
`a[href="/demo"]`「演示」，点它是站内导航（页面标记保留、没有整页刷新）。入口名字与地址由站点传入，与
`routes.ts` 声明的地址一致。

### 4 带数据的页面

四格都通过：直接打开 `/demo`、从侧栏和从正文链接两条路**站内导航**进 `/demo`（旧 bug 出在这里；这次 packed 装法下
dev 也无报错层、无整页刷新）、`useFetcher` 提交后页面计数与文件里的 `count` 一起更新。`build/client` 里搜不到
`node:fs`、`demo.server.ts` 里的标记字符串与数据文件名；`react-router typegen` 生成了
`.react-router/types/app/features/demo/+types/demo.ts`，`tsc --noEmit` 通过（转发文件用 `Route.LoaderArgs`）。

实验中撞到、已经改掉的几件事，都是推荐写法的前提：

- **`export { DemoPage as default } from '…'` 不会被包 `withComponentProps`**：React Router 只给
  `export default <表达式或函数>` 包（`@react-router/dev/dist/vite.js` 的 `decorateComponentExportsWithProps`），
  re-export 的组件 props 里没有 `loaderData`，SSR 报 `Cannot read properties of undefined (reading 'count')`
  （`runs/20261014-0941/linked-macro-dev-dev-server.txt`）。功能包的页面组件改用 `useLoaderData()` 取数据，转发文件就能用一行 re-export
- **`.server` 检查在 packed 装法的 dev 下漏检**：React Router 的 `dot-server` 插件拿解析结果整串匹配
  `/\.server(\.[cm]?[jt]sx?)?$/`，而 Vite 在 dev 下给 node_modules 里不预构建的包加 `?v=` 查询，结果是
  `…/demo-pages/dist/site/demo.server.js?v=c41c259c`，匹配不上。反例（页面组件里用 `.server` 模块的东西）：
  build 两种装法都被拦（`Server-only module referenced by client`）；dev 下 linked 被拦，packed 不拦，浏览器直接请求并执行了
  `demo.server.js?v=…`（`runs/inspect-packed-bad-forwarding/module.txt` 是客户端编译后的 import）。站点 vite 插件里加了
  一段 dev 补查（去掉查询再匹配，约 15 行），packed dev 也被拦了。正常写法（`.server` 只在 loader/action 里用）两种装法都没问题，
  因为 React Router 先剥掉 loader/action 再解析 import
- **Tailwind 扫到站点目录里被写的文件就整页刷新**：action 写 `site/data/demo-counter.json` 后，dev 下 SSR
  `program reload`、浏览器整页刷新，SSE 连着的旧模块实例收不到新推送。成因是 `@tailwindcss/vite` 的 `hotUpdate`
  对扫描到的源文件发 `full-reload`（`runs/reload-cause-01-template-app-css/console.txt`）；`app.css` 加
  `@source not '../data';` 后不再刷新（`runs/reload-cause-02-source-not-data/console.txt`）。评论、协作记录这类写进站点目录的数据都要这样排除
- **官方模板的预渲染会收进功能包的路由**：`prerender` 里的 `getStaticPaths()` 包含 `/demo/events`，SSE 不结束，构建报
  `Prerender: Request failed for /demo/events.data: The operation was aborted due to timeout`
  （`runs/20261014-0951/linked-config-start-build.txt`）；把 `/demo` 也预渲染时，构建时文件里是 7、启动前重置为 0，
  直接打开与站内导航都显示 7（`linked-config-prerender-feature-page-start` 段）。推荐写法只预渲染站点自己的静态页与内容页

页面路由里直接 `export { demoEventsLoader as loader } from 'demo-pages/site/server'` 这种不带站点参数的 re-export，
build 两种装法都通过、客户端产物里没有服务端代码（`*-reexport-loader` 段），dev 下没单独验。

### 5 Vite 处理

站点插件用 `vitefu` 1.1.3 的 `crawlFrameworkPkgs`，`isFrameworkPkgByJson` 判断「peerDependencies 里有 `fumadocs-core`
或 `@fumadocs/base-ui`」，没写包名单。识别结果（两种装法相同）：

```text
optimizeDeps.include: demo-content > ms, fumadocs-mdx > esbuild, fumadocs-mdx > github-slugger, …
optimizeDeps.exclude: @fumadocs/base-ui, demo-content, demo-pages, fumadocs-mdx
ssr.noExternal:       @fumadocs/base-ui, demo-content, demo-pages, fumadocs-mdx
ssr.external（只在 dev）: 这些包的非框架依赖
```

挂着插件时四格都没有 `FrameworkProvider` 报错（浏览器控制台与服务日志都查）。不挂插件的对照：

- packed 装法：dev 下 `/docs`、`/demo` 都 500，服务日志 `You need to wrap your application inside FrameworkProvider`
  （功能包被 SSR 外置，由 Node 直接加载，拿到的是另一份 fumadocs-core）；build 在预渲染 `/docs/` 时同样报错失败
- linked 装法：build + start 全过（包的真实路径不在 node_modules，Vite 本来就当源码处理）；dev 下第一次打开时
  `ms`、`unist-util-visit` 等依赖晚发现，Vite 重新预构建并整页刷新（504 Outdated Optimize Dep），水合检查失败，
  没有出现两份 fumadocs

fumadocs-mdx 自己的同类逻辑（`dist/dist-*.js` 的 `crawlFrameworkPkgs`）只认名字以 `fumadocs-` 或 `@fumadocs/` 开头的包，
而且只从根依赖里名字匹配的包往下走，认不到功能包；它给 CommonJS 依赖列出每个导出子路径，vitefu 只列包本身。
两份结果合并后没有冲突（`fumadocs-mdx` 自己也被 vitefu 认成框架包，与它自己的设置一致）。

### 6 推送

`demo-pages/site/server` 的 `demoEventsLoader` 返回 `text/event-stream`，资源路由转发文件一行 re-export。B 页
`useFetcher` 提交触发的推送，A 页的 `EventSource` 在 dev 与 build + start、两种装法下都收到；react-router-serve 的
compression 中间件没有卡住推送。订阅表在 `.server` 模块的模块作用域里，两个路由共用一个模块实例；前提是 dev 下不触发
SSR 模块重载（即上面 Tailwind 那条）。

## 推荐的原生写法

功能包 `template/` 里的转发文件，建站器原样复制到 `app/features/<包>/`：

```ts
// app/features/demo/demo.tsx
import type { Route } from './+types/demo';
import { demoAction, demoLoader } from 'demo-pages/site/server';
import { site } from '@/lib/site.server';

export const loader = (args: Route.LoaderArgs) => demoLoader(args, site);
export const action = (args: Route.ActionArgs) => demoAction(args, site);
export { DemoPage as default } from 'demo-pages/site'; // 组件内用 useLoaderData 取数据

// app/features/demo/events.ts（资源路由，不需要站点参数）
export { demoEventsLoader as loader } from 'demo-pages/site/server';

// app/features/demo/routes.ts
import { relative, type RouteConfig } from '@react-router/dev/routes';
const { route } = relative(import.meta.dirname);
export const demoRoutes = [route('demo', './demo.tsx'), route('demo/events', './events.ts')] satisfies RouteConfig;
```

站点：

```ts
// app/routes.ts：在 * 之前展开
...demoRoutes,

// app/lib/site.server.ts：站点上下文，经参数传给功能包
export const site = { dir: process.cwd() };

// source.config.ts：全站插件在每个集合里再列一次
const siteRemarkPlugins = [remarkMath];
const siteRehypePlugins = [rehypeKatex];
export default defineConfig({ mdxOptions: { remarkPlugins: siteRemarkPlugins, rehypePlugins: siteRehypePlugins } });
export const docs = defineDocs({
  dir: 'content/docs',
  docs: {
    async: true,
    postprocess: { includeProcessedMarkdown: true },
    mdxOptions: applyMdxPreset({
      remarkPlugins: [...siteRemarkPlugins, remarkDemoMark],
      rehypePlugins: (list) => [...siteRehypePlugins, ...list],
    }),
  },
});

// app/lib/source.ts：页面树插件
export const source = loader({
  source: docs.toFumadocsSource(), // docs 来自 .source/server
  baseUrl: '/docs',
  plugins: [demoPageTreePlugin({ name: '演示', url: '/demo' })],
});

// vite.config.ts
plugins: [fumadocsMdx(), tailwindcss(), featurePackages(), reactRouter()]
```

```css
/* app/app.css */
@import 'demo-content/styles.css';
@source not '../data';
```

`featurePackages()` 全文在 `site/feature-packages.vite.ts`（vitefu 识别 + dev 下的 `.server` 补查）；
`react-router.config.ts` 的预渲染只收 `/`、`/llms.txt`、`/llms-full.txt` 与内容页。

## 没验通或存疑

- `.server` 的 dev 补查是站点插件自己加的检查，不是 React Router 的；它只补「解析结果带查询」这一种，别的情况仍靠 React Router
- 页面路由直接 re-export loader 只在 build 下验过
- `demo-content/site` 一个入口同时导出 remark 插件与组件：build 时插件代码被摇掉，但 dev 下浏览器会加载 `unist-util-visit`。
  正式的包宜把构建期插件放到单独的子路径
- 推送的订阅表放在进程内存里，多进程部署要换别的通道；本实验只验了单进程
- 只在 Windows 上跑过；`react-router-serve` 对 `/docs` 回 301 到 `/docs/`（预渲染出的目录），检查里两种路径都接受
