# Word 导出为什么慢、改哪几处

```powershell
packages\word-report\engine\.venv\Scripts\python.exe probes\2610170945_word-export-speed\bench.py <报告快照目录> <layout.json> <标签>
```

## 问什么

协作站初步设计报告（155 页、74 张表、806 个行内公式、52 个行间公式）导出一次 Word 要 26 分钟，时间花在哪、改哪几处能明显变快。

## 怎么运行

1. 准备报告快照：一次 `report-docx export` 在引擎 `out/web-<任务 id>/input/` 留下的目录（`content.json` 加 `assets/`）就是快照，`layout.json` 在它旁边。
   报告内容属于 chb-dab-sst 项目，不进本仓；本次用的快照在 `D:\unitfolders\b2o8l-sst-mmc-2026\wr-engine\out\web-34c4cc20-8007-4e20-a37f-3fb0fab900bf\`。
2. 小样本：`node probes\2610170945_word-export-speed\make-sample.mjs <快照 input> <样本目录> c2`，再按 `runs/01-sample-runs.txt` 开头写的只留 c2-intro1、c2-iso、c2-3 三节；样本用空 layout `{}`。
3. 上面那条命令跑整条导出（排版稿、公式、更新域、PDF 与核对），按阶段打出秒数，输出在所用引擎的 `out/bench-<标签>-<时刻>/`。
   用哪份引擎由运行它的 `.venv` 决定：基线用 0.4.0 的引擎副本（自建 `.venv`），改动后用本仓 `packages/word-report/engine`。
4. 环境变量 `BENCH_OPTIONS=proofing` / `pagination` 在排版稿阶段关掉 Word 的随打随查或后台分页（结束后恢复原值）；`BENCH_DETAIL=1` 按内容类型拆排版稿耗时（各项有嵌套，不能相加）。
5. `profile-compose.py` 用 cProfile 剖析排版稿一步，`runs/00-full-compose-cprofile.txt` 是 0.4.0 在整份报告上的结果。

## 结论

整份报告从约 26 分钟降到 6.5 分钟。占位符顺序查找、单段单元格一次写入、日志节流之后是 16.4 分钟（`runs/02-full-before-plain-math.txt`）；
行内公式能写成文字的写成文字（760 / 806），MathType 对象从 858 个降到 98 个，公式阶段 320 → 40 秒，更新域 103 → 22 秒，总共 391.5 秒（`runs/03-full-plain-math.txt`）。
早绑定、关随打随查、关后台分页在样本上都在噪声内（`runs/01-sample-runs.txt`）；cProfile 显示的「60% 花在 pywin32 类型查询」主要是剖析器自身的开销。
轨迹卡 `docs-site/trajectory/2026-10-17-word-export-speed.mdx`。

## 运行那次的环境

2026-10-17，Windows 11 Pro 10.0.26200，Python 3.12.10，pywin32 312，comtypes 1.4.17，Word 16.0（Microsoft 365），MathType 7（MathPage.wll 64 位）。
被测对象：god-docsite `de9f5b49`（word-report 0.4.1，引擎与 0.4.0 相同）及其上未提交的引擎改动，改动随轨迹卡同一个提交。
