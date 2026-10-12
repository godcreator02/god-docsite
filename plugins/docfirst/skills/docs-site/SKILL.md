---
name: docs-site
description: 对文档站执行命令时读：建站、托管与重启（基础包上的站用 docsite.site.*，Next 站用 docfirst.site.*）、加分区、登记组件、构建、安装或构建失败；docfirst 站的核对、确认、生成，改了被钉的代码怎么提交，给别的仓写反馈。页面内容怎么写看 docs-writing。
---

# 文档站的操作

这份只讲**对站执行什么命令**：建站、改站的结构、构建与查看、核对与确认、出错了怎么办。页面内容怎么写、钉码钉哪种话、
黄灯以后正文怎么改，看同一个插件的说明书 `docs-writing`；轨迹卡看 `trajectory`。

站约定放在 `<仓>/docs-site/`，是一个独立的 pnpm 项目，下面的命令都在这个目录里运行。docfirst 站有两种，先看站目录认出是哪种：

| | 建在文档站基础包上的站 | Next 站 |
| --- | --- | --- |
| 认法 | `package.json` 里有 `"docsite": { "features": [...] }`，站目录有 `react-router.config.ts` | 站目录有 `next.config.mjs` |
| 框架 | 基础包 `@godcreator/docsite-kit`（fumadocs + React Router + Vite）加功能包 `@godcreator/docfirst-site` | Next + fumadocs，接入用 `@godcreator/docfirst-workflow/fumadocs` |
| 骨架与托管 | 工作台插件 gwb-docsite：`docsite.site.init` 写骨架，`docsite.site.add` 托管开发服务 | 本插件：`docfirst.create` 建站，`docfirst.site.*` 托管 `build` + `start` |
| 例子 | docfirst 自己的文档站 `D:\unitfolders\oz47p-docsite-kit\gwb-docfirst\docs-site` | 还没迁到基础包上的各仓文档站 |

**核对、确认、渲染两种站一样**，都在站目录里自己运行 `pnpm docfirst …`：它们要在仓里反复运行（git hook、CI、构建页面时也在运行它们），
归站里装的包，插件不转发命令行。基础包本身怎么用（身份码、评论、`people.json`、写页面）看 gwb-docsite 的说明书 `docsite`。

## 建站

### 建在基础包上的站

还没有一步建好的命令。照 docfirst 自己的文档站做：

1. `docsite.site.init {"dir":"<仓>/docs-site","port":<开发端口>,"title":"<站名>","features":{"@godcreator/docfirst-site":"<版本范围>"}}`
   写出骨架：`app/`、`vite.config.ts`、`react-router.config.ts`、`source.config.ts`、`tsconfig.json`、`.gitignore`，连同功能包带的轨迹卡集合 `app/lib/trajectory.ts`。
   这些文件不手改，基础包或功能包升级后再运行一次 `docsite.site.init {"dir":…}` 照新模板更新
2. 站自己写的：`content/`（各组一个目录，`meta.json` 写 `"root": true`）、站点根下的 `trajectory/`、`src/components/`、`docfirst.config.mjs`
   （`trajectory: "trajectory"`；要术语标注再写 `glossary`）、`people.json`，`package.json` 里加依赖 `@godcreator/docfirst-workflow` 与脚本 `"docfirst": "docfirst"`
3. `pnpm install`、`pnpm docfirst render`、`pnpm docfirst check`、`pnpm build`

### Next 站

```
docfirst.create        {"dir":"<仓>/docs-site"}    接好 docfirst 的 Next 站：现状、轨迹、未来三个区，钉码与生成物
docfirst.create-plain  {"dir":"<仓>/docs-site"}    普通 fumadocs 的 Next 站，没有 docfirst
```

参数两条相同，多给别的键直接报错：

