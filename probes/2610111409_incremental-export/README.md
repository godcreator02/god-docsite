从仓根执行 `.\.venv\Scripts\python.exe probes\2610111409_incremental-export\noop.py --create-baseline --baseline out\inc-base-001 --out out\inc-noop-001`，生成固定十页基准稿并测四次无变化复用。

# 增量写入实验

这是独立 probe，不是正式增量入口。用户决定撤掉 XML 批量写入和公式片段缓存，研究在上一版完整 DOCX 的副本里通过普通 COM 更新变化对象；随后要求把性能测试稿缩至总计十页。正式路径仍全量生成，旧批量实验在相邻的 `2610111327_export-performance/` 保留。

## 固定输入与环境

`fixture/` 是一页封面、一页目录、八页正文，包含中文段落、字符格式、一个普通表格、一张实际 PNG、两个行间 MathType 和跨章节引用。用显式章节起页固定十页，报告模块在真实 Word 中断言总页数。它不是五十一页 SST 全文的等比例缩影，耗时不能外推到其他工作量。

解释器必须是仓内 `.venv/Scripts/python.exe`。依赖版本在本目录 `requirements.txt`；还需本机 Microsoft Word、MathType 与原字体。`engine/docreport/` 是撤回批量和缓存后的冻结串行引擎，仅调整独立实验所需路径；正式代码不导入本目录。模板是已有不压缩图片的模板副本，公共模板不修改。

## 三个入口

输出目录每次换新；下面命令都从仓根执行：

```powershell
.\.venv\Scripts\python.exe probes\2610111409_incremental-export\noop.py --create-baseline --baseline out\inc-base-001 --out out\inc-noop-001
.\.venv\Scripts\python.exe probes\2610111409_incremental-export\patch.py --baseline out\inc-base-001 --out out\inc-patch-001 --mode combined --repeat 4 --oracle
.\.venv\Scripts\python.exe probes\2610111409_incremental-export\boundaries.py --baseline out\inc-base-001 --out out\inc-boundary-001 --rebuild
```

`patch.py` 的模式还可选 `paragraph`、`table`、`formula`，分别只改一个对象。`--oracle` 用修改后的同一 JSON 再执行完整串行生成，并比较书签内容、表格内容和逐页 PDF 文本。`boundaries.py --deletion-only` 是表格删除问题的最小原生复现。

## 本轮观测

`evidence/incremental-noop-r02/summary.json` 保存四轮无变化复用，含输入、依赖环境和上一版文件哈希核对，中位数约 0.43 s。没有启动 Word；复制的是完整 DOCX、PDF，检查证据来自上一版，不能声称本轮重新生成、重新打开或重新逐页验收。

`evidence/incremental-combined-r03/summary.json` 的四轮组合更新为 34.710、39.140、34.729、44.535 s，中位数 36.9345 s；每次都从相同基准复制，改一段正文、整张表和一个公式，保留另一个公式的嵌入数据。十页基准首次全量构建的引擎计时为 62.491 s；修改后全量对照为 53.918 s。前两组全量数字是单次观测，不是全量重复试验的中位数，也不能据此承诺固定加速比例。四轮组合更新后补加了运行前后输入一致性防护；随后单项试验使用带防护的实现，源码快照随每次运行保存。

组合更新与同内容全量对照的源书签、表格文本及十页逐页 PDF 文本相同；图片字节、正文斜体和上下标、公式读回及对象数量均通过。像素显示检查单列为 `visual-review.json`，不能用自动比较替代。

## 已遇到的失败

首次 fixture 的图片字段和引用缺少必要字段，被 schema 拒绝；两份输入失败日志保留。十页首轮又因 Word 压缩图片导致字节核验失败，改用已有不压缩图片模板副本后通过。

`incremental-combined-r01` 失败：`Range.Delete()` 只清空了表格内容，外层表格仍在，新表变成嵌套表。`incremental-table-delete-r01/deletion.json` 独立比较 Range 与 Table 删除；局部更新改用 `Table.Delete()`。

`incremental-combined-r02` 失败：删掉整段及段落标记再插入文字，使下一段书签扩张，包含了被修改段落。改为保留原段落标记，仅替换文字范围，再恢复自身书签、样式与字符格式。r03 四轮通过原来失败的源段落与格式断言。

## 边界与代价

本轮局部更新支持同一章节结构下的纯正文段落、无合并且单段单元格的整张表、行间公式内容替换；表格题注不变。公式删除旧对象再新建，只向空 MathType 对象写 TeX。未变公式保持在文档里，无片段缓存导入，仍逐一激活读回。

增删或移动结构、元数据、题注、脚注、复杂表格或行内对象修改要求全量；模板、资源、引擎、受跟踪环境或上一版输出变化也使增量失效。结构回退路径实际测试一次插入并全量重建；其他拒绝项与缺书签检测分别记录，不混称全部回退渲染通过。缺锚点时当前 probe 返回 `full-required` 并停止，尚未自动衔接全量。

环境指纹覆盖引擎、模板、报告模块、图片、依赖清单、Word/MathType 可执行文件元数据、MathType 渲染偏好及字体文件元数据；不宣称覆盖全部 Word 设置、打印机驱动和跨机器差异。这里的 JSON/state 文件是受控本机试验材料，不是开放给不可信客户端的缓存协议。

局部更新后仍有 Word 启动、全部公式读回、全局域/目录更新、分页和完整 PDF 导出。增量不是零维护方案：已发现两类原生范围问题，也增加了状态、失效与复核逻辑；本轮证据只支持继续研究，不代表生产级任意结构增量已完成。

## 证据保存

`evidence/` 保存各轮成功、失败、阶段时间、检查、输入快照和运行代码快照。`artifact-hashes.json` 标记原运行目录中 DOCX/PDF 的哈希；这些大文件仍在 `out/`，没有被说成已获得 Git 归档。`archive-manifest.json` 列本实验固定代码、输入和证据的哈希。完整历史样例的十二页串行回归在用户要求十页前已运行，其记录仅作撤回兼容回归，不混入十页性能统计。

## 挪入本仓

本目录原是本机仓 word-conversion-lab 的 `probes/2026-10-11-incremental-export/`，2026-10-17 随那个仓的轨迹卡挪进本仓；那个仓已退役，最后一个提交是 `3146c64`，bundle 是 `D:\unitfolders\nb9zj-word-conversion-lab\word-conversion-lab.bundle`。上面的命令与相对路径都以 word-conversion-lab 的仓根为准：要重跑，先从 bundle 克隆那个仓、照它的 README 建 `.venv`，在它的仓根下运行。
