# 协作站正文经 OMML 导出成 Word

```powershell
.\.venv\Scripts\python.exe -X utf8 routes\word-com\export_page.py runs\<新的运行目录>
```

## 问什么

协作站上的一页报告正文（MDX 里的 Markdown 加 LaTeX 公式）能不能不经过 MathType，直接经本机 Word 导出成正式版式的 DOCX：公式走 KaTeX 把 LaTeX 转成 MathML、
再用 Office 自带的 `MML2OMML.XSL` 转成 Word 原生公式（OMML），导出后的公式在 Word 里还能编辑。

## 怎么运行

1. 在本目录建 `.venv` 并装依赖：`python -m venv .venv`，`.\.venv\Scripts\python.exe -m pip install -r requirements.txt`；`site/` 下 `pnpm install` 装 remark 与 KaTeX（`site/package.json`）。
   本机要有 Microsoft Word，`MML2OMML.XSL` 的路径写死在 `routes/word-com/export_page.py` 与 `verify_export.py` 里（`C:/Program Files/Microsoft Office/root/Office16/`）。
2. 第一行命令读 `site/pages/report/sst-sample/page.mdx`：`site/parse-report.mjs` 用 remark 解析出结构、用 KaTeX 把每条公式转成 MathML，
   `routes/word-com/export_page.py` 经 Word COM 写入段落、标题、表格、图片、页眉页脚、横向节、目录与公式 SEQ 编号，公式经 XSLT 转成 OMML 后插入；
   导出后 `verify_export.py` 逐格比对表格、逐条比对公式结构与图片字节，`edit_native_formula.py` 在独立副本里改一处公式分母、保存重开再读回。
3. `site/report-export-plugin.mjs` 是当时站点里「导出 Word」按钮背后的 vite 中间件，`ReportExport.tsx` 是页面上的按钮；`import_sample.py` 是从原 Word 报告一次性取样生成 `page.mdx` 的程序。
4. 样例页的正文、图片、版式与取样记录（`sst-sample/` 下除 `ReportExport.tsx` 外的文件）是 SST 项目的报告节选，按仓根 `.gitignore` 只留在本机、不进 git；
   别处的克隆里没有它们，要重跑就换一页自己的 MDX 与 `word-layout.json`。实验当时的完整说明在 `lab-README.md`。

## 结论

可行：10 页样例导出出 6 张表、2 张图、15 个原生 OMML 公式、3 个方向节、1 个自动目录与 2 个公式编号域；247 个表格单元格逐格一致、15 个公式结构一致、两张图片字节一致；
在独立副本里把一个分式分母从 8 改成 9，保存重开后仍在、15 个公式对象都在。没有采用，原因见轨迹卡 `docs-site/trajectory/2026-10-10-collab-word-omml.mdx`。

## 运行那次的环境

2026-10-10，Windows 11 Pro 10.0.26200，Python 3.12，pywin32 312、python-docx 1.2.0、lxml 6.1.1、pypdf 6.10.0；Node 侧 katex 0.16.47、remark-parse 11.0.0、remark-math 6.0.0；本机 Microsoft 365 的 Word 16。
被测对象：本机仓 collab-word-lab 的提交 `16668dc`（单元 `nb9zj-word-conversion-lab`，没有远端），2026-10-17 把上面这些文件挪进本目录，站点的其余部分（协作站壳、评论记录）没有带过来。
