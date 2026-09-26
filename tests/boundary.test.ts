/**
 * # 边界守卫：五个包之间、workflow 包里面**唯一**的边界检查
 *
 * docfirst 的四个包按接缝切开：钉码 `docfirst-pin`、轨迹 `docfirst-trajectory`、命令行与项目 `docfirst-workflow`、
 * fumadocs 适配 `docfirst-fumadocs`；第五个包 `docs-explain` 是文档站讲解组件的外壳与零件，只给站用，
 * 跟那四个包互不认识。包与包之间的方向，pnpm 严格的 node_modules 能拦住一半——没写进依赖的包
 * import 不到——但「该不该写进依赖」没人检查；workflow 包里各目录之间更是谁都能 import 谁，`mdx/` 里
 * 写一句 `import "../project/load.ts"`，编译器不会报错，mdx 格式从此就跟读盘、git 绑在一起。
 * **这个文件补上的就是这两项检查。**
 *
 * 它检查六类约束，每一类失败时的表现各不相同：
 *
 * **一、包与包之间的方向**：pin 谁都不认识；trajectory 不认识 pin / workflow / fumadocs；workflow 不认识
 * fumadocs。方向一破，下游的改动就会拖着上游一起发版，而且没有任何别的信号。
 *
 * **二、pin 与 trajectory 的零依赖**：pin 只许 `node:crypto`，trajectory 的 `.` 入口连 `node:` 都不许——
 * 它们是整块能被别人拿走的部分，浏览器里也跑得动。
 *
 * **三、workflow 里各目录的方向**（下面 `WORKFLOW_DIRS` 那张表），以及 workflow 整个不认识任何站的宿主。
 *
 * **四、宿主只能是 peer，且不许打包进产物**：fumadocs 与 react 用的是消费方项目装的那份；打包进产物就是
 * 两份 React 各跑一套，现象是预渲染时莫名其妙的 hooks 报错。客户端组件的 "use client" 要留在产物头一行。
 *
 * **五、包不认识工作台插件**：五个 npm 包不许出现任何 `@godcreator/gwb-*`。
 * 包一旦依赖插件，装 docfirst 的人就得连带装上整个桌面工作台生态。
 *
 * **六、docs-explain 只给站用**：没有 dependencies，react 是必需 peer；`.` 是客户端组件，`./text` 零 import
 * （docfirst.config.mjs 在 Node 里加载它）。别的包都不依赖它。
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

/** 五个 npm 包在 packages/ 下的目录名 → 包名。工作台插件在 plugins/docfirst/，同一个工作区，但不在这几个包的依赖关系里 */
const NPM_PACKAGES: Record<string, string> = {
  "docfirst-pin": "@godcreator/docfirst-pin",
  "docfirst-trajectory": "@godcreator/docfirst-trajectory",
  "docfirst-workflow": "@godcreator/docfirst-workflow",
  "docfirst-fumadocs": "@godcreator/docfirst-fumadocs",
  "docs-explain": "@godcreator/docs-explain",
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
 *   pin         钉码：判新鲜只要读取器、旧内容来源两样传进来的东西，谁都不认识
 *   trajectory  轨迹：卡怎么解析、盘怎么建模画，跟钉码无关；读卡目录的那一半在 workflow
 *   workflow    命令行与项目：认识钉码与轨迹，不认识任何站的宿主，所以也不认识 fumadocs 适配
 *   fumadocs    站那一侧：认识以上三个，除了站谁都不认识它
 *   docs-explain 讲解组件：普通 fumadocs 站也要用，所以不认识 docfirst 的任何包；它只给站用，四个包也都不认识它
 */
const PACKAGE_FORBIDDEN: Record<string, string[]> = {
  "docfirst-pin": ["docfirst-trajectory", "docfirst-workflow", "docfirst-fumadocs", "docs-explain"],
  "docfirst-trajectory": ["docfirst-pin", "docfirst-workflow", "docfirst-fumadocs", "docs-explain"],
  "docfirst-workflow": ["docfirst-fumadocs", "docs-explain"],
  "docfirst-fumadocs": ["docs-explain"],
  "docs-explain": ["docfirst-pin", "docfirst-trajectory", "docfirst-workflow", "docfirst-fumadocs"],
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

test("五个包一个不多一个不少——加了新包得先想清楚它能认识谁", () => {
  const dirs = readdirSync(PACKAGES, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
  assert.deepEqual(dirs, Object.keys(PACKAGE_FORBIDDEN).sort());
});

// ── 二、pin 与 trajectory 的零依赖 ────────────────────────────────────────────

test("pin 零依赖：清单里没有 dependencies / peerDependencies，源码只 import 自己和 node:crypto", () => {
  const pkg = manifestOf("docfirst-pin");
  assert.deepEqual(Object.keys(pkg.dependencies ?? {}), [], "pin 的 dependencies 得是空的");
  assert.deepEqual(Object.keys(pkg.peerDependencies ?? {}), [], "pin 的 peerDependencies 得是空的");
  for (const file of sourcesIn(srcOf("docfirst-pin"))) {
    for (const spec of importSpecsOf(readFileSync(file, "utf8"))) {
      assert.ok(spec.startsWith("./") || spec === "node:crypto", `pin/${rel(srcOf("docfirst-pin"), file)} import 了 ${spec}`);
    }
  }
});

/** 文档文本那一侧的名字：mdx、记号写法、格式接口、带文档位置的引用与清单。钉码核心只认目标与记录，一个都不该有 */
const DOC_SIDE_WORDS = /\bmdx\b|[Mm]arker|[Dd]raft|formalOf|parseFormal|targetKey|@@docfirst|\bFormat\b|\bReference\b|\bListing\b/;

test("钉码核心不接触文档文本：源码与产物里没有 mdx、记号写法、格式接口、引用与清单", () => {
  const dir = srcOf("docfirst-pin");
  for (const file of sourcesIn(dir)) {
    const hit = DOC_SIDE_WORDS.exec(readFileSync(file, "utf8"));
    assert.equal(hit, null, `pin/src/${rel(dir, file)} 里出现了「${hit?.[0]}」`);
  }
  for (const file of ["index.mjs", "index.d.mts"]) {
    const hit = DOC_SIDE_WORDS.exec(distOf("docfirst-pin", file));
    assert.equal(hit, null, `pin 的产物 ${file} 里出现了「${hit?.[0]}」`);
  }
});

test("trajectory 的 `.` 入口零 import：产物一条 import 都没有，连 node: 也没有", () => {
  // 按产物判比按 package.json 判更准：就算以后 `.` 入口不小心 import 到一个真依赖，这里也查得到
  assert.deepEqual(importSpecsOf(distOf("docfirst-trajectory", "index.mjs")), []);
  assert.deepEqual(Object.keys(manifestOf("docfirst-trajectory").dependencies ?? {}), [], "trajectory 的 dependencies 得是空的");
});

test("trajectory 的 `.ts` 源码只有相对 import——`.tsx` 是 `./disk` 入口，由下一条按产物查", () => {
  const dir = srcOf("docfirst-trajectory");
  for (const file of sourcesIn(dir).filter((f) => f.endsWith(".ts"))) {
    for (const spec of importSpecsOf(readFileSync(file, "utf8"))) {
      assert.ok(spec.startsWith("./") || spec.startsWith("../"), `trajectory/src/${rel(dir, file)} import 了 ${spec}`);
    }
  }
});

test("trajectory 的 `./disk`：客户端指令在头一行，只 import react、不内联 react", () => {
  // 「不把 react 打包进产物」要正着断言：react 真被内联进产物时，产物里根本没有那条 import 行，
  // 反着遍历 import 说明符的写法是恒真的（没有行就一条也遍历不到）。
  const disk = distOf("docfirst-trajectory", "disk.mjs");
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
 *   marker   记号写法：草稿写法、正式记号里的属性、报告里的目标文本；只用钉码核心的类型，谁都不认识
 *   reference 引用在文档里的位置与核对结果的类型，谁都不认识
 *   mdx      mdx 格式：认引用、写回、名册检查、按原文渲染，用记号写法；不认识钉码编排、项目怎么装配、命令行怎么打印
 *   pinning  钉码编排：mdx 认引用、钉码核心判定、mdx 写回的先后顺序；不认识记号属性怎么写
 *   project  碰环境：读盘、git、摆放、读卡目录；不认识命令行
 *   cli      入口：认识以上全部，谁都不认识它
 */
const WORKFLOW_DIRS: Record<string, string[]> = {
  marker: ["reference", "mdx", "pinning", "project", "cli"],
  reference: ["marker", "mdx", "pinning", "project", "cli"],
  mdx: ["pinning", "project", "cli"],
  pinning: ["marker", "project", "cli"],
  project: ["cli"],
  cli: [],
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

test("workflow 目录方向：reference 只认识 @godcreator/docfirst-pin", () => {
  for (const file of sourcesIn(join(WORKFLOW_SRC, "reference"))) {
    for (const spec of importSpecsOf(readFileSync(file, "utf8"))) {
      assert.ok(spec.startsWith("./") || spec === "@godcreator/docfirst-pin", `reference/${rel(join(WORKFLOW_SRC, "reference"), file)} import 了 ${spec}`);
    }
  }
});

/** 源码里每条 import / export-from 语句的整行与说明符；判「是不是 import type」要看整行 */
function importStatementsOf(src: string): Array<{ line: string; spec: string }> {
  return [...src.matchAll(/^(?:import|export)\b[^\n]*?\bfrom\s*["']([^"']+)["']/gm)].map((m) => ({ line: m[0], spec: m[1]! }));
}

test("workflow 目录方向：marker 只从 @godcreator/docfirst-pin import 类型，别的只许是目录里的相对路径", () => {
  const dir = join(WORKFLOW_SRC, "marker");
  for (const file of sourcesIn(dir)) {
    const src = readFileSync(file, "utf8");
    const statements = importStatementsOf(src);
    assert.equal(statements.length, importSpecsOf(src).length, `marker/${rel(dir, file)} 有认不出整行的 import（副作用导入、动态导入或跨行花括号）`);
    for (const { line, spec } of statements) {
      if (spec === "@godcreator/docfirst-pin") {
        assert.match(line, /^(?:import|export)\s+type\b/, `marker/${rel(dir, file)} 从钉码核心 import 了值：${line}`);
        continue;
      }
      const inside = spec.startsWith("./") && !relative(dir, resolve(dirname(file), spec)).startsWith("..");
      assert.ok(inside, `marker/${rel(dir, file)} import 了 ${spec}`);
    }
  }
});

test("钉码核心不认识 workflow：源码的相对 import 都落在自己的 src/ 里，说明符里没有 docfirst-workflow", () => {
  const dir = srcOf("docfirst-pin");
  for (const file of sourcesIn(dir)) {
    for (const spec of importSpecsOf(readFileSync(file, "utf8"))) {
      assert.ok(!spec.includes("docfirst-workflow"), `pin/${rel(dir, file)} import 了 ${spec}`);
      if (spec.startsWith(".")) assert.ok(!relative(dir, resolve(dirname(file), spec)).startsWith(".."), `pin/${rel(dir, file)} 的 ${spec} 落到了 src/ 外面`);
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

test("workflow 不认识任何站的宿主：源码一个 fumadocs / react / next import 都没有，清单里也没有", () => {
  for (const file of sourcesIn(WORKFLOW_SRC)) {
    for (const spec of importSpecsOf(readFileSync(file, "utf8"))) {
      assert.ok(!HOST.test(spec), `workflow/${rel(WORKFLOW_SRC, file)} import 了宿主 ${spec}`);
    }
  }
  for (const dep of allDepsOf(manifestOf("docfirst-workflow"))) {
    assert.ok(!HOST.test(dep) && !dep.startsWith("@types/react"), `workflow 的清单里有宿主 ${dep}`);
  }
  for (const file of ["index.mjs", "cli.mjs", "mdx.mjs"]) {
    for (const spec of distClosureSpecs("docfirst-workflow", file)) {
      assert.ok(!HOST.test(spec), `workflow 的产物 ${file} import 了宿主 ${spec}`);
    }
  }
});

// ── 四、fumadocs 包：宿主只能是 peer，且不许被打包进产物 ──────────────────────

test("fumadocs 包的宿主只能是必需的 peer，不许进 dependencies", () => {
  const pkg = manifestOf("docfirst-fumadocs");
  for (const host of ["fumadocs-core", "fumadocs-ui", "react"]) {
    assert.ok(pkg.peerDependencies?.[host] !== undefined, `得声明 ${host} 为 peer`);
    assert.notEqual(pkg.peerDependenciesMeta?.[host]?.optional, true, `${host} 是这个包的必需 peer，不该标可选`);
  }
  for (const dep of Object.keys(pkg.dependencies ?? {})) assert.ok(!HOST.test(dep), `fumadocs 包把 ${dep} 装成了自己的依赖`);
});

test("fumadocs 包的产物：宿主与兄弟包只许按包名 import，不许打包进产物；pre 的客户端指令在头一行", () => {
  const FILES = ["index.mjs", "roster.mjs", "pre.mjs", "term.mjs", "trajectory.mjs"];
  for (const file of FILES) {
    const src = distOf("docfirst-fumadocs", file);
    // rolldown 给打包进来的每个模块标一行 `//#region <来源路径>`：只许是本包 src/ 下的，
    // 宿主或兄弟包被打包进来时这里会出现 node_modules / ../docfirst-… 的路径
    for (const m of src.matchAll(/^\/\/#region (.+)$/gm)) {
      assert.ok(m[1]!.startsWith("src/"), `${file} 把 ${m[1]} 打包进了产物`);
    }
    assert.doesNotMatch(src, /__CLIENT_INTERNALS|react\.production/, `${file} 正文里有 react 本体的痕迹`);
  }
  // 客户端组件的 "use client" 要留在产物头一行，不然 Next 不认
  assert.match(distOf("docfirst-fumadocs", "pre.mjs"), /^"use client";/, "pre 的 use client 指令被打没了");
  for (const file of FILES.filter((f) => f !== "pre.mjs")) {
    assert.doesNotMatch(distOf("docfirst-fumadocs", file), /^"use client";/, `${file} 不该带客户端指令`);
  }
  // 含 React 的两份得真 import react（正着断言：react 被内联时产物里根本没有这条 import 行）
  for (const file of ["pre.mjs", "term.mjs"]) {
    assert.ok(importSpecsOf(distOf("docfirst-fumadocs", file)).some(isReact), `${file} 里没有 react 的 import 行——react 被内联进产物了`);
  }
  // 星轨盘按包名转出 `./disk`，那份产物头一行的 "use client" 才管得住 StarDisk
  assert.ok(
    importSpecsOf(distOf("docfirst-fumadocs", "trajectory.mjs")).includes("@godcreator/docfirst-trajectory/disk"),
    "trajectory.mjs 得按包名引用 @godcreator/docfirst-trajectory/disk",
  );
});

test("fumadocs 包的 `./roster`：命令行读 docfirst.config.mjs 时会加载它，产物不许 import 宿主", () => {
  for (const spec of distClosureSpecs("docfirst-fumadocs", "roster.mjs")) {
    assert.ok(!HOST.test(spec), `roster.mjs import 了宿主 ${spec}`);
  }
  for (const spec of importSpecsOf(readFileSync(join(srcOf("docfirst-fumadocs"), "roster.ts"), "utf8"))) {
    assert.ok(!HOST.test(spec), `roster.ts import 了宿主 ${spec}`);
  }
});

/**
 * **包只发要在仓里用的东西。** 说明书与建站模板随工作台插件发：包里的说明书 agent 找不到——它放在
 * node_modules 里，没有东西指向它，一份 SKILL.md 放在那儿等于没有。agent 能读到说明书，全靠插件
 * `register` 了自己包里那个目录。判据见轨迹卡「包给仓、插件给人」。
 */
test("包只发 dist 与样式：skills 与 template 跟着插件走了，包里连目录都不该再有", () => {
  const FILES: Record<string, string[]> = {
    "docfirst-pin": ["dist"],
    "docfirst-trajectory": ["dist", "styles"],
    "docfirst-workflow": ["dist"],
    "docfirst-fumadocs": ["dist", "styles"],
    "docs-explain": ["dist", "styles"],
  };
  for (const [dir, files] of Object.entries(FILES)) {
    assert.deepEqual(manifestOf(dir).files, files, `${dir} 的 files`);
    for (const path of ["skills", "template"]) {
      assert.equal(existsSync(join(PACKAGES, dir, path)), false, `${dir} 里还留着 ${path}/——它归插件 gwb-docfirst-workflow`);
    }
  }
  for (const path of ["styles/light.css", "styles/term.css", "styles/trajectory.css"]) {
    assert.ok(existsSync(join(PACKAGES, "docfirst-fumadocs", path)), `fumadocs 包少了 ${path}`);
  }
  assert.ok(existsSync(join(PACKAGES, "docs-explain", "styles", "explain.css")), "docs-explain 包少了 styles/explain.css");
});

// ── 五、包不认识工作台插件 ──────────────────────────────────────────────────

test("五个 npm 包的依赖字段里不许出现工作台插件，也不许出现任何 @godcreator/gwb-*", () => {
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

test("五个包的源码里一行 @godcreator/gwb-* 都没有", () => {
  for (const dir of Object.keys(NPM_PACKAGES)) {
    for (const file of sourcesIn(srcOf(dir))) {
      for (const spec of importSpecsOf(readFileSync(file, "utf8"))) {
        assert.ok(!spec.startsWith("@godcreator/gwb-"), `${dir}/${rel(join(PACKAGES, dir), file)} import 了 ${spec}`);
      }
    }
  }
});

// ── 六、docs-explain 只给站用 ─────────────────────────────────────────────────

test("docs-explain 清单：没有 dependencies，react 只作必需 peer，依赖字段里没有任何 @godcreator/ 包", () => {
  const pkg = manifestOf("docs-explain");
  assert.deepEqual(Object.keys(pkg.dependencies ?? {}), [], "docs-explain 的 dependencies 得是空的");
  assert.deepEqual(Object.keys(pkg.peerDependencies ?? {}), ["react"], "docs-explain 的 peer 只有 react");
  assert.notEqual(pkg.peerDependenciesMeta?.react?.optional, true, "react 是 docs-explain 的必需 peer，不该标可选");
  // 普通 fumadocs 站也装它：docfirst-* 与 gwb-* 一个都不许出现，开发期依赖也算
  for (const dep of allDepsOf(pkg)) assert.ok(!dep.startsWith("@godcreator/"), `docs-explain 的清单里有 ${dep}`);
  // 反方向：别的包由 PACKAGE_FORBIDDEN 查，工作台插件在这里查
  const plugin = JSON.parse(readFileSync(PLUGIN_MANIFEST, "utf8")) as Pkg;
  assert.ok(!allDepsOf(plugin).includes(NPM_PACKAGES["docs-explain"]!), "工作台插件依赖了 docs-explain");
});

test("docs-explain 的 `.`：客户端指令在头一行，只 import react，没有把 react 或别的模块打包进来", () => {
  const index = distOf("docs-explain", "index.mjs");
  assert.match(index, /^"use client";/, "index.mjs 的 use client 指令得留在头一行");
  const specs = importSpecsOf(index);
  assert.ok(specs.some(isReact), "index.mjs 里没有 react 的 import 行——react 被内联进产物了");
  for (const spec of specs) assert.ok(isReact(spec), `index.mjs（客户端组件）import 了 react 之外的 ${spec}`);
  for (const m of index.matchAll(/^\/\/#region (.+)$/gm)) {
    assert.ok(m[1]!.startsWith("src/"), `index.mjs 把 ${m[1]} 打包进了产物`);
  }
  assert.doesNotMatch(index, /__CLIENT_INTERNALS|react\.production/, "index.mjs 正文里有 react 本体的痕迹");
});

test("docs-explain 的 `./text`：docfirst.config.mjs 在 Node 里加载它，产物零 import、不带客户端指令", () => {
  const text = distOf("docs-explain", "text.mjs");
  assert.deepEqual(importSpecsOf(text), []);
  assert.doesNotMatch(text, /^"use client";/);
  assert.deepEqual(importSpecsOf(readFileSync(join(srcOf("docs-explain"), "text.ts"), "utf8")), [], "text.ts 源码也不许 import");
});
