/**
 * # 边界守卫：`packages/` 下各包之间、workflow 包里面**唯一**的边界检查
 *
 * 包分两类。**通用包**不认识 docfirst，谁都能单独拿走用：钉码 `code-pin`（把文字钉在代码上）、
 * 星轨盘 `trajectory-disk`（把一组卡画成项目方向演变的圆盘）、讲解播放器 `explainer-player`（把讲解拆成配说明的帧来播放）。
 * **docfirst 的包** `docfirst-workflow` 用上面的通用包拼出 docfirst：命令行、项目装配与格式，
 * 接到 fumadocs 站上的部分在它的 `src/fumadocs/`，经子入口 `./fumadocs` 发出去。
 * 包与包之间的方向，pnpm 严格的 node_modules 能拦住一半——没写进依赖的包 import 不到——但「该不该写进依赖」
 * 没人检查；workflow 包里各目录之间更是谁都能 import 谁，`mdx/` 里写一句 `import "../project/load.ts"`，
 * 编译器不会报错，mdx 格式从此就跟读盘、git 绑在一起。**这个文件补上的就是这两项检查。**
 *
 * 它检查六类约束，每一类失败时的表现各不相同：
 *
 * **一、包与包之间的方向**：通用包互不认识，也不认识 docfirst 的包。
 * 方向一破，下游的改动就会拖着上游一起发版，而且没有任何别的信号。
 *
 * **二、通用包独立**（下面 `GENERIC_PACKAGES` 那张表）：清单里没有任何 `@godcreator/` 包，源码与产物不 import 它们、
 * 相对 import 不出自己的目录，源码、产物、样式与包的说明里一个 docfirst 字样都没有。docfirst 的名字一旦
 * 写进通用包，哪怕只是一行注释，下一个人就会顺着它把 docfirst 的规矩搬进来。另外各包自己的几条：
 * code-pin 只许 `node:crypto`、不认识文档文本；trajectory-disk 的 `.` 入口零 import、整个包不认识卡文件的写法。
 *
 * **三、workflow 里各目录的方向**（下面 `WORKFLOW_DIRS` 那张表），以及除了 `src/fumadocs/` 整个包不认识任何站的宿主；
 * `src/fumadocs/` 只按包名用本包的公开出口，命令行那一侧的代码才不会被带进站的构建。
 *
 * **四、宿主只能是可选的 peer，且不许打包进产物**：fumadocs 与 react 用的是消费方项目装的那份；打包进产物就是
 * 两份 React 各跑一套，现象是预渲染时莫名其妙的 hooks 报错。只用命令行的项目不装它们，所以标可选。
 * 客户端组件的 "use client" 要留在产物头一行。
 *
 * **五、包不认识工作台插件**：npm 包不许出现任何 `@godcreator/gwb-*`。
 * 包一旦依赖插件，装 docfirst 的人就得连带装上整个桌面工作台生态。
 *
 * **六、explainer-player 的两个入口**：react 是必需 peer；`.` 是客户端组件，`./text` 零 import
 * （站在 Node 里生成机读版时加载它）。
 *
 * **别删这个文件，也别把某一条注释掉「先让门禁通过」。** 它失败的时候，出错的是设计，不是测试。
 * 真要改方向，改的是那几张表加一段说明为什么——不是把断言删掉。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

interface Pkg {
  name: string;
  files?: string[];
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  peerDependenciesMeta?: Record<string, { optional?: boolean }>;
  devDependencies?: Record<string, string>;
}

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PACKAGES = join(ROOT, "packages");

/** npm 包在 packages/ 下的目录名 → 包名。工作台插件在 plugins/docfirst/，同一个工作区，但不在这几个包的依赖关系里 */
const NPM_PACKAGES: Record<string, string> = {
  "code-pin": "@godcreator/code-pin",
  "trajectory-disk": "@godcreator/trajectory-disk",
  "docfirst-workflow": "@godcreator/docfirst-workflow",
  "explainer-player": "@godcreator/explainer-player",
};
const PLUGIN_MANIFEST = join(ROOT, "plugins", "docfirst", "package.json");

const manifestOf = (dir: string): Pkg => JSON.parse(readFileSync(join(PACKAGES, dir, "package.json"), "utf8")) as Pkg;
/** 三类依赖字段里出现的全部包名：运行时、peer、开发期 */
const allDepsOf = (p: Pkg): string[] => Object.keys({ ...p.dependencies, ...p.peerDependencies, ...p.devDependencies });
/** 站的宿主：fumadocs 全家、next、react 本体与 react-dom */
const HOST = /^(fumadocs|next$|next\/|react$|react\/|react-dom$|react-dom\/)/;
const isReact = (spec: string): boolean => spec === "react" || spec.startsWith("react/");

