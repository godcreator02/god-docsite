/**
 * 装配的归一，全部跨 `loadProject` 看：`content` → `project.contentDir` 与 `trajectoryDir`，
 * `outputs` 的两种写法 → `project.placements(doc)`，三种路径写法 → `project.docIdOf(path)`，
 * 形状不对的配置 → `loadProject` 当场拒。
 *
 * 这几条不经文档，所以项目只有一份 `docfirst.config.mjs` 和空的内容根。
 * 装配那一整趟（地盘规则、真扫目录）在 cli 那几份测试，摆放那一摊在 placement.test.ts。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadProject } from "../packages/docfirst-workflow/src/project/index.ts";
import type { Project } from "../packages/docfirst-workflow/src/project/index.ts";

const roots: string[] = [];

/** 起一个只有配置和空内容根的临时项目：`body` 是 docfirst.config 里的那几项 */
function project(body: string, contentDir = "content"): Promise<Project> {
  const root = mkdtempSync(join(tmpdir(), "god-live-doc-load-"));
  roots.push(root);
  mkdirSync(join(root, contentDir), { recursive: true });
  writeFileSync(join(root, "docfirst.config.mjs"), `export default { ${body} };\n`);
  return loadProject(root);
}

test.after(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true, maxRetries: 5 });
});

test("内容根：没配退 content；配了照用，尾斜杠与反斜杠归一；轨迹卡目录固定在内容根下", async () => {
  const plain = await project("");
  assert.equal(plain.contentDir, "content");
  assert.equal(plain.trajectoryDir, join(plain.root, "content", "trajectory"));
  assert.equal((await project(String.raw`content: "site\\content/"`, "site/content")).contentDir, "site/content");
});

test("配置形状不对：不认识的键、content 空串，装配当场拒", async () => {
  const root = mkdtempSync(join(tmpdir(), "god-live-doc-load-"));
  roots.push(root);
  mkdirSync(join(root, "content"));
  writeFileSync(join(root, "docfirst.config.mjs"), `export default { formats: "fumadocs", content: " ", comparator: "git" };\n`);
  await assert.rejects(loadProject(root), (err: Error) => {
    assert.match(err.message, /有 3 处要改/);
    assert.match(err.message, /不认识的键 formats：配置只认 content \/ components \/ outputs/);
    assert.match(err.message, /content 要是一个非空目录/);
    assert.match(err.message, /不认识的键 comparator/);
    return true;
  });
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
