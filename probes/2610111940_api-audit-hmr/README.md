# E-2 / E-5 / E-7 针对性复核

2026-10-11，pwsh 7，独立站点与端口5456。复用原实验已安装依赖：fumadocs-core16.17.1、fumadocs-mdx15.4.7、Vite8.3.4、React Router8.4.0、Node24.14.1。原计划、原实验正文、包源码、依赖版本、lockfile没有改；没有提交、发布或上游issue。所有本次启动进程通过自己的exec session Ctrl+C停止。

## 复跑方法与隔离限制

在本目录运行 `pwsh -File ./set-variant.ps1 config`，随后 `cd site`，设置 `$env:PROBE_NO_EXTERNAL='1'`，运行 `node node_modules/@react-router/dev/bin.cjs dev --port 5456 --host 127.0.0.1 --strictPort`。独立浏览器打开 `/audit` 验证按集合隔离，或 `/docs` 验证feeds。其他变体为 `baseline`、`static`、`dynamic`、`restart`。切换前先停止自己的进程。

`fixtures/`保存宏source/config/Vite配置基线。`set-variant.ps1`只写本目录副本。`docs.tsx`在原计数器基础上增加未保存input，hydration effect生成并显示`window.__auditDocument` UUID。`logs/browser-observations.json`是本次真实DOM、点击和CDP返回值的转录，未冒称自动化断言。

站点文件完整复制，`node_modules`是指向原实验的junction。优化缓存固定为自己的`.audit-vite-cache`，原安装`.vite`目录时间保持19:23:31，但Vite配置加载的原`.vite-temp`目录时间更新到本次19:50，说明临时配置缓存仍触达共享安装目录；当前该临时目录为空，未清理/回滚它。没有修改依赖包文件。不能称临时缓存完全隔离。尝试把本次junction替换为自有node_modules容器时，删除junction的动作被自动守卫/策略拒绝；保留现有链接，没有继续扩展测试。后续复跑宜用自有容器仅链接各依赖目录，排除`.vite`和`.vite-temp`。

## E-7：现有server-only loader链

**已重跑：修改成立，删除成立，删除后重新新增未自动更新当前浏览器。**

| 操作 | 真实数据结果 | 浏览器状态 | 日志 |
| --- | --- | --- | --- |
| hydration基线 | 推送消息v5，按钮实际点至3 | input=audit-unsaved-123，窗口UUID已生成 | browser-observations.json |
| 修改已有demo.json | 浏览器变为audit-E7-edit-1 | count、input、window UUID、timeOrigin全保留 | 01-baseline.log 19:42:37 client hmr update docs.tsx；ssr page/program reload |
| 删除demo.json，移到本目录logs | 浏览器变为(missing) | 同样保留 | 01-baseline.log 19:42:57 |
| 重新新增demo.json | SSR200已含audit-E7-add-2；已打开浏览器仍为(missing) | 状态保留，数据更新未闭环 | 01-baseline.log 19:43:14仅ssr page reload，未见client update/program reload |

四阶段UUID=`bf21abf6-bf23-417d-94dc-3547ebc50609`，timeOrigin=`1791718932237.4`。本次没有计时轮询，不能重复宣称292ms的延迟保证；不覆盖外部生产来源、重连、新目录等后续任务。server-only是必要写法，不能单凭此实验保证所有增删都主动把loader数据更新到浏览器。

## E-5：宏集合内容增删

**已重跑原失败。** baseline运行期间新增`content/docs/audit-new.mdx`，约4秒和后续约十秒检查仍404，打开的`/docs`侧栏链接count=0。新增`comments/audit-new/index.mdx`，`/comments`200但没有新评论。已有docs和comments各移走一个文件后，两路由均500，日志仍引用已删`only=frontmatter`模块（01-baseline.log）。

避免同时删除的遮蔽，另起无restart插件进程独立删除`comments/t2/index.mdx`：删除前`/comments`200且包含t2，删除后500，错误明确指向`/comments/t2/index.mdx?...only=frontmatter`（06-comment-delete.log）。

