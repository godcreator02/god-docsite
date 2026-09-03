# god-live-doc

把文档里对代码说的话钉在源码上：文档说「我引的是 `src/greet.ts` 第 2 到 3 行」「src 下有这四个文件」
「store.ts 里还有 save」，工具替你盯着。变了就报黄，等作者复核；引用指向空气了就报红。**文档里不存代码的副本**
——站上那块是构建时现拿的，记忆只有一条指纹。

五类引用：行段、整文件、目录树、存在性（含「断言不在」）、名字。一篇手册怎么把它们用起来，
见 `examples/notes` 和文档站「五类引用：一篇手册里怎么用」。

## 怎么装

```bash
pnpm add -D @god-live-doc/cli @god-live-doc/project @god-live-doc/format-fumadocs
```

写 md 或手写 html 就把 `format-fumadocs` 换成 `@god-live-doc/format-md` / `@god-live-doc/format-html`，
一个项目里几个格式包可以并存（各认各的后缀）。fumadocs 在格式包里只是 **peer**——用你项目里装的那份。

## 怎么接

### 一、项目根放一份 `livedoc.config.mjs`

命令行和站读的是同一份：

```js
import * as fumadocs from "@god-live-doc/format-fumadocs";
import * as tabs from "./src/components/tabs/tabs.ai.mjs";

export default {
  formats: [fumadocs],       // 挂哪些格式包
  docs: "content/docs",      // 文档在哪（相对项目根）
  out: "out",                // render 的产物落哪
  ledger: ".ledger.json",    // 记录簿，默认就是这个
  comparator: "auto",        // 记忆怎么记：auto（默认，按文件位置挑 git 或 hash）、git、hash
  outputs: {                 // 产物摆放：挂了映射的文档 render --target ai 直接写到指定位置（相对项目根），不落 out/
    "content/docs/readme.mdx": ["../README.md"],
  },
  components: {              // 组件名册：AI 那份里怎么把组件压平
    ...fumadocs.defaultRoster,
    Tabs: tabs.Tabs,
    Tab: tabs.Tab,
  },
};
```

引用里的路径**相对项目根**。记录簿进 git——它就是记忆。

### 二、写引用：写一行草稿记号就行

```md
@@livedoc ref src/greet.ts:2-3 @@                       行段
@@livedoc ref config.json @@                            整文件（末尾追加也算变）
@@livedoc tree src @@                                   目录树；可带 depth=2、glob=*.test.ts
@@livedoc exists src/store.ts @@                        在；absent 是「断言不在」
@@livedoc has src/store.ts "export function save" @@    文件里有这个字面量
```

三种格式一个写法。`check` 认它、报「未确认」；`confirm` 把它换成这种格式的正式记号并投影内容，
之后草稿不再出现。头尾的 `@@` 是哨兵，少一头就是普通文字；写在句子里、围栏里、`<script>` 里的都不算。

正式记号的载荷是核心定的一截（`ref file="…" lines="a-b"`、`tree dir="…" depth="1"`、`exists path="…"`、
`absent path="…"`、`has file="…" text="…"`），外壳各格式各长各的（`marker(target)` 出，`parse(marker(t))` 认得回来）：

| 格式   | 正式记号                                                                                                        | 展示区                                                    |
| ---- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| md   | `<!-- ref … -->` … `<!-- /ref -->`（目录树是 `<!-- tree … -->` … `<!-- /tree -->`）                               | 行段 / 整文件 / 目录树有围栏；存在性、名字只有记号一行                         |
| mdx  | `{/* ref … */}`、`{/* tree … */}`、`{/* exists … */}`、`{/* has … */}`                                         | 没有，build 时现拿；目录树渲成 fumadocs 的 `Files` 文件树，存在性、名字渲成一行芯片 |
| html | `<pre data-file=… data-lines=…>`、`<pre data-tree=…>`、`<code data-exists=…>`、`<code data-has=… data-file=…>` | 元素本身                                                   |

**记号上的行号不用人维护**：代码挪了位置，下次 `confirm` 会把它改写成今天的位置，记录簿里的旧键当孤儿清掉。

### 三、fumadocs 站再接三处

`source.config.ts`：

```ts
import { defineConfig, defineDocs } from 'fumadocs-mdx/config';
import { livedocMdxOptions, livedocMarkdownOptions } from '@god-live-doc/format-fumadocs';

export const docs = defineDocs({
  dir: 'content/docs',
  docs: { postprocess: { includeProcessedMarkdown: livedocMarkdownOptions() } },
});

export default defineConfig({
  mdxOptions: livedocMdxOptions({ root: process.cwd() }) as never,
});
```

`src/components/mdx.tsx` 里把 `pre` 换成会画状态点的那个，再注册 fumadocs 自己的文件树三件（目录树引用注入的就是它们）：

