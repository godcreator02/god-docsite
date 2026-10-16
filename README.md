# god-docsite

## 是什么

文档站平台、按功能划分的功能包，以及两个 gwb 工作台插件。任何站点都是「fumadocs 官方 React Router 模板 + 挑选的功能包」：
平台包 `@godcreator/god-docsite` 带唯一的站点模板与建站器，功能包各自经 fumadocs 与 React Router 原生的扩展点接入站点。

| 包（`packages/`） | 做什么 |
| --- | --- |
| `@godcreator/god-docsite` | 平台：站点模板与建站器、三种页面来源、布局与侧栏、搜索、llms、推送、术语标注、vite 插件 |
| `@godcreator/identity`、`@godcreator/comments` | 身份与评论，基础站默认装 |
| `@godcreator/explainer` | 讲解组件 |
| `@godcreator/code-pin`、`@godcreator/doc-export`、`@godcreator/trajectory` | 钉码、生成物、轨迹卡与星轨盘 |
| `@godcreator/docfirst` | 命令行 `docfirst`：核对、确认、生成 |
| `@godcreator/collab` | 项目协作：任务与模块、日志与日历、通知、合并检查 |
| `@godcreator/word-report` | 报告：JSON 报告文档、报告列表与报告页、命令行 `report-docx`（检查、导出 Word） |

| 插件（`plugins/`） | 做什么 |
| --- | --- |
| `@godcreator/gwb-docsite` | 身份码、建站与加功能、`docfirst.create` 建 docfirst 站、托管站点的开发服务、评论命令，带说明书 `docsite`、`docs-site`、`docs-writing`、`trajectory` |
| `@godcreator/gwb-collab` | 协作站的项目、提交审核、通知与任务命令 |

## 怎么用

建站与托管在 gwb 工作台里做：`docsite.site.init` 建基础站、`docsite.feature.add` 加功能包、`docsite.site.add` 托管开发服务；
要钉码与轨迹卡的站用 `docfirst.create {"dir":"<仓>/docs-site"}` 一步建好。

docfirst 站的项目根放一份 `docfirst.config.mjs`（内容根、组件名册、生成物写到哪、轨迹卡目录）。内容根下 `future/` 是未来区，其余目录都是现状区；
文档里单独写一行不带记录的记号，路径相对项目根：

```mdx
{/* ref file="src/greet.ts" lines="2-3" */}   行段：这段代码、一条测试、配置里的一个值
{/* ref file="config.json" */}                整文件：只用在短文件上
{/* tree dir="src" */}                        目录树；可带 depth="2"、glob="*.test.ts"
```

然后在站目录里：

```bash
pnpm doc                                       # 核对（docfirst check）。有红时退出码 1；本仓未提交改动引起的黄也算红
pnpm doc:confirm                               # 机械写回：给未确认的记号写上记录，挪了位置的写回新行号，重新生成生成物
pnpm doc:confirm content/docs/a.mdx --accept   # 复核过后，接受点名页里的黄灯；必须点名页
pnpm doc:render                                # 只重新生成生成物
```

## 文档在哪

`docs-site/` 是全仓唯一的文档站：总览、建站与写页面、包（一个包一页）、插件、Gitea 与 NAS、维护、背景（fumadocs 原理）。轨迹卡在 `docs-site/trajectory/`。
随插件发布的说明书正本在 `docs-site/content/docs/outputs/skills/`，生成到 `plugins/docsite/skills/` 与 `plugins/collab/skills/`。

**这份 README 与仓根 `CLAUDE.md` 是生成物**（正本在 `docs-site/content/docs/outputs/`），`AGENTS.md` 手写；改 mdx 正本再在 `docs-site/` 里 `pnpm doc:render`。

## 这个仓自己怎么运行

```powershell
pnpm install
pnpm build          # 按依赖序构建全部包、两个插件与各站
pnpm check          # 逐个包跑 check（typecheck、快的一级测试，有 lint 的再 lint），一分钟左右
pnpm test:slow      # 慢的一级测试（各包的 *.slow.test.ts：真建站、大量调 git 的），只在显式要求时跑，近三分钟
pnpm test:deps      # 包之间的依赖方向、包内分层、模块之间不许有环（规则在 tests/dependency-rules.cjs，要先 pnpm build）
pnpm verify         # 全量：build → check → test:slow → test:deps → test:scaffold → test:e2e；只在升共用依赖时跑，平时看改到了什么只跑相关的几项（见 AGENTS.md）
pnpm test:pack      # 把包打成 tarball 装进测试站的副本，跑同样的端到端检查；改了包的 exports、files、依赖时跑

cd docs-site
pnpm doc
pnpm typecheck
pnpm test
pnpm build
```

站点的开发服务都由 gwb-docsite 托管（`docsite.site.add`），不在会话里自己 `pnpm dev`；`pnpm build` 只作提交前的检查。
