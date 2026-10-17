`.\.venv\Scripts\python.exe .\probe.py`

## 问什么

把 Word／MathType 通用操作提取为正式 `src/docreport/`，把本报告内容与规则留在 `reports/demo-report/` 后，能否保持已验收的十页正文、公式编辑与自动编号行为？

## 怎么运行

在本目录用 PowerShell 7。首次只创建一个用于启动本探针的私有 Python 3.12 venv；探针启动器只使用标准库，不继承仓或系统库。

```powershell
..\..\.venv\Scripts\python.exe -m venv .venv
.\.venv\Scripts\python.exe .\probe.py
```

探针先检查档案 SHA-256，再把冻结的 `input/repo/` 复制到仓根全新的 `out/<探针名>-<时间>-<随机值>/workspace/`。随后在该副本**实际创建 `workspace/.venv`**，安装副本 `requirements.txt` 的全部固定版本，再用 `--no-build-isolation --no-deps -e` 安装副本项目。正式引擎通过这个副本自己的 Python 执行；既不修改冻结源码，也不跳过 `require_environment()`。

引擎环境的创建、依赖安装、纯代码测试和正式生成命令都会写入新的 `rerun.json` 与 `step-*.txt`。新报告位于 `workspace/out/result/report.docx` 及同名 PDF。已有输出目录被拒绝。创建环境可能需要从配置的 Python 包源下载固定版本。正式代码依赖本机 Word、已注册且授权可用的 MathType，使用 COM/API，不控制桌面点击。

只校验归档或查看参数，不创建 venv、不启动 Word：

```powershell
.\.venv\Scripts\python.exe .\probe.py --check-archive
.\.venv\Scripts\python.exe .\probe.py --help
```

如需重复本次页面像素回归，指定本机 Poppler：

```powershell
.\.venv\Scripts\python.exe .\probe.py --poppler-dir 'C:\path\to\poppler\bin'
```

这个选项使用同一个 `pdftoppm.exe`、110 dpi 渲染新报告与冻结的 `input/baseline/report.pdf`，逐页比较 12 页像素并保存 `pixel-comparison.json`。无此参数时只完成正式自动化生成，明确记录像素比较未执行。无论像素比较是否通过，都不会复制旧验收冒充新记录；新 PDF 仍需要实际逐页检查。

## 结论

`formal-r02` 共 12 页，其中正文 10 页；6 个 MathType OLE、0 个 OMML，行间公式居中、右侧按章编号，临时插入与删除公式行后的编号和引用检查通过。全部 12 页由主会话逐页查看，且与此前验收的 `project-report-mathtype-r02` 全部逐页像素相同。

`formal-r01` 在临时编号行删除检查失败，`formal-r02` 改为先用非空文本 Range 查找临时行，再删除其整段。保留前一轮的 `verification.json`、`manifest.json` 和不保存的修复验证 `numbering-repair-check.json`。**r01 当时的完整工作树源码未冻结**；本目录不反推、不声称逐字复现失败轮，只保留其真实输入哈希和失败记录。

`evidence/formal-r02/` 保存通过的自动检查、生成清单、逐页验收、像素比较，以及最终 DOCX/PDF。中间稿、页面 PNG 等大文件保留原路径与 SHA-256 索引，未复制的文件仍只在原 `out/`，不算持久归档。本次归档仅做哈希、CLI 和静态检查，**没有再次启动 Word／MathType**。

## 运行那次的环境

2026-10-10，Asia/Shanghai。Windows 11 x64，Python 3.12.14，Microsoft Word 16.0.14334；依赖固定为 pywin32 312、comtypes 1.4.17、pypdf 6.10.0、Pillow 12.3.0、setuptools 80.9.0。完整环境与公式 API 检查见原始证据。

`baseGitCommit` 为 `6c6de0a4f6dc025be5ca7446b9483d779d01a35b`，**仅是生成时仓库的基础提交**。本次正式实现当时仍是尚未提交的工作树，不能说已包含在这个旧提交。`input/archive-manifest.json` 对冻结的每个正式源码、报告输入、模板和测试文件记录 SHA-256；其中 11 个生成输入哈希全部与 `evidence/formal-r02/manifest.json` 相符。额外测试文件是归档时的工作树快照。

历史自动化与视觉检查是分开的证据：`verification.json` 的通过状态仍含 `visual_review_pending`，另由同一 PDF 哈希的 `visual-review.json` 记录实际逐页通过，不改写原始自动化日志。

## 挪入本仓

本目录原是本机仓 word-conversion-lab 的 `probes/2610102028_formal-pipeline-regression/`，2026-10-17 随那个仓的轨迹卡挪进本仓；那个仓已退役，2026-10-17 连同备份一起删除（最后一个提交是 `3146c64`），本机和远端都不再有它的代码。上面的命令与相对路径都以那个仓的仓根为准，现在不能再重跑，本目录只作为当时的实验记录。
