/**
 * 骨架：六个包都在、都能装、都出得来产物，出口按 package.json 的 exports 解析得到。
 * 别的规矩（谁能依赖谁）归 boundary.test.ts。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const PACKAGES = join(HERE, "..", "packages");
const NAMES = ["core", "project", "cli", "format-md", "format-fumadocs", "format-html"];

test("六个包齐、包名带 scope、版本 0.1.0", () => {
  for (const name of NAMES) {
    const pkg = JSON.parse(readFileSync(join(PACKAGES, name, "package.json"), "utf8")) as { name: string; version: string };
    assert.equal(pkg.name, `@godcreator02/live-doc-${name}`);
    assert.equal(pkg.version, "0.1.0");
  }
});

test("每个包都构建出了 exports 里写的产物", () => {
  for (const name of NAMES) {
    const dir = join(PACKAGES, name);
    const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8")) as {
      exports: Record<string, { types?: string; default?: string }>;
    };
    for (const [entry, table] of Object.entries(pkg.exports)) {
      for (const file of [table.types, table.default]) {
        if (file === undefined || file.endsWith(".css") || file.endsWith(".tsx")) continue;
        assert.ok(existsSync(join(dir, file)), `${name} 的出口 ${entry} 少了 ${file}——先 pnpm build`);
      }
    }
  }
});
