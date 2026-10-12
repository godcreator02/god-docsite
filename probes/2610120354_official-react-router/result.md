# 结果：原样官方 React Router 模板的 dev 新增正文验证

2026-10-12。来源提交 d6cfc48d62aa9ea413f0fc5033617c0c923681ec，接线与差异见 `official-source.md`。
只记录实际观察；未验证的场景明确标注，没有一处写「全部通过」。

## 1. 模板启动

成功。命令 `react-router dev --port 5530 --host 127.0.0.1`（在 `site/` 内），启动即就绪，
`GET /docs` HTTP 200，服务日志仅 6 行（启动 + 首次访问时的依赖预打包 `cn, lucide-react`），无错误。

官方基线页 `/docs` 渲染完整（无障碍树取证）：侧栏（Hello World / Test）、正文（标题、卡片、
代码块、表格）、TOC、Copy Markdown / Open 按钮全部在位。

hydrate 证据（组合探针，非 console 逐条）：

- SSR：页面内 `fetch('/docs')` 的 HTML（32,342 字节）含完整正文文本
- 客户端 DOM 保留 6 个注释节点（SSR HTML 含 3 个 `<!--$` React 注释）——无整树客户端重渲染的痕迹
- 无 `vite-error-overlay`
- 后续受控输入真实键入成功（见第 6 节），React 事件与状态链路在线

**console 缺口（保留给主会话）**：ZCode 内嵌浏览器无 console 流能力，页面加载期的逐条 console
（含可能的 hydration 提示）取不到。页面内收集器（重写 console 方法）只覆盖安装之后的消息：
安装后全程仅 3 条 `[RUM] ArmsEventBridge is not available` 警告（内嵌浏览器环境自身注入，与站点无关），
无任何 vite/HMR/React 错误消息。首轮观察中 vite 没有输出任何 `[vite] hmr update` 类消息。

## 2. 新增发现（dev 运行中，核心观察）

同一 dev 进程运行中，向 `content/docs/` 依次写入（先依赖后 MDX，排除半文件）：
`baseline-widget.tsx`（useState 计数器 + 受控/非受控输入）、`baseline-figure.svg`、
`public/probe-photo.png`、最后 `baseline.mdx`（集合 dir 就是官方 `defineDocs` 的 `content/docs`，
MDX 内相对 import TSX 与 SVG）。观察（不刷新、不重启、不动配置）：

- **已打开的 `/docs` 页面导航 30.7 秒 / 37 次轮询内未出现 Baseline 链接**；页面 console 收集器
  无任何 vite/HMR 消息（无 `[vite] (x) hmr update`、无 full-reload）
- **服务端也不认识新页**：页面内 `fetch('/docs/baseline')` 全程 **HTTP 404**；延长观察窗口
  95 秒 / 19 次轮询仍全部 404（合计从写入起约 2 分钟以上）
- `fetch('/docs')` 返回的索引 HTML 不含 `/docs/baseline` 链接
- dev 服务日志在写入前后**没有任何新行**（无编译、无报错、无 watcher 输出）
- 模板原样哈希此时保持一致（见第 8 节），即未改任何官方文件也未动配置

事实口径：console 里没有 HMR 日志、服务端持续 404 是直接观察；「watcher 是否收到事件、
卡在哪一层」本轮未排查、不定责任层（fumadocs-mdx 的 vite 插件在 `dist/vite/index.js:130-131`
挂了 `server.watcher.on('change'/'add')`，仅作为代码事实记录）。

## 3. 重启对照（明确标记，不计作运行中新增通过）

为排除 MDX/TSX 路径写错，停服务后用**同一条命令**重启（`logs/dev-server-restart.log`）：

- `GET /docs/baseline` → **HTTP 200**
- `GET /docs` 索引 HTML 含 `/docs/baseline` 链接，侧栏出现 Baseline Probe
- 页面完整渲染：标题、widget、两张图片（见第 6 节）

结论：新增文件本身合法、启动扫描能发现；差别只在「dev 运行中新增」这一路径。

## 4. 客户端导航到新页

