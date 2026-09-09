/**
 * 装配的归一，全部跨 `loadProject` 看：`docs` 的两种写法 → `project.docsDirs`，
 * `outputs` 的两种写法 → `project.placements(doc)`，三种路径写法 → `project.docIdOf(path)`，
 * 形状不对的配置 → `loadProject` 当场拒。
 *
 * 这几条不经格式包也不经磁盘扫描，所以项目只有一份 `livedoc.config.mjs`、`formats` 是空表。
 * 装配那一整趟（地盘规则、真扫目录）在 cli.test.ts，摆放那一摊在 placement.test.ts。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadProject } from "@godcreator02/live-doc-project";
import type { Project } from "@godcreator02/live-doc-project";

const roots: string[] = [];

/** 起一个只有配置的临时项目：`body` 是 livedoc.config 里除 formats 之外的那几项 */
function project(body: string): Promise<Project> {
  const root = mkdtempSync(join(tmpdir(), "god-live-doc-load-"));
  roots.push(root);
  writeFileSync(join(root, "livedoc.config.mjs"), `export default { formats: [], ${body} };\n`);
  return loadProject(root);
}

test.after(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true, maxRetries: 5 });
});

test("docsDirs：没配退 docs；字符串一项；数组照抄；尾斜杠与反斜杠归一", async () => {
  assert.deepEqual((await project("")).docsDirs, ["docs"]);
  assert.deepEqual((await project(`docs: "content/docs/"`)).docsDirs, ["content/docs"]);
  assert.deepEqual((await project(String.raw`docs: ["content/docs", "content\\outputs"]`)).docsDirs, ["content/docs", "content/outputs"]);
});

test("docs 的形状不对：空数组、空白串，装配当场拒", async () => {
  await assert.rejects(project("docs: []"), /非空目录/);
  await assert.rejects(project(`docs: " "`), /非空目录/);
});

test("placements：字符串等于 frontmatter 为空；对象写法原样；没挂映射的文档给空表", async () => {
  const p = await project(`outputs: { "a.mdx": ["../README.md", { to: "../x/SKILL.md", frontmatter: ["name", "description"] }, { to: "Y.md" }] }`);

  assert.deepEqual(p.placements("a.mdx"), [
    { to: "../README.md", frontmatter: [] },
    { to: "../x/SKILL.md", frontmatter: ["name", "description"] },
    { to: "Y.md", frontmatter: [] },
  ]);
  assert.deepEqual(p.placements("b.mdx"), []);
});

test("outputs 的形状不对：空目标表、空路径、frontmatter 不是字段名数组，装配当场拒", async () => {
  await assert.rejects(project(`outputs: { "a.mdx": [] }`), /非空数组/);
  await assert.rejects(project(`outputs: { "a.mdx": [""] }`), /非空的相对路径/);
  await assert.rejects(project(`outputs: { "a.mdx": [{ to: "X.md", frontmatter: [""] }] }`), /字段名数组/);
});

test("docIdOf：绝对路径按项目根算，相对路径原样收；反斜杠与 ./ 前缀归一", async () => {
  const p = await project("");

  assert.equal(p.docIdOf(join(p.root, "docs", "a.md")), "docs/a.md");
  assert.equal(p.docIdOf("docs/a.md"), "docs/a.md");
  assert.equal(p.docIdOf("./docs/a.md"), "docs/a.md");
  assert.equal(p.docIdOf("docs\\a.md"), "docs/a.md");
});
