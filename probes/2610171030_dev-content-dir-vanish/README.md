# dev 运行中整个删掉 content 下的组，开发服务会不会退出

## 怎么运行

在仓根运行 `node probes/2610171030_dev-content-dir-vanish/run.mjs [轮数]`（默认 5 轮）。要先 `pnpm --filter @godcreator/god-docsite build`：测试站用的是平台包的构建产物。

每轮在 `full-test/site/content/` 下建 `zz-vanish-<运行编号>-<轮>/`（40 个子组，每组 `meta.json`、5 个页面、一个带 5 个文件的同名文件夹），等 3 秒，再用另一个进程整个删掉，等 3 秒后看开发服务还在不在、首页回不回。跑完删掉建的目录，日志与结果写进 `runs/`。

## 结果

- 改之前（`runs/20261017022212-*`）：第 1 轮开发服务就退出，`ENOENT: no such file or directory, scandir '…\zz-vanish-…\sub-23\page-0'`，和 SST 协作站上的报错同一处
- 改之后（`runs/` 里另一次）：5 轮服务都在，首页 200，日志里没有 ENOENT

根因与改法见轨迹卡 `docs-site/trajectory/2026-10-17-content-layout-dir-vanishes.mdx`。