/**
 * 编译产物里的 import 说明符——只认锚在行首的 import/export-from 语句，不用不带锚的
 * `from\s*["']` 全文匹配：产物里字符串字面量常包含 "pivots-from" 这类含 "from" 的子串
 * （trajectory 的 EDGE_HEAD 正则源码编译进去后原样留在产物里），不带锚的正则会把它当 import 语句头，
 * 从那个引号起一直匹配到几百字符外的下一个引号。tsdown/rolldown 的产物每条 import 语句独占一行，
 * 按行首锚定就避开了这个问题。源码也按这个写法排版，同一个函数两边通用。
 * 三种形态都收：`import … from "x"` / `export … from "x"`、副作用导入 `import "x"`、
 * 动态 `import("x")`——只认 from 那一种的话，一句 `import "宿主/样式.css"` 或
 * `await import("react")` 就能绕过每条边界检查。花括号跨行的 `import {\n a,\n b\n} from "x"` 另用一条收：
 * 它的行首后面紧跟花括号，花括号里只有名字，不会吃到字符串字面量。
 */
function importSpecsOf(src: string): string[] {
  const specs: string[] = [];
  for (const m of src.matchAll(/^(?:import|export)\b[^\n]*?\bfrom\s*["']([^"']+)["']/gm)) specs.push(m[1] as string);
  for (const m of src.matchAll(/^(?:import|export)\s+(?:type\s+)?\{[^}]*\n[^}]*\}\s*from\s*["']([^"']+)["']/gm)) specs.push(m[1] as string);
  for (const m of src.matchAll(/^import\s*["']([^"']+)["']/gm)) specs.push(m[1] as string);
  for (const m of src.matchAll(/\bimport\s*\(\s*["']([^"']+)["']\s*\)/g)) specs.push(m[1] as string);
  return specs;
}

/** 一个目录下的源文件（.ts / .tsx），递归 */
function sourcesIn(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...sourcesIn(full));
    else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) out.push(full);
  }
  return out;
}

const rel = (from: string, file: string): string => relative(from, file).split(sep).join("/");
const srcOf = (dir: string): string => join(PACKAGES, dir, "src");
const distOf = (dir: string, file: string): string => readFileSync(join(PACKAGES, dir, "dist", file), "utf8");

/** 一份产物连同它按相对路径 import 的同包 chunk，全部 import 说明符（相对的已经展开，不再列出） */
function distClosureSpecs(dir: string, file: string): string[] {
  const seen = new Set<string>();
  const specs: string[] = [];
  const visit = (name: string): void => {
    if (seen.has(name)) return;
    seen.add(name);
    for (const spec of importSpecsOf(distOf(dir, name))) {
      if (spec.startsWith("./")) visit(spec.slice(2));
      else specs.push(spec);
    }
  };
  visit(file);
  return specs;
}

// ── 一、包与包之间的方向 ──────────────────────────────────────────────────────

/**
 * 每个包不许依赖哪几个兄弟包。**列的是禁止的，不是允许的**——理由跟下面目录那张表一样。
 *   code-pin          通用包。判代码变没变只要读取器、旧内容来源两样传进来的东西，谁都不认识
 *   trajectory-disk   通用包。只收盘心加一组卡的中性输入，怎么建模、怎么画；docfirst 卡格式与读卡目录在 workflow
 *   explainer-player  通用包。普通 fumadocs 站也要用；docfirst 的包不用它，只有站用
 *   docfirst-workflow docfirst 本身：认识钉码与星轨盘，除了站谁都不认识它
 */
const PACKAGE_FORBIDDEN: Record<string, string[]> = {
  "code-pin": ["trajectory-disk", "docfirst-workflow", "explainer-player"],
  "trajectory-disk": ["code-pin", "docfirst-workflow", "explainer-player"],
  "docfirst-workflow": ["explainer-player"],
  "explainer-player": ["code-pin", "trajectory-disk", "docfirst-workflow"],
};

test("包的方向：清单三类依赖字段里不许出现禁止的兄弟包", () => {
  const bad: string[] = [];
  for (const [dir, forbidden] of Object.entries(PACKAGE_FORBIDDEN)) {
    const deps = allDepsOf(manifestOf(dir));
    for (const other of forbidden) if (deps.includes(NPM_PACKAGES[other]!)) bad.push(`${dir} → ${other}`);
  }
  assert.deepEqual(bad, [], "包的方向反了。改的是 PACKAGE_FORBIDDEN 那张表加一段为什么，不是把这条断言删掉");
});

