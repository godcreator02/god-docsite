/**
 * # 边界守卫：塌包之后**唯一**的那道
 *
 * 五个包塌成一个 `@team/docfirst-workflow` 之后，「谁能依赖谁」不再由 pnpm 的严格
 * node_modules 兜着了——同一个包里，`engine/` 里随手写一句 `import "../host/git.ts"`
 * 编译器不会吭一声，判定层就从此起了 git 子进程。**这个文件就是补上的那道门。**
 *
 * 它守四类东西，每一类各有各的失败长相：
 *
 * **一、目录方向**（下面 `LAYERS` 那张表）。分层的意义是「变化原因不同的东西不互相拖累」：
 * `engine/` 只认注进来的东西，所以它能不起进程、不碰盘地被测；`host/` 不认识任何格式，
 * 所以换格式不动它。方向一破，这两句话当场变成假话，而且**没有任何别的信号**——
 * 测试照跑、构建照过，只有半年后有人问「为什么判定层跑得这么慢」才看得出来。
 *
 * **二、判定层的零依赖**：`engine/` 只许 `node:crypto`——这套东西唯一能被别人整块抄走的部分。
 *
 * **三、宿主只能是 peer，且不许被打进产物**：fumadocs 与 react 用的是消费方项目装的那份；
 * 打进产物就是两份 React 各跑一套，现象是预渲染时莫名其妙的 hooks 报错。
 *
 * **四、方向只能是件 → 包**：两个 npm 包不许出现任何 `@team/gwb-*`。
 * 反过来一次，装 docfirst 的人就被迫拉进一整个桌面工作台生态。
 *
 * **别删这个文件，也别把某一条注释掉「先让门禁绿」。** 它报红的时候，红的是设计，不是测试。
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

/** 两个 npm 包的目录名。工作台件跟它们同住 packages/，但不在这套包的依赖网里 */
const NPM_PACKAGES = ["docfirst-workflow", "docfirst-trajectory"];
const PLUGIN = "gwb-docfirst-workflow";

const manifestOf = (dir: string): Pkg => JSON.parse(readFileSync(join(PACKAGES, dir, "package.json"), "utf8")) as Pkg;
/** 运行时真正会跟着走的依赖：dependencies 加 peerDependencies。devDependencies 不算——它只为编译和类型检查 */
const depsOf = (p: Pkg): string[] => Object.keys({ ...p.dependencies, ...p.peerDependencies });
const HOST = /^(fumadocs|next$|react$|react-dom$)/;

/**
 * 编译产物里的 import 说明符——只认锚在行首的 import/export-from 语句，不用裸的
 * `from\s*["']` 到处找：产物里字符串字面量常包含 "pivots-from" 这类含 "from" 的子串
 * （trajectory 的 EDGE_HEAD 正则源码编译进去后原样躺在那），裸正则会把它当 import 语句头，
 * 从那个引号起一路吞到几百字符外的下一个引号。tsdown/rolldown 的产物每条 import 语句独占一行，
 * 按行首锚定就躲开了这个坑。
 * 三种形态都收：`import … from "x"` / `export … from "x"`、副作用导入 `import "x"`、
 * 动态 `import("x")`——只认 from 那一种的话，一句 `import "宿主/样式.css"` 或
 * `await import("react")` 就能从每条边界底下溜过去。
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
 * `src/<层>` 不许 import 到哪几层去。**列的是禁止面，不是允许面**：写成允许面的话，
 * 加一个新目录会默默地什么都不许，加错地方反而更难发现。
 *
 * 方向读法（左边不许知道右边）：
 *   engine   判定：只认注进来的格式 / 读取器 / 记录簿 / 比较器，谁都不认识
 *   host     碰环境：可以用 engine 的类型与纯函数，不认识格式实现、不认识命令行
 *   fumadocs 格式实现 + 站接线：可以用 engine 与 host（`docfirstMdxOptions` 要 loadProject），不认识命令行
 *   cli      入口：认识以上全部，谁都不认识它
 *
 * 从前还有第五层 `site/`（给已有骨架装六区）。它搬进工作台件了：那件事只在 agent 手上发生
 * 一次、铺的是模板不是判定，而这个包的消费方是**仓**。判据见轨迹卡「包给仓件给人」。
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
 * **包只发要在仓里用的东西。** 说明书与装配模板跟着件走了：包没有独立的到达路径——它躺在
 * node_modules 里没人指引、没人会读，一份 SKILL.md 摆在那儿等于没有。能被 agent 读到全靠件
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
  // 包本身有 react（peer）与 unist-util-visit（只给 `./server` 用），`.` 入口这条红线
  // 按产物判——比按 package.json 判更准：就算以后 `.` 入口不小心 import 到一个真依赖，这里也抓得到
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
    // react 本体的内部标记：真被打进来的话，光看 import 行看不出，得在正文里抓
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
  // 由上面两条按产物判的测试守着，这条不管它们
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
  assert.ok(depsOf(manifestOf("docfirst-workflow")).includes("@team/docfirst-trajectory"), "docfirst 得依赖 trajectory 才接得上 trajectory 子命令");
  const trajectory = manifestOf("docfirst-trajectory");
  for (const dep of Object.keys({ ...trajectory.dependencies, ...trajectory.peerDependencies, ...trajectory.devDependencies })) {
    assert.notEqual(dep, "@team/docfirst-workflow", "trajectory 依赖了 docfirst——方向反了");
  }
});

test("轨迹只被命令行那一层用：engine / host / fumadocs 一个 import 都没有", () => {
  for (const layer of ["engine", "host", "fumadocs"]) {
    for (const file of sourcesIn(join(SRC, layer))) {
      for (const spec of importSpecsOf(readFileSync(file, "utf8"))) {
        assert.ok(!spec.startsWith("@team/docfirst-trajectory"), `${layer}/${rel(join(SRC, layer), file)} 引用了轨迹（${spec}）`);
      }
    }
  }
});

// ── 四、包不认识件 ──────────────────────────────────────────────────────────

test("两个 npm 包的依赖面里不许出现工作台件，也不许出现任何 @team/gwb-*", () => {
  // 件跟包同住一个工作区，包一旦认识件（哪怕只是一条 devDependency）这两个包就再也发不出去了
  // ——装它们的人不该被迫拉进一整个桌面工作台生态。三档全查：运行时、peer、开发期。
  // 反过来那半（件不许依赖包）在件自己的 tests/artifact.test.ts 里守着：两个方向都断，
  // 现在这两边**互不认识**。
  const pluginName = manifestOf(PLUGIN).name;
  for (const dir of NPM_PACKAGES) {
    const pkg = manifestOf(dir);
    for (const dep of Object.keys({ ...pkg.dependencies, ...pkg.peerDependencies, ...pkg.devDependencies })) {
      assert.notEqual(dep, pluginName, `${dir} 依赖了工作台件 ${pluginName}——方向反了`);
      assert.ok(!dep.startsWith("@team/gwb-"), `${dir} 依赖了 gwb 生态的 ${dep}`);
    }
  }
});

test("两个包的源码里一行 @team/gwb-* 都没有", () => {
  for (const dir of NPM_PACKAGES) {
    for (const file of sourcesIn(join(PACKAGES, dir, "src"))) {
      for (const spec of importSpecsOf(readFileSync(file, "utf8"))) {
        assert.ok(!spec.startsWith("@team/gwb-"), `${dir}/${rel(join(PACKAGES, dir), file)} import 了 ${spec}`);
      }
    }
  }
});
