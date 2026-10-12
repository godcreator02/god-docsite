# 任务 K 交付记录：身份/评论包集成与验证站

日期：2026-10-11。写入范围：`packages/docsite-identity/`、`packages/docsite-comments/`（修正、构建、测试、README）、`probes/2610112023_docsite-kit-complete/site/`（接入）、本目录（脚本、日志、结果）。仓根 `pnpm-lock.yaml` +61 行（两个新包 importer，旧 importer 未动）；`pnpm-workspace.yaml`（已有 `packages/*`）与根 `package.json` 未改。旧包、插件、正式站、design、trajectory、review 全程只读。

## 一、集成前修复（主会话 22:06 审查的 4 项）

1. **CommentRequestOptions 去掉 identity**：恢复契约字段（commenter/people/pageUrls/commentRoutes?/commentsDir?/pageHtmlOf?/siteOrigin），内部从可信 commenter 构造 `{ person: commenter }` 交 authorizeWrite（`src/server/comments.ts:326`）。测试全部改回契约形状，README 同步。
2. **as 语义恢复**：非字符串（含 Blob/File）→ 400「as 要是 people.json 里一个 agent 的 id」；空字符串照旧走 authorizeWrite 的未知 id 400；只有缺省（null）才以本人执行。新增请求层回归用例（File part 与空串两个断言，`test/comment-requests.test.ts`「as 畸形时拒绝」）。实站 curl 复验（见拒绝矩阵）。
3. **fd-\* 颜色类清零**：三个 React 文件全部 `fd-*` 换成包 tokens 任意值类（`bg-[var(--docsite-comments-card)]` 等，sed 批量+逐处核对，最终 `grep -c "fd-"` 三个文件均为 0）；`styles.css` 定义 `--docsite-comments-*` 11 个颜色 token（浅色默认 + `.dark` 深色）与评论正文排版 `.dc-comment-body`（p/ul/代码/链接/表格/引用，不依赖 typography 插件）；边框类（border/border-s/divide-y）显式用 token 色。**身份包** Avatar/IdentityBadge 改包自有 class（`.dc-avatar`/`.dc-identity`），新增 `styles.css` 与 exports `./styles.css`。README 更新为「宿主需要 Tailwind v4（v3 加 content），颜色与正文排版用包自己的」。
4. **不做的事照做**：快照差分、DOM 锚点/展开识别、splitText 覆盖层均未重写（逐字迁移保留）；`.katex`/`.sr-only` 取字旧假设、MDX 默认校验与宿主集合插件未对齐，README/代码注释已声明，不宣称全功能稳定。

**追加（用户中途指示「现在就改」）**：删除评论的 `window.confirm`（旧实现逐字迁移的现状）改为页内确认条（「删除这条回复？/删除整串评论（连同所有回复）？」+ 确认/取消按钮，悬停触发后常驻），`comment-cards.tsx` CommentItem；取消/确认路径均已实测（见下）。

## 二、安装与声明一致性（闭合）

| 命令 | 退出码 | 结果 |
| --- | --- | --- |
| 仓根 `pnpm install` | 0 | lock +61 行，只有 `packages/docsite-comments` 与 `packages/docsite-identity` 两个 importer；全部复用已有锁定版本（@mdx-js/mdx 3.1.1、diff-match-patch 1.0.5、parse5 7.3.0、yaml 2.9.1、react 19.3.0 等），无其它变动（install-1.log；基线存 baseline/） |
| 站点 `pnpm install` | 0 | site 增 `link:../../../packages/docsite-{comments,identity}`（link: 相对 site/package.json，曾因少一层写错并当场修复）与 `tailwindcss ^4.3.3`、`@tailwindcss/vite ^4.3.3`（照正式站版本）；site/pnpm-lock.yaml 是 site 自己的（site 本来就是独立 workspace，未动仓根配置）（site-install.log） |

## 三、两包检查与 exports 运行时解析

