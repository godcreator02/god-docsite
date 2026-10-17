# MDX 报告迁到 word-report 0.6.0 的 WordPlainMath 写法

运行：`node migrate.mjs <报告目录> <0.5.x 的 dist/core.mjs> <0.6.0 的 dist/core.mjs>`；核对通过后加 `--write` 才改写报告目录里的 `.mdx`。0.5.x 的 `core.mjs` 取站点 `node_modules/@godcreator/word-report/dist/`，0.6.0 的在 `packages/word-report` 里 `pnpm build` 后取。

## 做什么

- `<WordPlainMath tex="X">Y</WordPlainMath>` 改成 `<WordPlainMath word="Y">$X$</WordPlainMath>`
- `<strong>Z</strong>` 改成 `**Z**`
- 核对：迁移前的文件用 0.5.x 编译、迁移后的用 0.6.0 编译，两份报告文档序列化后逐字相同才写文件（生成的 id 也一样）；`**` 不认的位置会让结果不同，整批不写

## 结果

chb-dab-sst 协作站的初步设计报告（`site/reports/sst-preliminary-design/`，15 个 `.mdx`）：760 个 `<WordPlainMath>`、14 处 `<strong>`，迁移前后两份文档逐字相同。