test("包的方向：源码里也不许 import 禁止的兄弟包", () => {
  const bad: string[] = [];
  for (const [dir, forbidden] of Object.entries(PACKAGE_FORBIDDEN)) {
    for (const file of sourcesIn(srcOf(dir))) {
      for (const spec of importSpecsOf(readFileSync(file, "utf8"))) {
        const hit = forbidden.find((other) => spec === NPM_PACKAGES[other] || spec.startsWith(`${NPM_PACKAGES[other]}/`));
        if (hit !== undefined) bad.push(`${dir}/${rel(join(PACKAGES, dir), file)} → ${spec}`);
      }
    }
  }
  assert.deepEqual(bad, []);
});

test("packages/ 下的包一个不多一个不少——加了新包得先想清楚它能认识谁", () => {
  const dirs = readdirSync(PACKAGES, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
  assert.deepEqual(dirs, Object.keys(PACKAGE_FORBIDDEN).sort());
});

// ── 二、通用包独立 ────────────────────────────────────────────────────────────

/** 通用包：不认识 docfirst，谁都能单独拿走用。加一个通用包就加进这张表，下面三条自动管上它 */
const GENERIC_PACKAGES = ["code-pin", "trajectory-disk", "explainer-player"];

/** 包目录下除 node_modules 以外的全部文件：源码、产物、样式、构建配置、清单 */
function packageFiles(dir: string): string[] {
  const out: string[] = [];
  const walk = (current: string): void => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      if (entry.name === "node_modules") continue;
      const full = join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else out.push(full);
    }
  };
  walk(join(PACKAGES, dir));
  return out;
}

/** 产物里带 import 语句的文件：运行时代码与类型声明 */
const distCodeOf = (dir: string): string[] => packageFiles(dir).filter((f) => f.includes(`${sep}dist${sep}`) && /\.m?[jt]s$/.test(f));

test("通用包独立：清单三类依赖字段里没有任何 @godcreator/ 包", () => {
  const bad: string[] = [];
  for (const dir of GENERIC_PACKAGES) {
    for (const dep of allDepsOf(manifestOf(dir))) if (dep.startsWith("@godcreator/")) bad.push(`${dir} → ${dep}`);
  }
  assert.deepEqual(bad, [], "通用包得能单独拿走用。要用别的包，先想清楚它还算不算通用包");
});

test("通用包独立：源码与产物不 import 任何 @godcreator/ 包，源码的相对 import 不出自己的 src/", () => {
  const bad: string[] = [];
  for (const dir of GENERIC_PACKAGES) {
    for (const file of sourcesIn(srcOf(dir))) {
      for (const spec of importSpecsOf(readFileSync(file, "utf8"))) {
        const outside = spec.startsWith(".") && relative(srcOf(dir), resolve(dirname(file), spec)).startsWith("..");
        if (spec.startsWith("@godcreator/") || outside) bad.push(`${dir}/${rel(join(PACKAGES, dir), file)} → ${spec}`);
      }
    }
    for (const file of distCodeOf(dir)) {
      for (const spec of importSpecsOf(readFileSync(file, "utf8"))) {
        if (spec.startsWith("@godcreator/")) bad.push(`${dir}/${rel(join(PACKAGES, dir), file)} → ${spec}`);
      }
    }
  }
  assert.deepEqual(bad, []);
});

test("通用包不认识 docfirst：源码、产物、样式、构建配置与清单里一个 docfirst 字样都没有", () => {
  const bad: string[] = [];
  for (const dir of GENERIC_PACKAGES) {
    for (const file of packageFiles(dir)) {
      const lines = readFileSync(file, "utf8").split("\n");
      lines.forEach((line, index) => {
        if (/docfirst/i.test(line)) bad.push(`${dir}/${rel(join(PACKAGES, dir), file)}:${index + 1}`);
      });
    }
  }
  assert.deepEqual(bad, [], "通用包里写了 docfirst。讲 docfirst 怎么用它，写进 docfirst-workflow 或文档站，不写进通用包");
});

test("pin 零依赖：清单里没有 dependencies / peerDependencies，源码只 import 自己和 node:crypto", () => {
  const pkg = manifestOf("code-pin");
  assert.deepEqual(Object.keys(pkg.dependencies ?? {}), [], "pin 的 dependencies 得是空的");
  assert.deepEqual(Object.keys(pkg.peerDependencies ?? {}), [], "pin 的 peerDependencies 得是空的");
  for (const file of sourcesIn(srcOf("code-pin"))) {
    for (const spec of importSpecsOf(readFileSync(file, "utf8"))) {
      assert.ok(spec.startsWith("./") || spec === "node:crypto", `pin/${rel(srcOf("code-pin"), file)} import 了 ${spec}`);
    }
  }
});

