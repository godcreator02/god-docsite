从仓根执行 `.\.venv\Scripts\python.exe probes\2610111508_live-word-session\live.py --out out\live-session-001 --cases character cell table formula`，先生成十页基准，再在同一 Word 实例和文档内测每类首次加三次连续修改。

# 持续打开 Word 的增量实验

本实验只改变会话与验收时机：一个工作副本、一次启动 Word，连续修改；未修改的 MathType 对象不激活，改公式时只新建并验证目标对象。正式入口未改，未恢复 XML 批量写入或公式片段缓存。

## 固定材料与复现

`fixture/`、`engine/`、`common.py` 固定自上一轮十页增量实验；依赖版本在 `requirements.txt`。需要本机 Word 16.0.14334、可编辑的 MathType、相同字体和仓内 `.venv`。依赖和输入不能自动等同于其他机器的环境。

已有且哈希可核对的基准可省略首次构建：

```powershell
.\.venv\Scripts\python.exe probes\2610111508_live-word-session\live.py --baseline out\incremental-ten-base-r03 --out out\live-session-002
.\.venv\Scripts\python.exe probes\2610111508_live-word-session\live.py --baseline out\incremental-ten-base-r03 --out out\live-cell-002 --cases cell
```

每次换新输出目录。默认测试正文一字、整表重建、公式替换；`cell` 只修改单元格文字，不重建表格。实验只操作自己创建的 Word，结束时关闭该实例；没有部署长期常驻服务。

## 实测

| 操作 | COM 修改中位数 | 修改并保存中位数 | 修改至 PDF 中位数 |
| --- | ---: | ---: | ---: |
| 改一个汉字 | 0.363 s | 0.626 s | 5.577 s |
| 改一个单元格文字 | 0.330 s | 0.582 s | 5.653 s |
| 删除并重建 3×2 普通表格 | 5.226 s | 5.465 s | 10.322 s |
| 替换一个 MathType 并读回 | 1.303 s | 1.549 s | 6.701 s |

每类四次，含第一次操作及三次连续操作。`live-word-r02` 的十二次操作使用同一个 Word PID 90572；复制工作副本只做一次，约 0.0008 s，启动并打开一次为 5.335 s。单元格补测在另一独立会话中做四次，启动 4.795 s。系统缓存未清空，不能把这里的首次操作称作整机冷启动。

“修改至 PDF”包含修改、第一次保存、全部域/目录更新与分页、再次保存、整份十页 PDF 导出。保存等待后台队列清空，未改变用户的后台分页／保存设置。后台保存状态的含义见 [Microsoft Learn](https://learn.microsoft.com/en-us/office/vba/api/word.application.backgroundsavingstatus)。

静态检查另计，每次约 0.13–0.14 s；会话末尾才做一次保存重开和最终文档检查，主试验约 5.17 s，未混入日常编辑时间。这里没有测屏幕绘制延迟或跨进程 RPC 服务请求延迟，测的是本机 Python COM 调用到返回及后续处理。

## 正确性与显示

每轮检查保存稿的内容、格式、域结果、表格与 MathType 数量、图片字节、十页 PDF 及未修改公式的嵌入数据。正文和单元格修改不启动 MathType API；整表重建不激活公式；公式替换只激活目标，另一个公式的数据哈希始终不变。

主试验及单元格补测的最终 PDF 各十页均已查看，无裁切或重叠。中间每轮有自动检查和 PDF，未逐份做显示验收，不能继承最终稿的视觉通过。只覆盖不改变结构的小型内容修改；章节增删、分页剧变、复杂表格、协同人工编辑、Word 崩溃恢复未测。

首次运行 `live-word-r01` 因把窗口句柄误取自 Application 而失败，还没完成任何修改；改为 Document.ActiveWindow.Hwnd 后通过。失败日志、源快照与成功数据同时保留。

## 证据

`evidence/live-word-r02/` 和 `evidence/live-word-cell-r01/` 保存原始逐轮计时、启动信息、API 事件、最终摘要与显示记录；`evidence/results.json` 从原始数组逐项计算中位数，包括“修改并保存”，不把两个独立中位数直接相加。`archive-manifest.json` 固定材料哈希。大体积 DOCX、PDF、页面图仍在 out/，原路径及哈希不等于已归档文件本身。

## 挪入本仓

本目录原是本机仓 word-conversion-lab 的 `probes/2026-10-11-live-word-session/`，2026-10-17 随那个仓的轨迹卡挪进本仓；那个仓已退役，最后一个提交是 `3146c64`，bundle 是 `D:\unitfolders\nb9zj-word-conversion-lab\word-conversion-lab.bundle`。上面的命令与相对路径都以 word-conversion-lab 的仓根为准：要重跑，先从 bundle 克隆那个仓、照它的 README 建 `.venv`，在它的仓根下运行。
