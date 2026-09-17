# catalog · gwb-docfirst-workflow

插件的身份卡：是谁、提供什么、靠谁。命令清单不存卡——现扫门的 `index`。
登记面变了这张卡要跟着改，`tests/catalog.test.ts` 钉着防漏（源码 inject 的服务名必须在卡上；正本住 @godcreator/gwb-repo-kit）。

**定位**：docfirst 插件——在刚铺好的 fumadocs 骨架上装配六区与接线（docfirst.attach，插件里就这一条命令），外加六份说明书：讲机制的三份（docfirst 装六区 / docfirst-docs 写文档 / trajectory 记卡）加讲通用开发纪律的三份（spec-grill 先盘问 / parallel-by-module 并行派活 / docs-governance 文档与注释治理）。核对/确认/渲染不经插件——那是仓里的事，agent 自己 cd 过去跑 pnpm doc。

## 提供

（无服务——命令经总线直接面客，本插件没有窗格）

## 依赖

`gwbCommands`（硬依赖，inject）、`gwbSkills`（局部注入）

## 命令

命令清单不存卡——**现扫门的 `index`**（回执的命令行自带 plugin 包名归属；要用法走 `search {"plugin":"@godcreator/gwb-docfirst-workflow"}`）。
