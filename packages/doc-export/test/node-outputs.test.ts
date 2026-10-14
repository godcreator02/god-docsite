/**
 * 生成物落盘与核对：临时目录里一个项目，一份代码、两篇正本；钉用 code-pin 读工作区的核对。
 * 临时目录里不建 git 仓：确认不查 git，正本里的钉照样能写上记录。
 */
import { test } from "vitest";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDiskPinner, createPinWorkspace } from "@godcreator/code-pin/node";
import { placementsOf } from "../src/core/index.ts";
import type { OutputsConfig } from "../src/core/index.ts";
import { assertOutputTurf, renderOutputs, verifyOutputs } from "../src/node/index.ts";

const CODE = ["// greet", "export function greet(name: string): string {", "  return `hello ${name}`;", "}", ""].join("\n");
const SOURCE = ["---", "name: block-note", "description: 块笔记怎么用", "secret: 不该随行", "---", "", "# 摆放", "", '{/* ref file="src/greet.ts" lines="2-3" */}', ""].join("\n");

function setup(outputs: OutputsConfig) {
  const root = mkdtempSync(join(tmpdir(), "doc-export-"));
  mkdirSync(join(root, "src"));
  mkdirSync(join(root, "docs"));
  writeFileSync(join(root, "src", "greet.ts"), CODE);
  writeFileSync(join(root, "docs", "a.mdx"), SOURCE);
  const workspace = createPinWorkspace(root);
  assert.deepEqual(workspace.confirm("docs/a.mdx", { accept: false }).steps.map((s) => s.action), ["recorded"]);
  const project = { root, outputs: placementsOf(outputs), roster: {}, pinner: createDiskPinner(root) };
  return {
    root,
    project,
    read: (rel: string) => readFileSync(join(root, rel), "utf8"),
    teardown: () => rmSync(root, { recursive: true, force: true, maxRetries: 5 }),
  };
}

test("生成一次：render 写到落点、交回落点清单；verify 从 missing 转成 fresh", () => {
  const p = setup({ "docs/a.mdx": ["README.md"] });
  try {
    assert.deepEqual(verifyOutputs(p.project), [{ doc: "docs/a.mdx", to: "README.md", status: "missing", fresh: false }]);
    assert.deepEqual(renderOutputs(p.project), [{ doc: "docs/a.mdx", to: "README.md", status: "placed" }]);
    const readme = p.read("README.md");
    assert.match(readme, /```ts title="src\/greet\.ts:2-3"\nexport function greet/, "钉写成代码块");
    assert.doesNotMatch(readme, /\{\/\* ref /, "生成物里没有标记");
    assert.deepEqual(verifyOutputs(p.project), [{ doc: "docs/a.mdx", to: "README.md", status: "fresh", fresh: true }]);
  } finally {
    p.teardown();
  }
});

test("核对：生成物被手改了是 stale，被删了是 missing，重新生成之后回到 fresh；内容没变就不写", () => {
  const p = setup({ "docs/a.mdx": ["README.md"] });
  try {
    renderOutputs(p.project);
    writeFileSync(join(p.root, "README.md"), `${p.read("README.md")}\n手改一笔\n`);
    assert.deepEqual(verifyOutputs(p.project).map((c) => c.status), ["stale"]);
    rmSync(join(p.root, "README.md"));
    assert.deepEqual(verifyOutputs(p.project).map((c) => c.status), ["missing"]);
    renderOutputs(p.project);
    assert.deepEqual(verifyOutputs(p.project).map((c) => c.status), ["fresh"]);
    assert.deepEqual(renderOutputs(p.project).map((w) => w.status), ["unchanged"]);
  } finally {
    p.teardown();
  }
});

test("点名的 frontmatter 字段原样带到生成物头部、落点的父目录自己建；缺字段的落点不写", () => {
  const p = setup({ "docs/a.mdx": [{ to: "skills/x/SKILL.md", frontmatter: ["name", "description"] }, "PLAIN.md", { to: "BAD.md", frontmatter: ["nope"] }] });
  try {
    assert.deepEqual(renderOutputs(p.project).map((w) => [w.to, w.status, w.missing]), [
      ["skills/x/SKILL.md", "placed", undefined],
      ["PLAIN.md", "placed", undefined],
      ["BAD.md", "no-frontmatter", ["nope"]],
    ]);
    assert.ok(p.read("skills/x/SKILL.md").startsWith("---\nname: block-note\ndescription: 块笔记怎么用\n---\n\n# 摆放\n"));
    assert.ok(p.read("PLAIN.md").startsWith("# 摆放\n"));
    assert.equal(existsSync(join(p.root, "BAD.md")), false, "写出一份缺 name 的 SKILL.md 比不写更糟");
  } finally {
    p.teardown();
  }
});

test("只处理点名的正本；点名了映射里没有的正本报错", () => {
  const p = setup({ "docs/a.mdx": ["README.md"] });
  try {
    assert.deepEqual(renderOutputs(p.project, []), []);
    assert.throws(() => verifyOutputs(p.project, ["docs/b.mdx"]), /docs\/b\.mdx 不在 outputs 映射里/);
  } finally {
    p.teardown();
  }
});

test("落点的地盘：绝对路径、落进正本目录、两篇正本写同一个落点都报错", () => {
  const root = join(tmpdir(), "doc-export-turf");
  assert.throws(() => assertOutputTurf(root, ["content"], placementsOf({ "a.mdx": [join(root, "x.md")] })), /绝对路径不认/);
  assert.throws(() => assertOutputTurf(root, ["content"], placementsOf({ "a.mdx": ["content/x.md"] })), /落进了 content/);
  assert.throws(() => assertOutputTurf(root, ["content"], placementsOf({ "a.mdx": ["x.md"], "b.mdx": ["x.md"] })), /只许一篇正本写/);
  assert.doesNotThrow(() => assertOutputTurf(root, ["content"], placementsOf({ "a.mdx": ["../README.md"] })));
});
