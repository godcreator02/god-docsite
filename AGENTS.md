# docsite-kit

基于 fumadocs（React Router 框架模式 + Vite）的文档站基础包，和托管这些站的 gwb 基础插件。协作站、docfirst 文档站与论文阅读站都建在它上面；
各站自己的功能（协作站的任务与记录等）做成各自的功能包与插件，不放进这个仓。

## 仓里有什么

| 目录或文件 | 内容 |
| --- | --- |
| `packages/docsite-kit/` | 基础包 `@godcreator/docsite-kit`：页面来源、开发服务插件、服务端函数、页面正文组件、评论、站点人员列表、推送通道、中文界面文字 |
| `plugins/docsite/` | gwb 基础插件 `@godcreator/gwb-docsite`：身份码、托管站点、推数据、评论命令、说明书 `docsite` |
| `site/` | 自述站：用基础包搭，内容是基础包自己的说明，也是开发基础包时看效果的地方 |
| `site/people.json` | 自述站的人员列表，评论署名用；「我是谁」按 gwb 设置里的身份码认 |
| `trajectory/` | 轨迹卡：方向上的结论（试过什么、选了哪条路、实验得出了什么），只增不改 |
| `probes/` | 实验材料，一个实验一个目录，照目录里 README 第一行就能重新运行 |

基础包的用法、项目骨架每个文件做什么，写在自述站的 `site/content/` 里，不在这里重复。

## 怎么跑

* `pnpm install` 之后，`pnpm --filter @godcreator/docsite-kit build` 构建一次基础包：站点只用基础包的构建产物
* `pnpm dev` 启动自述站的开发服务（`http://127.0.0.1:4430`）；要写评论，开发服务的环境变量 `DOCSITE_IDENTITY_CODE` 要是 `site/people.json` 里某人的码
  （经 gwb-docsite 启动时它自己给），不然站点只读。改了基础包要重新构建它、再重启开发服务
* 日常只用开发服务，不为了看效果运行 build；build 只在发布前做
* 插件 `plugins/docsite` 打包时带进基础包的构建产物：改了基础包要先构建基础包；在隔离 home 里验插件用 `devkit.dev`（说明书 gwb-devkit）
* 改完一批：基础包里 `pnpm check`（类型检查加测试），插件里 `pnpm check`，站点里 `pnpm check`（类型检查）；整批做完在仓根 `pnpm check`
* 发版只用 `devkit.release`，基础包排在插件前面：`{"packages":["packages/docsite-kit","plugins/docsite"]}`

## 规矩

* 改了基础包或插件的行为、导出、命令，同一个提交里改 `site/content/` 里对应的说明页（插件还有随包的说明书 `plugins/docsite/skills/docsite/SKILL.md`）
* `site/content/` 里的页面只写现状，不写「原来怎样现在怎样」；历史与选型写进 `trajectory/` 的卡
* 某条路走不通、做了选型、实验有了结论，当场在 `trajectory/` 建一张卡，和代码放进同一个提交；已有的卡不改
* 评论定位的回归页是写作示例里的「收起内容试验」（`site/content/writing/collapse-test.mdx`）：改了评论定位，在它上面过一遍
