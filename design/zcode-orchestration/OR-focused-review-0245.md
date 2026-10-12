# O/R 返工定点验收

2026-10-12。按用户要求聚焦关键修正，不全量重审所有模块。

## O 正文外覆盖层

- 实读 highlight.ts、comment-overlay.tsx、placement.ts：按实例 useId 派生高亮名，清理只删本实例；实测卡片高度参与翻转/夹限；事件触发 rAF/timer 两者先到即撤销另一个。
- 主会话本地 Vitest：placement.test.ts + comment-overlay.test.tsx，31 passed，exit0。包含双实例和卸载、卡片边界相关用例。
- 对已有构建产物启动 preview 5480，CUA真实点击 fixed-text 徽章出现对应卡片；真实点击宿主展开按钮后 folded-text 徽章出现，真实点击 details 收起后徽章消失。
- 真实点击靠底部 fig-a：目标 top492.135/bottom707.458，视口高720；卡片 top311.135/bottom484.427，正确翻到上方且在视口内。
- 同时存在 docsite-comments-overlay-_r_0_ 和 _r_1_；article 下评论overlay/badge/data-commented-element计数0。console warn/error为空。
- 临时标签与服务已关闭。此次未穷举所有嵌套滚动/缩放场景。

结论：本轮多实例与卡片边界修正验收通过，可作集成基础。

## R 写作组件/编译

- 读取 source.config.ts：Config API命名 docs/notes 集合，各自applyMdxPreset，docs启用术语插件而notes不启用；不再全局skipFile路由集合。
- 读取Term实现：useId代替全局seq，普通同构React组件。库侧SSR相关6项测试主会话独立重跑通过（包含同页ID关联、两次独立SSR一致）。
- fixture的真实.source/server + getText('processed') 3项测试主会话独立重跑通过。存在中文数学示例的KaTeX unicodeTextInMathMode警告，未伪报无警告。
- 交付方报告本轮基线已改core/base-ui16.17.1、mdx15.4.7、Vite8.3.4，类型/构建通过。真实hover/hydrate为交付方证据，本轮不重复所有浏览器交互；旧合成Tabs/Accordion仍只属自检。

结论：本轮方向/SSR ID/公开Markdown输出修正通过重点复核；不等同全部写作组件浏览器穷尽验收。

## N 与下一步

N已交回并释放。保留复现和本人署名修复；“SSR更新必然整树remount”和“无公开入口查询”的因果判断不采纳为定论。reloadModule仍走Fast Refresh；browserCollections.raw是现有公开入口。S新会话在独立最小probe中做对照，不续叠N的HMR store/草稿持久化。
