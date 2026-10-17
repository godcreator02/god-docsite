# 排版稿一步怎么少调 COM

```powershell
<引擎副本>\.venv\Scripts\python.exe probes\2610171700_word-export-compose\compose_ab.py <样本目录> <每章留几个子块> <轮数> <新的存盘目录> v060 engine
```

## 问什么

word-report 0.6.0 导出整份初步设计报告，最慢的是写排版稿（上次安静时 275 秒，占七成）。不走整块 XML 写入（10-11 那轮做过，按用户决定撤掉了，见轨迹卡「回到串行写入」），
只在逐项 COM 写入里减少跨进程调用，能快多少、写出的文档是否不变。

## 怎么运行

1. 引擎副本：把 `packages/word-report/engine` 复制到路径短的目录（不带 `.venv`、`out`），`py -3.12 -m venv .venv`，
   `pip install -r requirements.txt`、`pip install --no-build-isolation --no-deps -e .`，再 `pip install psutil`（读 Word 进程的 CPU 时间）。
2. 快照：`node snapshot.mjs <站点目录> <报告 id> <输出目录> [<章 id…>]`，和 `report-docx export` 写进 `input/` 的一样；
   引擎还不会排一个图号下的多张图，快照里换成第一张子图的单图，指到子图的引用改指整个图。不给章 id 时同时把 `layout.json` 复制成 `<输出目录>-layout.json`。
3. `compose_bench.py`：只测排版稿，按项拆开计时（第 4 个参数给 fast / fast2 换成试验子类）。
4. `compose_ab.py`：几版在同一个 Word 里轮流写排版稿，墙钟与 CPU（Python 加 Word）都记；第一轮各版更新域后存盘，用 `compare_docx.py` 比对正文与脚注
   （去掉 Word 每次随机生成的修订号、段落与图片编号、书签编号、占位块 GUID、目录书签名）。`v060` 是 `compose_0_6_0.py`（0.6.0 原样），`engine` 是副本里装的引擎。
   `fast_composer.py`、`fast_composer2.py` 写的时候建在 0.6.0 的引擎上，并入引擎之后再跑就和 `engine` 一样，只留作记录；`fast_composer3.py` 建在并入后的引擎上。
   `quiet`、`window`、`proofing` 是 `engine` 加上 `quiet_word.py` 里的设置：排版稿期间关掉屏幕刷新并换草稿视图（window）、关掉后台分页与边写边查拼写语法（proofing），quiet 两组都关。
5. 整份完整导出用上一轮的 `probes/2610170945_word-export-speed/bench.py`。

## 结论

`runs.txt` 有全部数字。并入引擎的两组改动（写出的文档更新域后与 0.6.0 逐字相同）：

- 少取区域：段落插入后直接用插入返回的区域，起点记在 Python 里；文字格式按偏移直接取区域，加粗倾斜设在区域上；样式对象与书签集合各取一次；没有合并单元格的表直接按行列取格
- 填域不再 Find：占位符写进正文时记下位置；脚注与链接按正文顺序替换、把后面的位置按正文长度变化平移；域与编号从后往前替换。紧挨在域后面的 Word 区域不跟着域移动，编号书签的结尾按正文长度变化自己算

整章样本上排版稿 103 → 60 秒。试过不采用的：域代码按样式决定清不清粗斜体、正文单元格不重设样式（fast3），没变快，Word 存盘的域结构还变了。
测时期间机器负载很重，墙钟只看交替对比。

## 运行那次的环境

2026-10-17，Windows 11 Pro 10.0.26200，Python 3.12.10，pywin32、comtypes 照引擎 `requirements.txt`，psutil 7.2.2，Word 16.0（Microsoft 365）。
被测对象：god-docsite `41516992`（word-report 0.6.0）及其上的未提交引擎改动，改动随轨迹卡同一个提交。
