# 网站包装进项目以后，fumadocs 组件、代码块、讲解组件能不能在浏览器里用

## 问什么

网站包（`packages/collab-site`）引入 fumadocs 的排版组件、prism 代码着色、讲解组件包与 `SvgTex` 之后，按项目的装法（npm 包装进 `site/`、
pnpm 的 `.pnpm` 布局、协作站开发服务的依赖预打包）装进一个站点，页面能不能打开、样式与中文界面文字对不对。只在仓里跑单元测试看不出这些：
单元测试不经过 Vite 的依赖预打包，也不经过 Tailwind 从安装位置扫类名。

## 怎么运行

先在仓根 `pnpm install`，再在网站包里打包：

```
cd packages/collab-site
pnpm build
pnpm pack --out ../../probes/2610101530_fumadocs-components/site/collab-site.tgz
```

然后在 `site/` 里：

```
pnpm install --ignore-workspace
pnpm dev
```

打开 `http://127.0.0.1:4399/demo/components`。`pages/demo/components/page.mdx` 把每个组件都写了一遍，`Demo.tsx` 是讲解组件、
`Code` 的高亮行与 `SvgTex`。看控制台有没有报错，再逐个看：提示框四种颜色、代码着色与复制按钮（文字是「复制」）、写错语言的红框、
标签页、步骤、折叠段落、卡片（不带下划线）、目录树、参数表、分步讲解里的高亮行、SVG 里的公式；在控制台给 `html` 加上 `dark` 类再看一遍。

`.npmrc`、`pnpm-workspace.yaml` 与项目站点相同：发布不满一天的包不装（`@godcreator/*` 除外）。

重新打包后要换一个文件名（或删掉 `node_modules` 与锁文件）再装：同名的本地安装包，pnpm 会沿用上一次解出来的依赖。

## 结果（2026-10-10）

改到第四版才全部正常，前三版各暴露一个只有在这里才看得到的问题：

1. fumadocs 16.17.1 是前一天发的，项目站点按「发布不满一天不装」拒装 → 网站包把 `@fumadocs/base-ui` 与 `fumadocs-core` 写成确切版本 16.16.2
2. 浏览器报 `use-sync-external-store/shim` 没有 `useSyncExternalStore` 导出：网站包被排除在依赖预打包之外，fumadocs 组件底下的 CommonJS 依赖没被转换
   → 开发服务的 `optimizeDeps.include` 逐个列出 fumadocs 组件、`fumadocs-core/framework`、翻译库、prism 与讲解组件包
3. 卡片渲染时报 `Cannot destructure property 'basename'`：fumadocs-core 自带的 react-router 适配被预打包时带进了另一份 react-router
   → 改用 `fumadocs-core/framework` 的 `FrameworkProvider`，链接与路由钩子用网站包自己的 react-router
4. 复制按钮仍是英文：翻译键带两层注记，是 `Copy Text(code block)(aria-label)`。同一版里还看到：组件边框是黑的（Tailwind 的 `border`
   不写颜色是 currentColor，fumadocs 靠自己的基础样式统一成浅灰）、卡片文字带下划线、折叠段落标题上下多出外边距（正文区的默认链接、
   标题样式套到了组件上）→ 正文区里边框默认用分隔线颜色，默认链接样式只给没写类名的链接，标题跳过带 `not-prose` 的

第四版控制台没有报错，以上各项在浅色、深色下都对。
