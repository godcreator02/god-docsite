# 任务 O 结果：正文外评论悬浮层

2026-10-12 首轮交付；同日按 `design/zcode-orchestration/parallel-focused-review.md` 的复核意见做定点返工（多实例高亮、底部卡片、调度去重）。probe 目录 `docsite-kit/probes/2610120120_comments-overlay/`（目录已由主会话从旧日期名改至本名，依赖已重接）。

## 交付了什么

纯 React / 浏览器组件 `CommentOverlay`（`src/`，最终归评论包），与最小 fixture 站（`fixture/` + `index.html`）：

- **只测量呈现，不改正文**：徽章、元素框、卡片是覆盖层 DOM，渲染为正文容器的兄弟节点；不 splitText、不 surroundContents、不插标记节点、不写标注属性、不用正文伪元素。文字高亮用 CSS Custom Highlight API。
- **共享契约输入**：`bodyRoot`（正文根）、`markers`（id+count）、只读 `resolveTarget(id) → Range | Element | null`、`onActivate`。另有 `onUnplacedChange`（missing/hidden 明确上报，不乱飘）、`renderCard`（卡片内容由宿主渲染）、`activeId`（可选受控）。
- **定位分类**：text（按行矩形，徽章贴最后一行右端）、element（覆盖层画框，徽章骑右上角；行内元素贴右端）、hidden（收起 details、`hidden` 属性——Chromium 里收起内容有布局矩形但 `checkVisibility()` 为 false，单独靠矩形判不出来，已补祖先渲染检查）、missing（返回 null 或目标不在本正文子树）。
- **归并**：批同一个可见元素的多条 markers 并成一个徽章（count 相加，保留第一条 id）；hidden/missing 不并、逐条上报。
- **每实例高亮（本轮返工）**：`createHighlightPainter(key)` 工厂 + `overlayCssFor(key)` 动态规则；注册名由实例 `useId` 派生（清洗为 CSS 安全字符）。一页多实例互不覆盖，卸载只删自己的注册名与样式；卸载清理在 `CSS.highlights` 已被环境拆走时跳过。
- **卡片视口约束（本轮返工）**：测量时按实测卡片高度（未渲染时用上轮值，首轮 240 估计；渲染后 useLayoutEffect 发现高度差 >1px 触发补测）做约束——目标下方优先、放不下翻到上方、两边都不够贴视口底夹限；水平先在覆盖层宽度内夹、再夹进视口（窄屏）。滚动/resize 重测时翻转状态跟着视口关系重算。无新增常驻监听，全部复用集中调度。
- **集中调度**：一套 ResizeObserver（bodyRoot）+ MutationObserver（childList/characterData/attributes 全听）+ 资源 load capture + scroll capture + window resize + fonts.ready + visibilitychange，全部经 `requestAnimationFrame` 合并；宿主节流 rAF（嵌入视图 visibilityState 仍 visible）时由 150ms `setTimeout` 兜底——**两者谁先到谁跑并撤销另一个，同一轮调度只测一次（本轮返工消除重复）**。这不是持续轮询：只在事件（观察器/滚动/resize/可见性）到来时排一次。观察只挂在正文根上，覆盖层是兄弟节点，不会自触发循环。
- **交互**：覆盖层 `pointer-events: none`，徽章/卡片 `auto`——不拦正文选择、链接、控件；点高亮文字激活（命中正文交互元素时不抢）；点空白取消。
- **fixture 样本**：固定文字 Range、重复文本批第 2 次出现、跨多行长段、代码块、图片（换尺寸重定位）、两条批同一 figure 的归并、收起 details、aria-expanded 折叠组件、恒 null 的 missing、滚动容器内三个不同深度的目标；工具条提供字号切换（html rem）、正文重排（追加句子）、换图、宿主展开（明确演示自动展开是宿主职责）、「校验正文未被标注」（正文内标注类元素计数 + 结构对比）。fixture 本身就是两份正文两个覆盖层实例，是多实例场景的常驻样本。

## 检查与证据

| 检查 | 命令 | 结果 |
| --- | --- | --- |
| 类型 | `pnpm typecheck`（本地 `./node_modules/.bin/tsc --noEmit`） | 通过（strict） |
| 测试 | `pnpm test` | 31 个全过（Vitest + jsdom；假布局 patch Range/Element 几何原型） |
| 构建 | `pnpm build` | 通过（vite 8.3.4） |
| 浏览器自检 | `pnpm preview`（5480） | 见下 |

测试覆盖：定位/归并/hidden/missing 分类与坐标；**卡片翻转、贴底夹限、窄屏水平夹进视口、视口变矮后从下方翻上方（纯函数 4 例）；卡片实测高度变化触发补测修正（组件）**；挂载、激活、卸载后正文 outerHTML 与文字节点引用原样、正文内无任何标注属性；覆盖层是正文兄弟且 pointer-events 分层；徽章点击 onActivate(id/null)；点高亮文字激活、点链接不抢、点空白取消；受控 activeId；missing/hidden 上报；正文变化重测；卸载清理；**同树双实例各持独立注册名且 range 各指各自正文、单独卸载一个实例另一实例注册名保留、卸载后全清**。

