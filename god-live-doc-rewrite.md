# god-live-doc 重写方案：带 git 的文件型引用（第一里程碑）

状态：定案，2026-09-03。落点单元 `D:\dshfiles\26090315xby`（新开）。老仓 `D:\dshfiles\26082711aju\god-live-doc` 只读参考，做到对齐后退役。
2026-09-04 起正本住单元根（这份文件）；此前它临时放在总控台 drafts/ 下，总控台清理时迁回。

## 一、决定

- **全部重做**，不在老仓上改。架构照 livedoc-lab 台阶七（`D:\dshfiles\260901lab\step7-packages` / `step7-site` / `step7-mini`）的定案；从老仓只吸 git 记忆那条线（blob、hunk 映射、行段跟随、归一化）。
- **第一里程碑只做文件型引用**（文件 + 行段）。目录型、存在性引用下一步重新设计，接口给它们留位（草稿记号的动作词、Target 的 kind），现在不实现。
- 语言 TS，构建 tsdown，包管理 pnpm，测试 `node --test`（或 vitest 标准写法，别用沙箱绕行）。
- 单元布局跟 260901lab 一样：单元根是 git 仓，包工作区一个子文件夹，邻居子文件夹放外部引用的示例（fumadocs 站、手写 html）。包工作区里自带一个 fumadocs 文档站，用这套机制写自己的文档。

## 二、四层包（照实验室）

```
core            零依赖。接口正本、服务编排、比较器接口。不读文件、不读配置、不 import 格式包
project         装配：读 livedoc.config、造读取器 / 记录簿 / 比较器，塞给 core.createService；同一根只装配一次
cli             check / confirm / render
format-md       md：注释记号 + 展示区（围栏）+ 尾注释；renderAi 剥标记
format-fumadocs mdx 与 fumadocs 是一个整体：remark 插件（链尾）、序列化回调、meta 白名单、pre 组件 + 状态点样式；renderAi 借 fumadocs loader 读 _markdown
format-html     元素既是记号又是展示区；文件即终态（final），不渲染
```

依赖方向：cli → project → core；格式包 → core（format-fumadocs 还依赖 project，因为它在站的链上要自己装配）。fumadocs 只许出现在 format-fumadocs，而且是 peer。边界测试读各包 package.json 守这几条。

## 三、核心接口

```ts
type Target = { file: string; a: number; b: number }          // 第一里程碑只有这一种；kind 留给下一步
type Reference = { target: Target; at: number; extra?: Record<string, unknown> }
type Status = "fresh" | "changed" | "missing" | "unconfirmed"
type Item = { doc; reference; current: string[] | null; record: Record | null; status; lines: [number, number]; reason?; diff?; old? }
type Listing = { doc; items: Item[]; orphans: Orphan[] }

interface Format {
  name; claims(doc); parse(text) → Reference[]; write(text, fills) → text; marker(target) → string
  lintComponents?; renderAi?; renderHuman?; final?
}
interface Reader   { read(file) → string[] | null }
interface Ledger   { get / set / list / remove / save }
interface Comparator {
  kind: string
  snapshot(target, text) → { record } | { problem: string }      // 确认时出记录；git 版在这儿把「已提交」的门守住
  judge(record, target, text) → { status; lines; reason?; diff?; old? }   // 核对时判；行段可能跟到新位置
}
createService({ formats, reader, ledger, comparator })
```

- **记录带 kind**，kind 对不对得上由比较器自己判（核心不看 kind）：git 版、hash 版看到别家的记录一律交回「未确认」，不猜。
- `judge` 交回的 `lines` 是段今天的位置。confirm 用它记录、用它让格式包重写记号；引用的键从旧行段换到新行段，旧键当孤儿清掉。
- 一篇里有一处钉不住（snapshot 交回 problem）**整篇拒**，一条都不写，problems 原样交给 cli 打印。
- 三个比较器：`git`（任何 git 仓里已提交的文件）、`hash`（不在 git 里的文件）、`auto`（默认，按文件位置分派，见四之二）。