```tsx
import { LivedocPre } from '@god-live-doc/format-fumadocs/pre';
import { File, Files, Folder } from 'fumadocs-ui/components/files';
// …
Files, Folder, File,
pre: LivedocPre as unknown as NonNullable<MDXComponents['pre']>,
```

`global.css` 里引一行样式：`@import '@god-live-doc/format-fumadocs/light.css';`

`next.config.mjs` 里把这三个包标成外部包（它们只在服务端跑，还要读盘和调 git）：

```js
serverExternalPackages: ['@god-live-doc/format-fumadocs', '@god-live-doc/project', '@god-live-doc/core'],
```

## 怎么跑

```bash
pnpm livedoc check                    # 只读，报状态。红退 1，黄和白退 0
pnpm livedoc confirm                  # 出记录、清孤儿、换记号、投影内容
pnpm livedoc render --target ai       # 出给 AI 读的那份 md，落 out/；挂了 outputs 映射的摆到指定位置
```

`confirm` 之前**先 commit**：git 记忆只对已提交、且工作区干净的内容钉（引到别的仓也一样）。有一处钉不住就**整篇拒**
——problems 打出来，记录簿一条不写、文档一个字不改。

`outputs` 挂了映射的文档是**摆放**：README、AGENTS.md 这类宿主生态认死了路径的文件是纯生成物，正本在 mdx，
render 直接写到映射给的位置（可以出项目根，`../README.md`、`../../AGENTS.md` 都行）。`check` 顺手守着生成物——
目标还不存在、内容跟 mdx 源不一致（改了源没重摆、有人直接改了生成物）都算红，重跑 render 就平。

### 四种状态

|        | 什么意思                                             | 站上   | 退出码 |
| ------ | ------------------------------------------------ | ---- | --- |
| 🟢 新鲜  | 段哈希跟记忆里一样（挪了位置也算）                                | 绿点   | 0   |
| 🟡 有变动 | 内容变了，等作者复核；git 记忆把 diff 渲在同一块里，hash 记忆只留一句「位置不明」 | 实心黄点 | 0   |
| ⚪ 未确认  | 还没确认过，或者换过比较器                                    | 空心黄点 | 0   |
| 🔴 缺失  | 整段删光 / 文件没了 / blob 不在对象库；显示文档写下时那段               | 红点   | 1   |

孤儿记录（记录簿里有、文档里没有了）和名册外组件也算红。文档本身删了、挪了的，它的记录同样算红，`confirm` 整个忘掉。

### 五类各盯什么

| 类         | 变了是什么意思                                        | 黄        | 红                    |
| --------- | ---------------------------------------------- | -------- | -------------------- |
| 行段        | 那几行内容变了（挪了位置不算，跟得住）                            | 带 diff   | 整段删光、文件没了            |
| 整文件       | 文件任何一处变了，包括末尾追加                                | 整份 diff  | 文件没了                 |
| 目录树       | 名字多了少了（不看内容，按 .gitignore 过滤）；站上是 fumadocs 的文件树 | 多的绿、少的划掉 | 目录没了                 |
| 存在 / 断言不在 | 没有黄                                            | —        | 没了、文件和目录换了个、断言不在却出现了 |
| 名字        | 没有黄；纯文本匹配，写全（`export function save`）           | —        | 文件里找不到了              |

### 行段和整文件的记忆按文件位置分派

被引文件不限于项目自己的仓：别的仓、被忽略的 `node_modules`、仓外目录都能钉。默认的 `auto` 按文件的
**真实路径**（pnpm 软链按指向算）挑记忆：

| 文件在哪                      | 记忆                                                                                       |
| ------------------------- | ---------------------------------------------------------------------------------------- |
| 任何 git 仓里、已跟踪、干净          | **git**：记忆是那个仓 HEAD 里的 blob，哪儿都不存第二份。`git diff -U0` 的 hunk 表把旧行段映到今天，挪了跟得住，变了给 diff 和旧内容 |
| 任何 git 仓里、有改动或未跟踪         | 拒，「先 commit」，不退成 hash                                                                    |
| 被 `.gitignore` 忽略，或不在任何仓里 | **hash**：只记段哈希和旧行号。挪了靠滑窗找回来；改了就「位置不明」，没有 diff，等人重钉                                       |

`confirm` 的 `✅` 会标出哪一处拿到的是 hash 记忆。记录带 `kind`，核对按它转发；别家比较器的记录一律当
「未确认」重新确认，不猜。配置写 `git` / `hash` 是强制行段和整文件全用一种；目录树（记名字表）、存在性（记类型）、
名字（只记在）各有各的比较器，住核心。

## 包

