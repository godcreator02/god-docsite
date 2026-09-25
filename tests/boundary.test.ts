/**
 * # 边界守卫：五个包合并之后**唯一**的边界检查
 *
 * 五个包合并成一个 `@godcreator/docfirst-workflow` 之后，「谁能依赖谁」不再能靠 pnpm 的严格
 * node_modules 挡住——同一个包里，`engine/` 里随手写一句 `import "../host/git.ts"`
 * 编译器不会报错，判定层从此就会启动 git 子进程。**这个文件补上的就是这项检查。**
 *
 * 它检查四类约束，每一类失败时的表现各不相同：
 *
 * **一、目录方向**（下面 `LAYERS` 那张表）。分层的意义是「变化原因不同的东西不互相拖累」：
 * `engine/` 只认注进来的东西，所以它能不起进程、不碰盘地被测；`host/` 不认识任何格式，
 * 所以换格式不动它。方向一破，这两句话当场变成假话，而且**没有任何别的信号**——
 * 测试照跑、构建照过，只有半年后有人问「为什么判定层跑得这么慢」才看得出来。
 *
 * **二、判定层的零依赖**：`engine/` 只许 `node:crypto`——整个包里唯一能被别人整块复制走的部分。
 *
 * **三、宿主只能是 peer，且不许被打进产物**：fumadocs 与 react 用的是消费方项目装的那份；
 * 打进产物就是两份 React 各跑一套，现象是预渲染时莫名其妙的 hooks 报错。
 *
 * **四、包不认识工作台插件**：两个 npm 包不许出现任何 `@godcreator/gwb-*`。
 * 包一旦依赖插件，装 docfirst 的人就得连带装上整个桌面工作台生态。
 *
 * **别删这个文件，也别把某一条注释掉「先让门禁通过」。** 它失败的时候，出错的是设计，不是测试。
 * 真要改方向，改的是 `LAYERS` 那张表加一段说明为什么——不是把断言删掉。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

interface Pkg {
  name: string;
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PACKAGES = join(ROOT, "packages");
const SRC = join(PACKAGES, "docfirst-workflow", "src");

/** 两个 npm 包在 packages/ 下的目录名。工作台插件在 plugins/docfirst/，同一个工作区，但不在这两个包的依赖网里 */
const NPM_PACKAGES = ["docfirst-workflow", "docfirst-trajectory"];
const PLUGIN_MANIFEST = join(ROOT, "plugins", "docfirst", "package.json");

const manifestOf = (dir: string): Pkg => JSON.parse(readFileSync(join(PACKAGES, dir, "package.json"), "utf8")) as Pkg;
/** 运行时真正会跟着走的依赖：dependencies 加 peerDependencies。devDependencies 不算——它只为编译和类型检查 */
const depsOf = (p: Pkg): string[] => Object.keys({ ...p.dependencies, ...p.peerDependencies });
const HOST = /^(fumadocs|next$|react$|react-dom$)/;

/**
 * 编译产物里的 import 说明符——只认锚在行首的 import/export-from 语句，不用不带锚的
 * `from\s*["']` 全文匹配：产物里字符串字面量常包含 "pivots-from" 这类含 "from" 的子串
 * （trajectory 的 EDGE_HEAD 正则源码编译进去后原样留在产物里），不带锚的正则会把它当 import 语句头，
 * 从那个引号起一直匹配到几百字符外的下一个引号。tsdown/rolldown 的产物每条 import 语句独占一行，
 * 按行首锚定就避开了这个问题。
 * 三种形态都收：`import … from "x"` / `export … from "x"`、副作用导入 `import "x"`、
 * 动态 `import("x")`——只认 from 那一种的话，一句 `import "宿主/样式.css"` 或
 * `await import("react")` 就能绕过每条边界检查。
 */