**未验证**。运行中新增从未被发现，不存在可导航的新页；重启对照后本打算点击侧栏进入，
但鼠标点击通道失效（见第 9 节），改用直接打开 URL（第 5 节）。

## 5. 直开新 URL

- 运行中新增后（未重启时）：`fetch('/docs/baseline')` = 404（多次）
- 重启对照后：浏览器**直接导航** `http://127.0.0.1:5530/docs/baseline` 成功，
  title `Baseline Probe`、h1 与侧栏链接正常

## 6. 新 TSX 交互与图片（重启对照页上）

- 受控输入：真实键盘键入 `kbd-test` → value 与 mirror 同步更新（React onChange → state → 渲染链路真实走通）
- 非受控输入（defaultValue `seed`）：真实键盘键入，值变为 `typed-liveseed`（Ctrl+A 组合键未生效，
  追加在 seed 后），mirror 同步显示——onChange 链路真实走通
- 计数按钮：**无法激活**。playwright 定位点击（locator 3 种构造）、CUA 坐标点击、dom_cua 节点点击、
  focus+Enter 键盘激活全部未触发 onClick（count 恒为 0，且对照的官方侧栏链接同样点不动——
  是工具交互通道问题，不是页面问题）。**计数器交互标为未验证**
- 图片：相对路径 SVG（vite 处理为内联 data URI，naturalWidth 160）与 `/probe-photo.png`
  （naturalWidth 80）均加载成功
- 交互全程 console 收集器无 error/warn

## 7. 原 TSX 状态保留（新增另一篇时）

**未验证**。计划中的第二篇 MDX（流程 3）因第一篇在运行中就不被发现而未进行；
没有可观察「已有页组件状态是否保留」的时机。

## 8. 编辑 TSX 的原生 HMR

**未验证**（未进行，按限时收尾指示跳过）。

## 9. 工具通道缺口（主会话可补）

- 鼠标点击：合成点击事件未到达页面——官方模板自带的侧栏链接、计数按钮同样点不动；
  与页面无关（同一页面上键盘输入有效）
- 键盘：`cua.type` 打字有效；Ctrl+A 组合、按钮上 Enter 未生效
- console：无逐条流能力（加载期消息缺失，见第 1 节）

## 10. 模板原样性

实验结束时 `site/` 对 `official-snapshot/` 的 25 个官方文件逐一 SHA256 比对：
仅 `package.json`（三处依赖适配）不同；新增文件 4 个测试内容 +
`.react-router/types/*`（react-router dev 自动生成物）。

## 11. 归因分析（应用户询问补做：fumadocs 还是 vite）

在原样模板上补做两个只读实验与源码走读（未改任何官方文件；探针改动已还原；日志 `logs/dev-server-attrib.log`）。

**判别实验（2026-10-12 10:21，同版本组合）**：重启 dev 后修改已存在的
`baseline.mdx`（加一行标记文本），服务端 HTML **第一次轮询（<2.5 秒）就反映了新内容**，
dev 日志出现完整事件链：`[vite] (client) hmr update /app/routes/docs.tsx` →
`[vite] (ssr) page reload content/docs/baseline.mdx` → `[vite] (ssr) program reload`。
与上一轮新增文件时「零日志、持续 404」形成精确对照：**watcher 与失效链对 change 完整工作，
断点只在新增文件（add）路径**。

**源码走读（site/node_modules/fumadocs-mdx@15.4.7，安装态即为该提交产物）**：

1. `app/lib/source.ts` 的 `defineDocs`（Macro API）在 dev 下不落任何生成文件
   （`.source/` 不存在；`buildStart` 只在 forcedConfig / 存在 `source.config.ts` 时写盘）。
   集合枚举代码由 macro 转换生成，Vite 环境下就是 **vite 原生
   `import.meta.glob(['**/*.{mdx,md}'], { base: <content/docs>, query: … })`**
   （`dist/transform-YLS_tnU6.js:268-316` → `dist/codegen-CNSKFlLn.js:26-37`）
