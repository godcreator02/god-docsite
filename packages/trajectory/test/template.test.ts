/**
 * 站点模板 template/：建站器原样复制到站点 app/features/trajectory/。
 * 文件齐全；routes.ts 能被 import、两条路由的地址与文件对得上；mdx.ts 在构建期由 fumadocs-mdx 在 Node 里加载，
 * 它连同引到的本目录文件、本包 ./site/collection 的源码都不 import react 系与 fumadocs 的界面包。
 */
import { test } from "vitest";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import routes, { standaloneRoutes } from "../template/routes.ts";

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

test("模板文件齐全", () => {
  assert.deepEqual(readdirSync(TEMPLATE).sort(), ["card.tsx", "disk.tsx", "feature.tsx", "href.ts", "mdx.ts", "routes.ts", "site.server.ts", "styles.css"]);
});

test("package.json 把 template 发出去：建站器从装好的包里复制它", () => {
  const pkg = JSON.parse(readFileSync(join(PKG_ROOT, "package.json"), "utf8")) as { files: string[] };
  assert.ok(pkg.files.includes("template"));
});

test("routes.ts：卡页 /trajectory/* 在整站布局里，星轨盘 /trajectory 是独立页面（standaloneRoutes），文件都在模板目录里", () => {
  assert.deepEqual(routes.map((entry) => [entry.path, resolve(entry.file)]), [["trajectory/*", join(TEMPLATE, "card.tsx")]]);
  assert.deepEqual(standaloneRoutes.map((entry) => [entry.path, resolve(entry.file)]), [["trajectory", join(TEMPLATE, "disk.tsx")]]);
  for (const entry of [...routes, ...standaloneRoutes]) assert.ok(existsSync(entry.file), entry.file);
});

test("mdx.ts 不 import 界面：连同它引到的本目录文件、本包 ./site/collection 的源码", () => {
  const template = importClosure(join(TEMPLATE, "mdx.ts"));
  assert.ok(template.files.every((file) => file.endsWith(".ts")), `mdx.ts 引到了组件文件：${template.files.join("、")}`);
  assert.deepEqual(template.external.filter((spec) => UI_PACKAGE.test(spec)), []);
  assert.ok(template.external.includes("@godcreator/trajectory/site/collection"));
  const collection = importClosure(join(PKG_ROOT, "src", "site", "collection.ts"));
  assert.ok(collection.files.every((file) => file.endsWith(".ts")), `./site/collection 引到了组件文件：${collection.files.join("、")}`);
  assert.deepEqual(collection.external.filter((spec) => UI_PACKAGE.test(spec)), []);
});

test("mdx.ts 的集合工厂：名单跟 package.json 的 godDocsite.collections 一致，站点的全站插件并进卡集合的 mdx 选项", async () => {
  const pkg = JSON.parse(readFileSync(join(PKG_ROOT, "package.json"), "utf8")) as { godDocsite: { collections: string[] } };
  const { collections } = await import("../template/mdx.ts");
  assert.deepEqual(Object.keys(collections), pkg.godDocsite.collections);
  const remarkSite = function remarkSite() {};
  const rehypeSite = function rehypeSite() {};
  const cards = collections.trajectory({ remarkPlugins: [remarkSite], rehypePlugins: [rehypeSite] });
  assert.equal(cards.type, "doc");
  assert.equal(cards.dir, "trajectory");
  const mdxOptions = cards.mdxOptions as (environment: "bundler") => Promise<{ remarkPlugins?: unknown[]; rehypePlugins?: unknown[] }>;
  const options = await mdxOptions("bundler");
  assert.equal(options.remarkPlugins?.at(-2), remarkSite);
  assert.deepEqual((options.remarkPlugins?.at(-1) as unknown[])[1], { hrefBase: "/trajectory" });
  assert.equal(options.rehypePlugins?.[0], rehypeSite);
});

test("styles.css 引入本包样式", () => {
  assert.match(readFileSync(join(TEMPLATE, "styles.css"), "utf8"), /@import '@godcreator\/trajectory\/styles\.css';/);
});
