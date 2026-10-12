# docsite-kit

## 是什么

这个仓住着**文档站地基**与 **docfirst 文档工作流**两族东西，同一个 workspace 开发、各自独立发版。

**地基**是 `@godcreator/docsite-kit` 与七个能力包：基于 fumadocs（React Router 框架模式 + Vite）的文档站——页面（MDX、TSX、HTML 三种来源进同一棵页面树与搜索）、评论、人员与身份、推送通道、讲解组件、中文界面。配套工作台插件 `@godcreator/gwb-docsite`：一条命令从空目录建站（骨架正本在仓里的自述站，模板随插件派生）、托管站点的开发服务、agent 读写评论的命令。协作站、docfirst 站、论文站都建在它上面。

**docfirst** 把文档里对代码说的话钉在源码上：文档说「我引的是 `src/greet.ts` 第 2 到 3 行」「`config.json` 就这些」「src 下有这几个文件」，工具替你检查这些话还成不成立。变了就报黄等作者复核，引用指向的东西不在了就报红。**文档里不存代码的副本**——页面上那块是构建时现从源码读的，确认时的记录就写在记号自己身上：被钉那几行内容的 hash，加上确认时那份文件的 blob 名。引用分行段、整文件、目录树。

另一部分是**轨迹卡**：docfirst 防止现状文档与代码不符，轨迹卡防止历史被改写——一次方向上的决定记下来就不再改，谁取代了谁看得见。卡不钉码、不用 confirm，`check` 时一并校验；星轨盘在站上是一条独立的整页路由。

## 怎么装

```bash
pnpm add -D @godcreator/docfirst-workflow
```

`@godcreator/docfirst-workflow` 是命令行、项目装配与 mdx 格式，子入口 `./fumadocs` 是 fumadocs 适配（功能包 `docfirst-site` 用其中的 remark 插件）；通用包钉码核心 `@godcreator/code-pin`（把文字钉在代码上）与星轨盘 `@godcreator/trajectory-disk`（把轨迹卡画成项目方向演变的圆盘）随它装上。通用包不认识 docfirst，也能单独使用。`fumadocs` 与 `react` 是可选的 **peer**，只有 `./fumadocs` 用，用你项目里装的那份；只运行命令行的仓不用装它们。

站另装的两个包：

- `@godcreator/docfirst-site`：地基的功能包，在站 `package.json` 的 `"docsite": { "features": [...] }` 里声明。它给构建页面时的 remark 插件（钉码投影成带状态点的代码块与文件树、术语标注、轨迹卡里的链接）、页面里不用 import 的 `Term` 与文件树组件、星轨盘 `/trajectory` 与卡页 `/trajectory/<卡身份>` 两条路由、侧栏入口「轨迹」与样式
- `@godcreator/docfirst-explainer`：docfirst 站上用的讲解组件，把一段讲解拆成配说明的帧来播放；站要用时自己装，`docfirst-workflow` 与 `docfirst-site` 都不依赖它

**建站与托管由工作台插件做，命令行不管这两步**。装了 gwb 工作台的机器上，`docfirst.create {"dir":"<仓>/docs-site"}` 一步建好接了三个区（现状、轨迹、未来）的 docfirst 站：地基骨架与功能包起始物（`docfirst.config.mjs`、README 系生成物的正本、两区起始页、docfirst 系脚本）一次写全，装依赖、起服务探活。骨架写完就归站点，随便改。`docsite.site.add {"dir":…}` 托管开发服务，站的进程归工作台、跟哪个会话都无关。建站只由 agent 执行一次，所以不在包里——包留的是要在**仓**里反复发生的那几条。

## 怎么用

项目根放一份 `docfirst.config.mjs`（内容根在哪、组件名册、生成物写到哪、轨迹卡目录 `trajectory`、术语表 `glossary`；认哪些文件是写死的，不用配置）。
轨迹卡在 `trajectory` 指的目录，内容根下 `future/` 是未来区，其余目录都是现状区、都进核对，不用登记；项目根下 `src/components/` 里讲解组件的源码（`.ts`、`.tsx`、`.mjs`）也进核对。
文档里单独写一行不带记录的正式记号，路径相对项目根：

