# 评论覆盖层 fixture（任务 O：正文外评论悬浮层）

上面第一行是复跑命令（在 `docsite-kit/probes/2610120120_comments-overlay/` 里运行；`pnpm install` 装依赖，`pnpm check` 跑类型检查与全部 Vitest 测试，`pnpm build` 构建 fixture 站，`pnpm preview` 在 http://127.0.0.1:5480 起静态服务，Ctrl+C 停）。

## 这是什么

按 2026-10-12 的重写边界（`design/zcode-orchestration/package-split-contract.md` 的 K-06 与 `parallel-rewrite-contract.md`）重写的评论悬浮层：**纯 React / 浏览器组件，只测量与呈现，不修改正文**。

- 徽章、元素框、激活卡片全部是覆盖层自己的 DOM，渲染成正文容器的**兄弟节点**（正文容器外）
- 不 splitText、不 surroundContents、不往正文插 span/按钮、不写 `data-commented-element` 之类的标注属性、不靠正文 CSS 伪元素
- 文字高亮走 CSS Custom Highlight API（`::highlight()`，不碰正文 DOM），注册名按实例隔离：一页可挂多个覆盖层实例，互不覆盖、卸载只清自己的
- 激活卡片按实测卡片高度做视口约束：目标下方优先，放不下翻到上方，两边都不够贴视口底夹限；水平夹进视口（窄屏）
- 输入按共享契约：正文根元素、评论 id/数量、只读 `resolveTarget(id) → Range | Element | null`、`onActivate` 回调
- 不读评论文件、不判身份、不渲染评论 MDX、不约束持久化快照格式（旧 range 映射是宿主侧的输入边界，见 `fixture/anchors.ts` 的演示实现）

## 目录

| 路径 | 内容 |
| --- | --- |
| `src/comment-overlay.tsx` | `CommentOverlay` 组件：覆盖层 DOM、集中观察与调度、激活交互、卡片视口约束 |
| `src/placement.ts` | 测量：目标分类（text/element/hidden/missing）、坐标换算、卡片翻转/夹限、同元素归并 |
| `src/highlight.ts` | CSS Custom Highlight 画笔工厂：每实例注册名，卸载只清自己的 |
| `src/overlay-css.ts` | 覆盖层样式（高亮颜色、徽章 hover），最终归评论包时可并入包样式表 |
| `src/index.ts` | 公开导出 |
| `test/` | Vitest：定位逻辑、DOM 不被标注修改、事件、卸载清理（jsdom + 假布局） |
| `fixture/` | 宿主接线演示：固定文字、重复文本（第 2 次出现）、跨多行长段、代码块、图片（换图重定位）、details 折叠、aria-expanded 折叠、滚动容器、字号变化、重排正文、定位不到的样本 |

`pnpm-workspace.yaml`（packages 留空）让本目录成为独立安装单元：pnpm 不会向上找到 docsite-kit 仓根的 workspace，依赖与 lock 都只落在本目录。

## 宿主接入（最小用法）

```tsx
// 定位基准：包住正文、随正文长高、position: relative 的容器
<div style={{ position: 'relative' }}>
  <article ref={setBodyRoot}>…正文（不许被改动）…</article>
  <CommentOverlay
    bodyRoot={bodyRoot}
    markers={[{ id: 't1', count: 2 }]}          // 宿主聚合后的评论标记
    resolveTarget={resolveTarget}              // id → Range | Element | null
    onActivate={(id) => …}                     // 点徽章 / 高亮文字
    onUnplacedChange={(report) => …}           // missing / hidden 明确上报
    renderCard={(id) => <MyCard id={id} />}    // 激活时弹出的卡片内容
  />
</div>
```

要点：

- `markers` 与 `resolveTarget` 传稳定引用（`useMemo`/模块级常量）：引用变化会拆装观察接线重新测量
- 每个覆盖层实例只传**本正文里**的 markers；目标不在 `bodyRoot` 子树里的会被判为找不到（missing）
- 正文在内部滚动容器里时，覆盖层与正文放同一个滚动容器内即可：坐标在内容坐标系里，随内容滚动
- 颜色可用 CSS 变量 `--comment-overlay-accent` 覆盖
- 一页可以挂多个实例（fixture 里就是两份正文两个实例）：高亮注册名由实例自己的 useId 派生
- 折叠目标的「自动展开」是宿主的交互职责：组件只经 `onUnplacedChange` 报 hidden，不碰正文

## 命令

| 命令 | 作用 |
| --- | --- |
| `pnpm dev` | 开发服务（5480） |
| `pnpm build` / `pnpm preview` | 构建 / 静态服务（5480） |
| `pnpm test` | Vitest 全部测试 |
| `pnpm typecheck` | tsc --noEmit |
| `pnpm check` | typecheck + test |

端口 5480/5481 归本 probe（契约分配）；启动前确认空闲。

## 交付状态

见 `result.md`（改动、检查、证据、未完成项）与 `handoff.json`（结构化交付）。最终浏览器验收由主会话真实操作完成。
