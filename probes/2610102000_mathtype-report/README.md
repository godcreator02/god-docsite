`.\.venv\Scripts\python.exe .\probe.py`

## 问什么

能否从同一 JSON 生成包含行内与行间 MathType 的完整十页正文？

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

MathType 需要本机已安装、注册且授权可用；使用 COM/API，不依赖桌面点击。

新的 `rerun.json` 会明确记录自动化结果和“视觉检查未执行”。脚本不会复制旧视觉通过记录冒充新验收。本次整理**没有启动 Word/MathType 重跑**；只验证档案字节与重跑入口。

## 结论

r02 共 12 页：6 个 Equation.DSMT4、0 OMML，行间式 (3-1) 至 (3-5)，交叉引用插入后变化正确，六条公式保存重开读回通过，12 页逐页验收。

r01 的 aligned 被 MathType 渲染为未识别红字；r02 对本次两列公式适配 array{rl}。r01 源码未冻结，array 单测脚本未保存，不能逐字复现失败轮。本项覆盖创建和重开读取，不代表六类公式内部覆盖编辑或任意 LaTeX 已通过。

`evidence/` 保留所有实际存在的小型 JSON/TXT/源码记录，包括失败轮次；选取核心成功/失败 DOCX 和 PDF 保存显示证据。全部原始文件（含未复制的 PNG、中间稿和大型报告）的原路径、大小、SHA-256 与归档映射在 `input/archive-manifest.json`。未复制文件仍位于原 `out/`，受 Git/备份排除，不能把它们当作持久归档。

提交时存在的源码冻结在 `input/history-source/<commit>/`，运行入口采用 `input/repo/` 中对应版本。原 out 中确有的源码快照另按原样保留在 `evidence/`。Git 保存的 LF 与历史工作树 CRLF 可能造成原始哈希不同，清单区分这两种来源；没有保存的临时源码明确属于证据缺口。历史 JSON 中的旧 `runs/` 路径保留原文，不代表新生成位置。

## 运行那次的环境

实验发生于 **2026-10-10（Asia/Shanghai）**。本实验冻结代码提交为 `6c6de0a4f6dc025be5ca7446b9483d779d01a35b`。

Windows x64，Python 3.12.14，Microsoft Word 16.0.14334。MathType 实验使用 MathType 7.11.1.462 与 64-bit MathPage.wll。具体授权状态、工具版本和包版本以 evidence 中每轮原始记录为准。

本次归档时间为 `2026-10-10T20:19:55.425231+08:00`。原始轮次为：

- `out/project-report-mathtype-r01/`
- `out/mathtype-array-check/`
- `out/project-report-mathtype-r02/`
- `out/project-report-omml-regression-mt01/`

## 挪入本仓

本目录原是本机仓 word-conversion-lab 的 `probes/2610102000_mathtype-report/`，2026-10-17 随那个仓的轨迹卡挪进本仓；那个仓已退役，2026-10-17 连同备份一起删除（最后一个提交是 `3146c64`），本机和远端都不再有它的代码。上面的命令与相对路径都以那个仓的仓根为准，现在不能再重跑，本目录只作为当时的实验记录。