## 四之二、记忆按文件位置分派（2026-09-03 定）

被引文件不限于项目自己的仓：另一个仓（别的单元、上游 clone）、被忽略的 `node_modules`、不在任何仓里的目录都能钉。规则一条，`auto` 比较器执行，核对时按记录的 `kind` 转发：

| 文件在哪 | 记忆 |
| --- | --- |
| 任何 git 仓里、已跟踪、干净 | git，本仓外仓一视同仁 |
| 任何 git 仓里、已跟踪但有改动，或未跟踪且没被忽略 | 拒，「先 commit」，不退成 hash |
| 仓里但被 `.gitignore` 忽略（`git check-ignore`） | hash |
| 不在任何仓里 | hash |
| 仓还没有一次提交 | 拒，「这个仓还没提交过」 |

- **定位先 realpath**：pnpm 的 `node_modules/@x/y` 是指向工作区包的软链，按真实路径定它在哪个仓、被不被忽略。git 根从**文件所在目录**往上找第一个 `.git`（最里层那个，子模块算自己的仓），不再从项目根找。
- **跨仓 git**：blob 是内容寻址的，记录不加字段，核对时从文件位置重新找仓；文件没了从它原来的目录往上找。diff 用 `git diff --no-index` 对两个临时文件，不往别人的对象库写松散对象。外仓脏了照样拒；外仓 blob 取不回走 blob-missing。
- **hash 版滑窗**：记录存段哈希和旧行号。核对时先看旧位置，不对就按段长滑窗全文件找；找到就绿、带新行号（撞车取离旧位置最近的一个，并列不猜）；找不到、旧位置还在文件里就「有变动、位置不明」（reason `unlocated`，行号停在旧位置，站上不摆代码只留一句提示）；旧位置已超出文件就 vanished。没有旧内容，给不出 diff。
- **报告里露出记忆种类**：confirm 的 `✅` 后面标「hash 记忆，不在 git 里」；写手得知道拿到的是弱记忆。
- 不做：文件改名不追（file-missing 红，重钉）；绝对路径不认；命名根（机器相关路径留在本地配置）单独定。

## 四、git 比较器（从老仓吸的）

- **snapshot**：文件必须在 HEAD 里（被 .gitignore 忽略、未跟踪、大小写不符都拒）且工作区干净（`git status --porcelain -- file` 为空），否则 problem。记录 `{ kind: "git", blob: HEAD:file 的 blob, lines: [a,b], hash: 段哈希, commit }`。仓里不存第二份内容。
- **judge**：blob 不在对象库（浅克隆、历史重写）→ missing/blob-missing；文件不在 → missing/file-missing；`git diff -U0 旧blob 新内容` 出 hunk 表（先只算哈希不写对象，绿灯常态不留松散对象），`mapRange` 把旧行段映到今天：整段删光 → missing/vanished；映到的段哈希等于记录 → fresh；否则 changed，带 `diff`（LCS 给人看的 `- / +`）和 `old`（从 blob 取回旧段）。绿只认段哈希，hunk 说没碰到也再比一次。
- 仓根可以是 git 的子目录：`HEAD:<rel>` 要翻成仓根相对（老仓 `gitRel`）。
- **归一化**：LF、去行尾空白、去末尾空行，缩进注释保留；站展示什么就哈希什么，两处共用一个函数。
- 老仓可直接搬的文件：`libs/core/src/core/git.ts`（去掉 initRepo/commitAll 以外全要）、`diff.ts`（mapRange / mapLine / renderDiff / slice）、`hash.ts`（normalize / hashSpan）。`pins.ts` 里 `checkCode` 和 `endorse` 的代码钉分支是 judge / snapshot 的蓝本，别的分支不要。

## 四之三、五类目标（2026-09-03 定）

