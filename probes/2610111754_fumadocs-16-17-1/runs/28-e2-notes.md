# E-2 观察记录（2026-10-11，日志 26、27）

写法：`app/lib/source.ts` 的 docs 集合 `mdxOptions: applyMdxPreset({ remarkPlugins: [probeDep] })`
（`applyMdxPreset` 从 `fumadocs-mdx/config` 出口拿，主出口不导出它；它把自定义插件排在默认工序后、
remarkStructure 前，与计划第 2 节一致）。probeDep（app/lib/probe-dep.ts）只处理 pin-probe.mdx：
把 `pinned/a.ts` 内容与 `pinned/dir/` 文件列表塞成两个 code 节点，
`file.data._compiler?.addDependency(<绝对路径>)` 登记文件与目录。

| 验证 | 结果 |
| --- | --- |
| 改 pinned/a.ts（已登记的**文件**） | **成立**：1 秒内页面更新，dev 日志 `(ssr) page reload pinned/a.ts` |
| pinned/dir/ 里**新增**文件（已登记的是目录） | **不成立**：10 秒内页面无变化、日志无事件 |
| pinned/dir/ 里**删除**文件 | 同样不触发 |

要目录增删也生效，加了一个 Vite 插件（vite.config.ts 的 `probeDirWatch`）：
`configureServer` 里 `server.watcher.add(dir)`，`add`/`unlink` 事件里把路径以目录开头的事件
桥接成被钉文件的 change 事件（`server.watcher.emit('change', pinnedFile)`），走 Vite 正常失效链。
加了它之后增、删文件都在 1 秒内反映到页面。

结论：**登记文件成立；登记目录不成立；目录增删要生效需要 Vite 插件监听（D-08 的两个选项里选插件）**。

另：source.ts 写入 mdxOptions 后该文件浏览器端也加载（`fumadocs-mdx/config`、probe-dep 都是 Node-only）。
实测客户端没有炸：fumadocs-mdx 的宏转换会把 `defineDocs` 调用整体替换，多余的 import 在
browser 端模块图里仍会被解析——本实验里客户端页面正常（/docs 浏览器访问正常），因为宏展开后
`applyMdxPreset`/`probeDep` 的调用不在输出里、import 被 Vite 按需裁剪。若后续出现客户端报错，
再考虑把 mdxOptions 挪到单独的 Node-only 模块。
