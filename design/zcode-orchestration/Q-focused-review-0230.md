# Q 定点返工复核

主会话独立复核，2026-10-12 02:30 Asia/Shanghai。只验本轮快照和 iframe 接线，不宣称整模块全部完成。

- 阅读 content-files.ts、vite.config.ts、page-bodies.tsx、build-start.test.ts。build 复制可服务资源到客户端静态产物，生产路由不再读原 content；iframe 已移除永久500ms轮询，使用真实标题id。
- 在 Q 的 site 运行本地 `vitest.ps1 run test/build-start.test.ts -t '构建后修改'`，exit0，1 passed / 4 skipped。真实构建后改源HTML、移走SVG，产物正文、图片和搜索仍保持快照。没有全量重跑。
- 独立启动 build/server/index.js，CUA 真实点击“脚本也在跑”目录，URL 到 #scripts-run；外层定位点 top=439.667，iframe 内标题映射 top=439.219，误差约0.45px。
- 真实点击 iframe 的“换个颜色”，截图显示边框变色，读取实际 border rgb(190,79,218)，iframe 高442px。
- console 有一条 MutationObserver.observe 参数不是Node的错误。CDP堆栈位于无URL script4，源码带 Electron preload 的 require/process/exports 包装，末层 node:electron/js2c/sandbox_bundle；属于浏览器注入层，未见本站构建资源堆栈。没有将其伪报为“console完全无错误”。
- 临时浏览器标签与主会话服务已关闭。Q原报告的SSR本地图像、HTML表格结构化与MDX新增清单缺口仍保留；这些不因本次快照测试通过而标完成。

结论：本次快照与示例iframe导航修正通过定点验收，可进入后续串行集成。更复杂的嵌套定位/尺寸变化不在此次抽查覆盖内。