文档对代码说的话只有三种（内容、形状、有无），对象只有两种（文件、目录）。五类把矩阵填满，`Target` 是带 kind 的联合，记录簿键加 kind 前缀（老键 `file:a-b` 没前缀就是行段）：

| 类 | 草稿记号 | 记录 | 变了 | 站上 |
| --- | --- | --- | --- | --- |
| 行段 span | `@@livedoc ref f:a-b @@` | git / hash | 黄带 diff；挪了绿 | 代码块 |
| 整文件 file | `@@livedoc ref f @@` | git / hash（整文件哈希） | 末尾追加也黄 | 代码块 |
| 目录树 tree | `@@livedoc tree d [depth=N] [glob=…] @@` | 名字表本身 | 名字多了少了黄带 `- / +`；目录没了红 | text 清单，黄退 diff 块 |
| 存在 exists / absent | `@@livedoc exists p @@` / `absent` | 类型 file / dir / absent | 不在、类型变了、断言不在却出现了都红；没有黄 | 一行芯片 |
| 名字 has | `@@livedoc has f "text" @@` | 只记「在」 | 文件里找不到字面量红；没有黄 | 一行芯片 |

- 读取器多两样观察：`list(dir, depth, glob)`（在仓里按 .gitignore 过滤、去 .git，dirs 带尾斜杠，平铺排序）、`kindOf(path)`。核心不碰盘，比较器只吃观察。
- tree / exists / has 三个比较器住核心（纯函数）；`createKindComparator` 按目标 kind 分派，行段 / 整文件仍走 git / hash / auto。目录树不设提交门。
- 格式包共用核心的载荷 `formalOf(target)`（`ref file="…" lines="…"`、`tree dir="…" depth="1"`、`exists path="…"`、`has file="…" text="…"`），外壳各自定；md 给行段 / 整文件 / 目录树长展示区，存在性 / 名字只有记号一行；html 用 `<pre data-tree>`、`<code data-exists / data-absent / data-has>`。
- 明确不做：跑出来的数（约定不进散文）、行内记号、目录内容哈希。
- 第一个真用户是 `examples/notes`（命令行记事本，一篇 mdx 手册五类全用），文档站「五类引用：一篇手册里怎么用」那章钉它的真文件，改动场景的输出由它的测试跑出来。

## 五、记号两态

- **草稿记号**（核心定，四种格式一个写法，独立一行）：`@@livedoc ref src/greet.ts:2-3 @@`。整行匹配，头尾 `@@` 哨兵都在才算，载荷交 `toTarget` 校验；少一头就是普通文字，不报错。各格式的 parse 都认它（md / mdx 认单独成段的一行，html 逐行且跳过 script / style，围栏里不认），认到的引用带 `extra.draft`，check 报未确认。
- **正式记号**（格式包定，`marker(target)` 出）：md `<!-- ref file="…" lines="a-b" -->` 加围栏加 `<!-- /ref -->`；mdx `{/* ref file="…" lines="a-b" */}`；html `<pre data-file="…" data-lines="a-b"></pre>`。confirm 时草稿换成正式形态并投影，之后不再出现。守它的测试：`parse(marker(t))` 认回 t，每个格式一条。
- 动作词 `ref` 之外留给下一步：`exists`、`tree`。

## 六、fumadocs 包