| 命令 | 退出码 | 结果 |
| --- | --- | --- |
| `pnpm --filter @godcreator/docsite-identity check` | 0 | 4 文件 22 测试全过 |
| `pnpm --filter @godcreator/docsite-identity build` | 0 | dist 重建（含 react 入口 emit） |
| `pnpm --filter @godcreator/docsite-comments check` | 0 | 5 文件 41 测试全过（40 既有 + 1 新增 as 畸形回归） |
| `pnpm --filter @godcreator/docsite-comments build` | 0 | dist 重建 |
| 同上两项（页内确认条改动后复跑） | 0 | 41 测试、build 全过（check-build-2.log） |
| `node …/integration/resolve-exports.mjs` | 0 | 9 个入口（identity `.`/`server`/`react`/`styles.css`，comments `.`/`server`/`browser`/`react`/`styles.css`）全部从 node_modules 按包 exports 解析到 dist/文件，动态 import 成功且关键导出逐一核对齐全（resolve-exports.log） |
| 站点 `pnpm types:check` | 0 | typegen + tsc --noEmit 通过（site-types.log） |

React 单实例：vite `resolve.dedupe: ['react','react-dom']`（vite.config.ts，注释写明原因）；实查编译产物中评论包 dist 的 react import 统一指向 `/.probe-vite-cache/deps/react.js`（同一实例）。

## 四、验证站接入

新增/修改（site/ 内）：`package.json`（依赖）、`vite.config.ts`（tailwindcss 插件 + dedupe）、`app/app.css`（@import tailwindcss + 两包 styles.css + `.demo-doc` 正文排版）、`source.config.ts`（+`collectionDemo`、+`comments` 集合，schema 用 `commentFrontmatterSchema`）、`app/components/aria-toggle.tsx`（aria-expanded 折叠组件）、`app/lib/comment-data.server.ts`（集合→评论串分组、公开人员、身份）、`app/lib/comment-body.tsx`（评论正文按需加载）、`app/routes/comments-demo.tsx`、`app/routes/comments.tsx`、`app/routes/api-comments.ts`、`app/routes.ts`（注册三路由）、`content/collection-demo/index.mdx`（正文样本：可选中文字、details 折叠、AriaToggle、代码块；含「原文改动」验证段——验收时在第一段前插了一句，保留作样本）、`people.json`（编造验收码 k8v1r2w3x4 = zk）、`comments/`（种子与验收样本，见下）、`README.md`（复跑说明）。

正文消费全部走包公开 exports（dist）：JS import 经 node_modules 的 link；两个关键适配——`.source/browser` 的 raw 键带 `./` 前缀（`commentsRaw[path] ?? commentsRaw['./'+path]`）；`use()` 要求同一条评论每次渲染同一个 promise，raw 的加载函数每次调用返回新 promise，按路径缓存后修复（此前评论正文永远停在「正在加载……」）。

**评论写后自动可见的接线（主会话纠偏后）**：诊断确认两件事——(a) 写新评论后 vite 自动 reload 了 `.source` 但页面仍看不到新评论（服务端集合数据不更新）；(b) 删评论后 `.source/server` 的 eager glob 仍引用已删文件，页面 500（`Failed to load url …/20261011t144218-cafd.mdx`，site-dev-5460.log 22:50 时段，证据保留）。两者都是 fumadocs-mdx 集合成员变化在 dev 下的失效边界（touch source.config.ts 重新生成可恢复——诊断证据，不计为验收）。**修复**：`api-comments.ts` 的 action 在 `commentRequestResponse` 成功后 `utimes('source.config.ts')`（`refreshCollections`），走 fumadocs-mdx 公开的 watch/重生成机制 → 开发服务自动整页刷新。此后所有写操作均不需要人工 touch/重启/手动刷新（干净复跑验证见下）。这是本验证站的最小接线，不是通用内容更新方案。

## 五、浏览器实站验收（IAB 真实 click/drag/type；无 dispatchEvent 模拟）

`tab.dev.logs` 在本运行时不存在（已实测 `tab.dev` undefined、documentation 无 console/logs/devtools 入口），console 以页面内 hook（console.error/warn + unhandledrejection 捕获）替代，复现「正在加载」时捕获为空。

**带身份站（127.0.0.1:5460，DOCSITE_IDENTITY_CODE 只在子进程）**：