```mdx
{/* ref file="src/greet.ts" lines="2-3" */}   行段：这段代码、一条测试、配置里的一个值
{/* ref file="config.json" */}                整文件：只用在短文件上（末尾追加也算变）
{/* tree dir="src" */}                        目录树；可带 depth="2"、glob="*.test.ts"
```

讲解组件里照抄源码的数据也能钉：在那段数据正上方单独一行写 `/* ref file="src/greet.ts" lines="2-3" */`，跟上面一样，只是不带花括号。

然后：

```bash
pnpm docfirst check                                 # 只读，报状态。有红时退出码 1；本仓未提交改动引起的黄也算红
pnpm docfirst confirm                               # 机械写回：给未确认的记号写上记录，挪了位置的写回新行号，重新生成生成物
pnpm docfirst confirm content/docs/a.mdx --accept   # 复核过后，接受点名页里的黄灯；必须点名页
pnpm docfirst render                                # 只把 outputs 里有映射的生成正本渲染到生成位置
```

**正常工作的样子**：`check` 打出一行一处引用，每行带一个状态符号（🟢 新鲜 / 🟡 有变动 / ⚪ 未确认 /
🔴 缺失）；`confirm` 把记录写进记号的属性，站上每个被钉的代码块、文件树多一个对应颜色的点。
提交前的检查里加上 `pnpm docfirst check` 就行。**改了被钉的代码，就在同一个提交里处理它引起的黄灯**：
先 `confirm`，再逐条复核剩下的黄灯、点名页 `--accept`。确认不要求先提交。

## 文档在哪

两个站都在这个仓里，用工作区里的包搭、钉工作区里的实际源码：

- `site/`：地基的自述站（4430 端口），讲基础包与能力包怎么用，也是**骨架的正本**——建站模板从它派生
- `docs-site/`：docfirst 的文档站（4340 端口），讲钉码、核对、轨迹卡怎么用，是 **docfirst 站的正本与示例**——要建 docfirst 站的照它看

```bash
cd docs-site
pnpm docfirst check
```

先读 docs-site 首页的接缝图（包与包之间怎么接），再读要改的那块的模块页；改这个仓要知道的在维护区 `content/maintain/`。

文档本身怎么写、分区各放什么、每页写到哪为止，正本是**随工作台插件发的 skill**，在
`plugins/docfirst/skills/`：写页面、钉码、治理文档与注释读 `docs-writing`，建站、构建、核对与确认读 `docs-site`，
写轨迹卡读 `trajectory`。
说明书随插件发布而不随包发布，是因为包没有独立的途径让 agent 读到——放在 `node_modules` 里的一份
SKILL.md 没有说明指向它、没人会读。

**这份 README 与仓根 `CLAUDE.md` 是生成物**（正本在 `content/docs/outputs/`），`AGENTS.md` 手写；改 mdx 正本再 `pnpm docfirst render`；哪份正本生成到哪看 `docs-site/docfirst.config.mjs` 的 `outputs`。

## 这个仓自己怎么运行

```powershell
pnpm install
pnpm check          # 根测试的类型检查 + 逐包 check（tests/ 的边界守卫与版本盯守在 pnpm test）
pnpm test           # tests/ 下的工作区级测试
pnpm build          # 按依赖序构建全部包、两个插件与两个站

cd docs-site
pnpm docfirst check
pnpm test           # 用功能包的 remark 插件编译现状区每一页，核对投影与 import（不启动站点）
pnpm typecheck      # react-router typegen && tsc --noEmit
pnpm build          # react-router build
```

两个站的开发服务都由 gwb-docsite 托管（`docsite.site.add`），不在会话里自己 `pnpm dev`；`pnpm build` 只作提交前的检查。
改了构建页面时 remark 插件会调用到的包代码（`packages/docfirst-site`，`packages/docfirst-workflow/src/fumadocs/` 连同它调用的 workflow 别的出口与 code-pin），
先在改过的包里 `pnpm build`，再 `docsite.site.stop`、`docsite.site.start` 重启开发服务。