2. fumadocs-mdx 自己对 content 文件事件**有意不做处理**：
   `dist/vite/index.js:125-131` 的 `change/add` 监听只处理 `source.config.ts` 本身
   （Macro 模板没有该文件）；`dist/index-file-Dxxx3V3H.js:76-89` 的 `server.watcher.on("all")`
   在 `target === "vite"` 且集合非 dynamic 时对所有 content 文件事件直接 `return`
   （该路径只服务于 Node 适配器等需要写盘重新生成的场景）
3. 因此「dev 运行中新增 MDX 被发现」**完全依赖 vite 的 `import.meta.glob`
   对文件增删的动态失效**；fumadocs 没有提供第二条路径

**结论**：失效的环节在 **vite 侧**——`import.meta.glob` 的官方语义支持 dev 下文件增删自动更新，
实测 vite 8.3.4 + React Router 8.4.0（SSR dev）组合里 change 路径完整工作而 add 路径
没有任何失效迹象。fumadocs 的责任形态是「把新增文件的发现整体委托给 vite 的这个机制、
自己不做兜底」，而不是「自己的监听代码坏了」。

**未定层（留主会话，需打点才能区分）**：vite watcher 是否发出了 `add` 事件
（chokidar/文件系统层），或事件已到 vite 但 `import.meta.glob` 的失效逻辑未处理
（glob 注册/SSR environment 层）。两者都在 vite 侧；未做打点，不预断。

**顺带的官方文档对照**：vite 官方 Glob Import 文档写明 dev 下 glob 支持文件增删自动更新；
未搜到与「新增文件不被发现」精确匹配的 fumadocs 或 vite 已知 issue（搜到的相邻问题：
vite 8 glob 对含括号目录的 dev/build 差异、非 JS 资产需走 `assets` 选项、容器环境 watcher 失效）。

## 12. 裸 Vite 对照实验（bare-vite/，应用户要求：vite + react，无 RR / fumadocs）

版本：vite 8.3.4、react/react-dom 19.3.0、@vitejs/plugin-react 2.2.0，端口 5531，
日志 `logs/bare-vite-dev.log`。一个页面同时用两种 glob 写法枚举 `src/pages/`：
标准相对写法 `import.meta.glob('./pages/*.jsx')` 与带 base 写法
`import.meta.glob(['**/*.jsx'], { base: … })`（贴近 fumadocs 生成物形态）。

**结果 1（核心）：裸 vite 的新增文件失效链完整工作**。dev 运行中新增 `src/pages/b.jsx`：

- 服务端编译产物（`fetch /src/main.jsx`，带 no-store）：首次轮询（约 12 秒内）就包含
  `"./pages/b.jsx"`；vite 日志出现 `hmr update /src/main.jsx` → `hmr invalidate` → `page reload`
- **浏览器页面在未刷新的情况下自动更新**（timeOrigin 不变，standard 列表从
  `['./pages/a.jsx']` 变 `['./pages/a.jsx', './pages/b.jsx']`）——顺带证明本内嵌浏览器的
  HMR websocket 通道是通的（此前对 5530 页面「无 HMR 消息」的观察不受浏览器通道影响，
  因为 5530 场景连服务端 fetch 都是 404）
- 修改已存在 `a.jsx`（change 对照）：首次轮询（<2.5 秒）即反映

对照第 2/11 节：同一台机器、同一写入方式，官方模板场景（RR+fumadocs）新增 MDX 是
**零日志、服务端持续 404**。**「vite 在这台机器上 add 失效全局坏了」被本实验排除**；
断点收窄到官方模板场景特有因素（React Router dev 的 SSR environment / fumadocs-mdx
宏转换模块里的 glob / 其 glob 形态），归因结论见下节更新。