| 验收项 | 结果与证据 |
| --- | --- |
| 首屏 | IdentityBadge 显示「任务K」（头像+名字，身份包组件）；正文/折叠块/批注开关齐 |
| 选中文字批注 | 真实鼠标拖选「启动开发服务」→ 浮出评论按钮 → 草稿卡锚定「『启动开发服务』」→ 发送；磁盘 `quote: "启动开发服务"`、`range: [92,98]`、snapshot.txt 齐 |
| 评论正文是真 MDX | DOM 实查：strong「先装依赖」、a[href=example.com/quickstart]「快速开始」、code「pnpm dev」真实渲染 |
| 回复 | 回复文件落盘、计数+1、自动刷新后可见 |
| agent as 署名 | curl POST 带 `as=zk-agent` + 正确 Origin → 200，文件 `author: "claude→zk-agent"`（20261011t144319-2056.mdx） |
| 解决/重开 | UI 点击后磁盘 `status: "resolved"` + `resolvedBy: "zk"` + `resolvedAt`；重开后清回 open、正文保留 |
| 编辑 | hover → 编辑框载入原文（commentSourceResponse GET）→ 改文保存 → 磁盘与页面同步更新 |
| 删除（页内确认条） | 取消路径：点删除→确认条出现→点取消→回复仍在、文件不变；确认路径：只删目标回复文件，串与其它回复保留 |
| API 拒绝矩阵 | 非作者 edit/delete 403（带作者名）；Origin 缺失/错误 403；as=人 403、as=nobody 400、as=空串 400、as=文件 400；**全部拒绝后 comments/ 文件树 md5 不变** |
| 干净复跑（纠偏后，全程无 touch/重启/手动刷新） | 清实验串→干净重启→①UI 新建批注：文件落盘、**自动刷新后正文评论按钮+计数直接可见**；②UI 回复：自动刷新后可见（计数 2）；③UI 删回复：目标文件删、index+snapshot 保留、demo=200 list=200 **无 500**、自动刷新后回复消失计数归 1；④UI 删整串：串目录消失、两页 200、自动刷新后正文按钮消失；⑤种子串 seed-welcome 全程无损且在全部评论页正常显示 |
| 折叠定位（details 等价样本） | 批注折叠块里的「折叠块里的一句话」：`openers: [[215,228]]` 落盘；收起后正文无按钮；侧栏条目显示「在收起的『折叠块：里面藏着被批过的字』里」；点击后 details 自动展开、批注文字定位恢复、评论卡弹出 |
| 元素批注 | 批注模式点代码块：草稿识别「代码块」；落盘 element/range；刷新后代码块带 `data-commented-element`（画框）+ 右上角评论数按钮 |
| 原文改动映射 | 批「打开浏览器」后在第一段前插句：自动刷新后评论数按钮**精确插在挪动后的「打开浏览器」四字之后**（quote 完整保留时精确映射，不标「原文改过」——该标注只在 quote 本身被改时出现） |

**只读站（串行重启 readonly，同端口 5460）**：页面 200；IdentityBadge 显示「只读」；页面无身份码（grep 0，带身份站同验）；无批注开关（aria-pressed 按钮 0 个）、评论按钮与既有评论可见；`POST /api/comments` 403「这个站只读：评论在本机的开发服务里写」；`GET /api/comments?...` 403「这个站只读」；**拒绝后文件树 md5 不变**。

## 六、发现的问题与边界（如实）

1. **集合成员失效边界（已被站点接线闭环，根因属 fumadocs-mdx dev watch）**：新增成员 vite 自动 reload `.source` 但服务端集合数据不更新；删除成员后 eager glob 仍引用旧文件导致整页 500。验证站用 action 内 utimes source.config.ts 走公开 watch 机制闭环（干净复跑全链通过）。生产站/通用方案属后续，未做。
2. **批注模式下侧栏找回被拦**：批注模式在正文上 capture 所有点击并 preventDefault，侧栏触发的自动展开（opener.click()）也被拦（诊断证据：点击捕获记录两个 click 事件但 details 未展开）。退出批注模式后一切正常。旧实现固有行为，未改。
3. **dist 重建窗口 500**：包 build 先 rmSync dist 再 tsc，若 dev 服务正在跑会短暂报「Failed to load …/dist/server/index.js」（vite 模块图缓存失败态，即使 dist 已恢复也不自愈，需重启 dev）。验收时遇到一次，重启恢复。后续做包构建时先停站即可避免。
4. **「水合时机」（与 500 分开的编号）**：自动刷新/手动 reload 后 React 状态重置（卡片收起、批注模式关闭），属页面重载的正常表现，不是服务端错误；曾与 500 混在一段流程里出现，已分开。
5. 旧假设保留边界（未验）：`.katex`/`.sr-only` 取字规则、Tabs（role=tab/aria-selected）与 Files 文件树的折叠识别——本轮只验了 details（summary）一种折叠样本；AriaToggle（aria-expanded 按钮）组件在页上但未单独批注验 reveal。MDX 校验与宿主集合插件对齐未做（README 已声明）。
6. 1.1 基线（/ 与 /second 的 A/B 正文、计数、输入框）本轮只验了路由 200，交互未重跑（B 会话验过，K 轮未改那部分代码）。