- 三个插头：`livedocMdxOptions({ root })` 给 `source.config.ts` 的 mdxOptions（remark 链尾挂 `remarkLivedocHost`、`rehypeCodeOptions.parseMetaString` 白名单多认 `data-dot`）；`livedocMarkdownOptions()` 给集合的 `postprocess.includeProcessedMarkdown`（序列化回调认树上的标）。集合定义在 `source.config.ts`，命令行 renderAi 从项目根 `register()` fumadocs 的 loader，import 带 `?collection=`，读 `_markdown`。
- 插件：recognize（正式 + 草稿）→ `service.resolveRefs` → applyListing（标记换 code 节点，meta 写 `title="来源" lineNumbers=起行 data-dot="颜色"`，另挂 `data.livedoc` 给 md 回调）→ stamp（组件按名册打标，不动树）。名册外组件硬失败报到行。
- 页面：`pre` 组件覆盖（客户端），有 `data-dot` 就套 CodeBlock，把 8px 状态点塞进标题栏 Actions 槽；样式随包发一份 css。颜色：fresh 绿、changed 实心黄、unconfirmed 空心黄、missing 红。**changed 那块用 shiki 的 `[!code --]/[!code ++]` 把 diff 渲在同一块里**（老仓 `blocks.ts` 的 diffBlock，没有行注释的语言退成 diff 块）；missing 显示 `old`。
- 名册契约：规则三种写法（函数 / "children" / "drop"），函数只用 helpers（attr / textOf / text / heading / paragraph / quote / children / inline），不碰节点字段；默认表只有 Note。
- md 那头：来源行 `<!-- 来源 file:a-b · 状态 -->` + 不带 meta 的围栏；组件按名册压平。
- 站构建后要重 build 才能看见格式包代码的改动（Turbopack 只按 mdx 内容缓存）：文档里写明；调试用 build + start，不用 dev。

## 七、单元布局

```
D:\dshfiles\26090315xby\            单元根 = git 仓
  unit.json  AGENTS.md  CLAUDE.md
  god-live-doc\                     pnpm 工作区：packages/{core,project,cli,format-md,format-fumadocs,format-html}
    docs-site\                      自己的 fumadocs 文档站，用这套机制写自己的文档（消费方之一，link 依赖）
    tests\                          契约 / 边界 / 记号 / 换比较器 / 时序图源码防漂
  examples\                         邻居：外部引用的示例——fumadocs 站、手写 html、纯 md 项目，各自 link 包
```

## 八、测试范式（照实验室）

- 契约：几种格式在同一串改动下状态一致（临时 git 仓：init、commit，改代码、确认、删代码）。
- 边界：读各包 package.json，core 零依赖，只有 format-fumadocs 见宿主且只能是 peer。
- 记号：`parse(marker(t))` 认回 t；草稿四格式都认、少哨兵 / 句子里 / 围栏里不认；草稿确认后变正式形态且幂等。
- 比较器：git 版与 hash 版在同一串改动下状态一致（hash 版不跟行段）；git 版行段跟随、vanished、blob-missing、未提交拒确认。
- 站：不起 Next，`register()` 后 import 一篇 mdx，断言 pre 带 `data-dot` 与来源标题、组件被 React 表画、`_markdown` 有来源行；起站抓 `.md` 路由跟命令行产物逐字节比。

## 九、顺序

1. core：types、compare 接口、service（含整篇拒）、hash 比较器；测试用假格式包。
2. git 比较器（搬老仓三个文件），临时 git 仓测试。
3. project、cli、format-md、format-html、草稿记号。
4. format-fumadocs 三插头 + pre 组件 + diff 渲染；docs-site 用起来。
5. examples 两三个消费方；文档站写清接线、记号、状态。
6. 对齐老仓功能面（除目录 / 存在性）后老仓退役。

## 十、开放问题（不阻塞第一里程碑）

- remarkInclude 排在插件前，被引入片段里的引用 check 看不到。
- 行内组件规则只能交回行内节点，没有机制守。
- 记录簿一个 json 在并发构建下的写入时机（老仓靠「没变不写」躲过；保留这条）。
- 目录型、存在性引用的模型：Target 加 kind，比较器按 kind 分派，草稿动作词已留位。

## 十一、产物摆放（2026-09-04 定）

mdx 是唯一正本，README.md、AGENTS.md 这类宿主生态认死了路径的文件是**纯生成物**：内容搬进 mdx，
render 摆过去，从此目标文件不再手写。

