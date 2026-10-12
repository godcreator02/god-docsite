# 站点重启后，已经打开的页面还收不收得到推送

## 问什么

协作站的开发服务重启以后（端口不变），已经打开的页面能不能重新连上、提示栏会不会回到最新。

## 怎么运行

```
node probe.mjs setup; node probe.mjs start 2
```

先在仓根运行过 `pnpm install` 与网站包的 `pnpm build`（脚本直接用仓里网站包的 `dist/` 和它装的 vite、react）。`setup` 在系统临时目录的
`collab-site-restart-probe/` 下搭一个最小的项目站点，`start 2` 照 gwb-collab 的方式（环境变量交身份与口令）运行开发服务，端口 4391，
起来后马上推一份带 2 条通知的数据。接着：

1. 在浏览器里打开 `http://127.0.0.1:4391/tasks`，在开发者工具的控制台里运行下面这段，以后每一步都再调用 `probe()` 看一次：

   ```js
   window.__marker = '重启前'
   window.probe = () => ({ marker: window.__marker ?? null, visibility: document.visibilityState, origin: performance.timeOrigin, bar: (document.body.innerText.match(/协作仓 \d+ 件事/) || [null])[0], status: document.querySelector('[role=status]')?.textContent ?? null })
   ```

   `marker` 变成 null、`origin` 变了，就是整页重新加载过（重新加载后要重新粘贴这段）。
2. 把这个页面切到后台（最小化窗口、或切到别的标签页），运行 `node probe.mjs restart 3`：停掉开发服务、重新运行、起来后推 3 条。
   回到页面后马上 `probe()`；也可以让页面一直留在后台，用 Claude in Chrome 一类工具在页面里运行 `probe()`
3. 页面在前台时再 `node probe.mjs restart 4`，看 `probe()`
4. `node probe.mjs push 5` 不重启只推，看推送是否照常收到；做完 `node probe.mjs kill`

在后台的页面也可以不切窗口，在控制台里伪装成在前台：
`Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' }); document.dispatchEvent(new Event('visibilitychange'))`。

## 结论

Vite 8.3.0 的客户端断开后不在原页面上重连：在前台时每秒试连一次开发服务（子协议 `vite-ping`），连上就整页重新加载；
在后台时等到回到前台才开始试连。所以后台页面在开发服务重启后一直停在断开前，期间推来的全部收不到——`runs/01-before-fix.txt` 里
重启后推了 3 条，页面停在 2 条，直到伪装成前台才重新加载、显示 3 条。前台页面 2 秒内自动重新加载并显示最新（推 4 条，显示 4 条）。
重新加载后的页面取启动数据时，开发服务里已经是插件刚推来的那一份（`start` 后立刻 GET `/__collab/state`，`feed` 就是最新的）。
修改后（`runs/02-after-fix.txt`）：后台页面断开后提示栏换成断开提示，回到前台重新加载后显示最新，之后的推送照常收到。

## 运行那次的环境

2026-10-08，Windows 11 Pro 10.0.26200，Node 24.14.1，Chrome（Claude in Chrome 打开的后台标签页，`visibilityState` 一直是 hidden），
vite 8.3.0。被测代码：修改前是提交 05b9965，修改后是工作区里 `packages/collab-site/src/site-ui/page-data.ts` 那次改动（与这个目录同一个提交）。
