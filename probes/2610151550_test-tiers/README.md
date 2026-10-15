pwsh -File run-all.ps1

# 2610151550_test-tiers：各包测试的耗时，以及「慢」的分界放在哪

## 问什么

全量 `pnpm verify` 要五六分钟，其中仓根 `pnpm check` 就要三四分钟。哪些测试文件慢、为什么慢、分界放在哪里，
才能让默认的 `pnpm check` 只含快的、在一分钟左右，同时慢的一级照样能显式跑完？结论写在轨迹卡
`docs-site/trajectory/2026-10-15-test-tiers.mdx`。

## 怎么运行

第一行那条命令在实验目录下运行（Windows、pwsh 7、Node 24、vitest 5.0.3 下验过），要先在仓根 `pnpm install`、`pnpm build`。
它量的是分级之后的仓：各包默认配置（快的一级）、有慢测试的五个包的 `vitest.slow.config.ts`（慢的一级），再量仓根
`pnpm test`、`pnpm check`、`pnpm test:slow` 的总耗时，七八分钟。

分级之前的数字要在分级之前的提交上量：在 `19a04d6e` 上开一个 worktree、`pnpm install`、`pnpm build`，把本目录的脚本复制过去后运行
`pwsh -File measure.ps1 -Tag before`、`node table.mjs runs/before 100000 > runs/before-table.txt`、`pwsh -File isolated.ps1`
（把并行运行时超过 0.5 秒的文件逐个单独再跑一次）和 `pwsh -File static-checks.ps1`（各包 typecheck、lint 的耗时）。

## 文件

- `measure.ps1`：逐个包 `pnpm exec vitest run`，记下每个包的总耗时（`runs/<标签>/summary.json`）与 vitest 的 json 报告
- `table.mjs`：从 json 报告列出每个文件的耗时（vitest 报告里的文件耗时，不含启动与 import）、用例数，按耗时排序
- `isolated.ps1`：逐个文件单独运行，第一列是包含 vitest 启动的总耗时
- `static-checks.ps1`：各包 typecheck、lint 的耗时
- `runs/`：这次的全部记录。`before*`、`isolated*`、`static-checks.*` 是分级之前（`19a04d6e`）量的，`after*`、`slow*`、`root-*` 是分级之后量的；
  `isolated-table.txt` 列出单独运行时每条测试的耗时

## 记录里的数字

| 量的是什么 | 分级之前 | 分级之后 |
| --- | --- | --- |
| 各包测试逐个运行的总耗时（`before.txt`、`after-and-slow.txt`） | 181 秒，142 个文件、1134 条 | 快的一级 30 秒（117 个文件、955 条）；慢的一级 155 秒（25 个文件、179 条） |
| 各包 typecheck 与 lint（`static-checks.txt`） | 30 秒 | 没变 |
| 仓根 `pnpm check`（`root-timing.txt`） | 没有直接量，按上面两行相加约 3 分半 | 55 秒 |
| 仓根 `pnpm test`（各包并行） | 没有量 | 15 秒 |
| 仓根 `pnpm test:slow` | 没有这条命令 | 163 秒 |
| `plugins/collab` 的 `pnpm test:verified` | — | 28.5 秒，4 个文件、24 条，全过 |