- 配置加一项 `outputs`：`{ 文档路径: [目标路径, …] }`。键是文档的项目根相对路径（正斜杠，同记录簿的键）；
  值是非空数组，每条相对项目根（`../`、`../../` 出根都行）。绝对路径拒；目标落进文档目录拒（那是源的地盘）；
  一个目标只许一个文档写（撞车拒）。
- 挂了映射的文档 `render --target ai` 只写目标（不再落 out/），目标上层目录不在就建；没挂映射的照旧落 out/ 当调试产物。
  摆放时整理成摆放产物的形态：剥掉 fumadocs 给标题加的 `[#锚]` 记号、还原被序列化器保守转义的加粗星号
  （`&#x2A;*` → `**`）、去开头空行——那些都是站上 .md 路由的形态，README 不带。
- `check` 顺手守生成物：对每条映射在内存里重渲染，跟盘上那份比（行尾归一 LF）。目标不存在、内容不一致
  （mdx 源改了没重摆、有人直接改了生成物）都算红退 1——生成物自己也会腐，守它是本职。
- 目标文件没有「保护标记」：迁移路线是先把内容搬进 mdx 再挂映射，render 直接覆盖。`CLAUDE.md` 这种
  一行 `@AGENTS.md` 的桩保持手写，不进映射。
- `renderAi` 的名字与 `--target` 语义不动：摆放出的就是平 md 这一种形态。skill（目录形态：SKILL.md 加资源）押后。

## 十二、更名 @godcreator02 与首发（2026-09-04 定）

六包从 `@god-live-doc/*` 更名进 `@godcreator02` scope，发进本机 Verdaccio——让其他单元的项目按精确版本装得到。
scope 已有的 registry 规则（config 的 publish 权、~/.npmrc 的映射）原样复用，Verdaccio config 与 npmrc 都不动。

| 旧 | 新 |
| --- | --- |
| @god-live-doc/core | @godcreator02/live-doc-core |
| @god-live-doc/project | @godcreator02/live-doc-project |
| @god-live-doc/cli | @godcreator02/live-doc-cli |
| @god-live-doc/format-md | @godcreator02/live-doc-format-md |
| @god-live-doc/format-fumadocs | @godcreator02/live-doc-format-fumadocs |
| @god-live-doc/format-html | @godcreator02/live-doc-format-html |

- **六包同版本**（当前 0.1.0），一起动一起发；内部依赖 `workspace:*`，`pnpm publish` 时自动替换成精确版本——发布纪律照总控台 `registry.md`：版本人改、同版本号永不重发、`files` 白名单加 `prepublishOnly`、发前 `pnpm pack --dry-run` 核清单。
- **devkit release 不适用于这套包**：它的门禁是插件形态专用（scope 之外还查 exports 指 lib/、cordis.patch.yml 等），且假设一仓一包一插件。这套包手跑：工作区根 `pnpm build` → 逐包核清单 → `pnpm -r publish --no-git-checks`（docs-site 是 private 自动跳过）→ devkit `registry status` 核对 → 逐包 git tag（`@godcreator02/live-doc-core@0.1.0` 形式）。
- **消费姿势**：纯库不走 `dsh plugin add`，消费方 devDependencies 按精确版本引入（如 `@godcreator02/live-doc-cli@0.1.0`）。
- 第一个外部用户是 god-example（单元 26083120lks）：插件仓加 fumadocs 站（一仓一插件一站），README / CLAUDE.md 生成化，docs 迁站页钉真源码——它是后续插件接入的样板。

## 十三、轨迹卡与星轨盘搬进来（2026-09-05 定）

live-doc 治的是**现状文档撒谎**（话写下那刻就跟代码分家，机制盯代码变没变）；轨迹卡治的是**历史被改写**
（了断记下来就该冻结，谁动了、谁被取代了要看得见）。两者都是「文档可信」，方向相反：一个盯代码，一个盯文档自己。
所以轨迹**不是第四种格式包**：核心五类引用说的是「文档对文件系统说的话」，卡的关系边说的是「文档对文档说的话」，
卡不需要记忆、不需要 confirm，只要即时校验。它的形态是 lint 加模型，不走记录簿。

