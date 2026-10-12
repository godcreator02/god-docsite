# 1.1 浏览器验收过程转录（2026-10-11 21:00–21:10，任务 C 第二轮）

环境：ZCode 内置浏览器（IAB，仅此后端可用，`agent.browsers.list()` 无 cdp/extension）。
站点：任务 B 交付的验证站，`http://127.0.0.1:5460`，dev 服务由本轮启动（启动器 PID 99756，
见 dev-pid.txt；就绪耗时约 9 秒）。验收结束后整树终止并核对端口释放（20261011-C2-postcheck.txt）。

## 环境通道问题（重要，影响 A-3 的证据等级）

本会话的 IAB 里，**真实输入事件通道不可用**，判别过程与证据：

1. `getByRole('button', { name: /计数/ }).click()`（含 `force: true`）：一律超时在 actionability
   等待（"Timeout waiting for locator"）。B 的 handoff 也记录过同类现象（改用坐标点击完成）。
2. `cua.click({x, y})` 与 `dom_cua.click({node_id})`：多数不生效（点击前后计数不变）；偶发生效
   一次（计数 1→2）。按钮 rect 与 `elementFromPoint(中心)` 均正常（命中 BUTTON，无覆盖层）。
3. 根因观察：IAB 窗格初始隐藏（`document.hidden === true`）期间事件不投递、渲染 flush 被挂起
   （一次 dispatchEvent 的 setState 在窗格转为可见后才体现在 DOM）。`visibility.set(true)` 后
   `document.hidden` 变为 false；但坐标点击仍不稳定。
4. 交互最终以**页面内事件派发**（`dispatchEvent(new MouseEvent('click', {bubbles:true}))`、
   受控输入用原生 value setter + `input` 事件）完成：这走的是与真实点击相同的 React 合成事件
   路径（冒泡到根容器），能证明 onClick→setState→渲染 的客户端链路；**不能**等同于真实用户
   输入事件（isTrusted）。真实输入路径的验证见 B 的 result.md（坐标点击 0→1、0→1→2），
   主会话可自行复核。

另一次要现象：页面 reload 后 React hydration 完成前（按钮上尚无 `__reactProps$` 键），
点击一律无效；水合完成后 dispatch 立即生效（毫秒级）。验收序列均在确认 `__reactProps$`
存在后执行。

## A-1 / A-2　四段正文与第二页（浏览器面）

`domSnapshot`（首页）与逐区块 `innerText`（`section[data-probe=…]`）：

| 区块 | 可见正文（压缩空白） | 标记 A-ONLY-NODE-COMPILED |
| --- | --- | --- |
| server-a | A 集合正文：…A 集合自己的 mdxOptions 编译， 末尾应出现编译期 Node 插件附加的标记。 A-ONLY-NODE-COMPILED | 1 处 |
| browser-a | 同上 | 1 处 |
| server-b | B 集合正文：B 集合的 mdxOptions 不挂 Node 插件，末尾不应出现任何标记。 | 0 处 |
| browser-b | 同上 | 0 处 |
| /second 的 second-browser-b | B 集合正文：…（同上） | 0 处 |

浏览器加载的模块清单（`performance.getEntriesByType('resource')`）全部 200：react、react-dom、
react-router、`@vite/client`、HMR runtime、`.source/browser.ts`、两个集合的 MDX 条目
（`content/collection-a/index.mdx?collection=collectionA` 等）。

## A-3　交互序列（全部在 hydration 确认后执行；数字为每次动作后条件轮询读到的实际值）

首页计数（单次派发 → 轮询至预期，超时 6s）：

| 步 | 前 | 后 | 等待 |
| --- | --- | --- | --- |
| 1 | 0 | 1 | 19ms |
| 2 | 1 | 2 | 10ms |
| 3 | 2 | 3 | 13ms |

输入回显：受控输入设值 `acceptance-input-261011` → 「已输入：acceptance-input-261011」出现（14ms）。

客户端导航：点「第二页」→ 250ms 内 `location.pathname === '/second'`、h1=第二页、
second-browser-b 出现（无整页加载，`performance.navigation.type` 仍为 reload 记录）。
第二页本页计数 0→1→2 逐次成立。点「首页」→ 360ms 内回到 `/`，browser-a 含标记恢复。

注：验收过程中有一次操作序列因轮询表达式对 undefined 调 `includes` 抛错中断（工具调用错误，
非站点问题），期间页面状态被一次不完整导航重置；随后以单独观察重做，导航过程 8 次 250ms 采样
全部稳定（见上）。计数序列为重做后的干净记录。

## A-4　console 与错误观察

页面内安装捕获器（拦截 console.error/warn、window.onerror、unhandledrejection；装于
domcontentloaded 后、动作序列前），覆盖：首页计数 0→3、输入、两轮客户端导航、第二页计数。
**捕获 0 条。**

证据缺口（如实记录）：
- IAB 不提供控制台读取 API（browser/tab capabilities 均无），只能靠页面内捕获器；
- 捕获器装于页面加载之后，**加载与 hydration 时刻的 console 消息未捕获**。间接证据：
  全部模块 200、React 采用 SSR DOM 完成挂载（`__reactProps$` 稳定挂于按钮）、hydration
  mismatch 未伴随可见症状、dev 服务日志无错误。
- 真实输入事件通道问题见上节，属环境问题，未作为站点缺陷记录。

## 服务与源码核对

- 启动前：5460/5461 空闲，18 个源文件 SHA256 与主会话 manifest 全一致（20261011-C2-precheck.txt）。
- 验收后：dev 进程树（99756 及 6 个子进程）终止，两端口 free，18 文件哈希 0 差异
  （20261011-C2-postcheck.txt）。
