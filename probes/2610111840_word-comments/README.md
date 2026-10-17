# Word 批注与回复是否能保存并回读

## 问什么

在本机锁定修订的十页稿里，分别给正文、MathType 和行内图片添加批注，再给正文批注添加回复。验证保存重开后的文字、作者、范围与父子关系，并确认正文和对象未被修改。

用户明确允许本次使用 Computer Use；日常流程的 COM 约定不变。原稿保留，操作对象为 `out/comment-review-r01/批注试验.docx`。

## 怎么运行

本次通过 Word 界面创建三条主批注和一条回复。创建位置分别为 `p-edit`、`eq-edit` 对象及图 1 对象；回复使用正文批注的“答复”按钮。第一轮界面文字输入发生无关剪贴板串入，已立即替换并清理一个空白重复批注，后续批注正文通过 COM 精确填写，不能将此轮记为纯 UI 输入成功。误输入原文不归档。

固定 `fixture/` 保存原稿、加批注后的稿件、内容 JSON 和相对路径会话信息；使用仓内 `.venv` 复现回读：

```powershell
.\.venv\Scripts\python.exe -X utf8 probes\2610111840_word-comments\readback.py --session probes\2610111840_word-comments\fixture --out out\comment-readback-new
```

脚本只复制、只读打开独立快照，采集原始批注、对象和书签上下文；语义解释由 agent 单独写到 `interpretation.json`，不自动形成正文修改。

## 结论

成立：三条主批注和一条回复保存后存在，Word `Comments.Count` 为 4，正文原有 `Revisions.Count` 仍为 3，锁定修订保持。正文文字、图片宽高、图片与 OLE 数据均未改变。正文批注对应 `p-edit`，公式批注锚定 `Equation.DSMT4` 并对应 `eq-edit`；图片批注范围本身只有对象占位表示，需要 agent 结合图像属性与其后“图 1 保留的图片”判断为 `fig-stable`。

回复关系同时由 COM `Ancestor`／`Replies.Count`／`Replies.Item(i)` 与保存包 `commentsExtended.xml` 的父段落关系核对。初版直接遍历 `Comment.Replies` 在本机返回全部文档批注，造成错误的回复列表；`comment-readback-r01` 保留该结果及更正记录，r02 使用按 Count/Item 访问后通过。界面动作可能晚于工具返回才完成，应确认已有批注数后再重试，避免空白重复项。

正文意见、公式核对请求、图片比例确认及讨论回复均独立于内容 JSON。本轮没有采用意见或修改正文。仅验证同一 Word 用户的本地批注／回复；跨作者、已解决状态、删除、锚点随正文增删的变化与线上同步尚未测试。已设置批注气泡显示并保留测试窗口供用户查看。

## 运行那次的环境

Word 16.0，Build 16.0.14334；依赖见 `requirements.txt`。界面通过 `@oai/sky`，文字填写与回读使用仓内 Python COM。`evidence/comment-ui-r01/` 记录输入异常及实际方法；`evidence/comment-readback-r02/` 为保存稿结果，r03 为冻结 fixture 的复现。所有记录绑定 DOCX 哈希，原运行产物留在 out。

## 挪入本仓

本目录原是本机仓 word-conversion-lab 的 `probes/2026-10-11-comments/`，2026-10-17 随那个仓的轨迹卡挪进本仓；那个仓已退役，最后一个提交是 `3146c64`，bundle 是 `D:\unitfolders\nb9zj-word-conversion-lab\word-conversion-lab.bundle`。上面的命令与相对路径都以 word-conversion-lab 的仓根为准：要重跑，先从 bundle 克隆那个仓、照它的 README 建 `.venv`，在它的仓根下运行。
