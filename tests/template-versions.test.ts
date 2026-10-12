import { test } from "vitest";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * docfirst-site 模板里的版本盯守：模板 skeleton/package.json 给新站带进的 devDependencies 范围，
 * 必须罩得住工作区里那个包的当前版本。发版升了版本号、范围忘了跟上（比如 workflow 从 0.5 升 0.6），
 * 这条测试就红。
 */
test("docfirst-site 模板的 devDependencies 范围罩得住工作区的版本", () => {
  const template = JSON.parse(readFileSync(join(ROOT, "packages/docfirst-site/template/skeleton/package.json"), "utf8")) as {
    devDependencies: Record<string, string>
  };
  for (const [name, range] of Object.entries(template.devDependencies)) {
    const manifest = JSON.parse(readFileSync(join(ROOT, "packages", name.replace("@godcreator/", ""), "package.json"), "utf8")) as { version: string };
    assert.ok(range.startsWith("^"), `${name} 的范围要写成 ^x.y.z，读到 ${range}`);
    const lower = range.slice(1).split(".").map(Number);
    const actual = manifest.version.split(".").map(Number);
    assert.ok(
      actual[0] === lower[0] && actual[1] >= lower[1],
      `${name} 工作区版本 ${manifest.version} 不在模板范围 ${range} 里：发版时模板里的范围忘了跟`,
    );
  }
});