**结果 2（独立发现）：vite 8.3.4 的 `import.meta.glob` `base` 参数被无视**。
`base: './pages'` 与 `base: '/src/pages'` 两种写法的实际枚举结果完全相同，且都不是
`src/pages/`——编译产物把工作目录全域的 `**/*.jsx` 全部枚举进来（`D:/unitfolders` 下
相邻项目与旧 probe 的 jsx，key 为 7 层 `../` 相对路径），仅按期望 base 计算 key。
fumadocs-mdx 生成物恰好使用相对 base 形态；在官方 site 里因 `**/*.{mdx,md}` 全域匹配
恰好覆盖 `content/docs`，启动枚举结果碰巧正确，但该 bug 与「新增文件失效」之间的
因果未验证，不下结论。另：bare-vite 启动时 vite 依赖扫描报过一次
`TSCONFIG_ERROR: Failed to load tsconfig 'tsconfig/base.json'`（祖先目录里 site 的
tsconfig extends 了不存在的路径），未阻塞运行，仅记录。

**归因结论更新（覆盖第 11 节的初判）**：第 11 节判断「断点在 vite 侧的 import.meta.glob
add 失效」不再准确——裸 vite 下该机制工作正常。更新后的边界：

- vite 8.3.4 基础机制（watcher add 事件、glob importer 失效、HMR 推送）：正常
- vite 8.3.4 glob 的 `base` 参数：有独立 bug（枚举目录错误），与本问题的因果未验证
- React Router 8.4.0 dev（SSR environment）× fumadocs-mdx 15.4.7（宏转换模块中的
  base 形态 glob）组合：新增文件不触发任何失效（零日志、404）；change 正常
- 未定层：RR 的 SSR environment 与 fumadocs 转换模块两个因素未分离（需
  「RR 裸站 + glob」或「fumadocs 非 SSR」实验，本轮未做）

## 13. React Router 裸站对照实验（rr-vite-glob/：RR SSR + glob，无 fumadocs）

把变量逐步加回，定位第 12 节留下的未定层。RR 8.4.0（react-router/@react-router/dev）、
vite 8.3.4、react 19.3.0、`ssr: true`，端口 5531；一个路由组件里放 glob 列表，
日志 `logs/rr-vite-glob-dev.log` 与 `logs/rr-vite-glob-restart.log`。

**结果 1：RR SSR 裸站的标准/base jsx glob 的 add 失效正常**。运行中新增 `app/pages/b.jsx`：
SSR HTML（curl 直取，服务端视角）约 9 秒内包含 `b.jsx`；vite 日志出现
`(ssr) page reload app/pages/b.jsx`。React Router dev 的 SSR environment 本身不是致因。

**结果 2：fumadocs 生成物形态的 glob 让 RR SSR 的运行中失效路径卡死**。给同一组件加
第三种 glob——`import.meta.glob(['**/*.{mdx,md}'], { base: '../content', query: { collection: 'docs' } })`
（fumadocs-mdx 生成物的形态，但没有任何 fumadocs 插件与宏转换）：

- 冷启动：SSR 200，三种列表全部正确渲染——该形态本身可正常工作
- 保存该模块（change 触发失效重取）后：SSR 请求持续 500，日志反复
  `Internal server error: transport invoke timed out after 60000ms`（`fetchModule
  /app/routes/_index.tsx`，server-build 链）——**含该形态 glob 的模块在运行中失效时，
  vite 8.3.4 的 SSR 模块重取死等超时**；重启即恢复
- 对照官方模板（真 fumadocs）：同形态 glob 在宏转换模块里，新增 MDX 的表现是
  「静默不失效」（零日志、404）而非卡死——表现不同，但都落在「fumadocs 形态 glob ×
  运行中失效」这一域内；两者差异的成分（宏转换管线 / query 细节 / importer 位置）未再细分

**变量阶梯总结**（同一台机器、同一写入方式）：

| 场景 | 新增文件（add）失效 | 证据 |
| --- | --- | --- |
| 裸 vite（纯客户端） | 正常 | 产物含新文件 + 页面自动更新 + hmr 日志 |
| RR 8.4.0 SSR 裸站，标准/base jsx glob | 正常 | SSR HTML 更新 + `(ssr) page reload` 日志 |
| RR SSR + fumadocs 形态 glob（无 fumadocs 包） | 模块失效重取卡死（60s transport 超时）；冷启动正常 | 500 + timed out 日志 |
| 官方模板（RR SSR + fumadocs 宏转换，同形态 glob） | 静默不失效（零日志、404）；change 正常 | 第 2/11 节 |