/** 文档文本那一侧的名字：mdx、记号写法、格式接口、带文档位置的引用与清单。钉码核心只认目标与记录，一个都不该有 */
const DOC_SIDE_WORDS = /\bmdx\b|[Mm]arker|[Dd]raft|formalOf|parseFormal|targetKey|@@docfirst|\bFormat\b|\bReference\b|\bListing\b/;

test("钉码核心不接触文档文本：源码与产物里没有 mdx、记号写法、格式接口、引用与清单", () => {
  const dir = srcOf("code-pin");
  for (const file of sourcesIn(dir)) {
    const hit = DOC_SIDE_WORDS.exec(readFileSync(file, "utf8"));
    assert.equal(hit, null, `pin/src/${rel(dir, file)} 里出现了「${hit?.[0]}」`);
  }
  for (const file of ["index.mjs", "index.d.mts"]) {
    const hit = DOC_SIDE_WORDS.exec(distOf("code-pin", file));
    assert.equal(hit, null, `pin 的产物 ${file} 里出现了「${hit?.[0]}」`);
  }
});

test("trajectory 的 `.` 入口零 import：产物一条 import 都没有，连 node: 也没有", () => {
  // 按产物判比按 package.json 判更准：就算以后 `.` 入口不小心 import 到一个真依赖，这里也查得到
  assert.deepEqual(importSpecsOf(distOf("trajectory-disk", "index.mjs")), []);
  assert.deepEqual(Object.keys(manifestOf("trajectory-disk").dependencies ?? {}), [], "trajectory 的 dependencies 得是空的");
});

test("trajectory 的 `.ts` 源码只有相对 import——`.tsx` 是 `./disk` 入口，由下一条按产物查", () => {
  const dir = srcOf("trajectory-disk");
  for (const file of sourcesIn(dir).filter((f) => f.endsWith(".ts"))) {
    for (const spec of importSpecsOf(readFileSync(file, "utf8"))) {
      assert.ok(spec.startsWith("./") || spec.startsWith("../"), `trajectory/src/${rel(dir, file)} import 了 ${spec}`);
    }
  }
});

test("trajectory 的建模 `src/model/` 只 import 自己目录里的文件——布局、画布、组件都在它下游", () => {
  const dir = join(srcOf("trajectory-disk"), "model");
  for (const file of sourcesIn(dir)) {
    for (const spec of importSpecsOf(readFileSync(file, "utf8"))) {
      const inside = spec.startsWith("./") && !relative(dir, resolve(dirname(file), spec)).startsWith("..");
      assert.ok(inside, `trajectory/src/model/${rel(dir, file)} import 了 ${spec}`);
    }
  }
});

/** docfirst 卡文件的写法：关系行、frontmatter 字段名、里程碑标题常量。星轨盘只收中性输入，一个都不该认识 */
const CARD_FORMAT_WORDS = /supersedes::|pivots-from::|born-at|frontmatter|CARD_KEYS|MILESTONE_HEADING/;

test("trajectory 不认识 docfirst 卡格式：整个包（源码、产物、样式）里没有关系行、frontmatter 字段名这些卡文件的写法", () => {
  const bad: string[] = [];
  for (const file of packageFiles("trajectory-disk")) {
    const hit = CARD_FORMAT_WORDS.exec(readFileSync(file, "utf8"));
    if (hit !== null) bad.push(`${rel(join(PACKAGES, "trajectory-disk"), file)}「${hit[0]}」`);
  }
  assert.deepEqual(bad, []);
});

test("trajectory 的 `./disk`：客户端指令在头一行，只 import react、不内联 react", () => {
  // 「不把 react 打包进产物」要正着断言：react 真被内联进产物时，产物里根本没有那条 import 行，
  // 反着遍历 import 说明符的写法是恒真的（没有行就一条也遍历不到）。
  const disk = distOf("trajectory-disk", "disk.mjs");
  assert.match(disk, /^"use client";/, "disk.mjs 的 use client 指令得留在头一行");
  const specs = importSpecsOf(disk);
  assert.ok(specs.some(isReact), "disk.mjs 里没有 react 的 import 行——react 被内联进产物了");
  // 客户端那半只许 import react：第三方也不许内联（内联的第三方跟宿主装的那份会各跑一套），
  // node: 内置更不许（浏览器里根本没有）
  for (const spec of specs) assert.ok(isReact(spec), `disk.mjs（客户端组件）import 了 react 之外的 ${spec}`);
  // react 本体的内部标记：真被打包进来的话，光看 import 行看不出，得在正文里查
  assert.doesNotMatch(disk, /__CLIENT_INTERNALS|react\.production/, "disk.mjs 正文里有 react 本体的痕迹");
});

