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

// 首发是六包同版 0.1.0；之后各包各走各的（cli 先抬到 0.2.0：加了 init、skill 与站模板随包发）。
// 所以这条守的是形状，不是那个具体的数——把版本号写死在测试里，每发一次版就得改一次测试。
test("六个包齐、包名带 scope、版本是合法 semver", () => {
  for (const name of NAMES) {
    const pkg = JSON.parse(readFileSync(join(PACKAGES, name, "package.json"), "utf8")) as { name: string; version: string };
    assert.equal(pkg.name, `@godcreator02/live-doc-${name}`);
    assert.match(pkg.version, /^\d+\.\d+\.\d+$/, `${name} 的版本不是 semver`);
  }
});

// skill 跟着 cli 包走：别的包（消费方的开发套件）装了 cli 就能把 skills/ 挂给 agent 读，
// 不用另外约定一个目录。漏进 files 的话包发出去是空的，装的人只看到 dist。
test("cli 随包发两份 skill 与装配模板：files 收着它们，目录真在", () => {
  const dir = join(PACKAGES, "cli");
  const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8")) as { files: string[] };
  for (const entry of ["dist", "skills", "template"]) assert.ok(pkg.files.includes(entry), `cli 的 files 少了 ${entry}`);
  for (const rel of ["skills/livedoc-docs/SKILL.md", "skills/trajectory/SKILL.md", "template/attach"]) {
    assert.ok(existsSync(join(dir, rel)), `cli 少了 ${rel}`);
  }
});

// 骨架那半归站件：模板里留着一份 package.json / tsconfig / postcss，装配就会把站件刚铺好的
// 那几份盖掉——两个包各出一份同名配置，谁赢看谁后跑
test("装配模板里没有骨架那半：package.json、tsconfig、postcss、pnpm-workspace、.npmrc 一份都不在", () => {
  const template = join(PACKAGES, "cli", "template", "attach");
  for (const rel of ["package.json.tpl", "tsconfig.json.tpl", "postcss.config.mjs.tpl", "pnpm-workspace.yaml.tpl", ".npmrc.tpl"]) {
    assert.equal(existsSync(join(template, rel)), false, `装配模板里还留着骨架那半的 ${rel}`);
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
