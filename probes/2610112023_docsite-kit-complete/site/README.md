# 1.1 基础验证站（含 K 轮身份/评论接入）

docsite-kit 完整功能验证站：第一段（1.1）做 A/B 两个命名集合、正文与基础交互的接线；
K 轮在站上接入拆出来的身份包 `@godcreator/docsite-identity` 与评论包 `@godcreator/docsite-comments`。
不包含布局、搜索、feeds 等后续功能。

## 复跑（从干净 checkout 开始的完整顺序）

```pwsh
# 1. 仓根装依赖（link: 包的 node_modules 在这里建）并在干净服务停着的状态下构建两个 link 包
#    （先停服务再 build：包 build 会先删 dist，dev 正在跑时会踩到短暂的模块加载失败）
cd D:\unitfolders\oz47p-docsite-kit\docsite-kit
pnpm install
pnpm --filter @godcreator/docsite-identity build
pnpm --filter @godcreator/docsite-comments build

# 2. 本站自己的依赖（独立 workspace；link 包没有 dist 时这一步装得上但站起不来，所以顺序不能倒）
cd probes\2610112023_docsite-kit-complete\site
pnpm install

# 3. 启动（端口真实传给 react-router dev，--strictPort；带身份的站只监听 127.0.0.1）
pwsh -File ../package-split/integration/start-site.ps1 start identity 5460
# 只读启动（不带身份码）：
pwsh -File ../package-split/integration/start-site.ps1 start readonly 5461
# 停止（先核对记录的 PID 还是本脚本启动的实例，再杀整棵进程树）：
pwsh -File ../package-split/integration/start-site.ps1 stop
```

身份码是编造的验收码（people.json 里 zk 的 `k8v1r2w3x4`），只在这个脚本启动的子进程里生效。

类型检查：`pnpm types:check`（先 `react-router typegen` 生成 `.react-router/types`，
再 `tsc --noEmit`；两者都要求 `.source/` 已由 dev 首次启动生成）。

## 页面

- `/`、`/second`：1.1 的 A/B Config API、Node 插件隔离与交互基线，未动。
- `/comments-demo`：评论示例页。选中文字批注、折叠块定位、批代码块元素、右侧栏，
  顶部导航里显示当前身份（IdentityBadge）。
- `/comments`：全部评论页（筛选、和我有关、点回页面）。
- `/api/comments`：评论 HTTP 入口（action 走 `commentRequestResponse`，谁在操作由身份包
  `authorizeWrite` 核对 Origin 与 as）。

## 接线要点（1.1 部分）

- `source.config.ts` 用 `fumadocs-mdx/config` 的 `defineDocs` 定义命名集合
  `collectionA` / `collectionB`，各自设置 `docs.mdxOptions`；
  A 挂 `app/lib/node-marker-remark.ts`（node:fs 真实读文件、给正文追加
  `A-ONLY-NODE-COMPILED` 标记），B 的 remark 插件为空数组。
- 生成的 `.source/server` 只被 `app/lib/collections.server.ts`（`.server.ts` 后缀）
  引用，仅在路由 loader 里调用，输出 server-a / server-b 两段正文。
- 生成的 `.source/browser` 在路由组件里经 `createClientLoader` + `useContent`
  加载两集合正文（browser-a / browser-b 两段），浏览器不加载 Node 插件模块。
- `pnpm-workspace.yaml` 隔离 docsite-kit 仓根 workspace；
  Vite `cacheDir` 指向本目录 `.probe-vite-cache`。
- 首页 `/`：四段正文 + 计数按钮 + 输入框；`/second`：B 集合正文 + 本页计数。

## 接线要点（身份/评论部分）

- **依赖**：两个包经 `link:` 链进本站（本站是独立 workspace，不能用 `workspace:*`）。
  Vite `resolve.dedupe` 强制包里的 react 从本站解析，避免两份 React 实例。
- **集合**：`collectionDemo`（评论示例页正文）与 `comments`（评论集合，schema 用
  `commentFrontmatterSchema`）。评论正文是真正的 MDX 组件：`app/lib/comment-body.tsx`
  经 `.source/browser` 的 raw 按需加载（promise 按路径缓存——`use()` 要求每次渲染
  拿到同一个 promise）。
- **人员与身份**：`people.json` 只给本站用；loader 只把 `publicPeopleOf` 投影后的人员
  与 `siteIdentity()` 的公开结果传给浏览器（页面里搜不到身份码，已验）。
- **评论集合的 Windows glob 适配**：fumadocs-mdx 为 comments 集合生成的 glob 用相对 base
  （`./../comments`），本机 Vite 8.3.4 在 Windows 上对相对 base 的监听匹配有缺陷
  （posix.resolve 混入盘符路径），评论文件增删反映不到集合数据。`vite.config.ts` 里的
  `commentsGlobRootBase` 插件（源码 `app/lib/comments-glob-root-base.ts`）在 transform 时把
  这两个生成文件中 comments 集合的 base 换成根相对 `/comments`（走 root join 分支），
  增删即时反映、无需任何触碰配置的动作（api 里曾经的 utimes 补丁已移除——那是放大器不是修复）。
  适配范围仅 comments 集合；fumadocs-mdx 升级若改生成格式，`test/comments-api.e2e.test.ts`
  会红（它是这个适配的第一道报警）。评论包本身不依赖 Vite/Router。
- **评论增删的端到端测试**：`test/comments-api.e2e.test.ts` 起真实开发服务（5462），
  经 HTTP 新建→回复→删回复→删整串，断言 SSR 集合数据自动跟上、source.config.ts 未被碰、
  开发服务日志没有对已删评论模块的报错。运行（在站目录）：
  `..\..\packages\docsite-kit\node_modules\.bin\vitest.ps1 run --config test/vitest.config.mjs`
  （vitest 用仓里已有版本，本站不新增依赖；测试目录不进 typecheck，由运行时验证。）
- **样式**：`app.css` 引入 `tailwindcss` 与两个包的 `styles.css`。评论包的颜色用包自己的
  `--docsite-comments-*` tokens（不依赖 fumadocs 主题）；身份组件的样式完全在包自己的
  CSS 里。本站另给了 `.demo-doc` 正文排版（这站没有 fumadocs-ui）。

## 已知边界

- 批注模式开着时，从侧栏找回「收起内容里的评论」会被批注模式的点击拦截挡住
  （它在正文上 capture 所有点击）；退出批注模式（Esc）后正常。旧实现固有的行为。
- 评论区删除的确认是页内确认条（K 轮按用户要求改的）。
- 站里没有 favicon，浏览器请求 `/favicon.ico` 得到 404；
  `react-router dev` 首次启动会把 `isbot` 自动写进 `package.json`（框架自身行为）。
