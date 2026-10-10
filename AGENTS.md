# docsite-kit

基于 fumadocs（React Router 框架模式 + Vite）的文档站基础包。协作站、docfirst 文档站与论文阅读站都建在它上面；
各站自己的功能（协作站的任务与记录等）做成插件，不放进这个仓。

## 仓里有什么

| 目录 | 内容 |
| --- | --- |
| `packages/docsite-kit/` | 基础包 `@godcreator/docsite-kit`：页面来源、开发服务插件、服务端函数、页面正文组件、中文界面文字 |
| `site/` | 自述站：用基础包搭，内容是基础包自己的说明，也是开发基础包时看效果的地方 |

基础包的用法、项目骨架每个文件做什么，写在自述站的 `site/content/` 里，不在这里重复。

## 怎么跑

* `pnpm install` 之后，`pnpm --filter @godcreator/docsite-kit build` 构建一次基础包：`vite.config.ts` 由 Node 直接加载，
  只认构建产物里的开发服务插件
* `pnpm dev` 启动自述站的开发服务（`http://127.0.0.1:4430`）。开发服务直接用基础包 `src/` 下的源码，
  改了包里的组件页面马上变；只有改了 `src/vite/` 要重新构建基础包、重启开发服务
* 日常只用开发服务，不为了看效果运行 build；build 只在发布前做
* 改完一批：基础包里 `pnpm check`（类型检查加测试），站点里 `pnpm check`（类型检查）

## 规矩

* 改了基础包的行为或导出，同一个提交里改 `site/content/` 里对应的说明页
* `site/content/` 里的页面只写现状，不写「原来怎样现在怎样」