**带到 fumadocs / vite 的方式**：

1. **给 vite 报**：两个独立问题——glob `base` 参数被无视（枚举全域，编译产物可证）；
   SSR 环境下含 `**/*.{mdx,md}` + base + query 形态 glob 的模块在运行中失效时
   `fetchModule` 死等 60s（rr-vite-glob 站即最小复现，无任何 fumadocs 依赖）
2. **给 fumadocs 报**：官方 React Router 模板 dev 下新增 MDX 不被发现（重启对照可复现）；
   fumadocs-mdx 的 vite target 把文件增删发现完全委托给 vite glob 失效
   （`index-file` 插件对 vite target 非 dynamic 集合显式跳过），在上述 vite 行为下
   该委托不成立。fix 方向：index-file 已监听 `server.watcher.on("all")`，可对
   「匹配集合目录的 add/unlink」自己做失效/重生成，不依赖 vite glob 的 add 失效
3. **短期 workaround（我们自己的站）**：dev 中新增/删除正文文件后重启 dev 服务
   （本 probe 已多次验证重启即识别）；变更已有文件则无需处理（change 一直正常）

## 14. 不重启的 workaround（应用户要求验证：能不能不重启 dev 生效）

在官方站（未改任何官方文件、未改配置）上实测，日志 `logs/dev-server-wa.log`。

**W1（已验证有效、可重复）：touch `app/lib/source.ts`。** 流程与证据：

1. 运行中新增 `content/docs/wa2.mdx` → `GET /docs/wa2` **404**（复现基线；`wa1.mdx`
   是在服务启动完成前写入的，被启动扫描直接收进，不作失效证据）
2. 对 `app/lib/source.ts` 做一次**字节级原样重写**（ReadAllBytes → WriteAllBytes，
   内容零变化，仅触发文件 change 事件）→ vite 日志
   `(ssr) page reload app/lib/source.ts` + `program reload`，**约 3 秒后
   `GET /docs/wa2` 变 200**
3. 可重复性：新增 `wa3.mdx` → 404 → 再次 touch → 200；且 `/docs` 索引 HTML 同时
   含 wa1/wa2/wa3（pageTree 一并更新），全程无 60s 卡死（官方站的 source.ts
   失效重取链健康，与 rr-vite-glob 站路由模块的卡死不同链路）

原理：宏转换注入的 `import.meta.glob` 在 `app/lib/source.ts` 模块里；该模块自身的
change 走 vite 常规失效路径（此路径一直正常），重编译时 glob 重新枚举即收进新文件。
人的操作形态：dev 中新增/删除 MDX 后，在编辑器里对 `app/lib/source.ts` 随手保存一次
（哪怕没有改动）即可，无需重启 dev、无需改配置。

**未验证/放弃的候选**：

- W2（fumadocs 配置 `defineDocs` 加 `dynamic: true`）：源码上会让 index-file 的
  watcher 对 add 事件不再跳过，但 dynamic 集合改变正文加载形态（运行时枚举 + 内联
  hash），副作用大，W1 已足够，未测
- W3（`fumadocsMdx({ index: { target: 'default' } })`）：该分支的 regenerate 只写
  `.source/` 生成文件，Macro 模式运行时不读它们，推断无效，未测
- 删除文件场景（touch 是否同样让 pageTree 移除页面）：未测

## 15. 自动化 workaround（应用户要求：把第 14 节的手动 touch 自动化）

在 `site/vite.config.ts` 里加了一个实验插件 `probe-revalidate-source-on-content-change`
（约 15 行，**这是对官方模板文件的改动**，原样性说明见第 10 节更新）：监听
`server.watcher` 的 `add`/`unlink`，文件路径命中 `content/docs/` 时自动对
`app/lib/source.ts` 做一次原样重写（带 250ms 节流）——即第 14 节手动 touch 的机器版，
走同一条已验证的 change 失效路径，不依赖 vite 内部 API。

