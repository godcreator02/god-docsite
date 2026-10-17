从仓根运行 `.\.venv\Scripts\python.exe probes\2610111624_locked-review\prepare.py --out out\locked-review-001`，创建并在 Microsoft Word 中打开锁定修订的十页审阅稿。

# 人工修改与修订回读实验

固定原稿为 `fixture/report.docx`，对应的语义内容为 `fixture/content.json`；依赖见 `requirements.txt`，始终使用仓内 `.venv`。准备脚本使用冻结的 `word_session.py` 拥有私有 Word 实例；实际供人编辑的文件随后用 Microsoft Word 打开，不关闭或修改其他文档。

输出目录保留不可变 `baseline.docx`、供人编辑的 `导师审阅试验.docx`、JSON 快照与 `session.json`。随机保护密码只保存在该 out/ 目录的 `unlock-key.json`，不打印、不纳入 Git 证据。保护类型为仅允许修订，解锁后才能关闭修订或接受／拒绝修订。

请手工修改并按 Ctrl+S 保存。回读前由用户明确表示已保存；脚本读取磁盘快照，不替用户保存正在编辑的文档，不关闭其窗口：

```powershell
.\.venv\Scripts\python.exe probes\2610111624_locked-review\readback.py --session out\locked-review-001 --out out\locked-readback-001
```

回读记录 Word 修订与批注、源书签定位、接受修订后的段落文字差异、拒绝修订的文字投影与原稿是否一致，以及嵌入对象与媒体数据是否变化。结果是审阅材料，不自动修改 JSON，也不自动接受或拒绝用户的修改。

段落标记删除、复杂表格结构、公式内部变化需要单独核对，不能只凭文字投影判断完整往返。MathType 在锁定修订下是否可编辑，以人工试验实际结果为准。准备完成不代表人工回读已经完成；成功与失败证据均保存在 `evidence/`，原始 Word 大文件仍留在 out/，哈希记录不等于文件本身已归档。

## 本次人工回读结果

`locked-readback-r02` 读取用户保存稿：Word COM 返回 3 组插入修订、0 条批注；分别为新增一段、表格新增三行，以及另一段末尾追加文字。新增段落落在扩展后的旧段落书签内，因此书签只提供位置线索，不能直接解释成修改旧 JSON 段落。

公式对象需要补充对照：

```powershell
.\.venv\Scripts\python.exe -X utf8 probes\2610111624_locked-review\details.py --session out\locked-review-r01 --readback out\locked-readback-r02 --out out\locked-details-002
```

`details.py` 先比较保存包的表格结构、图片和 OLE 对象哈希，只激活发生变化的 MathType 对象及对应原稿对象。读取使用已有本机桥接的只读 getter ABI；本脚本没有公式写入函数。为允许激活，对独立分析副本在内存中解锁，读取后不保存，用户文件和不可变基线均不解锁。

`locked-details-r01` 实测公式 `eq-edit` 从 `$P=VI$` 变为 `$P=VI123123$`，该变化不在 Word 修订集合中，XML 中该对象也没有插入／删除修订包裹。另一公式和普通图片数据未变。仅用 `Revisions` 会漏掉本次公式变化，必须对照发稿基线和嵌入对象。尚未测试实际批注／回复、删除、移动、合并单元格与多人冲突；本实验不提供自动合并。

首次 `locked-readback-r01` 因本机 COM 自定义属性 `Item` getter 报 Member not found 而失败，原始脚本及错误保留；随后直接读取保存包中的同名批次属性，核对值未改变，得到 r02 成功结果。`rejectedParagraphTextsEqualBaseline=false` 只是简化文字投影仍保留新段落／新表格行容器，不能当作 Word 实际拒绝所有修订的结果；本次没有执行接受或拒绝操作。

## 图片显示尺寸漏检与补测

用户随后指出图 1 改了尺寸。返回稿哈希与 r02 完全相同，原图字节也确实相同，但 Word 的显示宽高已变。此前“普通图片数据未变”只覆盖媒体字节，不能代表图片的布局未变；首次回读遗漏了这项用户修改。

`check_geometry.py` 绑定上述真实基线和返回稿哈希，直接调用实际 `inventory()`。修复前失败于缺少显示几何信息，修复后既检测同字节图片的尺寸变化，也验证原稿对自身不产生变化。用同一已保存样本中的明确字段差异锁定缺失读取层，因此没有继续进行保存时点或环境因素的多假设调查。

`details.py` 现额外采集 DrawingML 的显示尺寸、变换、裁剪及放置设置，用文档内唯一绘图 ID 配对；存在歧义时停止，不能用媒体哈希推断 JSON 源元素。当前尚未覆盖任意 VML、链接图、组合图、图表及全部图片特效，也未验收图片源 ID 映射。

```powershell
.\.venv\Scripts\python.exe -X utf8 probes\2610111624_locked-review\check_geometry.py
.\.venv\Scripts\python.exe -X utf8 probes\2610111624_locked-review\geometry.py --session out\locked-review-r01 --readback out\locked-readback-r02 --out out\locked-geometry-002
```

`locked-geometry-r01` 的 Word COM 只读重开证据：图 1 从约 9.00 × 3.09 cm 变为 10.65 × 5.67 cm，宽高比例改变；两份稿均为行内图、段落居中、四边裁剪为零。返回稿仍只有原先的 3 组文字／表格插入修订，未产生独立图片尺寸修订。保留旧证据及其遗漏，不将它改写成当时已经检出。补测没有重新激活 MathType、保存文档或修改 JSON。

## 挪入本仓

本目录原是本机仓 word-conversion-lab 的 `probes/2026-10-11-locked-review/`，2026-10-17 随那个仓的轨迹卡挪进本仓；那个仓已退役，最后一个提交是 `3146c64`，bundle 是 `D:\unitfolders\nb9zj-word-conversion-lab\word-conversion-lab.bundle`。上面的命令与相对路径都以 word-conversion-lab 的仓根为准：要重跑，先从 bundle 克隆那个仓、照它的 README 建 `.venv`，在它的仓根下运行。
