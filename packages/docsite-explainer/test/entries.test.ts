/**
 * 三个入口的边界：react 是唯一 peer；`.` 是客户端组件，产物头一行带客户端指令、只 import react；
 * `./text` 与 `./seam-graph` 站点在 Node 里生成机读版时也加载，产物零 import、不带客户端指令。
 * 「不把 react 打包进产物」要正着断言：react 真被内联进产物时，产物里根本没有那条 import 行，
 * 反着遍历 import 说明符的写法是恒真的。
 */
import { test } from "vitest";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

interface Pkg {
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
}

const PKG_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const isReact = (spec: string): boolean => spec === "react" || spec.startsWith("react/");

/**
 * 一份源码或产物里的 import 说明符——只认锚在行首的 import/export-from 语句，不用不带锚的
 * `from\s*["']` 全文匹配：字符串字面量常包含 "pivots-from" 这类含 "from" 的子串，不带锚的
 * 正则会把它当 import 语句头，从那个引号起一直匹配到几百字符外的下一个引号。tsc 的产物每条
 * import 语句独占一行，源码也按这个写法排版，同一个函数两边通用。
 * 三种形态都收：`import … from "x"` / `export … from "x"`、副作用导入 `import "x"`、
 * 动态 `import("x")`——只认 from 那一种的话，一句 `import "样式.css"` 或 `await import("react")`
 * 就能绕过这边的每条检查。花括号跨行的 `import {\n a,\n b\n} from "x"` 另用一条收：
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

const distOf = (file: string): string => readFileSync(join(PKG_ROOT, "dist", file), "utf8");

/** tsc 不打包：一份产物会 import 同包的别的产物，相对说明符跟进去展开，只交回外部说明符 */
function distClosureSpecs(file: string): string[] {
  const seen = new Set<string>();
  const specs: string[] = [];
  const visit = (name: string): void => {
    if (seen.has(name)) return;
    seen.add(name);
    for (const spec of importSpecsOf(distOf(name))) {
      if (spec.startsWith("./")) visit(spec.slice(2));
      else specs.push(spec);
    }
  };
  visit(file);
  return specs;
}

test("清单：没有 dependencies，peer 只有 react", () => {
  const pkg = JSON.parse(readFileSync(join(PKG_ROOT, "package.json"), "utf8")) as Pkg;
  assert.deepEqual(Object.keys(pkg.dependencies ?? {}), [], "dependencies 得是空的");
  assert.deepEqual(Object.keys(pkg.peerDependencies ?? {}), ["react"], "peer 只有 react");
});

test("`.` 产物：客户端指令在头一行，连同它转出的同包产物只 import react，没有把 react 打包进来", () => {
  const index = distOf("index.js");
  assert.match(index, /^"use client";/, "index.js 的 use client 指令得留在头一行");
  const specs = distClosureSpecs("index.js");
  assert.ok(specs.some(isReact), "index.js 及其同包产物里没有 react 的 import 行——react 被内联进产物了");
  for (const spec of specs) assert.ok(isReact(spec), `index.js（客户端组件）import 了 react 之外的 ${spec}`);
  assert.doesNotMatch(index, /__CLIENT_INTERNALS|react\.production/, "index.js 正文里有 react 本体的痕迹");
});

test("`./text`：产物零 import、不带客户端指令，源码也不许 import", () => {
  const text = distOf("text.js");
  assert.deepEqual(importSpecsOf(text), []);
  assert.doesNotMatch(text, /^"use client";/);
  assert.deepEqual(importSpecsOf(readFileSync(join(PKG_ROOT, "src", "text.ts"), "utf8")), [], "text.ts 源码也不许 import");
});

test("`./seam-graph`：产物零 import、不带客户端指令，源码只 import 类型", () => {
  const graph = distOf("seam-graph.js");
  assert.deepEqual(importSpecsOf(graph), []);
  assert.doesNotMatch(graph, /^"use client";/);
  const src = readFileSync(join(PKG_ROOT, "src", "seam-graph.ts"), "utf8");
  for (const line of src.split("\n").filter((l) => /^import\b/.test(l))) {
    assert.match(line, /^import type /, `seam-graph.ts 只许 import 类型：${line}`);
  }
});