// ── 三、workflow 里各目录的方向 ────────────────────────────────────────────

const WORKFLOW_SRC = srcOf("docfirst-workflow");

/**
 * `src/<目录>` 不许 import 到哪几个目录去。**列的是禁止的目录，不是允许的目录**：写成允许的目录的话，
 * 加一个新目录会默默地什么都不许，加错地方反而更难发现。
 *
 * 方向读法（左边不许知道右边）：
 *   marker   记号写法：记号里的属性、报告里的目标文本、已删掉的草稿写法的报错；只用钉码核心的类型，谁都不认识
 *   reference 引用在文档里的位置与核对结果的类型，谁都不认识
 *   mdx      mdx 格式：认引用、写回、名册检查、按原文渲染，用记号写法；不认识组件格式、钉码编排、项目怎么装配、命令行怎么打印
 *   code     组件格式：讲解组件源码里的记号，按行认、按行写，用记号写法；只认识 marker 与 reference
 *   pinning  钉码编排：按文件选格式，格式认引用、钉码核心判定、格式写回的先后顺序；不认识记号属性怎么写
 *   project  碰环境：读盘、git、摆放；不认识命令行与卡格式
 *   cards    docfirst 卡格式：读卡目录、解析、校验、换成星轨盘的中性输入；卡里不许钉码要认记号，所以只认识 marker
 *   cli      命令行入口：认识以上全部，谁都不认识它
 *   fumadocs 站那一侧：不用相对路径进任何目录，只按包名用本包的 `.`、`./mdx`、`./cards`（下面单独一条查）；谁都不认识它
 */
const WORKFLOW_DIRS: Record<string, string[]> = {
  marker: ["reference", "mdx", "code", "pinning", "project", "cards", "cli", "fumadocs"],
  reference: ["marker", "mdx", "code", "pinning", "project", "cards", "cli", "fumadocs"],
  mdx: ["code", "pinning", "project", "cards", "cli", "fumadocs"],
  code: ["mdx", "pinning", "project", "cards", "cli", "fumadocs"],
  pinning: ["marker", "project", "cards", "cli", "fumadocs"],
  project: ["cards", "cli", "fumadocs"],
  cards: ["reference", "mdx", "code", "pinning", "project", "cli", "fumadocs"],
  cli: ["fumadocs"],
  fumadocs: ["marker", "reference", "mdx", "code", "pinning", "project", "cards", "cli"],
};

/** 一条相对说明符落在 workflow `src/` 下的哪个目录；落到 src 外面或 src 根上的文件回 null */
function dirOf(file: string, spec: string): string | null {
  const target = resolve(dirname(file), spec);
  const from = relative(WORKFLOW_SRC, target);
  if (from.startsWith("..")) return null;
  const parts = from.split(sep);
  return parts.length > 1 ? parts[0]! : null;
}

test("workflow 目录方向：marker 与 reference 谁都不认识，mdx 不认识钉码编排与 project，都不认识 cli", () => {
  const bad: string[] = [];
  for (const [dir, forbidden] of Object.entries(WORKFLOW_DIRS)) {
    for (const file of sourcesIn(join(WORKFLOW_SRC, dir))) {
      for (const spec of importSpecsOf(readFileSync(file, "utf8"))) {
        if (!spec.startsWith(".")) continue;
        const hit = dirOf(file, spec);
        if (hit !== null && forbidden.includes(hit)) bad.push(`${rel(WORKFLOW_SRC, file)} → ${hit}/（${spec}）`);
      }
    }
  }
  assert.deepEqual(bad, [], "方向反了。改的是 WORKFLOW_DIRS 那张表加一段为什么，不是把这条断言删掉");
});

test("workflow 目录方向：reference 只认识 @godcreator/code-pin", () => {
  for (const file of sourcesIn(join(WORKFLOW_SRC, "reference"))) {
    for (const spec of importSpecsOf(readFileSync(file, "utf8"))) {
      assert.ok(spec.startsWith("./") || spec === "@godcreator/code-pin", `reference/${rel(join(WORKFLOW_SRC, "reference"), file)} import 了 ${spec}`);
    }
  }
});

