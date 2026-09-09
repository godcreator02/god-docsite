/**
 * outputs 摆放走一趟命令行：render 摆到落点、check 守着生成物跟源一致，各打成哪几行、退什么码。
 * 摆放本身（渲成什么、四态怎么判、frontmatter 怎么挑）归 project 的摆放模块，账在 placement.test.ts；
 * 这儿只验命令行这一层，加装配时的地盘规则与配置形状。台子在 cli-project.ts。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CONFIG, setupProject, withOutputs } from "./cli-project.ts";
import { run } from "./repo.ts";

const SKILL_DOC = [
  "---",
  "name: block-note",
  "description: 块笔记怎么用",
  "tags:",
  "  - 笔记",
  "  - 块",
  "secret: 不该随行",
  "---",
  "",
  "# skill",
  "",
  "@@livedoc ref src/greet.ts:2-3 @@",
  "",
].join("\n");

test("outputs 摆放：render 只写指定目标、不落 out/；check 守生成物——手改了或删了都红，重摆后复原", async () => {
  const p = setupProject(withOutputs(`{ "docs/a.md": ["README.md"] }`));
  try {
    await p.cli("confirm");
    const rendered = await p.cli("render");
    assert.equal(rendered.code, 0, rendered.out);
    assert.match(rendered.out, /→ {2}docs\/a\.md {2}摆放到 README\.md/);
    const readme = p.read("README.md");
    assert.match(readme, /```ts\nexport function greet/);
    assert.doesNotMatch(readme, /<!-- ref |<!-- \/ref -->/, "摆放那份也剥记号");
    assert.equal(existsSync(join(p.root, "out")), false, "挂了映射的不再落 out/");

    const green = await p.cli("check");
    assert.equal(green.code, 0, green.out);
    assert.match(green.out, /🟢 docs\/a\.md → README\.md {2}生成物跟 mdx 源一致/);

    writeFileSync(join(p.root, "README.md"), readme + "\n手改一笔\n");
    const edited = await p.cli("check");
    assert.equal(edited.code, 1);
    assert.match(edited.out, /🔴 docs\/a\.md → README\.md {2}生成物跟 mdx 源不一致/);

    rmSync(join(p.root, "README.md"));
    const gone = await p.cli("check");
    assert.equal(gone.code, 1);
    assert.match(gone.out, /🔴 docs\/a\.md → README\.md {2}生成物还不存在——render 摆过去/);

    await p.cli("render");
    assert.equal((await p.cli("check")).code, 0, "重摆之后恢复绿");
  } finally {
    p.teardown();
  }
});

test("outputs 配置的地盘规则：绝对路径、落进文档目录、一个目标两个文档写，装配时都拒", async () => {
  const cases: [string, RegExp][] = [
    [withOutputs(`{ "docs/a.md": ["C:/绝对/路径.md"] }`), /绝对路径不认/],
    [withOutputs(`{ "docs/a.md": ["docs/copy.md"] }`), /落进了文档目录/],
    [withOutputs(`{ "docs/a.md": ["README.md"], "docs/b.html": ["README.md"] }`), /一个目标只许一个文档写/],
  ];
  for (const [config, message] of cases) {
    const p = setupProject(config);
    try {
      await assert.rejects(p.cli("check"), message);
    } finally {
      p.teardown();
    }
  }
});

test("outputs 目标落进第二个文档目录也拒", async () => {
  const p = setupProject(CONFIG.replace(`docs: "docs", out: "out" };`, `docs: ["docs", "more"], out: "out", outputs: { "docs/a.md": ["more/copy.md"] } };`));
  try {
    await assert.rejects(p.cli("check"), /落进了文档目录/);
  } finally {
    p.teardown();
  }
});

test("outputs 点名了源里没有的 frontmatter 字段：render 不摆、退 1；check 红并说缺哪个", async () => {
  const p = setupProject(withOutputs(`{ "docs/s.md": [{ to: "SKILL.md", frontmatter: ["name", "nope"] }] }`));
  try {
    writeFileSync(join(p.root, "docs", "s.md"), SKILL_DOC);
    run(p.root, ["add", "-A"]);
    run(p.root, ["commit", "-qm", "加 skill 源"]);
    await p.cli("confirm");
    const rendered = await p.cli("render");
    assert.equal(rendered.code, 1);
    assert.match(rendered.out, /🔴 docs\/s\.md → SKILL\.md {2}mdx 源的 frontmatter 里没有 nope——补上再 render/);
    assert.equal(existsSync(join(p.root, "SKILL.md")), false, "缺字段就不摆");
    const red = await p.cli("check", "--json");
    assert.equal(red.code, 1);
    const report = JSON.parse(red.out) as { docs: Array<{ doc: string; outputs: Array<{ to: string; status: string; fresh: boolean; missing?: string[] }> }> };
    const entry = report.docs.find((d) => d.doc === "docs/s.md")!;
    assert.deepEqual(entry.outputs, [{ to: "SKILL.md", status: "no-frontmatter", fresh: false, missing: ["nope"] }]);
  } finally {
    p.teardown();
  }
});

test("outputs 对象写法的形状：to 空、frontmatter 不是字符串数组，装配时拒", async () => {
  const cases: [string, RegExp][] = [
    [withOutputs(`{ "docs/a.md": [{ to: "" }] }`), /每个目标得是非空的相对路径/],
    [withOutputs(`{ "docs/a.md": [{ to: "X.md", frontmatter: "name" }] }`), /frontmatter 得是字段名数组/],
    [withOutputs(`{ "docs/a.md": [] }`), /目标得是非空数组/],
  ];
  for (const [config, message] of cases) {
    const p = setupProject(config);
    try {
      await assert.rejects(p.cli("check"), message);
    } finally {
      p.teardown();
    }
  }
});