function importSpecsOf(src: string): string[] {
  const specs: string[] = [];
  for (const m of src.matchAll(/^(?:import|export)\b[^\n]*?\bfrom\s*["']([^"']+)["']/gm)) specs.push(m[1] as string);
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

// ── 一、目录方向 ──────────────────────────────────────────────────────────────

/**
 * `src/<层>` 不许 import 到哪几层去。**列的是禁止的层，不是允许的层**：写成允许的层的话，
 * 加一个新目录会默默地什么都不许，加错地方反而更难发现。
 *
 * 方向读法（左边不许知道右边）：
 *   engine   判定：只认注进来的格式 / 读取器 / 旧内容来源，谁都不认识
 *   host     碰环境：可以用 engine 的类型与纯函数，不认识格式实现、不认识命令行
 *   fumadocs 格式实现 + 站接线：可以用 engine 与 host（`docfirstMdxOptions` 要 loadProject），不认识命令行
 *   cli      入口：认识以上全部，谁都不认识它
 *
 * 从前还有第五层 `site/`（给已有的站装六区）。它移进工作台插件了：那件事只在 agent 手上发生
 * 一次、写的是模板不是判定，而这个包的使用方是**仓**。判据见轨迹卡「包给仓件给人」。
 */
const LAYERS: Record<string, string[]> = {
  engine: ["host", "fumadocs", "cli"],
  host: ["fumadocs", "cli"],
  fumadocs: ["cli"],
  cli: [],
};

/** 一条相对说明符落在 `src/` 下的哪一层；落到 src 外面回 null */
function layerOf(file: string, spec: string): string | null {
  const target = resolve(dirname(file), spec);
  const from = relative(SRC, target);
  if (from.startsWith("..")) return null;
  return from.split(sep)[0] ?? null;
}

test("目录方向：engine 不认识 host / fumadocs，host 不认识 fumadocs / cli", () => {
  const bad: string[] = [];
  for (const [layer, forbidden] of Object.entries(LAYERS)) {
    for (const file of sourcesIn(join(SRC, layer))) {
      for (const spec of importSpecsOf(readFileSync(file, "utf8"))) {
        if (!spec.startsWith(".")) continue;
        const hit = layerOf(file, spec);
        if (hit !== null && forbidden.includes(hit)) bad.push(`${rel(SRC, file)} → ${hit}/（${spec}）`);
      }
    }
  }
  assert.deepEqual(bad, [], "方向反了。改的是 LAYERS 那张表加一段为什么，不是把这条断言删掉");
});

test("目录方向：四层一个不少、一个不多——加了新目录得先想清楚它能认识谁", () => {
  const dirs = readdirSync(SRC, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
  assert.deepEqual(dirs, Object.keys(LAYERS).sort());
});

test("判定层零依赖：engine/ 只许 import 自己和 node:crypto——它不读文件、不起子进程、不认识任何格式", () => {
  for (const file of sourcesIn(join(SRC, "engine"))) {
    for (const spec of importSpecsOf(readFileSync(file, "utf8"))) {
      assert.ok(spec.startsWith("./") || spec === "node:crypto", `engine/${rel(join(SRC, "engine"), file)} import 了 ${spec}`);
    }
  }
});

test("fumadocs 这个名字只出现在 fumadocs/ 那一层：别的层一个宿主 import 都没有", () => {
  for (const layer of ["engine", "host", "cli"]) {
    for (const file of sourcesIn(join(SRC, layer))) {
      for (const spec of importSpecsOf(readFileSync(file, "utf8"))) {
        assert.ok(!HOST.test(spec), `${layer}/${rel(join(SRC, layer), file)} import 了宿主 ${spec}`);
      }
    }
  }
});

// ── 二、宿主只能是 peer，且不许被打进产物 ────────────────────────────────────

test("宿主只能是 peer，不许进 dependencies", () => {
  const pkg = manifestOf("docfirst-workflow");
  assert.ok(Object.keys(pkg.peerDependencies ?? {}).some((d) => d.startsWith("fumadocs")), "得声明 fumadocs 为 peer");
  for (const dep of Object.keys(pkg.dependencies ?? {})) assert.ok(!HOST.test(dep), `docfirst 把 ${dep} 装成了自己的依赖`);
});

test("产物里不许打进 fumadocs 或 react，只许 import；pre 的客户端指令要留在头一行", () => {
  for (const file of ["dist/fumadocs.mjs", "dist/pre.mjs", "dist/term.mjs"]) {
    const src = readFileSync(join(PACKAGES, "docfirst-workflow", file), "utf8");
    for (const spec of importSpecsOf(src).filter((s) => HOST.test(s))) {
      assert.ok(!spec.startsWith("."), `${file} 把 ${spec} 打进了产物`);
    }
  }
  // 状态点组件是客户端组件：指令得留在产物头一行，不然 Next 不认
  assert.match(readFileSync(join(PACKAGES, "docfirst-workflow", "dist", "pre.mjs"), "utf8"), /^"use client";/, "pre 的 use client 指令被打没了");
});

/**
 * **包只发要在仓里用的东西。** 说明书与建站模板随工作台插件发：包里的说明书 agent 找不到——它放在
 * node_modules 里，没有东西指向它，一份 SKILL.md 放在那儿等于没有。agent 能读到说明书，全靠插件
 * `register` 了自己包里那个目录。判据见轨迹卡「包给仓件给人」。
 */
test("包只发 dist 与样式：skills 与 template 跟着件走了，包里连目录都不该再有", () => {
  const pkg = JSON.parse(readFileSync(join(PACKAGES, "docfirst-workflow", "package.json"), "utf8")) as { files: string[] };
  assert.deepEqual(pkg.files, ["dist", "styles"]);
  for (const path of ["styles/light.css", "styles/term.css"]) {
    assert.ok(existsSync(join(PACKAGES, "docfirst-workflow", path)), `docfirst 少了 ${path}`);
  }
  for (const path of ["skills", "template"]) {
    assert.equal(existsSync(join(PACKAGES, "docfirst-workflow", path)), false, `docfirst 里还留着 ${path}/——它归件 gwb-docfirst-workflow`);
  }
});

// ── 三、轨迹包自己那几条 ──────────────────────────────────────────────────────

test("trajectory 的 `.` 入口零 npm 依赖：产物只许 import node: 内置模块", () => {
  // 包本身有 react（peer）与 unist-util-visit（只给 `./server` 用），`.` 入口这条约束
  // 按产物判——比按 package.json 判更准：就算以后 `.` 入口不小心 import 到一个真依赖，这里也查得到
  const src = readFileSync(join(PACKAGES, "docfirst-trajectory", "dist", "index.mjs"), "utf8");
  for (const spec of importSpecsOf(src)) assert.ok(spec.startsWith("node:"), `trajectory 的 . 入口产物 import 了 ${spec}`);
});

test("trajectory 的 react / server 入口：客户端指令、react 只 import 不内联、各自的边界", () => {
  // 「不打进 react」要正着断言：react 真被内联进产物时，产物里根本没有那条 import 行，
  // 反着遍历 import 说明符的写法是恒真的（没有行就一条也遍历不到）。
  const isReact = (spec: string): boolean => spec === "react" || spec.startsWith("react/");
  const dir = join(PACKAGES, "docfirst-trajectory", "dist");
  const react = readFileSync(join(dir, "react.mjs"), "utf8");
  const server = readFileSync(join(dir, "server.mjs"), "utf8");
  assert.match(react, /^"use client";/, "react.mjs 的 use client 指令得留在头一行");
  assert.doesNotMatch(server, /^"use client";/, "server.mjs 不该带客户端指令");

  for (const [name, src] of [["react.mjs", react], ["server.mjs", server]] as const) {
    const specs = importSpecsOf(src);
    assert.ok(specs.some(isReact), `${name} 里没有 react 的 import 行——react 被内联进产物了`);
    // react 本体的内部标记：真被打进来的话，光看 import 行看不出，得在正文里查
    assert.doesNotMatch(src, /__CLIENT_INTERNALS|react\.production/, `${name} 正文里有 react 本体的痕迹`);
  }

  // 客户端那半只许 import react：第三方也不许内联（内联的第三方跟宿主装的那份会各跑一套），
  // node: 内置更不许（浏览器里根本没有）
  for (const spec of importSpecsOf(react)) {
    assert.ok(isReact(spec), `react.mjs（客户端组件）import 了 react 之外的 ${spec}`);
  }
  // 服务端那半可以 import node: / remark 那套 / 包名自引用的 ./react，但 react 同样只许 import
  for (const spec of importSpecsOf(server)) {
    if (spec.startsWith("react")) assert.ok(isReact(spec), `server.mjs 把 ${spec} 打进了产物`);
  }
});

test("trajectory 的 `.` 入口源码只 import 自己和 node:fs / node:path / node:fs/promises", () => {
  // 只扫 .ts：react.tsx / server.tsx 是 `./react` `./server` 两个入口，各自的依赖边界
  // 由上面两条按产物判的测试检查，这条不管它们
  const IMPORT_RE = /^\s*import\b[\s\S]*?\bfrom\s*["']([^"']+)["']/gm;
  const dir = join(PACKAGES, "docfirst-trajectory", "src");
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".ts"))) {
    const src = readFileSync(join(dir, file), "utf8");
    for (const m of src.matchAll(IMPORT_RE)) {
      const spec = m[1]!;
      assert.ok(
        spec.startsWith("./") || spec === "node:fs" || spec === "node:path" || spec === "node:fs/promises",
        `trajectory/src/${file} import 了 ${spec}`,
      );
    }
  }
});