**公开API路线只完成服务端验证。** `restart`变体只用`configureServer`、`server.watcher` add/unlink和`server.restart()`，不访问Fumadocs内部缓存，不匹配虚拟模块形状，不操作`evaluatedModules`。服务端清单恢复：新增MDX200、评论出现；删后MDX404，其余docs/comments200且评论消失（05-public-restart.log）。但浏览器删除后旧侧栏项count仍1；立即`restart().then(()=>server.ws.send({type:'full-reload'}))`也未验证可靠收敛。

因此仅证明公开重启能重建服务端清单，**没有交付自动浏览器刷新修复，更没有证明现有K-04细粒度失效代码全部只依赖稳定接口**。重启/刷新连接和删除并发时序尚需专项设计。

## E-2：按集合Node插件隔离

**原两种失败已重跑，公开配置替代路线也已实际验证。**

1. `static`：宏所在`app/lib/source.ts`顶层静态import `applyMdxPreset`和Node-only `probeDep`，集合调用`mdxOptions: applyMdxPreset(...)`。SSR200，但计数器点击仍0、effect未运行、window标记undefined。实际首个错误是`fumadocs-mdx/config`带入的`fumadocs-core/.../remark-image`访问`node:url.fileURLToPath`被externalize。不能把这条具体日志改写成只由自写插件node:fs引起（02-static.log）。
2. `dynamic`：集合`mdxOptions: async () => { const {probeDep}=await import('./probe-dep'); ... }`，SSR500，`Vite module runner has been closed.`（03-dynamic.log）。仅说明这种延后import回调失败。
3. `config`：`source.config.ts`使用公开`fumadocs-mdx/config`的`defineDocs`、`applyMdxPreset`，命名导出auditA/auditB，分别设置含Node插件/空数组的`docs.mdxOptions`。`audit-node-plugin.ts`确实执行`node:fs.readFileSync(package.json)`并添加A专属marker。生成`.source/server`仅由`audit-config.server.ts`进入loader；另通过官方`.source/browser`的`createClientLoader`/`useContent`把两个集合正文加载到客户端。浏览器四个section结果：serverA、browserA均`A body + A-ONLY-NODE-COMPILED`，serverB、browserB均仅`B body`；按钮0→1确认hydration（04-config.log、browser-observations.json）。`.source/browser`仅type-import配置，没有运行时import Node插件。

应纠正原“15.4.7不能按集合挑插件”：**客户端共享宏模块的原写法失败；Config API命名集合配置＋server/browser生成入口可按集合隔离Node-only remark插件。** 本次只验证一页两集合，没有迁移完整站点，没有验证大型站构建、所有插件组合、产物体积。原`_compiler.addDependency`文件/目录监听实验本次未重跑，稳定性由另一份接口审计负责。

## 材料与只读源码

原实验：`../2610111754_fumadocs-16-17-1/README.md`、`runs/39-e7-redo-notes.md`；计划：`../../design/30-refactor-plan.html`。固定tag源码位于原实验`_upstream/`，实际读取：

- `apps/docs/content/docs/mdx/(integrations)/vite.mdx`：并列列出Macro与Config API路线。
- `apps/docs/content/docs/mdx/entry/browser.mdx`：`createClientLoader`和React Router `useContent`示例。
- `packages/mdx/src/config/define.ts`：命名DocCollection的mdxOptions类型与默认工序替换语义。
- `packages/mdx/src/vite/index.ts`：configPath、index、runnerImport、macro evaluator加载。
- `packages/mdx/src/plugins/index-file.ts`：Vite target的server/browser生成入口。
- `packages/mdx/src/macro/eval.ts`、`macro/transform.ts`：宏配置求值和运行时展开分别处理。

运行结论来自实际重跑；异步回调runner生命周期的归因是源码解释，未通过patch上游验证。公开API重启路线客户端收敛未解决，无线上部署或生产验收。
