# E-7 重做观察记录（2026-10-11，日志 36–38）

## 写法

- `app/lib/feeds.server.ts`：`import.meta.glob('/feeds/*.json', { eager: true, import: 'default' })`
  包在 `demoFeedMessage()` 里，`.server.ts` 后缀让它不进客户端 bundle（React Router 约定）。
- 只在 `app/routes/docs.tsx` 的 **loader** 里 import 并调用；浏览器端代码（Page/Content 组件）不碰它，
  feed 值经 loaderData 传入。`app/lib/source.ts` 里上次手写的 feeds 删掉。

## 前置修复：上次提交态浏览器端就是坏的（hydration 死）

重做一开始发现计数器点不动、点链接是整页跳转——干净基线（上次提交 28a1332 + 清 Vite 缓存 + 新进程）
同样复现：**E-2 把 `import { probeDep }`/`import { probePin }`（Node-only，node:fs）静态写在
source.ts 顶层，而 source.ts 被浏览器端加载（docs.tsx 客户端 import 它取集合）**——客户端模块图
带进 node:fs，加载失败，**整站 hydration 死**（SSR 正常所以当时没发现；上次 E-2 笔记里
「实测客户端没炸」是错误结论，当时只验了 SSR 200）。

修复试了两条：
1. mdxOptions 改异步函数、插件在函数内动态 import——**不行**：fumadocs-mdx 的宏求值报
   `Vite module runner has been closed`（runs/36、37）。
2. **mdxOptions 挪到全局 `source.config.ts`**（只构建期在 Node 加载，浏览器不解析）——可行。
   插件顺序不变（同一个 applyMdxPreset），E-8 的输出不受影响（改完后 E-8 逐字节比对见 40 号笔记）。
   代价：全局 mdxOptions 作用于所有集合，不能按集合挑插件（15.4.7 下的现实约束）。

修复后（runs/38）：客户端版 source.ts 里 0 处插件引用，hydration 恢复（计数器可点、客户端导航正常）。

## 数据更新行为（feeds.server 写法，日志 38）

| 观察 | 结果 |
| --- | --- |
| 写 feeds/demo.json（第 1 轮，v4） | SSR HTML **292 ms** 出现新值；浏览器里 feed 文字已更新；**计数器保持 3（没归零）**；**window 标记保留（没有整页刷新）** |
| 第 2 轮（v5） | 同样：291 ms 更新，计数器 3、标记保留 |
| dev 日志（同一秒） | `(client) hmr update /app/routes/docs.tsx`——客户端只有 HMR 更新，**没有 page reload**；`(ssr) page reload feeds/demo.json` + program reload——服务端程序重载，对浏览器透明 |

对比上一轮（feeds 写在 source.ts，被浏览器端加载）：同秒 `(client) page reload` + 计数器归零 + 标记丢失。

## 结论

**成立（写法修正后）**：feeds 只在服务端 loader 里读（`.server.ts` ＋ 浏览器端代码不 import）时，
「不进 git 的 feeds/ 文件一变，页面不刷新整页就更新」实现——数据约 290 ms 到页面，
交互状态（计数器、未保存输入）不丢。上轮「不成立」的根因是写法（feeds 挂在了浏览器也加载的 source.ts），
不是机制；K-08 按 server-only 写法实现即可。
附带结论：**集合 mdxOptions 里不能静态 import Node-only 插件**（见上），15.4.7 下站点插件放
source.config.ts（全局）或保证插件模块浏览器可加载。