- `dir`：站目录的绝对路径。**必须还不存在**，上一级（仓目录）必须已经存在。已经有站的仓不能用这两条命令，给已经在用的站加 docfirst 要手动接入
- `title`：站名，不给就依次用仓根 `package.json` 的 `title`、包名去掉 scope、仓的目录名
- `port`：不给就在单元文件夹插件的设置 `unit-folder.units-root` 指的目录里找没被别的站脚本占用的，从 4310 起选；
  读不了的目录或 `package.json` 列在回执的 `portScanIncomplete` 里

两条都先运行官方脚手架 `create-fumadocs-app`（版本写死在插件里，要联网），再应用本机约定：允许 esbuild 运行构建脚本、
`dev` / `start` 写端口并只监听 127.0.0.1、字体 Sarasa Mono SC、页面语言 zh-CN、站名、去掉 GitHub 链接与分享图、`/` 跳到 `/docs`、
`.gitignore` 排除 `next dev` 在站根生成的 `AGENTS.md` 与 `CLAUDE.md`、每页 md 的 `Content-Type` 带 `charset=utf-8`。
普通站里自带搜索、`/llms.txt` 与每页的 markdown 版本（网址后加 `.md`）。`docfirst.create` 建的站只留搜索，删掉每页的机读版
（llms 路由、`.md` 地址、页面上复制与查看 markdown 的按钮）：机读文字只给生成物。它另外写进三个内容集合、各区的路由与侧栏、
整页星轨盘 `/trajectory`、`docfirst.config.mjs`、组件名册与名册核对脚本、起始页，以及 `doc` / `doc:confirm` / `doc:render` / `verify:roster` 几条脚本。

**只写文件**，不运行 install。回执里的 `next` 就是接着要运行的：

```
cd <站目录>
pnpm install
pnpm doc:render     # 只有 docfirst 站：生成仓根 README.md / AGENTS.md / CLAUDE.md
pnpm doc            # 只有 docfirst 站：核对
pnpm build
```

仓根已经有 `README.md` / `AGENTS.md` / `CLAUDE.md` 时回执多一条 `warn`：第一次 `doc:render` 会**覆盖**它们。
先把原有内容移进 `content/docs/outputs/` 下对应的 mdx 正本，再 render。

建站报错：

- 「dir 要是绝对路径」：插件在工作台主进程里运行，不知道相对于哪个目录
- 「站目录的上一级要是已经存在的仓目录」：`dir` 多写或少写了一层，或者仓还没建
- 「docfirst.create 没建成：……」：后面是原话。最常见是站目录已经存在，其次是脚手架联网失败或超时；
  脚手架输出变了、要替换的原文找不到时，报错指向插件的 `src/scaffold.ts`
- 「不认识的参数」：只接受 `dir`、`title`、`port`

## 改站的结构

### 建在基础包上的站

**加一个分区**（`content/notes/` → `/notes`）：建目录，`meta.json` 写 `title`、`"root": true` 与 `pages`，再把目录名加进 `content/meta.json` 的 `pages`。
`app/` 与配置文件不动。`content/` 下除 `future/` 外的目录自动算现状区，不用登记；轨迹卡在 `docfirst.config.mjs` 的 `trajectory` 指的目录里，不在 `content/` 下。

**侧栏顺序**写在各目录的 `meta.json`：`{ "pages": ["index", "...", "glossary"] }`，`"..."` 是其余按文件名排。

**用一个组件**：站内组件写在 `src/components/`，在用到它的页面开头按相对路径 `import`（`import { SeamMap } from '../../src/components/seam-map/seam-map';`），
组件自己 `import` 样式（`./xx.css`、`@godcreator/docfirst-explainer/styles.css`）。`Term` 与文件树 `Files` / `Folder` / `File` 由功能包提供，页面里不用 import；
fumadocs 自带的组件从 `@fumadocs/base-ui/components/<名>` 在页面开头 import。**只有组件要放进生成正本时**，在 `docfirst.config.mjs` 的 `components`
给它一条机读规则：放在组件旁边、不依赖 React 的 `.ai.mjs` 文件里，交回的文字就是它在生成物里的样子；普通页面上的组件不写规则。
生成正本里用了名册外的组件，`pnpm docfirst check` 报红、`render` 拒绝渲染；页面里用了却没 import 的组件，页面渲染时报组件未定义。

