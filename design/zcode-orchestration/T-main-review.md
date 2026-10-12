# 官方React Router模板独立复测

2026-10-12 04:28—04:31 Asia/Shanghai。T交回completed/roundIsOver/yolo。主会话独立运行与真实浏览器复核，不只采用工作会话报告。

## 原样性

官方提交d6cfc48d62aa9ea413f0fc5033617c0c923681ec，examples/react-router（CLI模板源）。对official-snapshot与site全部25个文件独立计算哈希，仅package.json不同；其三处workspace替换为同提交对应发布包。Macro源码、正文路由、Vite配置、根布局未修改。版本core/base-ui16.17.1、mdx15.4.7、React Router8.4.0、Vite8.3.4，Windows。

## 主会话实测

1. 直接用node运行本地@react-router/dev/bin.cjs dev，5530。打开/docs/baseline，CUA真实点击计数0→1，受控输入official-keep，非受控输入-domseed，镜像同步。console warn/error为空。
2. 运行中先新建root-new-widget.tsx和root-new-figure.svg，再于04:29:27.057新建root-new.mdx（自己的相对TSX/图片引用）。等待30秒后官方导航仍无新页，直接GET /docs/root-new为404。已有计数及双输入均保留；console无新增错误。不能把“没更新所以状态没变”说成新增成功时保状态。
3. 同一进程修改已有baseline-widget.tsx的按钮文案，立即从Baseline count变为Baseline edited count；计数仍1，双输入保持。dev日志明确有该TSX的client hmr update与ssr page reload，console无错误。说明已有文件编辑HMR链能工作，问题不是全部热更新失效。
4. 停服务，恢复baseline-widget原始字节，明确做重启对照。重启后同一root-new页进入官方导航；CUA真实点导航进入新页、点其自写组件0→1，图片complete=true/naturalWidth160，console warn/error为空。这个成功不计入“运行中发现新增页”。

## 结论与范围

原样官方Macro模板在当前环境中：启动、已有MDX/TSX渲染与交互、已有TSX编辑热更新均正常；运行中新增MDX发现失败，重启启动扫描可发现并正常渲染。责任仍可能在文件add事件、glob匹配/失效或集合更新层；本轮没有定位到具体责任，不泛化为所有系统/版本的Fumadocs缺陷。

不再通过收窄评论自写TSX能力、改编译架构解释该现象。下一步如继续应只定位新增文件发现链路，并对官方样本做最小复现。

临时浏览器标签和主会话服务已关闭；主会话新增的3个测试文件已精确清理，baseline-widget恢复哈希一致。T原始样本、源码快照、依赖锁及日志均保留。
