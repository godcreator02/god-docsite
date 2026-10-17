# Word 引擎迁入后的回归基线

```powershell
packages\word-report\engine\.venv\Scripts\python.exe -m docreport build packages\word-report\engine\reports\demo-report --out probes\2610131513_word-report-migration-baseline\runs\<新的运行目录>
```

## 问什么

Word 引擎（`docreport`）从 word-conversion-lab 的已提交基线迁进 docsite-kit（今天的 `packages/word-report/engine/`）之后，用原 demo 报告重新生成，结果是否与迁入前一致。

## 怎么运行

1. 在 `packages/word-report/engine/` 照它 README 的「环境」一节建好 `.venv`；本机要有 Microsoft Word 与 MathType。
2. 运行第一行命令，输出目录每次换一个新名字。输出里有 `draft.docx`、`report.docx`、`report.pdf`、`manifest.json`（输入文件的哈希与运行环境）与 `verification.json`（每一步的检查事件）。
3. 迁入的出处在 `migration-provenance.json`：源仓、源提交 `d6e01303`、每份迁入文件的 SHA-256；`migration-verification.json` 是这次回归的摘要（单元测试、依赖检查、真实 Word 运行的输出哈希与检查事件）。

## 结论

`runs/migration-baseline-20261013-01` 失败：已提交基线里链接的占位文字 `@LINK0@` 没被替换，`document_state` 报「Unresolved generation placeholders」。
迁入时显式替换锚点文字后，`runs/migration-baseline-20261013-02` 通过自动检查：12 页，编号公式 (3-1)～(3-5)，用时 148 秒，状态 `passed_automation_visual_review_pending`（逐页显示待人工查看）；
23 个 Python 单元测试与依赖检查通过，模板哈希未变。

## 运行那次的环境

2026-10-13，Windows 11 Pro 10.0.26200，Python 3.12.10，pywin32 312，comtypes 1.4.17，pypdf 6.10.0，Pillow 12.3.0；Word 与 MathType 版本记在两次运行的 `manifest.json`。
被测对象：word-conversion-lab `d6e01303` 的引擎，迁进当时 docsite-kit 仓的 `packages/word-report/`（迁入时只改了 `__main__.py` 与 `compose.py`，哈希见 `migration-verification.json`）。
两次运行的输出原在单元根 `report-leftovers/word-report/out/`，两份摘要原在分支 `wip/reports-on-old-kit` 的 `b144b23e`，2026-10-17 一起挪进本目录。