**接数学公式**归基础包的骨架：站里不另外接，`source.config.ts`、`app/` 都由初始化写出、改了也会被覆盖。
站点骨架的 `source.config.ts` 里没有 `remark-math` 时，这个站还写不了公式：等基础包接上以后升级基础包，再运行一次 `docsite.site.init {"dir":…}`。

### Next 站

**加一个分区**（`content/notes/` → `/notes`）改四处：`src/lib/source.ts` 里用 `fumadocs-mdx/macro` 的 `defineDocs` 加集合、
再加一条 `loader`；`src/app/notes/[[...slug]]/page.tsx` 照 docs 的写；侧栏在 `src/app/docs/layout.tsx` 里把各 loader 的
`getPageTree()` 拼成一棵树、每个分区一个 `root: true` 的文件夹节点；新分区的 `layout.tsx` 写 `export { default } from '../docs/layout'`。
集合写了 `mdxOptions` 会去掉缺省处理，用 `applyMdxPreset(...)` 加回来。docfirst 站里 `content/` 下新建的目录自动算现状区，不用登记。
侧栏顺序同上，写在 `meta.json`。

**登记一个组件**：写在 `src/components/`，登记进 `src/components/mdx.tsx` 的组件表，mdx 里才能写 `<名字 />`。
fumadocs 自带的组件从 `fumadocs-ui/components/<名>` 导入，默认组件表里只有 `Card`、`Callout`、代码块与标题几样。docfirst 站还要：

1. `src/components/registry.ts` 的名单加上组件名
2. **只有组件要放进生成正本时**，在 `docfirst.config.mjs` 的 `components` 给它一条机读规则（写法同上）。普通页面上的组件不写规则

然后 `node scripts/verify-roster.mjs` 核对机读规则表里的组件都在名单里。生成正本里用了名册外的组件，`pnpm doc` 直接报错。

用讲解组件包 `@godcreator/docfirst-explainer` 要在全局样式里引入它的 `styles.css`。

**接数学公式**照 fumadocs 官方做法，不另写组件：站里装 `remark-math`、`rehype-katex`、`katex`；现状区集合的 `mdxOptions` 里
`remarkPlugins` 加上 `remarkMath`、`rehypePlugins` 写 `(v) => [rehypeKatex, ...v]`（排在代码高亮之前）；全局样式引入 `katex/dist/katex.css`。
docfirst 站的集合已经用 `docfirstMdxOptions` 给了 `remarkPlugins`，在它外面再包一层：

```ts
const base = docfirstMdxOptions({ root: process.cwd() });
mdxOptions: applyMdxPreset({
  ...base,
  remarkPlugins: (v) => base.remarkPlugins([remarkMath, ...v]),
  rehypePlugins: (v) => [rehypeKatex, ...v],
}),
```

`docfirst-workflow` 0.5.4 起核对、确认与渲染也按 remark-math 解析，公式里的花括号不会被当成 mdx 表达式。

### 两种站都一样

Markdown 图片 `![说明](/p2/x.png)` 不用登记：图片放在站的 `public/` 下或页面旁边，页面上由 fumadocs 默认的图片组件显示。
在 mdx 里手写的 `<img>` 才算组件，照上面各自的组件写法处理。站用到的包（讲解组件包，`motion`、`next-themes` 这类 fumadocs 间接带进来的包）都写进站自己的 `package.json`。

## 构建与查看

### 建在基础包上的站

