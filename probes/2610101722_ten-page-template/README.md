`.\.venv\Scripts\python.exe .\probe.py`

## 问什么

自建原生 dotx 能否覆盖十页正文的公式、长表、横向节、目录和编辑回归？

## 怎么运行

在本实验目录使用 PowerShell 7。首次执行先创建**本实验自己的** Python 3.12 venv 并装本目录锁定依赖。下面只借仓 venv 的 Python 可执行文件创建新环境，不继承仓或系统的库；不使用 `--system-site-packages`。

```powershell
..\..\.venv\Scripts\python.exe -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe .\probe.py
```

仓 `.venv` 若不存在，先按项目说明配置 Python 3.12，再创建本实验 `.venv`。此后独立重跑只需第一行命令。Python 依赖版本冻结在本目录 `requirements.txt`，不会读取正式工程的依赖文件。

脚本校验冻结输入和证据的 SHA-256，复制 `input/repo/` 到仓根全新的 `out/<探针名>-<时间>-<随机值>/workspace/`，然后执行冻结的历史 Python 入口。只在这个新工作区内生成 DOCX、PDF 和日志，不会重写归档或原历史 out；已有输出目录会被拒绝。Word 实例仅由历史脚本拥有和关闭。

```powershell
# 只核对档案完整性，不启动 Word，也不宣称重跑了实验：
.\.venv\Scripts\python.exe .\probe.py --check-archive
# 只展开一个全新的工作区：
.\.venv\Scripts\python.exe .\probe.py --prepare-only
# 可选：使用本机 Poppler 导出新 PDF 的逐页 PNG（仍需逐页人工检查）：
.\.venv\Scripts\python.exe .\probe.py --poppler-dir 'C:\path\to\poppler\bin'
```



新的 `rerun.json` 会明确记录自动化结果和“视觉检查未执行”。脚本不会复制旧视觉通过记录冒充新验收。本次整理**没有启动 Word/MathType 重跑**；只验证档案字节与重跑入口。

## 结论

r03 共 12 页，其中正文 10 页；6 条 OMML、5 张表、2 幅图，通过全公式编辑、编号插入、表格增行及修订检查，并逐页验收。

r01/r02 中间源码未单独留存；r03 对应 Git 提交冻结。归档保留全部已存在失败/中间检查记录，新运行不自动宣告视觉通过。

`evidence/` 保留所有实际存在的小型 JSON/TXT/源码记录，包括失败轮次；选取核心成功/失败 DOCX 和 PDF 保存显示证据。全部原始文件（含未复制的 PNG、中间稿和大型报告）的原路径、大小、SHA-256 与归档映射在 `input/archive-manifest.json`。未复制文件仍位于原 `out/`，受 Git/备份排除，不能把它们当作持久归档。

提交时存在的源码冻结在 `input/history-source/<commit>/`，运行入口采用 `input/repo/` 中对应版本。原 out 中确有的源码快照另按原样保留在 `evidence/`。Git 保存的 LF 与历史工作树 CRLF 可能造成原始哈希不同，清单区分这两种来源；没有保存的临时源码明确属于证据缺口。历史 JSON 中的旧 `runs/` 路径保留原文，不代表新生成位置。

## 运行那次的环境

实验发生于 **2026-10-10（Asia/Shanghai）**。本实验冻结代码提交为 `e8e308e51ea99863800dcce518fcff3767856b12`。

Windows x64，Python 3.12.14，Microsoft Word 16.0.14334。MathType 实验使用 MathType 7.11.1.462 与 64-bit MathPage.wll。具体授权状态、工具版本和包版本以 evidence 中每轮原始记录为准。

本次归档时间为 `2026-10-10T20:19:55.425231+08:00`。原始轮次为：

- `out/project-report-r01/`
- `out/project-report-r02/`
- `out/project-report-r03/`

## 挪入本仓

本目录原是本机仓 word-conversion-lab 的 `probes/2610101722_ten-page-template/`，2026-10-17 随那个仓的轨迹卡挪进本仓；那个仓已退役，最后一个提交是 `3146c64`，bundle 是 `D:\unitfolders\nb9zj-word-conversion-lab\word-conversion-lab.bundle`。上面的命令与相对路径都以 word-conversion-lab 的仓根为准：要重跑，先从 bundle 克隆那个仓、照它的 README 建 `.venv`，在它的仓根下运行。
