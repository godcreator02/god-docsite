# 五模块重点复核
2026-10-12。按用户最新要求，只核对未实现、偏离目标与别扭的接法；未全量重跑测试或浏览器。

## N 原生评论
保留Config API、server/browser、createClientLoader及按页元数据方向。index target=default是公开类型中未文档化的选项，仍属受版本约束的接点。
未闭环：新增时客户端正文入口暂缺；CommentBodyBoundary出错后failed不主动恢复，依赖整页刷新；删除已加载正文仍有Vite reload错误；tests/helpers.ts重试短暂SSR500，所以31项绿不能代表这段失败窗口消失。
编辑、提及、无页面评论、快照映射按本小段范围尚未实现，应列待接入，不作为当前回归失败。

## R 写作能力（最明确的方向偏差）
fixture用了core/base-ui16.16.2、mdx15.4.4，偏离本批16.17.1/15.4.7。
source.config.ts又用全局插件skipFile按路径区分集合，并宣称集合级mdxOptions不可用；这与已完成Config API实验和派单相反，应改回命名集合各自mdxOptions/applyMdxPreset。
Term采用全局seq生成id，注释错误宣称没有use client便是服务端组件、useId要求use client。React Router本fixture实际client/assets/dist-DPDRIZNY.js包含Term，SSR/客户端ID存在不一致风险。
termMarkdownRule及手工mdast序列化测试没有证明Fumadocs实际getText输出，应删掉不必要的第二份转换约定或以真实公开输出验收。
合成点击只能算自检，不能称浏览器互动全部通过。

## Q 页面来源与搜索
StaticSource和公开搜索入口方向可保留，HTML iframe原样展示符合既有基线。
快照缺口：lib/src/content-files.ts每请求fs.readFile，site路由指向../../content；build/start仍读源content，HTML实际正文/图片可变，而标题/索引来自构建时，违背同一份快照。现build-start测试只查原文件可访问，没有改源验证快照不变。
HtmlPageBody每500ms持续测量并同步一套序号锚点；这是需收敛的接缝，优先资源就绪/布局变化触发与真实标题锚点，避免永久轮询。
MDX新增不进清单、SSR本地图像缺位、HTML表格/持久锚点不足均已报告，不忽略。

## O 覆盖层
组件采用正文外兄弟节点，未见splitText/插标记/属性画框，主方向可保留。
明确缺口：CSS.highlights固定全局名称，多实例覆盖，卸载任一实例会删掉另一实例高亮；fixture本身包含两实例，不能仅写“一页一实例”就略过。卡片靠底部不翻转。
集中RO/MO/scroll/resize测量合理；150ms timer是为IAB节流加的事件触发兜底，不是持续轮询，但会重复测量，后续只补关键真实输入/正常浏览器验证，不继续为验收工具不断增加产品机制。

## P 身份
抽查authorizeWrite及公开边界，未见需要架构返工之处：显式输入、可信origin、白名单作者、身份与评论桩无依赖。38项测试为交付方报告，本轮未重新全跑。
真实React Router8组合仍待集成（现样本是Request/Response形状的Node驱动）。入站人员/join等明确是后续插件能力，不误报已完成。

## 优先顺序
先修R接线/SSR假设和Q快照；N继续作为原生读写未完成项处理，框架问题不靠业务层补丁遮蔽；O修小范围多实例/卡片边界后接入；P可作为集成基础。
所有会话已completed/roundIsOver/yolo并交回，本轮不自动重派；先给用户重点结论。

