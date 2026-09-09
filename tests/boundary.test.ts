/**
 * 边界测试：读各包的 package.json 依赖图，守几条规矩。
 *   core 零依赖；除了 fumadocs 格式包，谁都不许见宿主（fumadocs / next / react）；
 *   fumadocs 格式包里 fumadocs 只能是 peer——它用消费方项目装的那份，产物里不许打进去。
 * 再加两条读源码的：core/ 下只 import 自己和 node:crypto；核心不 import 任何格式包。
 * 最后一条守的是件与包之间的方向：七个 live-doc-* 包不许认识工作台件、不许认识任何
 * `@godcreator02/gwb-*`——依赖只能是件 → cli 这一个方向。
 * pnpm 的严格 node_modules 让「没声明就 import 不到」，所以依赖图就是边界本身。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

interface Pkg {
  name: string;
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PACKAGES = join(ROOT, "packages");
const all = Object.fromEntries(
  readdirSync(PACKAGES).map((name) => [name, JSON.parse(readFileSync(join(PACKAGES, name, "package.json"), "utf8")) as Pkg]),
) as Record<string, Pkg>;

/** 工作台件的目录名。它跟七个 live-doc-* 包同住 packages/，但不在这套包的依赖网里
 * ——下面除了最后那条守方向的，管的都是七个包，所以先把它摘出去 */
const PLUGIN = "gwb-live-doc";
const pkgs = Object.fromEntries(Object.entries(all).filter(([name]) => name !== PLUGIN)) as Record<string, Pkg>;

/** 运行时真正会跟着走的依赖：dependencies 加 peerDependencies。devDependencies 不算——它只为编译和类型检查 */
const depsOf = (p: Pkg): string[] => Object.keys({ ...p.dependencies, ...p.peerDependencies });
const HOST = /^(fumadocs|next$|react$|react-dom$)/;

/** 编译产物里的 import 说明符——只认锚在行首的 import/export-from 语句，不用裸的
 * `from\s*["']` 到处找：产物里字符串字面量常包含 "pivots-from" 这类含 "from" 的子串
 * （trajectory 的 EDGE_HEAD 正则源码编译进去后原样躺在那），裸正则会把它当 import 语句头，
 * 从那个引号起一路吞到几百字符外的下一个引号。tsdown/rolldown 的产物每条 import 语句独占一行，
 * 按行首锚定就躲开了这个坑。
 * 三种形态都收：`import … from "x"` / `export … from "x"`、副作用导入 `import "x"`、
 * 动态 `import("x")`——只认 from 那一种的话，一句 `import "宿主/样式.css"` 或
 * `await import("react")` 就能从每条边界底下溜过去。 */
function importSpecsOf(src: string): string[] {
  const specs: string[] = [];
  for (const m of src.matchAll(/^(?:import|export)\b[^\n]*?\bfrom\s*["']([^"']+)["']/gm)) specs.push(m[1] as string);
  for (const m of src.matchAll(/^import\s*["']([^"']+)["']/gm)) specs.push(m[1] as string);
  for (const m of src.matchAll(/\bimport\s*\(\s*["']([^"']+)["']\s*\)/g)) specs.push(m[1] as string);
  return specs;
}

test("core 零依赖", () => {
  assert.deepEqual(depsOf(pkgs.core!), []);
});

test("除了 fumadocs 格式包和 trajectory，谁都不依赖宿主", () => {
  // trajectory 的 react 是给 ./react、./server 两个入口用的 peer（跟 format-fumadocs
  // 声明 fumadocs 为 peer 同一个道理），`.` 入口本身零依赖，见下面按产物判的那条。
  for (const [name, pkg] of Object.entries(pkgs)) {
    if (name === "format-fumadocs" || name === "trajectory") continue;
    for (const dep of depsOf(pkg)) assert.ok(!HOST.test(dep), `${name} 依赖了宿主 ${dep}`);
  }
});

test("fumadocs 格式包：宿主只能是 peer，不许进 dependencies", () => {
  const pkg = pkgs["format-fumadocs"]!;
  assert.ok(Object.keys(pkg.peerDependencies ?? {}).some((d) => d.startsWith("fumadocs")), "得声明 fumadocs 为 peer");
  for (const dep of Object.keys(pkg.dependencies ?? {})) assert.ok(!HOST.test(dep), `format-fumadocs 把 ${dep} 装成了自己的依赖`);
});

test("fumadocs 格式包的产物里不许打进 fumadocs 或 react，只许 import", () => {
  for (const file of ["dist/index.mjs", "dist/pre.mjs"]) {
    const src = readFileSync(join(PACKAGES, "format-fumadocs", file), "utf8");
    const specs = importSpecsOf(src);
    const hosts = specs.filter((s) => HOST.test(s));
    for (const spec of hosts) assert.ok(!spec.startsWith("."), `${file} 把 ${spec} 打进了产物`);
    // 状态点组件是客户端组件：指令得留在产物头一行，不然 Next 不认
    if (file.endsWith("pre.mjs")) assert.match(src, /^"use client";/, "pre 的 use client 指令被打没了");
  }
});

test("html 格式包只依赖核心；命令行和装配不依赖任何格式包", () => {
  assert.deepEqual(depsOf(pkgs["format-html"]!), ["@godcreator02/live-doc-core"]);
  for (const name of ["cli", "project"]) {
    for (const dep of depsOf(pkgs[name]!)) assert.ok(!dep.startsWith("@godcreator02/live-doc-format-"), `${name} 依赖了格式包 ${dep}`);
  }
});

