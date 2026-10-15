/**
 * 两个入口的边界：react 是唯一 peer（可选）；`.`（core）站点在 Node 里生成机读版时加载，产物与源码都不 import 任何运行时依赖；
 * `./site` 是组件，产物连同它引到的同包产物只 import react。
 * 「不把 react 打包进产物」要正着断言：react 真被内联进产物时，产物里根本没有那条 import 行，
 * 反着遍历 import 说明符的写法是恒真的。
 */
import { test } from "vitest";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, posix } from "node:path";
import { fileURLToPath } from "node:url";

interface Pkg {
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  peerDependenciesMeta?: Record<string, { optional?: boolean }>;
}

const PKG_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const isReact = (spec: string): boolean => spec === "react" || spec.startsWith("react/");

/**
 * 一份源码或产物里的 import 说明符——只认锚在行首的 import/export-from 语句，不用不带锚的
 * `from\s*["']` 全文匹配：字符串字面量常包含 "pivots-from" 这类含 "from" 的子串，不带锚的
 * 正则会把它当 import 语句头，从那个引号起一直匹配到几百字符外的下一个引号。
 * 三种形态都收：`import … from "x"` / `export … from "x"`、副作用导入 `import "x"`、
 * 动态 `import("x")`；花括号跨行的 `import {\n a,\n b\n} from "x"` 另用一条收。
 */
function importSpecsOf(src: string): string[] {
  const specs: string[] = [];
  for (const m of src.matchAll(/^(?:import|export)\b[^\n]*?\bfrom\s*["']([^"']+)["']/gm)) specs.push(m[1] as string);
  for (const m of src.matchAll(/^(?:import|export)\s+(?:type\s+)?\{[^}]*\n[^}]*\}\s*from\s*["']([^"']+)["']/gm)) specs.push(m[1] as string);
  for (const m of src.matchAll(/^import\s*["']([^"']+)["']/gm)) specs.push(m[1] as string);
  for (const m of src.matchAll(/\bimport\s*\(\s*["']([^"']+)["']\s*\)/g)) specs.push(m[1] as string);
  return specs;
}

const distOf = (file: string): string => readFileSync(join(PKG_ROOT, "dist", file), "utf8");

/** 产物会 import 同包的别的产物：相对说明符跟进去展开，只交回外部说明符。file 相对 dist/、正斜杠 */
function distClosureSpecs(file: string): string[] {
  const seen = new Set<string>();
  const specs: string[] = [];
  const visit = (name: string): void => {
    if (seen.has(name)) return;
    seen.add(name);
    for (const spec of importSpecsOf(distOf(name))) {
      if (spec.startsWith("./") || spec.startsWith("../")) visit(posix.join(posix.dirname(name), spec));
      else specs.push(spec);
    }
  };
  visit(file);
  return specs;
}

test("清单：没有 dependencies，peer 只有 react 且可选", () => {
  const pkg = JSON.parse(readFileSync(join(PKG_ROOT, "package.json"), "utf8")) as Pkg;
  assert.deepEqual(Object.keys(pkg.dependencies ?? {}), [], "dependencies 得是空的");
  assert.deepEqual(Object.keys(pkg.peerDependencies ?? {}), ["react"], "peer 只有 react");
  assert.equal(pkg.peerDependenciesMeta?.react?.optional, true, "只用 `.` 的 Node 使用方不装 react");
});

test("`.`（core）：产物连同它引到的同包产物零外部 import，源码只 import 本目录的文件", () => {
  assert.deepEqual(distClosureSpecs("core/index.mjs"), []);
  const coreDir = join(PKG_ROOT, "src", "core");
  for (const name of readdirSync(coreDir)) {
    for (const spec of importSpecsOf(readFileSync(join(coreDir, name), "utf8"))) {
      assert.ok(spec.startsWith("./"), `core/${name} import 了本目录之外的 ${spec}`);
    }
  }
});

test("`./site`：产物连同它引到的同包产物只 import react，没有把 react 打包进来", () => {
  const specs = distClosureSpecs("site/index.mjs");
  assert.ok(specs.some(isReact), "site 产物里没有 react 的 import 行——react 被内联进产物了");
  for (const spec of specs) assert.ok(isReact(spec), `site 产物 import 了 react 之外的 ${spec}`);
  assert.doesNotMatch(distOf("site/index.mjs"), /__CLIENT_INTERNALS|react\.production/, "site 产物正文里有 react 本体的痕迹");
});