- **开发服务由 gwb-docsite 托管，不在会话里自己 `pnpm dev`**：改了页面，开发服务自己刷新

  ```
  docsite.site.add    {"dir":"<仓>/docs-site"}                登记并常驻（插件每次加载时启动）
  docsite.site.start  {"dir":"<仓>/docs-site","open":false}   启动；人为停了、连续失败停下的也用它再启动
  docsite.site.stop   {"dir":"<仓>/docs-site"}                停掉，这次加载期间不再自动启动
  docsite.site.list   {}                                       各站的状态、地址、启动失败的原因
  docsite.site.remove {"dir":"<仓>/docs-site"}                停掉并不再托管
  ```

  - 端口从站 `package.json` 的 `dev` 脚本读，脚本里要写死 `--port`；启动前插件查一遍站点（装没装依赖、`people.json` 对不对），不过就把每条问题写在 `error` 里
  - **改了构建页面时 remark 插件会调用到的包代码**（功能包 `docfirst-site`，`docfirst-workflow` 的 `./fumadocs` 及它调用的别的出口，`code-pin`）：
    在改过的包里 `pnpm build`，再 `docsite.site.stop`、`docsite.site.start` 重启开发服务——remark 插件在开发服务启动后第一次编译页面时装配，之后不重读
  - 给人看就在 VS Code 的内置浏览器里打开 `docsite.site.list` 回的地址（读说明书 `vscode`）
- **只是自己验证**：已托管的站直接看；没托管的 `docsite.site.start {"dir":…,"open":false}` 启动，验完 `docsite.site.stop`
- **`pnpm build` 是 `react-router build`**，只作提交前的检查，产物在 `build/`，不用它看页面
- **agent 读 mdx 正本，不解析 HTML**：站不出每页的机读版，直接读仓里 `content/` 下的 mdx

### Next 站

- **不用 `pnpm dev`**：它重新编译时内存一路上涨，出现过涨到约 16 GB 退出。看页面一律先 `pnpm build` 再 `pnpm start`，
  改了内容重新 build、重启 start。改完一批再 build，不改一页 build 一次；改的是站构建时会调用到的包代码，先删 `.next` 再 build
- **用户要看的站交给工作台托管，不由会话自己启动**：会话自己开的服务归那个会话，会话一停、一结束站就掉，几个会话还会抢同一个端口
  （理由见站上的轨迹卡「文档站改由工作台托管」）：

  ```
  docfirst.site.add      {"dir":"<仓>/docs-site"}               登记并启动 pnpm start；没构建过的先 build
  docfirst.site.restart  {"dir":"<仓>/docs-site"}               改完文档调它：停掉 → pnpm build → 启动，重新计时 12 小时
  docfirst.site.restart  {"dir":"<仓>/docs-site","build":false}  只重启不构建（到期了再开）
  docfirst.site.list     {}                                      托管着哪些站、各自状态、到期时刻、最近一次失败的原因
  docfirst.site.remove   {"dir":"<仓>/docs-site"}               停掉并不再托管
  ```

  - 端口从站 `package.json` 的 start 脚本读，脚本里要写死一个 `-p <端口>`
  - 每次启动开 12 小时，到点自动停，状态变成 `expired`；人在工作台的窗格「文档站」里看开着哪些站、还剩多久，窗格没有按钮，开关都由 agent 调命令
  - 端口已经被别的进程占着（多半是会话自己开的 `next start`）就不启动，`error` 里写明：停掉那个进程再 `restart`
  - 构建期间站打不开；构建或启动失败时站保持停着，回执的 `error` 带输出的最后几行，照它修好再 `restart`
  - 给人看就在 VS Code 的内置浏览器里打开地址（读说明书 `vscode`）。用户没说要看，build 通过就结束，不登记
- **只是自己验证、用户没说要看**：在站目录 `pnpm build` 再 `pnpm start`（Claude Code 桌面版写进 `.claude/launch.json` 用 `preview_start`，
  经到点自动停止的超时脚本启动），验完停掉。这个站已经由工作台托管的，直接 `restart`，不另开一个端口