出处：老 god-flow monorepo `D:\dshfiles\26082411bfd\god-docs\packages\god-flow-panels\node\star\`（parse / model /
layout / chains 四个 TS 文件是纯函数，带测试与 fixtures）；星盘视觉的参照物是
`D:\AI2026_godnotes\RUEPRTP9HY\trail-viewer-archive\trail-rings.html`（trail 时代、自带亮暗两套色板）。
两处都**只读**，搬逻辑不 import。老 326 张卡不搬；god-flow 家族已退役，本仓是轨迹功能的新家。

### 卡的格式（照 card-format 篇，不改）

- 落点：项目仓 `docs-god-flow/trajectory/`，一卡一文件、平铺不建子目录。**卡身份 = 文件名主干** `<YYYY-MM-DD>-<slug>`。
- frontmatter：`born-at`（`YYYY-MM-DDTHH:mm`，日级 `YYYY-MM-DD` 兼容）、`type`（`root` 或形态值 `choice` / `evidence` /
  `derivation` / `reference` / `snapshot`，缺省即默认形态）、`parent`（子卡必填，列表）、`merged-in`（仅根卡，⊆ parent）、
  `label`（必填）、`domain`（泳道，可缺）、`status`（自由槽位，不读不校验）。
- 正文关系边：`supersedes:: [文字](卡身份.md)`、`pivots-from:: [文字](卡身份.md)`，一行一条，wikilink 形态宽容。
- 根卡正文 `## 里程碑` 区块：`- 日期｜标题｜说明`（全角竖线）。
- **frontmatter 自己按行解析、一律字符串，不引 YAML 库**：日级 `born-at` 会被 YAML 库解成 Date。

### 校验（三层，从老仓 model.ts 整搬）

形状（born-at 格式、parent / merged-in 元素是合法身份）、存在性（缺 born-at / label、内卡缺 parent）、一致性
（parent 含自身、merged-in ⊄ parent、内卡写 merged-in、关系行写歪）。**另加一条本仓的**：卡正文里出现 livedoc
引用记号（草稿记号 `@@livedoc … @@` 或 md 正式记号 `<!-- ref … -->`）报病——轨迹分区冻结，不钉活代码。
`type` 取值不校验、`domain` 不设白名单。

### 模型与布局（从老仓整搬，常量公式一处不动）

聚盘（`parent` 含盘即上盘；子项目根卡默认虫洞投影、`merged-in` 列出的父盘递归摊入）、关系边按盘求解、
提树（分量收取代与转向两种边，主干比终点不比长度）、孤星、领域序按首次出现；布局：有效天数标度（空窗折叠、
对称双半段对数）、扇环装箱（领域聚块、槽复用）、鱼眼闭式映射、跨日弧向避让链表。**布局在客户端算**：服务端只出
模型，布局是纯函数几毫秒，放客户端才保得住设置滑杆。

### 包：`packages/trajectory`，`@godcreator02/live-doc-trajectory`，三个入口

| 入口 | 装什么 | 依赖 |
| --- | --- | --- |
| `.` | parse / validate / model / layout / chains；`scanDir(dir)` 读目录出 `{ cards, sick }`；`buildTrajectory(dir)` 出给盘的模型 | 产物只 import `node:`（包的 dependencies 里有 remark 那套，是给 `./server` 用的） |
| `./react` | 客户端组件 `StarDisk`（`"use client"` 留在产物头一行，照 format-fumadocs `/pre` 的先例）+ 随包发的 `star.css` | react 为 peer |
| `./server` | 服务端组件 `Trajectory`（读目录、建模、渲 `StarDisk`）、卡页 frontmatter 的 `cardSchema`——手写 StandardSchemaV1 对象（工厂形态，取 `ctx.path` 做 label 缺失时的文件名兜底；title 从 label 派生、born-at 收成字符串）、remark 插件 `remarkTrajectoryLinks`（关系边行渲成标注、`卡身份.md` 链接改写成卡页路由） | react 为 peer；remark 那套同 format-md |

