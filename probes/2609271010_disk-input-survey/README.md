# 本机各站的星轨盘数据长什么样

```
node survey.mjs <docfirst-trajectory 的 dist/index.mjs> <docfirst-workflow 的 dist/cards.mjs> <卡目录…>
```

## 问什么

给星轨盘换成中性输入、删多余机制之前，先看本机各站的卡实际用到了哪些路径：

- 扇区一圈装不下、要走「同域时间不搭界的树复用角度」的站有几个（决定 `packWithReuse` 留不留）
- 同一组同一天挤了几张卡（决定斜排、同日角偏、跨日错开这几层防重叠值不值得实测）
- 现有病卡多少条、有没有指向盘外的关系（决定「断掉的关系算病」会让哪些站多红）

## 怎么跑

用 2026-09-27 本仓 `a533adf` 构建出的两份 dist（`packages/docfirst-trajectory/dist/index.mjs`、
`packages/docfirst-workflow/dist/cards.mjs`），卡目录是 `D:\unitfolders\*\*\docs-site\content\trajectory` 能匹配到的全部。
脚本只读，不写任何文件。输出存在 `runs/2609271010.txt`。

这两份 dist 的导出（`buildModel`、`RingsLayout`、`scanCardDir`）在中性输入那一轮之后会变，要复跑就先 checkout `a533adf` 再构建。

## 结论

- 4 个站走「复用角度」：plecs-studio 1024°、gwb-kernel 1352°、gwb-block-note 753°、collab-site 442°。这条路径留着
- 同组同日最挤：plecs-studio 38 张、gwb-lifecycle-plugins 19 张、gwb-kernel 11 张。防重叠几层的取舍要在这几个站上截图对比
- 指向盘外的关系只有一处：gwb-paper-fetch 的 `2026-09-17-paper-fetch` 用 `pivots-from` 指向根卡 `2026-09-08-gwb-papers`