## 七、进程与复跑

无遗留进程：全部 dev 服务经 `start-site.ps1 stop` 停止（taskkill /T 杀进程树），5460/5461 无监听。复跑入口：`site/README.md`（含身份开关说明）；脚本 `start-site.ps1`（start identity|readonly <port> / stop），身份码只设进脚本启动的子进程。验收样本评论保留在 `site/comments/`（seed-welcome 种子、b7be9e「打开浏览器」映射样本、2560d1 折叠样本、3bf3ff 代码块元素样本），`content/collection-demo/index.mdx` 保留「改动插入」段。

## 八、实际文件清单

- 包修正：`docsite-comments/src/server/comments.ts`、`src/react/{comment-cards,comments,all-comments}.tsx`、`styles.css`、`test/comment-requests.test.ts`、`README.md`、`package.json`（无改，identity 加 exports）；`docsite-identity/src/react/index.tsx`、`styles.css`（新）、`package.json`（exports+files）、`README.md`。
- 站点：见第四节清单（+`.source/`、`node_modules`、`.react-router/`、`.probe-vite-cache/` 正常生成物）。
- 本目录：`baseline/`（三共享文件基线）、`install-1.log`、`site-install.log`、`check-build.log`、`check-build-2.log`、`site-types.log`、`resolve-exports.mjs/.log`、`start-site.ps1`、`site-process.json`（已清）、`site-dev-5460.log`/`.err.log`（dev 全程日志，含 500 证据）、`result.md`、`handoff.json`。

## 九、下一步准确范围

- 主会话复核：干净复跑链（建议照 README 用 start-site.ps1 再走一遍创建→回复→删除）、folding/元素/映射抽检、只读切换。
- 后续批次候选：集合成员失效的通用方案（fumadocs-mdx 侧或 dev 插件）；批注模式下 reveal 被拦；Tabs/Files 折叠样本与 .katex/.sr-only 假设；MDX 校验对齐；生产站迁移两个包；页内确认条上游同步给旧包或留差异记录。

---

# 返工轮（2026-10-11 23:15 复核后）：三个缺陷的修复与剩余待验项

对应主会话复核 `review/20261011-2315-K-review.md` 与 `20261011-2315-browser-errors.json`。已过项未重跑；只修指出的缺陷。

## 修复 1：全部评论预览的嵌套交互元素

`all-comments.tsx` 重构：卡片不再是外层 `<a>`——说明行里，挂页面的串显示 `<a href="?comment=…">页面名</a>`（Tab 可达），不挂页面的串显示「不挂在页面上 · 展开」按钮（Tab 可达）；正文预览不再被任何点击处理器包住，正文里自己的链接独立工作。侧栏（`comments.tsx` CommentsPanel）列表项保留 div role=button（非原生交互元素，无嵌套无效 HTML），但 `onClick` 里命中 `a, button` 时不再当作选卡（链接不再被吞）；detail 展开的 ThreadView 接上了删除回调。

**已验（DOM/console 层）**：/comments 首屏 `document.querySelectorAll('a a')` 为 0；3 个挂页面串的说明链接 tabIndex 0、href 带 `?comment=`；展开按钮 tabIndex 0；种子卡正文里两个链接独立渲染；首屏与水合 console（页面内 hook，error/warn/unhandled）为空。主会话捕获的两条 nesting error 对应的结构（外层 a）已不存在。

**待主会话浏览器补验**：点展开按钮/说明链接的交互路径、正文链接点击行为（见「工具缺口」）。

## 修复 2：删除后的正文/元数据不同步（乐观移除）

根因与修法：删除前页面内存里的 threads 永远是加载时的旧数据，直到整页刷新；刷新前的任何重渲染（vite 对已删文件的 hmr 失效就是一次）会用旧数据渲染已删条目，此时浏览器端模块图里该条目的正文模块已失效 → `CommentBody` throw「浏览器端没有评论正文模块…」→ CommentBodyBoundary（主会话 23:18/23:19 捕获的正是这个）。

