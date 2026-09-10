/**
 * 骨架：两个包都在、都能装、都出得来产物，出口按 package.json 的 exports 解析得到。
 * 别的规矩（谁能依赖谁、目录方向）归 boundary.test.ts。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const PACKAGES = join(HERE, "..", "packages");
/** 目录名 → 包名。目录名跟包名去掉 scope 那一截同名 */
const NAMES: Record<string, string> = {
  "docfirst-workflow": "@godcreator02/docfirst-workflow",
  "docfirst-trajectory": "@godcreator02/docfirst-trajectory",
};

// 塌包之后两个包重新从 0.1.0 起。这条守的是形状，不是那个具体的数——把版本号写死在测试里，
// 每发一次版就得改一次测试。
test("两个包齐、包名带 scope、版本是合法 semver", () => {
  for (const [dir, name] of Object.entries(NAMES)) {
    const pkg = JSON.parse(readFileSync(join(PACKAGES, dir, "package.json"), "utf8")) as { name: string; version: string };
    assert.equal(pkg.name, name);
    assert.match(pkg.version, /^\d+\.\d+\.\d+$/, `${dir} 的版本不是 semver`);
  }
});

test("每个包都构建出了 exports 里写的产物", () => {
  for (const dir of Object.keys(NAMES)) {
    const pkgDir = join(PACKAGES, dir);
    const pkg = JSON.parse(readFileSync(join(pkgDir, "package.json"), "utf8")) as {
      exports: Record<string, string | { types?: string; default?: string }>;
      bin?: Record<string, string>;
    };
    for (const [entry, table] of Object.entries(pkg.exports)) {
      const files = typeof table === "string" ? [table] : [table.types, table.default];
      for (const file of files) {
        if (file === undefined) continue;
        assert.ok(existsSync(join(pkgDir, file)), `${dir} 的出口 ${entry} 少了 ${file}——先 pnpm build`);
      }
    }
    for (const file of Object.values(pkg.bin ?? {})) {
      assert.ok(existsSync(join(pkgDir, file)), `${dir} 的可执行少了 ${file}——先 pnpm build`);
    }
  }
});
