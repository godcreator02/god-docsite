/**
 * outputs 摆放：render 把 mdx 正本摆到指定落点（README、包内 SKILL.md 这些），check 守着生成物跟源一致。
 * 点名的 frontmatter 字段随行、地盘规则、配置形状的拒法都在这儿。台子在 cli-project.ts。
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
    const rendered = await p.cli("render", "--target", "ai");
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

    await p.cli("render", "--target", "ai");
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

test("outputs 对象写法：点名的 frontmatter 字段原样随行到生成物头部（块式列表跟着走），没点名的剥掉；字符串写法照旧全剥", async () => {
  const p = setupProject(
    withOutputs(`{ "docs/s.md": [{ to: "skills/x/SKILL.md", frontmatter: ["name", "tags"] }, "PLAIN.md"] }`),
  );
  try {
    writeFileSync(join(p.root, "docs", "s.md"), SKILL_DOC);
    run(p.root, ["add", "-A"]);
    run(p.root, ["commit", "-qm", "加 skill 源"]);
    assert.equal((await p.cli("confirm")).code, 0);
    const rendered = await p.cli("render", "--target", "ai");
    assert.equal(rendered.code, 0, rendered.out);
    assert.match(rendered.out, /→ {2}docs\/s\.md {2}摆放到 skills\/x\/SKILL\.md/);
    const skill = p.read("skills/x/SKILL.md");
    assert.ok(skill.startsWith("---\nname: block-note\ntags:\n  - 笔记\n  - 块\n---\n\n# skill\n"), skill);
    assert.doesNotMatch(skill, /description:|secret:/, "没点名的字段不随行");
    const plain = p.read("PLAIN.md");
    assert.ok(plain.startsWith("# skill\n"), `字符串写法整段剥掉：${plain.slice(0, 40)}`);
    assert.match(skill, /```ts\nexport function greet/, "正文照样是投影过的 md");

    const green = await p.cli("check");
    assert.equal(green.code, 0, green.out);
    assert.match(green.out, /🟢 docs\/s\.md → skills\/x\/SKILL\.md {2}生成物跟 mdx 源一致/);
    assert.match(green.out, /🟢 docs\/s\.md → PLAIN\.md {2}生成物跟 mdx 源一致/);

    // 手改头部一个字：跟源不一致，红
    writeFileSync(join(p.root, "skills", "x", "SKILL.md"), skill.replace("block-note", "block-notes"));
    const stale = await p.cli("check");
    assert.equal(stale.code, 1);
    assert.match(stale.out, /🔴 docs\/s\.md → skills\/x\/SKILL\.md {2}生成物跟 mdx 源不一致/);
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
    const rendered = await p.cli("render", "--target", "ai");
    assert.equal(rendered.code, 1);
    assert.match(rendered.out, /🔴 docs\/s\.md → SKILL\.md {2}mdx 源的 frontmatter 里没有 nope——补上再 render/);
    assert.equal(existsSync(join(p.root, "SKILL.md")), false, "缺字段就不摆");
    const red = await p.cli("check", "--json");
    assert.equal(red.code, 1);
    const report = JSON.parse(red.out) as { docs: Array<{ doc: string; outputs: Array<{ to: string; status: string; missing?: string[] }> }> };
    const entry = report.docs.find((d) => d.doc === "docs/s.md")!;
    assert.deepEqual(entry.outputs, [{ to: "SKILL.md", status: "no-frontmatter", missing: ["nope"] }]);
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