test("docfirst 依赖 trajectory，trajectory 不依赖 docfirst——轨迹是独立的一条包线", () => {
  assert.ok(depsOf(manifestOf("docfirst-workflow")).includes("@godcreator/docfirst-trajectory"), "docfirst 得依赖 trajectory 才接得上 trajectory 子命令");
  const trajectory = manifestOf("docfirst-trajectory");
  for (const dep of Object.keys({ ...trajectory.dependencies, ...trajectory.peerDependencies, ...trajectory.devDependencies })) {
    assert.notEqual(dep, "@godcreator/docfirst-workflow", "trajectory 依赖了 docfirst——方向反了");
  }
});

test("轨迹只被命令行那一层用：engine / host / fumadocs 一个 import 都没有", () => {
  for (const layer of ["engine", "host", "fumadocs"]) {
    for (const file of sourcesIn(join(SRC, layer))) {
      for (const spec of importSpecsOf(readFileSync(file, "utf8"))) {
        assert.ok(!spec.startsWith("@godcreator/docfirst-trajectory"), `${layer}/${rel(join(SRC, layer), file)} 引用了轨迹（${spec}）`);
      }
    }
  }
});

// ── 四、包不认识工作台插件 ──────────────────────────────────────────────────

test("两个 npm 包的依赖面里不许出现工作台件，也不许出现任何 @godcreator/gwb-*", () => {
  // 插件跟包在同一个工作区，包一旦认识插件（哪怕只是一条 devDependency）这两个包就不能再发布了
  // ——装它们的人不该连带装上整个桌面工作台生态。三类依赖全查：运行时、peer、开发期。
  // 反方向（插件不许依赖包）由插件自己的 tests/artifact.test.ts 检查：两个方向都禁止，
  // 现在这两边**互不认识**。
  const pluginName = (JSON.parse(readFileSync(PLUGIN_MANIFEST, "utf8")) as Pkg).name;
  for (const dir of NPM_PACKAGES) {
    const pkg = manifestOf(dir);
    for (const dep of Object.keys({ ...pkg.dependencies, ...pkg.peerDependencies, ...pkg.devDependencies })) {
      assert.notEqual(dep, pluginName, `${dir} 依赖了工作台件 ${pluginName}——方向反了`);
      assert.ok(!dep.startsWith("@godcreator/gwb-"), `${dir} 依赖了 gwb 生态的 ${dep}`);
    }
  }
});

test("两个包的源码里一行 @godcreator/gwb-* 都没有", () => {
  for (const dir of NPM_PACKAGES) {
    for (const file of sourcesIn(join(PACKAGES, dir, "src"))) {
      for (const spec of importSpecsOf(readFileSync(file, "utf8"))) {
        assert.ok(!spec.startsWith("@godcreator/gwb-"), `${dir}/${rel(join(PACKAGES, dir), file)} import 了 ${spec}`);
      }
    }
  }
});