- **agent 读 mdx 正本，不解析 HTML**：docfirst 站不出每页的机读版，直接读仓里 `content/` 下的 mdx；普通站可以先读 `/llms.txt` 找页，再取那几页的 `.md`

### 验收一页

- 每个按钮点一下、每种情况都试一遍，深浅主题各看一次，把窗口拉窄看一次
- 预览面板被隐藏时页面宽度是 0、逐帧回调不运行，动画停在中途：先给页面设一个尺寸，连续截几张图让它往前走再看最终画面；
  预览把窗口缩放过时按坐标点会点偏，改用元素引用
- docfirst 站再运行 `pnpm docfirst check`（Next 站另加 `node scripts/verify-roster.mjs`）；页面是生成正本的，看一眼生成物里组件变成的文字读得懂

## docfirst 站：核对、确认、生成

```
pnpm docfirst check                                       核对。有红时退出码 1——那是核对结果，不是命令失败
pnpm docfirst check --json                                机读报告，一行 JSON
pnpm docfirst confirm                                     机械写回：未确认的记号写上记录、挪了位置的写回新行号、重新渲染生成物
pnpm docfirst confirm content/docs/a.mdx --accept         复核过后，接受点名页里的黄灯
pnpm docfirst render                                      只重新生成生成物
pnpm docfirst trajectory                                  列出轨迹卡在星轨盘上的树与主干
```

各仓脚本名不完全一样，以站的 `package.json` 为准（`docfirst.create` 建的 Next 站另有 `pnpm doc`、`pnpm doc:confirm`、`pnpm doc:render` 几条简写）。

**读 `--json` 报告**：`docs[].items[]` 里 `status` 是 `changed`（内容变了）或 `missing`（目标不在了）的就是待处理；
`line` 是记号在文档里第几行，`lines` 是被引的那段今天在源文件里的位置，`diff` 是变了的那几行。`unconfirmed` 不算对不上。
`doc` 也可能是站 `src/components/` 下讲解组件的源码。

### 改了被钉的代码：同一个提交里处理黄灯

1. 改代码，先运行不带文档的检查（类型、lint、测试）
2. 在站目录运行 `pnpm docfirst check`：钉住的文件在本仓有未提交改动、内容又变了的黄灯**算红**
3. `pnpm docfirst confirm`：机械写回，不需要判断；黄灯原样留着、逐条列出
4. 逐条看剩下的黄灯：论断还成立就 `pnpm docfirst confirm <页…> --accept`；不成立先改正文再确认——正文怎么改看 `docs-writing` 的「黄灯以后改正文」
5. 代码、文档、记号上的新记录放进同一个提交

`--accept` 必须点名页：同一个仓里别人还没复核的黄灯不替别人接受。确认不要求先提交。已经提交的代码、别的仓的代码引起的黄灯，
`check` 只报告、不算红，碰到了照样按第 4 步处理。

### 生成物

README、AGENTS.md、CLAUDE.md、包里的 SKILL.md 是生成物：`docfirst.config.mjs` 的 `outputs` 把 mdx 正本对到生成位置。
**改正本，不改生成物**，改完 `pnpm docfirst render`，正本与生成物放进同一个提交；生成物跟正本对不上 `pnpm docfirst check` 报红。
渲染按原文处理：去掉 frontmatter，每个钉码记号换成一个代码块，每个组件换成它在名册里的机读文字，其余文字一个字节不动。
名册外的组件、mdx 表达式渲染不了，`pnpm docfirst check` 报红。
SKILL.md 要在映射里写对象形式、保留 `name` / `description` 两个 frontmatter 字段，否则生成出去是一份永远不会被读到的文档。

## 给别的仓写反馈

在 A 仓工作时发现 B 仓的问题，**在 B 仓在 gitea 上的仓里开一条 issue**，不往 B 仓里写文件：