修法（不吞错、不隐藏、不 loading）：**删除接口一成功就把那条从界面上拿掉**——`CommentItem` 新增 `onDeleted`（remove 成功后调用），`ThreadView` 转发（onEntryDeleted(threadId, file)），`CommentLayer` 与 `AllComments` 各自维护 `removedKeys`（threadId/文件名）并派生 `live`（useMemo，引用稳定），全部下游（measure、定位、卡片、侧栏、全部评论列表）改用 `live`。删发起条 = 整串消失；删回复 = 只少那条。fetch 在本地往返先于 vite watcher 生效，删除成功后到整页刷新之间不再渲染已删条目。

**已验**：`pnpm --filter @godcreator/docsite-comments check`（41 测试）+ `build` 全绿（check-build-3.log）；站点 `pnpm types:check` exit 0。**实站删除链的 UI 验证待主会话**（我的 IAB 输入通道失效，见下）——上一轮干净复跑的删除链证据是修复前代码的，不充当本轮通过证据。

## 修复 3：start-site.ps1 端口与 PID

- 端口真实传给 react-router dev（`pnpm dev --port <Port> --host 127.0.0.1 --strictPort`，CLI 参数覆盖 package.json dev 脚本里的 5460）。**实测**：`start readonly 5461` → 5461 返回 200，dev 命令行显示 `--port 5461` 生效（site-dev-5461.err.log 首行）；只读站 POST 403。
- stop 先核对记录 PID 的启动时间（截到秒：CIM 与 Get-Process 的滴答精度不同，最初两版比对分别有格式与精度 bug，均已修）再 taskkill /T。**实测**：start→stop 循环通过（stopped pid 53308、端口清空）。
- 中途发现并清理：上一轮 identity 站（cmd 8168 → node 44736/44352）因 stop 旧 bug 跳过后遗留，按 CIM 命令行与创建时间核实属本会话启动链后连同 5461 试验树一并清理；12:03/12:05/19:28 等更早的他人进程未动。当前 5460/5461 无监听。

## 修复 4：README 复跑顺序与 utimes 口径

`site/README.md` 重写复跑段：干净 checkout 需先仓根 `pnpm install` → 构建两个 link 包（停服务状态下，dist 删除窗口）→ 站点 `pnpm install` → 启动。utimes 一节改为：**锁定版本（fumadocs-mdx 15.4.7）下实测的站点变通**，「touch 配置=数据失效」不是公开承诺接口，升级要重验；记录了整页刷新对草稿/状态的影响与删除乐观移除的边界。

## 浏览器工具缺口（如实记录，不冒充通过）

本会话的 IAB 从约 23:32 起**点击通道失效**：Playwright locator click（含 force）、CUA 坐标 click、dom_cua node_id click、focus+Enter、Control+Enter 组合键、Tab 移焦全部不触发（导航链接点了不跳转；`elementFromPoint` 命中目标、按钮 enabled、无遮挡——不是页面问题）；`locator.type` 与单键 press 正常。跨页面（/comments、/comments-demo）、新标签、dev 服务重启 + 依赖缓存清理后依旧。23:32 前本会话几十次真实 click/drag 全部正常（前文证据）。按补充纠偏停止排查，未改站点适配工具、未用合成事件。

**留给主会话（其 CUA 已实测可用）的浏览器项**：
1. 修复后代码的 UI 全链：创建（正文带链接）→ 自动刷新可见 → 回复 → 编辑 → 删回复（验乐观移除后无「浏览器端没有评论正文模块」错误、串保留）→ 删整串 → 列表/页面一致，另一串无损；加一轮重复创建删除。
2. /comments 交互：展开按钮、说明链接跳转、正文链接不被吞。
3. AriaToggle（aria-expanded）批注后收起、侧栏找回。
4. 全程 `tab.dev.logs` 首屏与操作期 console（我的 hook 只能覆盖加载后）。

## 本轮命令与退出码

| 命令 | 退出码 |
| --- | --- |
| `pnpm --filter @godcreator/docsite-comments check`（修后） | 0（41 测试，check-build-3.log） |
| `pnpm --filter @godcreator/docsite-comments build`（修后） | 0 |
| 站点 `pnpm types:check`（修后） | 0 |
| `start-site.ps1 start readonly 5461` / curl 5461 | 200 |
| `start-site.ps1 stop`（修后 PID 校验） | stopped，端口清空 |