浏览器自检（IAB 内嵌浏览器，读操作 + evaluate；**点击类输入通道在该环境不可用——本轮重试 playwright click 仍超时，CUA 坐标与 DOM 通道也送不进页面，属环境限制非组件问题**；交互链路用合成事件自检，单元测试已覆盖同样逻辑；真实操作验收留给主会话）：

- 双实例高亮共存：fixture 两实例注册名 `_r_0_`/`_r_1_` 并存；激活实例一出现 `_r_0_-active` 与卡片
- 底部卡片：把 wrapped-text 滚到贴视口底（目标底 500/视口 720），卡片翻到上方（231..404）且完整在视口内
- 滚动跟随：滚动容器滚到 1/3，scroller-mid 徽章贴可视文字行（top 差 10px）
- 折叠双向：宿主展开 details 后 folded-text 恢复徽章、hidden 列表只剩 widget；summary 原生收起后徽章消失、回 hidden 列表（初次观察到一次「展开后徽章未恢复」为自检脚本自身污染与 IAB 节流时序抖动：干净 reload 复验与 summary 反向均稳定通过）
- 正文无标注：两份正文标注类元素 0 个

## 发现并修掉的问题（含本轮）

首轮五项（Chromium 收起 details 有布局矩形、「测量中」标志死锁、视口宽度变化不重测、rAF 被宿主节流、外正文目标判错）见 git 历史与前版 result；本轮返工：

1. **固定全局 Highlight 注册名**：两实例互相覆盖、卸载任一清掉另一个。改为每实例画笔（useId 派生注册名 + 按实例注入 `::highlight()` 规则），补双实例与单独卸载测试。
2. **卡片靠视口底部越界**：按实测卡片高度做下方/上方翻转与贴底夹限，水平夹进视口；高度变化经 useLayoutEffect 回量补测，滚动/resize 时翻转跟着重算。
3. **150ms 兜底重复测量**：rAF 与 setTimeout 双排时两个都会跑 measure（幂等但多测一次）。改为谁先到谁撤销另一个。
4. 测试基建两个坑：jsdom 30 已带原生 Highlight API（Set 形态），fake 需 defineProperty 强制覆盖且构造器按原生收 rest 参数；「卸载清理」用例把正文移出 React 树后未删，残留 #body/#quote 污染后续用例的查询。

## 未完成 / 留给主会话

- **真实浏览器验收**：本会话 IAB 的点击输入通道不可用（重试确认），滚动/换行/缩放/折叠、双实例高亮、底部卡片的最终验收由主会话真实操作完成（fixture 就绪，`pnpm preview` 端口 5480）。
- 首轮遗留：一次 reload 后首测坐标过期约 882px 的一次性竞态已防御未归因（scroll restoration 疑似）；IAB 节流下 setTimeout 也被拖慢约 2.5 倍（会执行，只是慢）。
- 卡片翻转用的是视口几何；若最终站点需要「跟随目标固定在下方直到滚动到贴底再翻」的粘性行为，集成时在 constrainCard 上再调。

## 集成说明（给主会话的单写集成）

- `src/` 四个文件 + `src/index.ts` 导出整体并入评论包（无 fumadocs 依赖，仅 react）；`overlayCssFor(key)` 按实例生成（含 `::highlight()` 规则），徽章外观规则可并入包样式表
- 公开导出：`CommentOverlay`、类型 `CommentOverlayProps / OverlayMarker / UnplacedReport / MarkerPlacement / Box / CardConstraint / HighlightPainter`、`measureAllPlacements / samePlacements / defaultCardHeight`（测量纯函数，包内测试可复用）、`overlayCssFor / createHighlightPainter / highlightsAvailable`
- 依赖版本与基线对齐：react ^19.3.0、vite ^8.3.0、vitest ^5.0.1、typescript ^6.0.3、jsdom ^30.1.2、@vitejs/plugin-react ^6.1.2（lock 锁 6.1.2）；本轮未改任何依赖版本

## 写入释放

- 本轮只写了 `docsite-kit/probes/2610120120_comments-overlay/` 内的 `src/highlight.ts`、`src/overlay-css.ts`、`src/placement.ts`、`src/comment-overlay.tsx`、`src/index.ts`、`test/placement.test.ts`、`test/comment-overlay.test.tsx`、`test/test-utils.ts`、`README.md`、`result.md`、`handoff.json`，以及本地 `dist/` 构建产物
- 未动其他 probe、packages、父 workspace/lock、正式 site、台账、其他仓；未改依赖版本
- 端口 5480 的 preview 服务交回前已停止
