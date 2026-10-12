继续原任务K（同一连续返工上下文），仍按原独占目录。主会话已完成一轮独立复核，报告review/20261011-2315-K-review.md，原始浏览器错误摘录review/20261011-2315-browser-errors.json。主会话服务已停、5460/5461空闲、临时浏览器页已关，自己的验收串e143c5已UI删除，现存K样本7文件未损，可安全接回写入。

已通过：两包types/build、I22/J41测试、9exports解析、站点typegen/tsc、八项拒写文件hash不变、只读POST/GET403、details侧栏展开定位。不要把这些重新变成计划；只修以下实际缺陷和必要回归：

1. 首次打开/comments即有React嵌套a错误：all-comments.tsx外层a包CommentItem，正文MDX又有a。种子串就能复现。把打开/导航入口和正文链接分开，保证有效HTML、键盘可达且正文链接不被整卡点击吞掉。不要简单换外层button继续包互动正文；同类侧栏预览也审查。用真实含MDX链接的评论验证首屏及交互console无nesting/hydration错误。

2. 删除回复/整串虽最终恢复，但主会话tab.dev.logs在23:18:11/23:19:12确实捕获“浏览器端没有评论正文模块…eb82.mdx / …index.mdx”，触发CommentBodyBoundary；Vite也尝试reload已删MDX。两次删除之间无typegen/touch/手工重启或刷新，不是验收干扰。请修正文与元数据更新的时序/删除条目处理，不能用最后200覆盖中途组件错误。已有auto-utimes做法并没有证明完整闭环。禁止屏蔽console、catch吞所有错误、永远loading、隐藏有效评论或手工touch来通过。限当前评论验证站必要接线，不扩全站HMR，不读/改私有ModuleRunner/cache，不用src alias。若无法安全闭合，给最小复现和真实剩余问题，不能再次写全部通过。

3. start-site.ps1 Port参数未传给实际pnpm dev：脚本只改Origin，dev脚本却固定5460。修正真实端口传递，验证5461或另一个允许的空闲端口，并保留127.0.0.1和strictPort。停止时核实记录PID仍是本脚本的实例再停，避免陈旧PID误杀。
4. site/README.md补全干净checkout复跑顺序：根依赖安装→两包构建→独立站点依赖安装→带身份/只读启动；现只有site install漏掉link包dist。不要本轮跑旧生产站build。
5. utimes source.config.ts只能描述为锁定版本下实测的站点变通；配置监视实现存在不代表提供稳定的评论数据失效接口。更新说明的承诺口径，并如实记录整页刷新/草稿状态与开发模式边界。

主会话的浏览器能力通过mcp__cua_repl的Tab.dev.logs可读加载期日志；你的运行时若没有此入口，说明缺口而不要注入hook后写“无error”。你仍要完成真实click/typeText/drag路径并留证据，最终console由主会话补验。
修完重跑受影响的类型/测试/build，从干净服务复跑新建、回复、编辑、删回复、删整串和其他串保留，覆盖正文带链接；操作之间不得靠人touch/typegen/改配置或刷新。加一轮重复创建删除避免只测偶然成功。折叠保留已过details证据，补验页面现有AriaToggle的aria-expanded找回，仍不扩Tabs/Files。
所有命令pwsh7，版本/依赖声明每次读gwb-release；遵守原目录，不改review/design/旧包/其他仓，不提交发布，不派会话。追加新证据与result/handoff，不删旧失败材料。结束停自己服务，等待15分钟检查。
