# docsite-kit

基于 fumadocs（React Router 框架模式 + Vite）的文档站基础包。协作站、docfirst 文档站与论文阅读站都建在它上面；
各站自己的功能（协作站的任务与记录等）做成插件，不放进这个仓。

## 仓里有什么

| 目录或文件 | 内容 |
| --- | --- |
| `packages/docsite-kit/` | 基础包 `@godcreator/docsite-kit`：页面来源、开发服务插件、服务端函数、页面正文组件、评论、站点人员列表、中文界面文字 |
| `site/` | 自述站：用基础包搭，内容是基础包自己的说明，也是开发基础包时看效果的地方 |
| `site/people.json` | 自述站的人员列表，评论署名用；「我是谁」按 gwb 设置里的身份码认 |
| `trajectory/` | 轨迹卡：方向上的结论（试过什么、选了哪条路、实验得出了什么），只增不改 |
| `probes/` | 实验材料，一个实验一个目录，照目录里 README 第一行就能重新运行 |

基础包的用法、项目骨架每个文件做什么，写在自述站的 `site/content/` 里，不在这里重复。

## 怎么跑

* `pnpm install` 之后，`pnpm --filter @godcreator/docsite-kit build` 构建一次基础包：`vite.config.ts` 与评论文件的 schema
  由 Node 直接加载，只认构建产物
* `pnpm dev` 启动自述站的开发服务（`http://127.0.0.1:4430`）；要写评论，开发服务的环境变量 `DOCSITE_IDENTITY_CODE` 要是 `site/people.json` 里某人的码
  （经 gwb-docsite 启动时它自己给），不然站点只读。开发服务直接用基础包 `src/` 下的源码，
  改了包里的组件页面马上变；改了 `src/vite/` 或评论文件的 schema（`src/comments.ts`、`src/people.ts`）要重新构建基础包、重启开发服务
* 日常只用开发服务，不为了看效果运行 build；build 只在发布前做
* 改完一批：基础包里 `pnpm check`（类型检查加测试），站点里 `pnpm check`（类型检查）；整批做完在仓根 `pnpm check`

## 规矩

* 改了基础包的行为或导出，同一个提交里改 `site/content/` 里对应的说明页
* `site/content/` 里的页面只写现状，不写「原来怎样现在怎样」；历史与选型写进 `trajectory/` 的卡
* 某条路走不通、做了选型、实验有了结论，当场在 `trajectory/` 建一张卡，和代码放进同一个提交；已有的卡不改
* 评论定位的回归页是写作示例里的「收起内容试验」（`site/content/writing/collapse-test.mdx`）：改了评论定位，在它上面过一遍
