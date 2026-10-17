# MDX 报告迁到 word-report 0.5.0 的写法

运行：先在 `packages/word-report` 里 `pnpm build`，再在本目录 `node migrate.mjs <报告目录> <装着 Python 3 的 python.exe>`；核对通过后加 `--write` 才改写报告目录里的 `.mdx`。

## 做什么

- 组件名加 `Word` 前缀：`Figure`、`Figures`、`Panel`、`Table`、`Caption`、`Ref`、`Cite`、`Abstract`、`Reference`、`Bibliography`
- 0.4.2 的 Word 引擎会写成文字的 `$…$`，改写成 `<WordPlainMath tex="…">…</WordPlainMath>`，组件里的文字就是 0.4.2 引擎写进 Word 的那几段（斜体写成 `*…*`，下标上标写成 `<sub>`、`<sup>`）。判断与文字都来自 `plain_math_0_4_2.py`，它是提交 e11663ed 里的 `engine/src/docreport/plain_math.py` 原样取出，0.5.0 的引擎里已经没有这个解析器
- 核对：迁移前（只改名）与迁移后各编译一次，除了生成的 id、不写 `alt` 的图的默认 alt、多出的 `plainText` 之外逐项相同，`plainText` 等于 0.4.2 引擎写出的文字；有一处不符就不写文件

## 结果

chb-dab-sst 协作站的初步设计报告（`site/reports/sst-preliminary-design/`，15 个 `.mdx`）：806 个行内公式里 760 个改成 `<WordPlainMath>`（不同的 TeX 255 种，对照在 `mapping.tsv`），46 个保留 `$…$` 交给 MathType，核对零差异。和 0.4.2 导出时的数字一致（760 个写成文字、行内加行间共 98 个 MathType 对象）。
