# Vite + React 样板：每页一个 TSX 组件

## 问什么

协作站改用 Vite + React Router 做底座、每一页就是 `pages/` 下的一个 React 组件，外观借 fumadocs-ui，批注与任务存在页面旁边的 `.collab.json`：这样能不能把现有的两份 HTML 页面放进来、交互照常、站内跳转不残留，并且在网页上批注能写回 JSON、带上源码位置。

## 怎么跑

```powershell
cd site; pnpm install; pnpm dev
```

打开 `http://127.0.0.1:4398`。生产构建：`pnpm build`（先 `tsc --noEmit` 再 `vite build`）。

目录：`site/collab/` 是框架部分（以后拆成 npm 包的那一块），通过别名 `@collab` 引用；`site/pages/` 是内容，`index.tsx`、`tasks.tsx` 与 `sst/` 下两页，每页旁边同名的 `.collab.json` 存批注和任务，`_folder.json` 给侧栏里的目录起名。`sst/comm-test.tsx` 与 `sst/control-plan.tsx` 由 AI 从 `SST 总控通信实验.html`、`SST控制系统开发计划-批注.html` 改写而来。
`sst/` 下这两页是真实项目的内容，仓根 `.gitignore` 忽略它们、不进公开仓，只在原来做实验的那台电脑上有；没有它们就复现不了 `runs/02-browser-checks.txt` 里这两页的检查。

## 结论

可行。`runs/01-build.txt` 类型检查加生产构建通过（vite 构建 1.05 秒）；`runs/02-browser-checks.txt` 里各项都成立：

- 两份 HTML 改写成 TSX 后内容完整，页面样式写在页内 `<style>` 里并全部限定在 `.pg-<页名>` 之下，离开页面后这段样式随组件一起移除，不会留在别的页。
- 3D 视图的 three.js 代码放进 `useEffect`，在 3D 页和任务页之间来回跳三轮，每轮在 3D 页排队的动画帧请求是 1 个、离开后是 0 个，画布也随之移除，没有累积。
- code-inspector-plugin 在开发时给每个元素加上 `data-insp-path="文件:行:列:标签"`，开发计划页上有 341 个。
- 在网页上点「添加批注」、点元素、填写后保存，开发服务的接口把批注写进 `control-plan.collab.json`，带着被点元素的文字、标签和源码位置，页面随即更新。原 HTML 里的「批注 1」按文字定位也能对上原位置。

改写的工作量（按两个子代理的回报）：开发计划页 `class` 改 `className` 约 180 处、`style` 改对象 23 处；通信实验页约 165 处与 19 处，另有 SVG 属性改驼峰约 33 处、`colspan` 5 处。3D 部分为新版 three 调整了光照强度（乘 π）和贴图颜色空间。

路上撞到的：

- 照 fumadocs 文档把它排除在 Vite 依赖预打包之外，浏览器端报 `use-sync-external-store` 没有 `useSyncExternalStore` 导出。那条文档针对的是带服务端渲染的 React Router；纯浏览器端应用去掉排除即可。
- 批注层每次渲染新建「可见批注」数组，触发重新测量又触发渲染，死循环；用 `useMemo` 缓存。
- 子代理写的 3D 代码里，嵌套的函数声明会被提升，TypeScript 不把外面的非空判断带进去；改成判断后赋给类型不为空的常量。

没做到的：3D 画面没有截图（检查时浏览器面板处于隐藏状态）；所有页面和 three.js 打进了一个 1.1 MB 的文件，没有按页面拆分；框架部分还没拆成 npm 包；Claude Code 自己的网页批注功能没有试。

## 跑那次的环境

2026-09-25，Windows 11 Pro 10.0.26200，Node v24.14.1，pnpm 12.4.2。vite 8.3.0，@vitejs/plugin-react 6.1.1，react 19.3.0，react-router 8.4.0，fumadocs-ui 为 `@fumadocs/base-ui` 16.15.1，fumadocs-core 16.15.1，three 0.186.0，code-inspector-plugin 2.0.9，tailwindcss 4.3.3，TypeScript 6.0.3。被测对象就是本目录的 `site/`，仓的提交是 `a4b2b34` 之后的工作区。