test("workflow 目录方向：code 只认识 marker、reference 与 @godcreator/code-pin", () => {
  const dir = join(WORKFLOW_SRC, "code");
  for (const file of sourcesIn(dir)) {
    for (const spec of importSpecsOf(readFileSync(file, "utf8"))) {
      if (spec === "@godcreator/code-pin") continue;
      const landed = spec.startsWith(".") ? (dirOf(file, spec) ?? "") : "";
      assert.ok(["code", "marker", "reference"].includes(landed), `code/${rel(dir, file)} import 了 ${spec}`);
    }
  }
});

/** 源码里每条 import / export-from 语句的整行与说明符；判「是不是 import type」要看整行 */
function importStatementsOf(src: string): Array<{ line: string; spec: string }> {
  return [...src.matchAll(/^(?:import|export)\b[^\n]*?\bfrom\s*["']([^"']+)["']/gm)].map((m) => ({ line: m[0], spec: m[1]! }));
}

test("workflow 目录方向：marker 只从 @godcreator/code-pin import 类型，别的只许是目录里的相对路径", () => {
  const dir = join(WORKFLOW_SRC, "marker");
  for (const file of sourcesIn(dir)) {
    const src = readFileSync(file, "utf8");
    const statements = importStatementsOf(src);
    assert.equal(statements.length, importSpecsOf(src).length, `marker/${rel(dir, file)} 有认不出整行的 import（副作用导入、动态导入或跨行花括号）`);
    for (const { line, spec } of statements) {
      if (spec === "@godcreator/code-pin") {
        assert.match(line, /^(?:import|export)\s+type\b/, `marker/${rel(dir, file)} 从钉码核心 import 了值：${line}`);
        continue;
      }
      const inside = spec.startsWith("./") && !relative(dir, resolve(dirname(file), spec)).startsWith("..");
      assert.ok(inside, `marker/${rel(dir, file)} import 了 ${spec}`);
    }
  }
});

