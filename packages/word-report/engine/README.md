# Word report engine

正式 Word COM / MathType 引擎迁入本仓。来源、提交与每份原始文件的 SHA-256 见 `migration-provenance.json`。仅迁入源仓已提交基线，未迁入源仓未提交代码、probe、旧运行输出或虚拟环境。Python 包版本仍为 0.0.1，依赖版本保持来源固定值。

## 环境

使用本目录独立 `.venv`，不使用系统包、不复制源仓环境。Windows 64 位 Python 3.12、Microsoft Word 与 MathType 为实际导出的本机要求。

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m pip install --no-build-isolation --no-deps -e .
.\.venv\Scripts\python.exe -m pip check
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
```

## 报告包的数据入口

网站只用于阅读和评论。`@godcreator/docsite-reports` 的 `report-docx` CLI 与 `./export` API 先把分章内容编译成完整 `format: docreport` / `schemaVersion: 1` 文档与 `assets/`，交给以下入口。它们不依赖 gwb。`--data-only` 必须传递；这个模式不导入快照目录中的 `report.py`。未展开的文档引用不会通过正式 Schema。

```powershell
.\.venv\Scripts\python.exe -m docreport validate <快照目录> --data-only
.\.venv\Scripts\python.exe -m docreport build <快照目录> --data-only --out out\<新的运行目录>
```

需要版式数据时，可加 `--layout <layout.json>`，内容为已有 `validate_layout` 支持的节点 ID 字典：段落样式、图片宽度、表格列宽与行高、顶层章节起页与方向。默认采用 `templates/project-report.dotx`。报告包的 CLI/API 不接受任意 Python 布局程序。

已有 demo 保留其受信任的 `report.py` 与原入口，用于原有版式和专属验收回归：

```powershell
.\.venv\Scripts\python.exe -m docreport build reports\demo-report --out out\<新的运行目录>
```

一次运行只占用本包 `out/` 的新子目录；失败记录保留，不覆盖以前结果。COM 使用独立 `DispatchEx` 实例，只关闭本次实例内的文档。模板为只读输入，输入与输出哈希、保存重开检查、公式检查、DOCX/PDF 均写入本次输出。自动通过状态保持 `passed_automation_visual_review_pending`，逐页显示由用户检查，不能沿用旧输出的验收。

## 迁入回归

2026-10-13 的证据摘要见 `migration-verification.json`：23 个 Python 单测与依赖检查通过；原 demo 经迁入代码重新生成 12 页 DOCX/PDF，6 个 MathType 保存重开、5 张表、2 张源图片、正文、域引用和临时编号增删检查通过，模板哈希未变。页面显示仍待用户检查。

首次运行在 `out/migration-baseline-20261013-01` 留下失败记录：已提交基线的链接锚点保留 `@LINK0@`。迁入包显式替换锚点文字后，在全新目录 `out/migration-baseline-20261013-02` 重新生成并通过自动验收；没有使用源仓未提交的修补代码。

独立 CLI 回归时，MathType 将读回文本的外层 `$...$` 换成了 `\[...\]`，旧校验错误地判定公式变化。当前只规范化一对外层数学分隔符，内部 TeX 仍逐字比较；不会改写公式、改 MathType 全局设置或忽略内容差异。对应回归同时检查错误公式与不匹配分隔符仍被拒绝。
