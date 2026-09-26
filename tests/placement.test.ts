/**
 * 摆放模块：渲一份正文、戴上点名的 frontmatter 字段、写到每个落点，再跟盘上那份比出四态。
 *
 * 跨 project 的接口进——临时目录里起一个真项目，`loadProject` 之后直接调 `placing` 的两个方法。
 * 不起命令行、不劫持 stdout、不 `process.chdir`：摆放的判定不该只有走一趟命令行才验得着。
 *
 * 临时目录里不起 git 仓：确认不问 git，源里那条引用照样记得下。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadProject } from "../packages/docfirst-workflow/src/project/index.ts";
import { CODE } from "./repo.ts";

/** 带 frontmatter 的源：点名的字段随行到生成物头部，没点名的剥掉 */
const SOURCE = ["---", "name: block-note", "description: 块笔记怎么用", "secret: 不该随行", "---", "", "# 摆放", "", "@@docfirst ref src/greet.ts:2-3 @@", ""].join("\n");

/** 起一个能被 loadProject 装配的临时项目：一份代码、两篇文档、一份配 outputs 的 docfirst.config */
async function setup(outputs: string) {
  const root = mkdtempSync(join(tmpdir(), "god-live-doc-placing-"));
  mkdirSync(join(root, "src"));
  mkdirSync(join(root, "docs"));
  writeFileSync(join(root, "src", "greet.ts"), CODE);
  writeFileSync(join(root, "docs", "a.mdx"), SOURCE);
  writeFileSync(join(root, "docs", "b.mdx"), "# 没挂映射\n");
  writeFileSync(join(root, "docfirst.config.mjs"), `export default { content: "docs", outputs: ${outputs} };\n`);

  const project = await loadProject(root);
  // 记号先确认掉：草稿记号还没有展示区，投影不出内容——摆放要验的正是投影过的那份正文
  for (const doc of project.docs()) {
    const done = project.pinning.confirmDoc(doc, project.read(doc), { accept: false });
    assert.ok(done.steps.every((step) => step.action !== "refused"), `${doc} 没确认下来`);
    if (done.changed) project.write(doc, done.text);
  }

  return {
    root,
    project,
    read: (rel: string) => readFileSync(join(root, rel), "utf8"),
    teardown: () => rmSync(root, { recursive: true, force: true, maxRetries: 5 }),
  };
}

test("摆放一趟：render 写到落点、回落点清单；check 从 missing 转成 fresh", async () => {
  const p = await setup(`{ "docs/a.mdx": ["README.md"] }`);
  try {
    const project = p.project;

    assert.deepEqual(await project.placing.check("docs/a.mdx"), [{ to: "README.md", status: "missing", fresh: false }], "还没摆过：生成物不在");

    assert.deepEqual(await project.placing.render("docs/a.mdx"), [{ to: "README.md", status: "placed" }]);
    const readme = p.read("README.md");
    assert.match(readme, /```ts title="src\/greet\.ts:2-3"\nexport function greet/, "正文是投影过的 md");
    assert.doesNotMatch(readme, /\{\/\* ref |@@docfirst/, "摆放那份剥掉记号");

    assert.deepEqual(await project.placing.check("docs/a.mdx"), [{ to: "README.md", status: "fresh", fresh: true }]);
  } finally {
    p.teardown();
  }
});

test("摆放的核对：生成物被手改了是 stale，被删了是 missing，重摆之后回 fresh", async () => {
  const p = await setup(`{ "docs/a.mdx": ["README.md"] }`);
  try {
    const project = p.project;
    await project.placing.render("docs/a.mdx");

    writeFileSync(join(p.root, "README.md"), p.read("README.md") + "\n手改一笔\n");
    assert.deepEqual(await project.placing.check("docs/a.mdx"), [{ to: "README.md", status: "stale", fresh: false }]);

    rmSync(join(p.root, "README.md"));
    assert.deepEqual(await project.placing.check("docs/a.mdx"), [{ to: "README.md", status: "missing", fresh: false }]);

    await project.placing.render("docs/a.mdx");
    assert.deepEqual(await project.placing.check("docs/a.mdx"), [{ to: "README.md", status: "fresh", fresh: true }]);
    assert.deepEqual(await project.placing.render("docs/a.mdx"), [{ to: "README.md", status: "unchanged" }], "内容没变就不写");
  } finally {
    p.teardown();
  }
});

test("点名的 frontmatter 字段原样随行到生成物头部，没点名的剥掉；字符串写法整段剥掉", async () => {
  const p = await setup(`{ "docs/a.mdx": [{ to: "skills/x/SKILL.md", frontmatter: ["name", "description"] }, "PLAIN.md"] }`);
  try {
    const project = p.project;
    assert.deepEqual(await project.placing.render("docs/a.mdx"), [
      { to: "skills/x/SKILL.md", status: "placed" },
      { to: "PLAIN.md", status: "placed" },
    ]);

    const skill = p.read("skills/x/SKILL.md");
    assert.ok(skill.startsWith("---\nname: block-note\ndescription: 块笔记怎么用\n---\n\n# 摆放\n"), skill);
    assert.doesNotMatch(skill, /secret:/, "没点名的字段不随行");
    assert.ok(p.read("PLAIN.md").startsWith("# 摆放\n"), "字符串写法整段剥掉");
  } finally {
    p.teardown();
  }
});

test("点名了源里没有的 frontmatter 字段：这个落点不摆，两个方法都说缺哪几个", async () => {
  const p = await setup(`{ "docs/a.mdx": [{ to: "SKILL.md", frontmatter: ["name", "nope"] }] }`);
  try {
    const project = p.project;
    assert.deepEqual(await project.placing.render("docs/a.mdx"), [{ to: "SKILL.md", status: "no-frontmatter", missing: ["nope"] }]);
    assert.equal(existsSync(join(p.root, "SKILL.md")), false, "缺字段就不摆——摆一份缺 name 的 SKILL.md 比不摆更糟");
    assert.deepEqual(await project.placing.check("docs/a.mdx"), [{ to: "SKILL.md", status: "no-frontmatter", fresh: false, missing: ["nope"] }]);
  } finally {
    p.teardown();
  }
});

test("没挂映射的文档：两个方法都回空清单，一个字都不写", async () => {
  const p = await setup(`{ "docs/a.mdx": ["README.md"] }`);
  try {
    const project = p.project;
    assert.deepEqual(await project.placing.check("docs/b.mdx"), []);
    assert.deepEqual(await project.placing.render("docs/b.mdx"), []);
  } finally {
    p.teardown();
  }
});
