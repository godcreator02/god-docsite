/**
 * livedoc.config 两个配置项的归一化，纯函数直接喂：`docs` 字符串或数组 → 目录表，
 * `outputs` 字符串或 `{ to, frontmatter }` → 摆放表。装配那一整趟（地盘规则、真扫目录）在 cli.test.ts。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { docsDirsOf, placementsOf } from "@godcreator02/live-doc-project";

test("docsDirsOf：没配退 docs；字符串一项；数组照抄；尾斜杠与反斜杠归一", () => {
  assert.deepEqual(docsDirsOf({}), ["docs"]);
  assert.deepEqual(docsDirsOf({ docs: "content/docs/" }), ["content/docs"]);
  assert.deepEqual(docsDirsOf({ docs: ["content/docs", "content\\outputs"] }), ["content/docs", "content/outputs"]);
  assert.throws(() => docsDirsOf({ docs: [] }), /非空目录/);
  assert.throws(() => docsDirsOf({ docs: " " }), /非空目录/);
});

test("placementsOf：字符串等于 frontmatter 为空；对象写法原样；形状错拒", () => {
  assert.deepEqual(placementsOf({}), {});
  assert.deepEqual(
    placementsOf({ outputs: { "a.mdx": ["../README.md", { to: "../x/SKILL.md", frontmatter: ["name", "description"] }, { to: "Y.md" }] } }),
    { "a.mdx": [{ to: "../README.md", frontmatter: [] }, { to: "../x/SKILL.md", frontmatter: ["name", "description"] }, { to: "Y.md", frontmatter: [] }] },
  );
  assert.throws(() => placementsOf({ outputs: { "a.mdx": [] } }), /非空数组/);
  assert.throws(() => placementsOf({ outputs: { "a.mdx": [""] } }), /非空的相对路径/);
  assert.throws(() => placementsOf({ outputs: { "a.mdx": [{ to: "X.md", frontmatter: [""] }] } }), /字段名数组/);
});
