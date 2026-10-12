# docsite-kit

基于 fumadocs（React Router 框架模式 + Vite）的文档站基础包，和托管这些站的 gwb 基础插件。协作站、docfirst 文档站与论文阅读站都建在它上面；
各站自己的功能（协作站的任务与记录等）做成各自的功能包与插件，不放进这个仓。

## 仓里有什么

| 目录或文件 | 内容 |
| --- | --- |
| `packages/docsite-kit/` | 组合包 `@godcreator/docsite-kit`（只做接线）：功能包约定、路由挂载、vite 插件（经 Vite 处理源码包、TSX 标题刷新、推送通道服务） |
| `packages/docsite-identity/` | 身份包：people.json 盘协议、身份码解析、authorizeWrite 写入校验、@ 提及，身份与评论互不依赖 |
| `packages/docsite-comments/` | 评论包（fumadocs 原生机制）：评论串模型与文件读写（评论是集合文件）、正文外批注覆盖层、评论界面 |
| `packages/docsite-page-sources/` | 页面来源包：TSX/HTML 页面做成 StaticSource 进同一棵页面树与搜索、中文搜索服务、content 资产的 dev/build 快照、TSX/HTML 正文组件 |
| `packages/docsite-writing/` | 写作包：Term 术语组件与 remark 标注插件、TSX 公式 Tex |
| `packages/docsite-ui/` | UI 外壳包：侧栏分组、站内链接卡片、全宽切换、主题切换与身份标识、中文界面文字 |
| `packages/docsite-feed/` | 推送通道包：gwb 插件按频道往开发服务推数据（只留最新一份）——协议、进程内存储、开发服务收发端点、浏览器 hook 三面都在包里 |
| `packages/docsite-explainer/` | 讲解组件包：分步/动画/选情况三种外壳、画帧零件、接缝图、机读文字生成；零依赖、peer 只有 react。正本自 gwb-docfirst 的 docfirst-explainer 搬入，那边 0.1.1 冻结待切薄壳 |
| `plugins/docsite/` | gwb 基础插件 `@godcreator/gwb-docsite`：身份码、从空目录建站（建站器在插件里：组装骨架与功能包模板、一次写盘、一次装依赖）、托管站点、推数据、评论命令、说明书 `docsite` |
| `site/` | 自述站：用基础包搭，内容是基础包自己的说明与设计讲解（方案、原则、fumadocs 原理），也是开发基础包时看效果的地方。它是站点骨架的正本：`app/` 与根目录的配置手写在这里，插件构建时派生出建站用的模板（`plugins/docsite/template/`，构建产物不进 git） |
| `site/people.json` | 自述站的人员列表，评论署名用；「我是谁」按 gwb 设置里的身份码认 |
| `trajectory/` | 轨迹卡：方向上的结论（试过什么、选了哪条路、实验得出了什么），只增不改 |
| `probes/` | 实验材料，一个实验一个目录，照目录里 README 第一行就能重新运行 |

基础包的用法、项目骨架每个文件做什么，写在自述站的 `site/content/` 里，不在这里重复。

## 怎么跑

* `pnpm install` 之后，`pnpm --filter @godcreator/docsite-kit build` 构建一次基础包：站点只用基础包的构建产物
* `vite` 挂着 8.3.4 的补丁（`patches/vite@8.3.4.patch`，登记在仓根 `pnpm-workspace.yaml`）：Windows 上 Vite 对 `import.meta.glob` 相对 base 的处理有缺陷，dev 运行中新增的文件不进 glob 集合（fumadocs-mdx 生成的正是相对 base，所以新增正文页要重启 dev 才出现）。补丁把 `toAbsoluteGlob` 相对 base 分支的 `posix.resolve` 改为 `posix.join`，运行中新增第 1 秒即被发现。成因、复现命令（原版失效与补丁生效双轨，测试按已安装的 vite 自动分组）与全部验证记录在 `probes/2610121018_vite-add-discovery`。升级 vite 前先跑该 probe 的测试看上游修了没有：修了就删补丁与登记；没修就用 `pnpm patch` 按新版本重新生成补丁
* `pnpm dev` 启动自述站的开发服务（`http://127.0.0.1:4430`）；要写评论，开发服务的环境变量 `DOCSITE_IDENTITY_CODE` 要是 `site/people.json` 里某人的码
  （经 gwb-docsite 启动时它自己给），不然站点只读。改了基础包要重新构建它、再重启开发服务
* 骨架直接改 `site/app/` 与根目录的配置（正本），插件的 `pnpm build` 会重新派生 `plugins/docsite/template/`；骨架依赖有变化时同步改插件的版本表 `src/scaffold/versions.ts`（`@godcreator` 系的精确版本）
* 日常只用开发服务，不为了看效果运行 build；build 只在发布前做
* 插件 `plugins/docsite` 打包时带进基础包的构建产物：改了基础包要先构建基础包；在隔离 home 里验插件用 `devkit.dev`（说明书 gwb-devkit）
* 改完一批：基础包里 `pnpm check`（类型检查加测试），插件里 `pnpm check`，站点里 `pnpm check`（类型检查）；整批做完在仓根 `pnpm check`
* 发版只用 `devkit.release`，基础包排在插件前面：`{"packages":["packages/docsite-kit","plugins/docsite"]}`

## 规矩

* 改了基础包或插件的行为、导出、命令，同一个提交里改 `site/content/` 里对应的说明页（插件还有随包的说明书 `plugins/docsite/skills/docsite/SKILL.md`）
* `site/content/` 里的页面只写现状，不写「原来怎样现在怎样」；历史与选型写进 `trajectory/` 的卡
* 某条路走不通、做了选型、实验有了结论，当场在 `trajectory/` 建一张卡，和代码放进同一个提交；已有的卡不改
* 评论定位的回归页是写作示例里的「收起内容试验」（`site/content/writing/collapse-test.mdx`）：改了评论定位，在它上面过一遍