边界测试跟着加一条：react 只许出现在 format-fumadocs 和 trajectory，且只能是 peer；trajectory 不依赖 core、
不依赖任何格式包、cli 与 project 不依赖 trajectory 的 react / server 入口。

### 星轨盘：React 重写壳，数学不重写

- **结构归 React，帧归 rAF**：SVG 树由 React 声明式建（按卡身份 keyed），补间循环与每帧 `place()` 用 useEffect 起 rAF、
  经 ref 表直接改属性，不走 setState。离散变化才走状态：筛选、搜索、设置、帮助、主题、当前盘。
- 视觉照 trail-rings：内旧外新的环、周月年环与日期标签、空窗小行星带、扇环框与树名、金色里程碑环、取代金黄虚线、
  转向青色点线、枯枝渐变、图例即筛选器、右上工具条与搜索、设置滑杆收进浮层、帮助浮层。
- **形状按 `type`**：choice 实心圆、evidence 三角、derivation 菱形、reference 方形、snapshot 空心方、缺省空心圆；
  被取代（有取代出边）一律淡出。这是 `type` 的显示读法，不是过滤，所有卡照常上盘。颜色只编码领域。
- **点节点在新标签页打开卡页**：节点包 SVG `<a href target="_blank" rel="noopener">`，链接由组件 prop `hrefOf(id)` 给。
  卡片栏、分割拖柄、VSCode 打开、复制路径全删。悬停小气泡：label、出生时刻、泳道、是否被取代。
- **搜索只匹配 label 与卡身份**，不搜正文（正文不进 payload）。
- **滚轮点击激活**：点一下盘进入交互态（滚轮鱼眼穿梭 / 自由缩放），Esc 或点盘外释放；未激活时滚轮穿透给页面。
- 主题跟 fumadocs：监听 `html` 的 `dark` class，两套色板从 trail-rings 搬，示例里的主题按钮不要。
- 多盘：盘上方一排页签，虫洞节点点了切盘（同页状态）；报病列表在盘下方列出（`livedoc check` 也报）。
- 尺寸：容器方形、宽随父元素；带全屏按钮（Fullscreen API）。客户端组件动态导入关掉 SSR，先渲占位方块。
- 测试：模型 / 布局 / 链表 / parse 的测试从老仓搬（`node --test`）；布局黄金数用老仓 fixtures 钉；React 层用
  `react-dom/server` 渲一遍断言 SVG 结构（节点数、扇环数、`a[target=_blank]`）。

### 接线

- `livedoc.config` 加一项 `trajectory: "docs-god-flow/trajectory"`（相对项目根，可选；不配就整个不管）。
  `livedoc check` 顺带跑卡校验，病卡逐条打印、算红退 1。另加子命令 `livedoc trajectory [--json]`：列盘、树、主干，
  `--json` 出模型。
- docs-site：卡集合单开一个 fumadocs 集合与 loader，落 `/trajectory/<卡身份>`，主文档树只多一页「轨迹」放盘；
  卡目录在单元根 `docs-god-flow/trajectory/`，`turbopack.root` 抬到单元根。本仓自己的卡由人写（动手权在人），
  盘空着是正常态；演示盘用老仓那批诗名 fixtures 放在 `examples/trajectory-site`。
- **`serverExternalPackages` 不加 trajectory**（2026-09-05 落地时定）：`./react` 是客户端组件、
  `./server` 用包名自引用去渲它，外置后 Next 走 Node 单独加载 `server.mjs`、看不见 `"use client"`，
  `StarDisk` 被当服务端组件渲染即炸。与 `format-fumadocs` 那条同类。
- 后续（本轮不做）：现状文档链到的卡被 `supersedes` 时该页黄；用 git 守子卡冻结；卡钉「当时」的代码。