1. 找到 B 仓在 gitea 上是 `<owner>/<仓名>`：插件包看它 `package.json` 的 `repository.url`，别的仓在仓里运行 `git remote get-url gitea`。
   B 仓在 gitea 上没有仓的，告诉人，不开 issue、也不写文件
2. 经 gwb-gitea 开 issue（说明书 `gitea` 的「工单」一节）：

   ```
   gitea.http { "method": "POST", "path": "/repos/<owner>/<仓名>/issues",
     "body": { "title": "<一句话标题>", "body": "<正文>" } }
   ```

   正文写碰到什么、期望怎样、证据在哪、你觉得该改哪儿，最后一行写 `来源：<哪个仓 / 哪次会话>`。回执 `status: 201` 才算开好，
   `body.number` 是编号

开着的 issue 在工作台的「issue 反馈」窗格里看，agent 调 `gitea-issues.list`（插件 `@godcreator/gwb-gitea-issues`）。
收件的仓处理完：结论写进现状页或轨迹卡，在 issue 下留言写明改在哪个提交，再关掉它
（`PATCH /repos/<owner>/<仓名>/issues/<编号>`，`body` 写 `{"state":"closed"}`）。

## 安装或构建失败

两种站都会碰到的：

- `pnpm-workspace.yaml` 的 `allowBuilds: esbuild: true` 别删，少了 `pnpm install` 报 `ERR_PNPM_IGNORED_BUILDS`
- 发布不满一天的包 pnpm 拒绝安装（`ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION`），锁文件里有这种包时连 `pnpm build` 都运行不了：
  把版本退回上一个。只在本机临时验证可以在当前终端设 `$env:pnpm_config_minimum_release_age='0'`，不写进仓里
- 安装设置写 `pnpm-workspace.yaml`，项目级 `.npmrc` 里的安装设置 pnpm 不读
- pnpm 不让代码 import 没声明的依赖：fumadocs 间接带进来的包也写进站自己的 `package.json`
- 有 Markdown 图片的页面构建时报 `第 1 行：名册外组件 <img>`：`@godcreator/docfirst-workflow` 0.5.2 及更早不认识 fumadocs 由 Markdown 图片
  生成的 `<img>`。把它升到 0.5.3 或更新，不要把 `img` 加进名册
- 写了公式的页面 `pnpm docfirst check` 报 `Could not parse expression with acorn`：`@godcreator/docfirst-workflow` 0.5.3 及更早不认 remark-math 的公式，
  把公式里的花括号当成 mdx 表达式。把它升到 0.5.4 或更新，不要为了绕开它把公式改写成组件或代码块

建在基础包上的站：

- 卡页报「DocsPage 要在 DocsLayout 下」：装出了两份 `@fumadocs/base-ui`，常见原因是 fumadocs-core 的可选 peer `zod` 解析成两个版本。
  在 `pnpm-workspace.yaml` 的 `overrides` 里把 `zod` 定成一个版本，重新 `pnpm install`

Next 站：

- `next.config.mjs` 的 `serverExternalPackages` 里不放带 `'use client'` 组件的包，否则预渲染报
  `Cannot read properties of null (reading 'use')`
- 含粗体或斜体的页面构建时报 `RangeError: Maximum call stack size exceeded`，栈在 fumadocs-core 的 `stringifier.js` 与
  mdast-util-to-markdown 的 `handle/strong.js` 之间来回：fumadocs-core 16.15.14 及更早配 mdast-util-to-markdown 2.1.3 就是这样。
  把 `fumadocs-core`、`fumadocs-ui` 升到 16.15.17 或更新，不要用 `overrides` 把 mdast-util-to-markdown 退回 2.1.2
- `-H 127.0.0.1` 别删：next 缺省监听所有网卡
- 升级 fumadocs：先在临时目录 `pnpm dlx create-fumadocs-app@<版本>` 生成一份对照、读迁移说明，改 `package.json` 版本
  （`fumadocs-core` 与 `fumadocs-ui` 同号），`pnpm install`、`pnpm build`
