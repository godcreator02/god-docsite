/**
 * outputs 摆放经命令行测一遍：render 写到落点、check 核对生成物跟源一致，各打印成哪几行、以什么退出码结束。
 * 摆放本身（渲染成什么、四种状态怎么判、frontmatter 怎么挑）归 project 的摆放模块，测试在 placement.test.ts；
 * 这里只测命令行这一层，加装配时的地盘规则与配置形状。测试用的项目在 cli-project.ts 里搭建。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { setupProject, UNCONFIRMED, withOutputs } from "./cli-project.ts";
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
  UNCONFIRMED,
  "",
].join("\n");

test("outputs 摆放：confirm 顺带重新生成、render 只写指定目标；check 核对生成物——手改了或删了都红，重新生成后恢复", async () => {
  const p = setupProject(withOutputs(`{ "docs/a.mdx": ["README.md"] }`));
  try {
    const done = await p.cli("confirm");
    assert.match(done.out, /→ {2}docs\/a\.mdx {2}重新摆放到 README\.md/, "confirm 最后把配置了映射的文档重新生成一遍");
    const rendered = await p.cli("render");
    assert.equal(rendered.code, 0, rendered.out);
    assert.match(rendered.out, /· {2}docs\/a\.mdx → README\.md {2}没变/, "内容没变就不写");
    const readme = p.read("README.md");
    assert.match(readme, /```ts title="src\/greet\.ts:2-3"\nexport function greet/);
    assert.doesNotMatch(readme, /\{\/\* ref /, "摆放那份也去掉记号");

    const green = await p.cli("check");
    assert.equal(green.code, 0, green.out);
    assert.match(green.out, /🟢 docs\/a\.mdx → README\.md {2}生成物跟 mdx 源一致/);

    writeFileSync(join(p.root, "README.md"), readme + "\n手改一笔\n");
    const edited = await p.cli("check");
    assert.equal(edited.code, 1);
    assert.match(edited.out, /🔴 docs\/a\.mdx → README\.md {2}生成物跟 mdx 源不一致/);

    rmSync(join(p.root, "README.md"));
    const gone = await p.cli("check");
    assert.equal(gone.code, 1);
    assert.match(gone.out, /🔴 docs\/a\.mdx → README\.md {2}生成物还不存在——运行 render 生成/);

    assert.match((await p.cli("render")).out, /→ {2}docs\/a\.mdx {2}摆放到 README\.md/);
    assert.equal((await p.cli("check")).code, 0, "重新生成之后恢复绿");
  } finally {
    p.teardown();
  }
});

test("outputs 配置的地盘规则：绝对路径、落进内容根、一个目标两个文档写，装配时都报错", async () => {
  const cases: [string, RegExp][] = [
    [withOutputs(`{ "docs/a.mdx": ["C:/绝对/路径.md"] }`), /绝对路径不认/],
    [withOutputs(`{ "docs/a.mdx": ["docs/copy.md"] }`), /落进了 \S+，那是源文件的地盘/],
    [withOutputs(`{ "docs/a.mdx": ["README.md"], "docs/b.mdx": ["README.md"] }`), /一个目标只许一个文档写/],
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

test("outputs 目标落进内容根下的任何地方都报错，轨迹与未来区也算", async () => {
  for (const to of ["docs/future/copy.md", "docs/trajectory/copy.md", "./docs/deep/copy.md"]) {
    const p = setupProject(withOutputs(`{ "docs/a.mdx": [${JSON.stringify(to)}] }`));
    try {
      await assert.rejects(p.cli("check"), /落进了 docs，那是源文件的地盘/, to);
    } finally {
      p.teardown();
    }
  }
});

test("outputs 点名了源里没有的 frontmatter 字段：render 不写、退出码 1；check 红并说缺哪个", async () => {
  const p = setupProject(withOutputs(`{ "docs/s.mdx": [{ to: "SKILL.md", frontmatter: ["name", "nope"] }] }`));
  try {
    writeFileSync(join(p.root, "docs", "s.mdx"), SKILL_DOC);
    run(p.root, ["add", "-A"]);
    run(p.root, ["commit", "-qm", "加 skill 源"]);
    const done = await p.cli("confirm");
    assert.equal(done.code, 1, "confirm 顺带重新生成时遇到缺字段的落点也算红");
    assert.match(done.out, /🔴 docs\/s\.mdx → SKILL\.md {2}mdx 源的 frontmatter 里没有 nope——补上再 confirm/);
    const rendered = await p.cli("render");
    assert.equal(rendered.code, 1);
    assert.match(rendered.out, /🔴 docs\/s\.mdx → SKILL\.md {2}mdx 源的 frontmatter 里没有 nope——补上再 render/);
    assert.equal(existsSync(join(p.root, "SKILL.md")), false, "缺字段就不写");
    const red = await p.cli("check", "--json");
    assert.equal(red.code, 1);
    const report = JSON.parse(red.out) as { docs: Array<{ doc: string; outputs: Array<{ to: string; status: string; fresh: boolean; missing?: string[] }> }> };
    const entry = report.docs.find((d) => d.doc === "docs/s.mdx")!;
    assert.deepEqual(entry.outputs, [{ to: "SKILL.md", status: "no-frontmatter", fresh: false, missing: ["nope"] }]);
  } finally {
    p.teardown();
  }
});

test("outputs 对象写法的形状：to 空、frontmatter 不是字符串数组，装配时报错", async () => {
  const cases: [string, RegExp][] = [
    [withOutputs(`{ "docs/a.mdx": [{ to: "" }] }`), /每个目标得是非空的相对路径/],
    [withOutputs(`{ "docs/a.mdx": [{ to: "X.md", frontmatter: "name" }] }`), /frontmatter 得是字段名数组/],
    [withOutputs(`{ "docs/a.mdx": [] }`), /目标得是非空数组/],
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
