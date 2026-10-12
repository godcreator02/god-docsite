# 新增正文：主会话独立复测

2026-10-12 03:43—03:46 Asia/Shanghai。目标仅验证React Router + Fumadocs dev新增正文；不推导全部评论实现的正确性。

环境为S的site-b，React Router8.4.0 / Vite8.3.4 / fumadocs-core16.17.1 / fumadocs-mdx15.4.7，Windows。路由/docs无评论action/fetcher。官方createClientLoader/useContent，另有公开raw入口预查。两组只切index.target，其余代码相同。S回执completed/roundIsOver/yolo。

## 默认 fumadocsMdx()

- 主会话暂时只改vite.config.ts中的插件参数，启动5521；已有正文、TSX和图片正常。
- CUA真实点击建立外壳计数1、已有正文内计数1，分别输入root-controlled/root-dom。
- 先创建局部TSX与SVG，03:43:57.927创建root-review-vite.mdx；等待30秒后导航没有新增，两个计数和输入不变。
- 独立GET /docs/root-review-vite返回404，正文标题未出现。
- .source/server.ts使用import.meta.glob，相对base为./../content/docs。
- 结论：在这个样本/机器/版本组合中，默认接线没有更新新增页。尚未单独定位Vite/glob路径/fumadocs的责任，不能推广为所有平台/所有配置失败。

## index.target = default

- 停服务、逐字恢复S原vite配置，重新启动同端口，重新建立基线：外壳1、正文1、双输入retain-controlled/retain-dom。
- 03:45:23.095新增另一篇root-review-default.mdx；下一次浏览器读取已出现导航。主会话未精确计时，S的约300ms仅作其采样结果。
- 页面timeOrigin保持1791747897047.8；外壳1、双输入完整；已有正文内TSX计数从1变0。
- CUA真实点击新增导航，标题和自写RootReviewCounter正常出现；真实点击新组件0→1，图片complete=true且naturalWidth=40。客户端导航timeOrigin仍不变。另开新标签直达同URL正常呈现。
- 结论：新增页可用，整页/整路由未重挂；未改动MDX正文子树的状态仍丢失。相关createClientLoader实例重建是待解决的接点，不能说状态全部保留。

## 控制台与证据限制

两次启动各有一条hydration属性不匹配警告，指向样本DocsRoute用Math.random生成data-identity；属于实验探针自身问题，S的“全程零错误”口径过宽。本次不把该属性作为挂载判据；实际计数、输入和timeOrigin可观察。新增和客户端导航阶段没有额外console错误。S此前use().default的async组件错误对照已明确作废。

没有全量复审或扩展删除矩阵。两个临时浏览器标签、主会话服务已关闭；4个仅由主会话创建的临时内容文件已精确删除，vite.config与复测前备份哈希一致。S原始样本/日志保留，生成入口由下次启动重新生成。

## 对后续判断的影响

先前“正文新增没问题，只是评论列表抢先显示”的推断不充分。现在证据至少涉及两层：默认接线的新增页发现/清单更新，以及可用接线下正文组件状态重置。评论提交的时序窗口仍可能存在，但不能再作为唯一原因。当前完成用户要求的正文新增基线，下一步由这两个具体结果讨论，不自动扩展实现。
