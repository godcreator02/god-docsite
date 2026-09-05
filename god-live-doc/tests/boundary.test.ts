/**
 * 边界测试：读各包的 package.json 依赖图，守几条规矩。
 *   core 零依赖；除了 fumadocs 格式包，谁都不许见宿主（fumadocs / next / react）；
 *   fumadocs 格式包里 fumadocs 只能是 peer——它用消费方项目装的那份，产物里不许打进去。
 * 再加两条读源码的：core/ 下只 import 自己和 node:crypto；核心不 import 任何格式包。
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
const pkgs = Object.fromEntries(
  readdirSync(PACKAGES).map((name) => [name, JSON.parse(readFileSync(join(PACKAGES, name, "package.json"), "utf8")) as Pkg]),
) as Record<string, Pkg>;

/** 运行时真正会跟着走的依赖：dependencies 加 peerDependencies。devDependencies 不算——它只为编译和类型检查 */
const depsOf = (p: Pkg): string[] => Object.keys({ ...p.dependencies, ...p.peerDependencies });
const HOST = /^(fumadocs|next$|react$|react-dom$)/;

test("core 零依赖", () => {
  assert.deepEqual(depsOf(pkgs.core!), []);
});

test("除了 fumadocs 格式包，谁都不依赖宿主", () => {
  for (const [name, pkg] of Object.entries(pkgs)) {
    if (name === "format-fumadocs") continue;
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
    const specs = [...src.matchAll(/from\s*["']([^"']+)["']/g)].map((m) => m[1]!);
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

test("trajectory 零依赖", () => {
  assert.deepEqual(depsOf(pkgs.trajectory!), []);
});

test("trajectory 源码只 import 自己和 node:fs / node:path / node:fs/promises", () => {
  // 锚在行首的 import 语句取到 from 的引号——core 那条用的宽松正则会被本包正文里
  // "pivots-from" 这个字符串字面量骗过（from 后紧跟的引号是它自己的收尾引号，
  // 匹配一路吞到几百字符外的下一个引号），换一条不认字符串内容、只认真实 import 语句的。
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