identity 包未动（本轮无源码改动）。服务全部停止，5460/5461 无监听，state 文件已清。

---

# 返工轮二（2026-10-12 00:08 根因诊断后）：Windows glob base 修正，utimes 补丁移除

依据主会话诊断 `review/20261012-0008-root-cause.md` 与 `review/no-touch.test.ts`（及 no-touch-result.log 红、absolute-base-result.log 绿两份对照）。

## 旧结论作废

- 「action 内 utimes source.config.ts 已让评论写删闭环」——**作废**。诊断第三层证实 utimes 触发的配置重载会连带更新整个 MDX 图（含已删模块），是删除时六次 Failed to reload 的放大器，不是正确的集合更新协议。
- 「集合成员失效的根因在 Fumadocs 的 watch/codegen」——**作废**。真根因：本机 Vite 8.3.4 对 import.meta.glob **相对 base**（fumadocs 生成的 `./../comments`）在 Windows 上监听匹配失败（toAbsoluteGlob 的 posix.resolve 混入盘符与当前目录）；根相对 base（`/comments`）走 root join 分支正常。

## 实际改动（全部在站点接线层，包不动）

1. `app/routes/api-comments.ts`：移除 utimes/refreshCollections 补丁，接口只做评论包的 `commentRequestResponse`。
2. `app/lib/comments-glob-root-base.ts`（新）：`commentsGlobRootBase` Vite 插件，`enforce: 'pre'` transform 只作用于 `.source/server.ts` 与 `.source/browser.ts`，把 comments 集合的 `"base": "./../comments"` 字符串替换为根相对 `"/comments"`。生成来源仍是 fumadocs-mdx codegen（source.config.ts 的 defineCollections），不改生成文件本身、不碰 node_modules、不用私有方法；范围仅 comments 集合两个生成文件。fumadocs-mdx 升级改格式时替换失效——e2e 测试是第一道报警（插件与 README 都写明）。
3. `vite.config.ts` 接入该插件（import 带 .ts 扩展，消 native configLoader 警告）。
4. `test/comments-api.e2e.test.ts`（新）+ `test/vitest.config.mjs`：端到端 Vitest——起真实开发服务（root=site、加载本站 vite.config.ts、5462 strictPort），HTTP 新建→断言 SSR 全部评论页自动出现该串完整路径；回复→出现；删回复→消失且串头还在；删整串→页面 200 且不含；全程断言 source.config.ts 内容未变、api 源码不含 utimes；**包装开发服务 logger 的 error/warn，断言没有涉及 /comments/ 模块的报错**——直接回应「删除时六次 Failed to reload 已删 MDX」：修正后不再出现（删除触发的是正常的 page reload/program reload，见 e2e-green.log）。vitest 二进制用 packages/docsite-kit 已有版本（绝对路径），本站不新增依赖。
5. `tsconfig.json`：`exclude: ["test"]`（e2e 靠运行时验证，vitest 类型从绝对路径拿不完整）+ `allowImportingTsExtensions`（vite.config 的 .ts 扩展 import）。
6. `site/README.md`：utimes 段替换为 base 适配说明（含适配范围与报警测试），补 e2e 运行命令。

## 先红后绿证据

| 步骤 | 结果 | 日志 |
| --- | --- | --- |
| 移除 utimes、无 base 修正 → e2e | **红**：新建 8 秒内 SSR 不含新条目（复现诊断） | e2e-red.log |
| 加 commentsGlobRootBase → e2e | **绿**：增删全部自动反映、无已删模块 reload 报错、配置未动 | e2e-green.log |
| vite.config 加扩展名后复跑 | 绿 | e2e-green-2.log |
| 站点 `pnpm types:check` | 0（site-types-2.log） | — |

## 剩余待验（不声称已过）

- 浏览器端全链（含修复后代码的 UI 操作与 tab.dev.logs console）由主会话补验（我的 IAB 点击通道仍失效，未再反复试）。
- 「已删模块 HMR」在浏览器侧的最终表现（e2e 已证服务端 logger 无报错；浏览器 console 由主会话确认）。
- AriaToggle 找回、/comments 交互路径（同上，待补清单不变）。