test("workflow 目录方向：目录一个不少、一个不多——加了新目录得先想清楚它能认识谁", () => {
  const dirs = readdirSync(WORKFLOW_SRC, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
  assert.deepEqual(dirs, Object.keys(WORKFLOW_DIRS).sort());
});

const FUMADOCS_SRC = join(WORKFLOW_SRC, "fumadocs");
const WORKFLOW_NAME = NPM_PACKAGES["docfirst-workflow"]!;
const isSelf = (spec: string): boolean => spec === WORKFLOW_NAME || spec.startsWith(`${WORKFLOW_NAME}/`);

test("workflow 的 fumadocs 目录：相对 import 不出 src/fumadocs/，本包只按包名用 `.`、`./mdx`、`./cards`；别的目录不按包名引用本包", () => {
  const SELF_ALLOWED = [WORKFLOW_NAME, `${WORKFLOW_NAME}/mdx`, `${WORKFLOW_NAME}/cards`];
  const bad: string[] = [];
  for (const file of sourcesIn(WORKFLOW_SRC)) {
    const insideFumadocs = !relative(FUMADOCS_SRC, file).startsWith("..");
    for (const spec of importSpecsOf(readFileSync(file, "utf8"))) {
      if (insideFumadocs && spec.startsWith(".") && relative(FUMADOCS_SRC, resolve(dirname(file), spec)).startsWith("..")) {
        bad.push(`${rel(WORKFLOW_SRC, file)} 用相对路径出了 fumadocs/：${spec}`);
      }
      if (insideFumadocs && isSelf(spec) && !SELF_ALLOWED.includes(spec)) bad.push(`${rel(WORKFLOW_SRC, file)} 按包名引用了 ${spec}`);
      if (!insideFumadocs && isSelf(spec)) bad.push(`${rel(WORKFLOW_SRC, file)} 按包名引用了本包 ${spec}`);
    }
  }
  assert.deepEqual(bad, []);
});

test("workflow 除了 src/fumadocs/ 不认识任何站的宿主：源码与命令行那一侧的产物一个 fumadocs / react / next import 都没有", () => {
  for (const file of sourcesIn(WORKFLOW_SRC)) {
    if (!relative(FUMADOCS_SRC, file).startsWith("..")) continue;
    for (const spec of importSpecsOf(readFileSync(file, "utf8"))) {
      assert.ok(!HOST.test(spec), `workflow/${rel(WORKFLOW_SRC, file)} import 了宿主 ${spec}`);
    }
  }
  for (const file of ["index.mjs", "cli.mjs", "mdx.mjs", "cards.mjs"]) {
    for (const spec of distClosureSpecs("docfirst-workflow", file)) {
      assert.ok(!HOST.test(spec), `workflow 的产物 ${file} import 了宿主 ${spec}`);
    }
  }
});

// ── 四、fumadocs 子入口：宿主只能是可选的 peer，且不许被打包进产物 ──────────────────────

test("workflow 的宿主只能是可选的 peer，不许进 dependencies", () => {
  const pkg = manifestOf("docfirst-workflow");
  for (const host of ["fumadocs-core", "fumadocs-ui", "react"]) {
    assert.ok(pkg.peerDependencies?.[host] !== undefined, `得声明 ${host} 为 peer`);
    assert.equal(pkg.peerDependenciesMeta?.[host]?.optional, true, `${host} 只有 ./fumadocs 用，只用命令行的项目不装它，得标可选`);
  }
  for (const dep of Object.keys(pkg.dependencies ?? {})) assert.ok(!HOST.test(dep), `workflow 把 ${dep} 装成了自己的依赖`);
});

test("fumadocs 子入口的产物：宿主、兄弟包与本包的别的出口只许按包名 import，不许打包进产物；pre 的客户端指令在头一行", () => {
  const FILES = ["fumadocs.mjs", "fumadocs-roster.mjs", "fumadocs-pre.mjs", "fumadocs-term.mjs", "fumadocs-trajectory.mjs"];
  for (const file of FILES) {
    const src = distOf("docfirst-workflow", file);
    // rolldown 给打包进来的每个模块标一行 `//#region <来源路径>`：只许是 src/fumadocs/ 下的，
    // 宿主或兄弟包被打包进来时会出现 node_modules 路径，命令行那一侧的代码被打包进来时会出现 src/ 下别的目录
    for (const m of src.matchAll(/^\/\/#region (.+)$/gm)) {
      assert.ok(m[1]!.startsWith("src/fumadocs/"), `${file} 把 ${m[1]} 打包进了产物`);
    }
    assert.doesNotMatch(src, /__CLIENT_INTERNALS|react\.production/, `${file} 正文里有 react 本体的痕迹`);
  }
  // 客户端组件的 "use client" 要留在产物头一行，不然 Next 不认
  assert.match(distOf("docfirst-workflow", "fumadocs-pre.mjs"), /^"use client";/, "pre 的 use client 指令被打没了");
  for (const file of FILES.filter((f) => f !== "fumadocs-pre.mjs")) {
    assert.doesNotMatch(distOf("docfirst-workflow", file), /^"use client";/, `${file} 不该带客户端指令`);
  }
  // 含 React 的两份得真 import react（正着断言：react 被内联时产物里根本没有这条 import 行）
  for (const file of ["fumadocs-pre.mjs", "fumadocs-term.mjs"]) {
    assert.ok(importSpecsOf(distOf("docfirst-workflow", file)).some(isReact), `${file} 里没有 react 的 import 行——react 被内联进产物了`);
  }
  // 星轨盘按包名转出 `./disk`，那份产物头一行的 "use client" 才管得住 StarDisk
  assert.ok(
    importSpecsOf(distOf("docfirst-workflow", "fumadocs-trajectory.mjs")).includes("@godcreator/trajectory-disk/disk"),
    "fumadocs-trajectory.mjs 得按包名引用 @godcreator/trajectory-disk/disk",
  );
});

test("fumadocs 子入口的 `./fumadocs/roster`：命令行读 docfirst.config.mjs 时会加载它，产物不许 import 宿主", () => {
  for (const spec of distClosureSpecs("docfirst-workflow", "fumadocs-roster.mjs")) {
    assert.ok(!HOST.test(spec), `fumadocs-roster.mjs import 了宿主 ${spec}`);
  }
  for (const spec of importSpecsOf(readFileSync(join(FUMADOCS_SRC, "roster.ts"), "utf8"))) {
    assert.ok(!HOST.test(spec), `fumadocs/roster.ts import 了宿主 ${spec}`);
  }
});

/**
 * **包只发要在仓里用的东西。** 说明书与建站模板随工作台插件发：包里的说明书 agent 找不到——它放在
 * node_modules 里，没有东西指向它，一份 SKILL.md 放在那儿等于没有。agent 能读到说明书，全靠插件
 * `register` 了自己包里那个目录。判据见轨迹卡「包给仓、插件给人」。
 */
test("包只发 dist 与样式：skills 与 template 跟着插件走了，包里连目录都不该再有", () => {
  const FILES: Record<string, string[]> = {
    "code-pin": ["dist"],
    "trajectory-disk": ["dist", "styles"],
    "docfirst-workflow": ["dist", "styles"],
    "explainer-player": ["dist", "styles"],
  };
  for (const [dir, files] of Object.entries(FILES)) {
    assert.deepEqual(manifestOf(dir).files, files, `${dir} 的 files`);
    for (const path of ["skills", "template"]) {
      assert.equal(existsSync(join(PACKAGES, dir, path)), false, `${dir} 里还留着 ${path}/——它归插件 gwb-docfirst-workflow`);
    }
  }
  for (const path of ["styles/light.css", "styles/term.css", "styles/trajectory.css"]) {
    assert.ok(existsSync(join(PACKAGES, "docfirst-workflow", path)), `workflow 包少了 ${path}`);
  }
  assert.ok(existsSync(join(PACKAGES, "explainer-player", "styles", "explain.css")), "explainer-player 包少了 styles/explain.css");
});

// ── 五、包不认识工作台插件 ──────────────────────────────────────────────────

test("npm 包的依赖字段里不许出现工作台插件，也不许出现任何 @godcreator/gwb-*", () => {
  // 插件跟包在同一个工作区，包一旦认识插件（哪怕只是一条 devDependency）这几个包就不能再发布了
  // ——装它们的人不该连带装上整个桌面工作台生态。三类依赖全查：运行时、peer、开发期。
  // 反方向（插件不许依赖包）由插件自己的 tests/artifact.test.ts 检查：两个方向都禁止，
  // 现在这两边**互不认识**。
  const pluginName = (JSON.parse(readFileSync(PLUGIN_MANIFEST, "utf8")) as Pkg).name;
  for (const dir of Object.keys(NPM_PACKAGES)) {
    for (const dep of allDepsOf(manifestOf(dir))) {
      assert.notEqual(dep, pluginName, `${dir} 依赖了工作台插件 ${pluginName}——方向反了`);
      assert.ok(!dep.startsWith("@godcreator/gwb-"), `${dir} 依赖了 gwb 生态的 ${dep}`);
    }
  }
});

test("npm 包的源码里一行 @godcreator/gwb-* 都没有", () => {
  for (const dir of Object.keys(NPM_PACKAGES)) {
    for (const file of sourcesIn(srcOf(dir))) {
      for (const spec of importSpecsOf(readFileSync(file, "utf8"))) {
        assert.ok(!spec.startsWith("@godcreator/gwb-"), `${dir}/${rel(join(PACKAGES, dir), file)} import 了 ${spec}`);
      }
    }
  }
});

// ── 六、explainer-player 的两个入口 ─────────────────────────────────────────────────

test("explainer-player 清单：没有 dependencies，react 只作必需 peer；工作台插件不依赖它", () => {
  const pkg = manifestOf("explainer-player");
  assert.deepEqual(Object.keys(pkg.dependencies ?? {}), [], "explainer-player 的 dependencies 得是空的");
  assert.deepEqual(Object.keys(pkg.peerDependencies ?? {}), ["react"], "explainer-player 的 peer 只有 react");
  assert.notEqual(pkg.peerDependenciesMeta?.react?.optional, true, "react 是 explainer-player 的必需 peer，不该标可选");
  // 反方向：别的包由 PACKAGE_FORBIDDEN 查，工作台插件在这里查
  const plugin = JSON.parse(readFileSync(PLUGIN_MANIFEST, "utf8")) as Pkg;
  assert.ok(!allDepsOf(plugin).includes(NPM_PACKAGES["explainer-player"]!), "工作台插件依赖了 explainer-player");
});

test("explainer-player 的 `.`：客户端指令在头一行，只 import react，没有把 react 或别的模块打包进来", () => {
  const index = distOf("explainer-player", "index.mjs");
  assert.match(index, /^"use client";/, "index.mjs 的 use client 指令得留在头一行");
  const specs = importSpecsOf(index);
  assert.ok(specs.some(isReact), "index.mjs 里没有 react 的 import 行——react 被内联进产物了");
  for (const spec of specs) assert.ok(isReact(spec), `index.mjs（客户端组件）import 了 react 之外的 ${spec}`);
  for (const m of index.matchAll(/^\/\/#region (.+)$/gm)) {
    assert.ok(m[1]!.startsWith("src/"), `index.mjs 把 ${m[1]} 打包进了产物`);
  }
  assert.doesNotMatch(index, /__CLIENT_INTERNALS|react\.production/, "index.mjs 正文里有 react 本体的痕迹");
});

test("explainer-player 的 `./text`：docfirst.config.mjs 在 Node 里加载它，产物零 import、不带客户端指令", () => {
  const text = distOf("explainer-player", "text.mjs");
  assert.deepEqual(importSpecsOf(text), []);
  assert.doesNotMatch(text, /^"use client";/);
  assert.deepEqual(importSpecsOf(readFileSync(join(srcOf("explainer-player"), "text.ts"), "utf8")), [], "text.ts 源码也不许 import");
});
