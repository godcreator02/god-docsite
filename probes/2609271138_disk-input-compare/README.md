# 星轨盘收中性输入前后，盘面有没有变

```
node layout-dump.mjs <old|new> <仓根> <输出文件> <卡目录…>
```

## 问什么

星轨盘改成收中性输入、渲染这一侧删掉一批代码之后，现在看得到的画面与操作是不是一个都没变。对比的两边都从
git 取：改动前是 `aac79c6`（代码与 `f4463e7` 相同），改动后是 `0ed704c`（只换输入、只删代码）与
`0e6bc3b`（容错改报错、加校验）。两边的输出只放临时目录，不进仓。

## 怎么跑

**布局导出**：

1. `git worktree add <临时目录> aac79c6`，在里面 `pnpm install --prefer-offline`、`pnpm build`；改动后的一边在本仓 `pnpm build`
2. `node layout-dump.mjs old <临时目录> <旧.json> <卡目录…>` 与 `node layout-dump.mjs new <仓根> <新.json> <卡目录…>`，
   卡目录取 `D:\unitfolders\*\*\docs-site\content\trajectory` 能匹配到的全部，外加 `tests/fixtures/` 下的轨迹 fixture。
   new 一边直接 import `src/*.ts`，要用能剥类型的 Node（22.6 以上）
3. `node compare-dumps.mjs <旧.json> <新.json>`：病卡清单以外逐项比，病卡清单另列每个目录新增、消失的病

两边要在同一时刻导出：别的会话随时可能往某个站加卡，隔一阵再导会把新卡当成差异。

**页面操作**：两边各起一个文档站 dev（旧的一边在临时目录的 `docs-site` 下），打开 `/trajectory`，视口 1280×800、
暗色主题，`localStorage.clear()` 后刷新，执行 `page-ops.js`，约 90 秒后读 `window.__opsResult`，逐步比哈希。
不同的步骤再从 `window.__pageOps` 取全文逐段比。

**两个标签页的 `devicePixelRatio` 必须相同**。容器宽度在 1.5 倍下是 1264.67，在 1 倍下是 1265，画布取整后差 1px，
之后每一次重新适配视图（盘心大小这类要重排的滑杆）的快照都会不同，看起来像是代码改了。

## 结论

- 布局导出，19 个卡目录（18 个站加 fixture）：`0ed704c` 与改动前逐字节相同；`0e6bc3b` 除病卡清单外逐项相同，
  病卡只多了 gwb-paper-fetch 一条（关系指向根卡），gwb-ui-plugins 一条换成「parent 须写成列表」
- 页面操作 34 步（初始、滚轮、拖动、回到原点、悬停、点开侧栏、Esc、图例与两种筛选、搜索、全部标签、九个设置滑杆各拉到最小与最大、
  切主题、日期窗收窄、Ctrl+滚轮、回到原点两次）：两个标签页都是 1 倍时，34 步的哈希全部相同。
  滚轮、Ctrl+滚轮这两步在两边都没改变 DOM，所以这两步没有测到
