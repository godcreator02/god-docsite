/**
 * 站点模板 template/：建站器原样复制到站点 app/features/code-pin/。钉码没有页面，只有构建期的 remark 插件与样式。
 * mdx.ts 在构建期由 fumadocs-mdx 在 Node 里加载：它连同引到的本包 ./node、./site 源码都不 import react 系与 fumadocs 的界面包。
 */
import { test } from "vitest";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PKG_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const TEMPLATE = join(PKG_ROOT, "template");

const UI_PACKAGE = /^(react|react-dom|react-router|lucide-react|@fumadocs\/base-ui)(\/|$)/;

function importSpecsOf(src: string): string[] {
  return [...src.matchAll(/^(?:import|export)\b[^\n]*?\bfrom\s*["']([^"']+)["']/gm), ...src.matchAll(/^import\s*["']([^"']+)["']/gm)].map((m) => m[1] as string);
}

/** 相对 import 落到的源码文件：写了后缀照写的找，没写按 .ts、.tsx 找 */
function resolveRelative(from: string, spec: string): string {
  const base = resolve(dirname(from), spec);
  const found = [base, `${base}.ts`, `${base}.tsx`].find((path) => /\.tsx?$/.test(path) && existsSync(path));
  if (found === undefined) throw new Error(`${from} 里的 ${spec} 找不到对应的源码文件`);
  return found;
}

/** 从一个文件起，沿相对 import 走完，交回经过的文件与全部外部说明符 */
function importClosure(entry: string): { files: string[]; external: string[] } {
  const files: string[] = [];
  const external: string[] = [];
  const visit = (file: string): void => {
    if (files.includes(file)) return;
    files.push(file);
    for (const spec of importSpecsOf(readFileSync(file, "utf8"))) {
      if (spec.startsWith(".")) visit(resolveRelative(file, spec));
      else external.push(spec);
    }
  };
  visit(entry);
  return { files, external };
}

/** 本包出口 → 源码入口（与 tsdown.config.ts 的 entry 对应） */
const OWN_ENTRIES: Record<string, string> = {
  "@godcreator/code-pin/node": "src/node/index.ts",
  "@godcreator/code-pin/site": "src/site/index.ts",
};

test("模板文件齐全：没有页面，就没有 routes.ts", () => {
  assert.deepEqual(readdirSync(TEMPLATE).sort(), ["mdx.ts", "styles.css"]);
});

test("package.json 把 template 发出去：建站器从装好的包里复制它", () => {
  const pkg = JSON.parse(readFileSync(join(PKG_ROOT, "package.json"), "utf8")) as { files: string[] };
  assert.ok(pkg.files.includes("template"));
});

test("mdx.ts 不 import 界面：连同它引到的本包 ./node、./site 源码", () => {
  const template = importClosure(join(TEMPLATE, "mdx.ts"));
  assert.deepEqual(template.external.sort(), Object.keys(OWN_ENTRIES).sort(), "mdx.ts 只用本包的 ./node 与 ./site");
  for (const entry of Object.values(OWN_ENTRIES)) {
    const own = importClosure(join(PKG_ROOT, entry));
    assert.ok(own.files.every((file) => file.endsWith(".ts")), `${entry} 引到了组件文件`);
    assert.deepEqual(own.external.filter((spec) => UI_PACKAGE.test(spec)), [], entry);
  }
});

test("styles.css 引入钉码外框的样式，那个文件在包的出口里", () => {
  assert.match(readFileSync(join(TEMPLATE, "styles.css"), "utf8"), /@import '@godcreator\/code-pin\/site\/pin\.css';/);
  const pkg = JSON.parse(readFileSync(join(PKG_ROOT, "package.json"), "utf8")) as { exports: Record<string, unknown> };
  assert.ok("./site/pin.css" in pkg.exports);
});
