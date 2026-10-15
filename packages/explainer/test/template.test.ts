/**
 * 站点模板 template/：建站器原样复制到站点 app/features/explainer/。讲解组件由正文直接 import，
 * 不进站点的 MDX 组件表，所以模板里只有样式。
 */
import { test } from "vitest";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const PKG_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const TEMPLATE = join(PKG_ROOT, "template");

interface Pkg {
  files: string[];
  exports: Record<string, unknown>;
}

const pkg = JSON.parse(readFileSync(join(PKG_ROOT, "package.json"), "utf8")) as Pkg;

test("模板里只有样式：没有页面、不登记组件", () => {
  assert.deepEqual(readdirSync(TEMPLATE), ["styles.css"]);
});

test("package.json 把 template 发出去：建站器从装好的包里复制它", () => {
  assert.ok(pkg.files.includes("template"));
});

test("styles.css 引入讲解组件的样式，那个文件在包的出口里", () => {
  assert.match(readFileSync(join(TEMPLATE, "styles.css"), "utf8"), /@import '@godcreator\/explainer\/styles\.css';/);
  assert.ok("./styles.css" in pkg.exports);
});