**实测（日志 `logs/dev-server-auto.log`）**：装插件重启一次后，dev 运行中新增
`wa4.mdx`、`wa5.mdx` 两轮，全程零手动动作：

- `GET /docs/wa4` 首次轮询（约 2 秒内）即 200；`wa5` 同样自动 200
- 日志链条：新增文件 → `(ssr) page reload app/lib/source.ts` → `program reload`
- `/docs` 索引含 wa1–wa5 与原有 Baseline Probe，pageTree 同步

一次性成本：装插件改 vite.config.ts 需要一次重启（本轮为显式重启；vite 也会因
配置文件变化自动重启）。装好之后新增/删除正文文件全自动生效，无需任何人操作。
删除文件（unlink）已由同一插件处理但未单独实测。

**第 10 节原样性更新**：自本节起 `site/vite.config.ts` 相对官方快照多了该实验插件
（第 1–11 节的所有原样结论均在插件加入之前取得）；其余官方文件仍与快照一致。

**精确时延（logs/dev-server-timing.log）**：写入 `wa6.mdx` 后立即发起的请求即返回 200，
写文件到新页可用的端到端时延约 **106ms**（含新 MDX 按需编译与 pageTree 更新），体感即时。
浏览器中已打开页面的自动更新（导航栏出现新页）未在浏览器侧单独实测；服务端数据与
索引确认即时更新。

**与评论的关系**：本插件只处理 `content/docs/` 下正文文件的新增/删除。docsite-kit 的评论
走独立机制——评论写在站点根 `comments/` 目录（`src/server/comments.ts:345`：「只改 comments/
里的文件……开发服务看到文件变了自己刷新页面」），页面上手动发评论是表单 POST 到
`api/comments` 的 action，action 完成后路由自动 revalidate loader，评论列表随请求-响应闭环
更新，不依赖也不经过本插件；agent 直接写评论文件的场景由 docsite-kit 的开发服务插件负责。

## 16. 干净模板 + 插件验证（clean-fumadocs/，应用户要求）

从 `official-snapshot/` 原样复制的新站，与快照逐一 SHA256 对照：**只有两处差异**——
`package.json`（第 1 节的三处依赖适配）与 `vite.config.ts`（加上第 15 节的插件），
无任何其他预置测试内容（启动时侧栏仅官方 `/docs` 与 `/docs/test` 两个链接）。
日志 `logs/clean-fumadocs-dev.log`。

dev 运行中（5530）依次新增 `clean-new-1.mdx`、`clean-new-2.mdx`，全程零手动动作：

| 观察 | clean-new-1 | clean-new-2 |
| --- | --- | --- |
| 写入到新页 200 | **161 ms** | **163 ms** |
| 新页正文真实渲染（HTML 含正文文本） | 是 | — |
| `/docs` 侧栏同步 | 是 | 是（/docs、clean-new-1、clean-new-2、test） |
| vite 日志 | `(ssr) page reload app/lib/source.ts` + `program reload` | 同 |

结论：在没有任何历史测试内容的原样官方模板上，插件的效果与第 15 节一致——
dev 运行中新增正文页约 0.16 秒自动可访问，可重复。








## 时间线（本地时刻，来自日志与 performance.timeOrigin）

| 时刻 | 事件 |
| --- | --- |
| 04:05:16 | dev 首次启动就绪（5530） |
| ~04:06:01 | 浏览器首开 `/docs`（timeOrigin 1791749161079），渲染/探针取证 |
| ~04:08 | 写入基线页 4 文件（先 TSX/SVG/PNG，后 MDX） |
| 写入后 30.7s | 37 次轮询：导航未出现，console 无 HMR 消息 |
| 写入后 ~2min | 19 次轮询：`/docs/baseline` 全程 404 |
| 04:13:27 | dev 重启（同命令） |
| 重启后数秒 | `/docs/baseline` 200，索引含链接（timeOrigin 1791749628720） |
| 之后 | 直开新页、输入交互与图片验证 |
| 收尾 | 服务停止，5530 无监听 |
