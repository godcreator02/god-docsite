# catalog · gwb-docfirst-workflow

插件的身份卡：是谁、提供什么、靠谁。命令清单不存卡——现扫 `/surface`。
登记面变了这张卡要跟着改，tests/catalog.test.ts 钉着防漏。

**定位**：docfirst 件——在刚铺好的 fumadocs 骨架上装配六区与接线（docfirst.attach，件里就这一条命令），外加六份说明书：讲机制的三份（docfirst 装六区 / docfirst-docs 写文档 / trajectory 记卡）加讲通用开发纪律的三份（spec-grill 先盘问 / parallel-by-module 并行派活 / self-explaining-code 代码自解释）。核对/确认/渲染不经件——那是仓里的事，agent 自己 cd 过去跑 pnpm doc。

## 提供

（无服务——窗格与命令经总线直接面客）

## 依赖

`gwbCommands`（硬依赖，inject）、`gwbSkills`（局部注入）

## 命令

命令清单不存卡——**现扫 `/surface`**（`?plugin=gwb-docfirst-workflow` 取这一组的形状）。
