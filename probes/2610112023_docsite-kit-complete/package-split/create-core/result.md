# 任务L交付：create-docsite 一次性建站文件生成核心（返工第二轮）

状态：已按主会话第二轮复核意见修复 nested 根回滚缺口与所有权生命周期，等待复核。未创建
`package.json`、未执行任何 pnpm 命令、未改 workspace / lock / 其他包 / 其他仓（review/ 主会话
文件只读）。测试框架 Vitest，模板为单一普通文件树。

## 本轮修复（对照第二轮复核意见）

| 复核意见 | 修复 |
| --- | --- |
| nested-only 模板：`ensureDirChain` 仅 `relative === ''` 分支登记根，nested 分支 recursive mkdir 建的根未登记，回滚后 site 根残留 | `ensureDirChain` 统一根登记：无论 `dirToEnsure` 是根本身还是更深的目录，**根不存在时根首先登记**，再从第一个缺失段起登记后续段。预存在目录仍绝不登记、绝不删。删除范围没有扩大 |
| `createFileExclusive` 先 push 再 writeFileSync 把创建失败与写入失败混为一谈 | 重写为：`fs.openSync(targetPath, 'wx')` **成功才登记**，随后 `fs.writeFileSync(fd, content)`（保住现有注入点，未用 writeSync 绕开），`finally fs.closeSync(fd)`；EEXIST 或 open 阶段任何错误都发生在登记之前——不登记、不删 |
| 补 open 失败不误记/不误删、文件和 marker 半写回滚；nested-only 用例 | 新增 4 条（见下）；文件与 marker 半写回滚两条保留。mock 经验：此环境里 `fs.readFileSync` 也会经过 `fs.openSync`（flags='r'）导出属性，open 阶段 mock 按路径＋`'wx'` 过滤、其余透传真实 open，避免误拦模板读取 |

## 实跑命令与退出码（真实执行）

- **Vitest**（在 `packages/create-docsite` 下）：`../docsite-kit/node_modules/.bin/vitest.ps1 run`
  → **Test Files 3 passed (3)，Tests 34 passed (34)**（plan 9＋create 19＋cli 6），无跳过。
- **主会话复现测试等价副本**：`create-core/create-rollback-replay.test.ts` 已同步为主会话最新
  两用例版（半写回滚＋nested-only 根回滚），断言与 mock 一字未改、仅调整 import 层级 →
  **2 passed**。
- **类型检查**：`../docsite-kit/node_modules/.bin/tsc -p tsconfig.json` → **exit 0**。
- CLI 未动（纯 Node 运行）。

## 行为通过情况（全部真实临时目录 IO）

前两轮全部验收项保留。本轮新增 4 条：

| 新测试 | 断言 |
| --- | --- |
| open 阶段 EEXIST（mock 只拦目标内 wx 创建） | 判 conflict（未覆盖）；文件不在清单、不删，目标一个字节不变 |
| open 阶段 EACCES | io-error；不登记、不删除，目标回到建站前，无残留报告 |
| nested-only 模板＋目标根不存在＋写失败（与主会话用例同构） | 回滚后 `existsSync(目标根) === false`，nested 分支建的根也登记并删除 |
| （保留）正文半写、marker 半写、根新建/预存在边界 | 同前一轮，注入点不变仍命中 |

未测试、不承诺的仍为：并发进程同时写同一目标、断电恢复（README「回滚的边界」）。

## 真实文件清单

`packages/create-docsite/`：`src/plan.ts`、`src/create.ts`、`src/cli.ts`、
`test/plan.test.ts`、`test/create.test.ts`、`test/cli.test.ts`、`test/helpers.ts`、
`tsconfig.json`、`README.md`（无 package.json；vitest 缓存 node_modules 每次运行后清理）。

`package-split/create-core/`：本 result.md、handoff.json、`create-rollback-replay.test.ts`
（主会话复现测试等价副本，两用例，作回归证据保留）。

## 残留

无残留临时目录、无后台进程；review/ 目录未改动。

