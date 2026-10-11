# E-5 / E-3 观察记录（2026-10-11）

## E-5 增删内容文件（日志：02-dev-first.log、03-dev-e5-restart.log、04-dev-e5-after-delete.log）

底子：fumadocs 官方示例 examples/react-router，fumadocs-core 16.17.1 / fumadocs-mdx 15.4.7 / @fumadocs/base-ui 16.17.1，
未加任何自写 Vite 插件。浏览器里用 `window.__probe = 'alive-…'` 判断刷新方式（整页刷新会丢，热更新不丢）。

| 步骤 | 侧栏/页面树 | 直接打开 | 更新方式 |
| --- | --- | --- | --- |
| 新建 content/docs/new.mdx | 不变（等 22 秒也不出现，dev 日志无重编译） | /docs/new 404 | **无任何触发，要重启**；重启后 200、侧栏出现 |
| 改标题（文件已在清单里） | 1 秒内换成新标题 | 200，标题已换 | **整页刷新**：window 标记丢失，日志 `page reload … Could not Fast Refresh`（SSR program reload + 客户端 page reload） |
| 删除 new.mdx | 1 秒内从侧栏消失 | **/docs/new 500，且整站 /docs 一起 500，不自愈** | 浏览器不刷新，弹 Vite 错误浮层（`Failed to load url /content/docs/new.mdx?macro_id=…&only=frontmatter`）；重启后恢复 404/200 |

结论：fumadocs-mdx 15.4.7 自己处理不了增删：新建不进清单、删除把 SSR 打死（500）。
改动已有文件正常（整页刷新后生效）。docsite() 里「文件增删后让模块失效」的逻辑还需要，
且失效时机要在集合虚拟模块重新解析之前，否则出现删除后的 500。

对照观察：touch 已有 test.mdx 与新建 new.mdx 同时进行，前者立即触发 page reload，后者毫无反应——
watch 只认启动时清单里已有的文件。

## E-3 评论文件夹里的 .tsx（日志：06-dev-e3.log、07-dev-e3-t2.log）

- comments 集合：`defineCollections({ type: 'doc', dir: 'comments', async: true })`，无 schema。
  无 schema 时条目把 frontmatter 字段摊平在顶层（`entry.author`），另有 `info`、`getText`、`getMDAST`、`load`。
- comments/t1/index.mdx `import { Diagram } from './diagram'`：dev 下整页正常渲染，
  .tsx 组件（带 CSS 动画）进了 SSR HTML（`e3-diagram`、`评论里的动画组件`）。
- 改 t1/diagram.tsx：3 秒内生效，方式为整页刷新（`page reload comments/t1/diagram.tsx` + program reload）。
- dev 运行时复制出 t2/：15 秒内不出现，**要重启**；重启后 t1、t2 都在。
- build + start：见 08-build-e3.log 与 09-start-e3.log（补记）。