test("core 源码只 import 自己和 node:crypto——它不读文件、不起子进程、不认识任何格式", () => {
  const dir = join(PACKAGES, "core", "src");
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".ts"))) {
    const src = readFileSync(join(dir, file), "utf8");
    for (const m of src.matchAll(/(?:from|import)\s*\(?\s*["']([^"']+)["']/g)) {
      const spec = m[1]!;
      assert.ok(spec.startsWith("./") || spec === "node:crypto", `core/src/${file} import 了 ${spec}`);
    }
  }
});

test("每个格式包都实现了核心要的那五样", async () => {
  for (const name of ["format-md", "format-fumadocs", "format-html"]) {
    const mod = (await import(`@godcreator02/live-doc-${name}`)) as Record<string, unknown>;
    for (const key of ["name", "claims", "parse", "write", "marker"]) {
      assert.ok(mod[key] !== undefined, `${name} 少了 ${key}`);
    }
  }
});

test("trajectory 的 `.` 入口零 npm 依赖：产物只许 import node: 内置模块", () => {
  // 阶段 A 时包本身零依赖；阶段 B 加了 react（peer）与 unified / unist-util-visit
  // （只给 `./server` 用），`.` 入口这条红线因此改按产物判——比按 package.json 判更准：
  // 就算以后 `.` 入口不小心 import 到一个真依赖，这里也能抓到。
  const src = readFileSync(join(PACKAGES, "trajectory", "dist", "index.mjs"), "utf8");
  for (const spec of importSpecsOf(src)) assert.ok(spec.startsWith("node:"), `trajectory 的 . 入口产物 import 了 ${spec}`);
});

test("trajectory 的 react / server 入口：客户端指令、react 只 import 不内联、各自的边界", () => {
  // 「不打进 react」要正着断言：react 真被内联进产物时，产物里根本没有那条 import 行，
  // 反着遍历 import 说明符的写法是恒真的（没有行就一条也遍历不到）。
  const isReact = (spec: string): boolean => spec === "react" || spec.startsWith("react/");
  const dir = join(PACKAGES, "trajectory", "dist");
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

test("cli、project、三个格式包不依赖 trajectory 的 react / server 入口（按产物 import 判）", () => {
  for (const name of ["cli", "project", "format-md", "format-fumadocs", "format-html"]) {
    const distDir = join(PACKAGES, name, "dist");
    for (const file of readdirSync(distDir).filter((f) => f.endsWith(".mjs"))) {
      const specs = importSpecsOf(readFileSync(join(distDir, file), "utf8"));
      for (const spec of specs) {
        assert.ok(
          !spec.startsWith("@godcreator02/live-doc-trajectory/react") && !spec.startsWith("@godcreator02/live-doc-trajectory/server"),
          `${name}/dist/${file} 引用了 trajectory 的 react / server 入口（${spec}）`,
        );
      }
    }
  }
});

test("trajectory 的 `.` 入口源码只 import 自己和 node:fs / node:path / node:fs/promises", () => {
  // 锚在行首的 import 语句取到 from 的引号——core 那条用的宽松正则会被本包正文里
  // "pivots-from" 这个字符串字面量骗过（from 后紧跟的引号是它自己的收尾引号，
  // 匹配一路吞到几百字符外的下一个引号），换一条不认字符串内容、只认真实 import 语句的。
  // 只扫 .ts：react.tsx / server.tsx 是 `./react` `./server` 两个入口，各自的依赖边界
  // 由上面两条按产物判的测试守着，这条不管它们。
  const IMPORT_RE = /^\s*import\b[\s\S]*?\bfrom\s*["']([^"']+)["']/gm;
  const dir = join(PACKAGES, "trajectory", "src");
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

test("cli 允许依赖 trajectory，project 与三个格式包不许依赖它", () => {
  assert.ok(depsOf(pkgs.cli!).includes("@godcreator02/live-doc-trajectory"), "cli 得依赖 trajectory 才能接 trajectory 子命令");
  for (const name of ["project", "format-md", "format-fumadocs", "format-html"]) {
    assert.ok(!depsOf(pkgs[name]!).includes("@godcreator02/live-doc-trajectory"), `${name} 不该依赖 trajectory`);
  }
});

test("方向只能是件 → cli：七个包的依赖面里不许出现工作台件，也不许出现任何 @godcreator02/gwb-*", () => {
  // 件跟包同住一个工作区，方向一旦反过来（哪怕只是一条 devDependency）这套包就再也发不出去了
  // ——装它的人不该被迫拉进一整个桌面工作台生态。三档全查：运行时、peer、开发期。
  const pluginName = all[PLUGIN]!.name;
  for (const [dir, pkg] of Object.entries(pkgs)) {
    for (const dep of Object.keys({ ...pkg.dependencies, ...pkg.peerDependencies, ...pkg.devDependencies })) {
      assert.ok(dep !== pluginName, `${dir} 依赖了工作台件 ${pluginName}——方向反了`);
      assert.ok(!dep.startsWith("@godcreator02/gwb-"), `${dir} 依赖了 gwb 生态的 ${dep}`);
    }
  }
});