```
core             零依赖（只用 node:crypto）。接口正本、编排服务、归一化与哈希、行段映射与 LCS diff、hash 比较器（滑窗）、目录树 / 存在性 / 名字三个比较器
project          装配：读 livedoc.config、造读取器（读文件、列目录、看类型）/ json 记录簿 / 比较器；git 那条线和按种类、按位置分派的 auto 比较器也住这儿
cli              check / confirm / render
format-md        注释记号 + 围栏展示区 + 尾注释
format-fumadocs  mdx 与 fumadocs 是一个整体：remark 插件、序列化回调、meta 白名单、pre 组件 + 样式
format-html      元素既是记号又是展示区，文件即终态（final），不渲染
```

依赖方向：cli → project → core；格式包 → core（format-fumadocs 还依赖 project，它在站的链上要自己装配）。
fumadocs 只许出现在 format-fumadocs，而且只能是 peer。`tests/boundary.test.ts` 守着这几条。

## 这个仓自己怎么跑

```powershell
cd god-live-doc
pnpm install
pnpm build          # 各包 tsdown，拓扑序
pnpm typecheck      # 各包 tsc，外加 tests/
pnpm test           # 先 build 再 node --test tests/*.test.ts

cd docs-site        # 自己的文档站，用这套机制写自己的文档
pnpm livedoc check
pnpm livedoc render --target ai       # 重摆 README / AGENTS 生成物（mdx 源动了才要）
pnpm test           # 站那头的接线（不起 Next）
pnpm build          # next build
node scripts/verify-roster.mjs

cd ..\..\examples\plain           # 消费方示例：手写 html + 纯 md，比较器 hash
pnpm install; pnpm test
cd ..\fumadocs-site               # 消费方示例：外部 fumadocs 站
pnpm install; pnpm test; pnpm build
cd ..\notes                       # 消费方示例：记事本，一篇 mdx 手册五类引用全用上
pnpm install; pnpm test
```

改了格式包的代码，站要**先删 `.next` 再 build** 才看得见——Turbopack 只按 mdx 内容缓存。
调试站用 `next build` + `next start`，不用 dev。

## 待定

方案里没定、这一版按「最保守」选了的地方，记在这儿备查：

* **记录的类型名叫 `MemoRecord`**，不叫 `Record`——后者是 TS 内置的映射型别，撞名。清单项上的字段名还是 `record`。
* **构建产物是 `.mjs` / `.d.mts`**（tsdown 的默认），`exports` 直接指过去，没去折腾扩展名。
* 包**没写 `private`**，但也**没配发布流程**——能发，没发。真要发之前得先想清楚版本策略。
* **没有「代码根」这个配置项**：引用路径一律相对项目根。所以 `docs-site` 引工作区源码时写的是
  `../packages/…`，标题栏上也就这么显示。要更好看得先给配置加一项，那是接口变更。
* **`format-fumadocs` 把 `fumadocs-ui` / `react` 放进了 devDependencies**，只为编译和类型检查；
  `tsdown` 的 `deps.neverBundle` 守着它们不进产物。消费方最好装**同一个版本**，否则 pnpm 会摆出两份
  副本，React 的上下文可能对不上。
* **hash 记忆的「有变动」没有 diff、没有旧内容、也定位不了**（记忆里只有段哈希）：报「位置不明」，行号停在旧位置，
  站上那一块不摆代码只留一句提示。想要 diff 就得存一份段文本，那是「不存第二份内容」的反面，不做。
* **文件改名不追**，改了名就是 `file-missing`，重钉。**绝对路径不认**；仓外路径在别的机器上会红，
  机器相关的路径该留在本地配置——那就是「代码根 / 命名根」，跟上面那条一起定。
* **目录树的记忆是名字表本身**，存在记录簿里——「不存第二份内容」的一处例外：几十个名字不是代码，不这么存就给不出
  「多了哪个、少了哪个」。目录树不设提交门。**存在性、名字没有黄**；名字是纯文本匹配、只记「在」不记次数。
* **不做**：跑出来的数（约定不进散文）、行内记号（押后）、目录的内容哈希、符号级别的存在（要语言服务）。
* **缺失的引用也走整篇拒**：`confirm` 时 snapshot 交回 problem，整篇不写。想确认就先把引用改对或删掉。
* **`renderHuman` 没有实现**：fumadocs 那份人看的就是站本身，md / html 也没有第二种人看的形态。
  接口上留着这个口。
* **`livedocMarkdownOptions` 的回调形参声明成 `unknown`**：fumadocs 那头要求的是完整 mdast 型别，
  这个包只认树上的几个字段，形参放宽才对得上它的签名。

方案第十节那几条开放问题原样还在：`remarkInclude` 排在插件前所以被引入片段里的引用 check 看不到；
行内组件规则只能交回行内节点、没有机制守；记录簿一个 json 在并发构建下的写入时机（靠「没变不写」躲过）。
