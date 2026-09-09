/**
 * 命令行三个动作，在临时真 git 项目里跑一遍：check 报状态、confirm 写回并刷记录簿、render 出产物。
 * 五类引用各自的报法、忽略文件退回 hash 记忆、记录簿的两种清扫（文档没了、引用没了）也在这儿。
 * 台子在 cli-project.ts；outputs 摆放在 cli-outputs.test.ts，装配与报告在 cli-report.test.ts。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { setupProject } from "./cli-project.ts";
import { CODE, run } from "./repo.ts";

test("check 报未确认；confirm 换记号、投影、刷记录簿；再 check 全绿", async () => {
  const p = setupProject();
  try {
    const first = await p.cli("check");
    assert.equal(first.code, 0, "未确认不算红");
    assert.match(first.out, /⚪ docs\/a\.md {2}src\/greet\.ts:2-3 {2}未确认/);
    assert.match(first.out, /⚪ docs\/b\.html/);

    const done = await p.cli("confirm");
    assert.equal(done.code, 0);
    assert.match(done.out, /✅ docs\/a\.md {2}src\/greet\.ts:2-3 {2}已确认，草稿记号已换成正式记号/);
    assert.match(p.read("docs/a.md"), /<!-- ref file="src\/greet\.ts" lines="2-3" -->\n```ts/);
    assert.match(p.read("docs/b.html"), /<pre data-file="src\/greet\.ts" data-lines="2-3"><code/);
    const ledger = JSON.parse(p.read(".ledger.json")) as Record<string, Record<string, { kind: string }>>;
    assert.equal(ledger["docs/a.md"]!["src/greet.ts:2-3"]!.kind, "git");

    const again = await p.cli("check");
    assert.equal(again.code, 0);
    assert.match(again.out, /🟢 docs\/a\.md/);
    assert.match(again.out, /🟢 docs\/b\.html/);
  } finally {
    p.teardown();
  }
});

test("代码改了：check 报黄、退 0；文件没了：报红、退 1", async () => {
  const p = setupProject();
  try {
    await p.cli("confirm");
    writeFileSync(join(p.root, "src", "greet.ts"), CODE.replace("hello", "hey"));
    run(p.root, ["commit", "-qam", "改问候语"]);
    const yellow = await p.cli("check");
    assert.equal(yellow.code, 0, "有变动等作者复核，不是红");
    assert.match(yellow.out, /🟡 docs\/a\.md {2}src\/greet\.ts:2-3 {2}有变动/);

    rmSync(join(p.root, "src", "greet.ts"));
    const red = await p.cli("check");
    assert.equal(red.code, 1);
    assert.match(red.out, /🔴 docs\/a\.md {2}src\/greet\.ts:2-3 {2}缺失.*文件不在了/);
  } finally {
    p.teardown();
  }
});

test("confirm 遇 problems：打印、退非零、一个字不改", async () => {
  const p = setupProject();
  try {
    writeFileSync(join(p.root, "src", "greet.ts"), CODE.replace("hello", "hey"));
    const before = p.read("docs/a.md");
    const rejected = await p.cli("confirm");
    assert.equal(rejected.code, 1);
    assert.match(rejected.out, /🔴 docs\/a\.md 第 3 行：src\/greet\.ts:2-3 未提交/);
    assert.match(rejected.out, /这篇整篇没确认/);
    assert.equal(p.read("docs/a.md"), before, "拒了就不写回");
    assert.equal(existsSync(join(p.root, ".ledger.json")), false, "拒了就不落记录簿");
  } finally {
    p.teardown();
  }
});

test("render：md 出 ai 那份剥掉记号；html 说产物就是文档本身", async () => {
  const p = setupProject();
  try {
    await p.cli("confirm");
    const rendered = await p.cli("render");
    assert.equal(rendered.code, 0);
    assert.match(rendered.out, /→ {2}docs\/a\.md {2}渲染成 out\/a\.md\.ai\.md/);
    assert.match(rendered.out, /· {2}docs\/b\.html {2}html 的产物就是文档本身/);
    const ai = p.read("out/a.md.ai.md");
    assert.doesNotMatch(ai, /<!-- ref |<!-- \/ref -->/);
    assert.match(ai, /```ts\nexport function greet/);
  } finally {
    p.teardown();
  }
});

test("被忽略的文件走 hash 记忆：confirm 标明；改了内容 check 报黄、位置不明", async () => {
  const p = setupProject();
  try {
    writeFileSync(join(p.root, ".gitignore"), "vendor/\n");
    run(p.root, ["add", "-A"]);
    run(p.root, ["commit", "-qm", "忽略 vendor"]);
    mkdirSync(join(p.root, "vendor"));
    writeFileSync(join(p.root, "vendor", "lib.ts"), CODE);
    writeFileSync(join(p.root, "docs", "c.md"), "# c\n\n@@livedoc ref vendor/lib.ts:2-3 @@\n");

    const done = await p.cli("confirm");
    assert.equal(done.code, 0);
    assert.match(done.out, /✅ docs\/c\.md {2}vendor\/lib\.ts:2-3 {2}已确认，草稿记号已换成正式记号（hash 记忆：不在 git 里）/);
    assert.match(done.out, /✅ docs\/a\.md {2}src\/greet\.ts:2-3 {2}已确认，草稿记号已换成正式记号\n/, "git 记忆的不标");
    const ledger = JSON.parse(p.read(".ledger.json")) as Record<string, Record<string, { kind: string }>>;
    assert.equal(ledger["docs/c.md"]!["vendor/lib.ts:2-3"]!.kind, "hash");

    writeFileSync(join(p.root, "vendor", "lib.ts"), CODE.replace("hello", "hey"));
    const yellow = await p.cli("check");
    assert.equal(yellow.code, 0);
    assert.match(yellow.out, /🟡 docs\/c\.md {2}vendor\/lib\.ts:2-3 {2}有变动.*位置不明/);
  } finally {
    p.teardown();
  }
});

test("五类引用一篇 md：目录树长出清单、名字和存在性只有记号；多了文件黄、断言不在的出现了红", async () => {
  const p = setupProject();
  try {
    writeFileSync(
      join(p.root, "docs", "d.md"),
      "# d\n\n@@livedoc tree src @@\n\n@@livedoc ref src/greet.ts @@\n\n@@livedoc has src/greet.ts \"export function greet\" @@\n\n@@livedoc absent src/remove.ts @@\n",
    );
    const done = await p.cli("confirm");
    assert.equal(done.code, 0, done.out);
    assert.match(done.out, /✅ docs\/d\.md {2}tree src depth=1 {2}已确认/);
    assert.match(done.out, /✅ docs\/d\.md {2}src\/greet\.ts:all {2}已确认/);
    assert.match(done.out, /✅ docs\/d\.md {2}has src\/greet\.ts "export function greet" {2}已确认/);
    assert.match(done.out, /✅ docs\/d\.md {2}absent src\/remove\.ts {2}已确认/);
    const md = p.read("docs/d.md");
    assert.match(md, /<!-- tree dir="src" depth="1" -->\n```text\ngreet\.ts\n```\n<!-- \/tree -->/);
    assert.match(md, /<!-- ref file="src\/greet\.ts" -->\n```ts\n\/\/ greet\n/);
    assert.match(md, /<!-- has file="src\/greet\.ts" text="export function greet" -->\n\n<!-- absent path="src\/remove\.ts" -->/);

    const green = await p.cli("check");
    assert.match(green.out, /🟢 docs\/d\.md {2}tree src depth=1 {2}新鲜（1 项）/);

    writeFileSync(join(p.root, "src", "tag.ts"), "export const t = 1;\n");
    writeFileSync(join(p.root, "src", "remove.ts"), "");
    const after = await p.cli("check");
    assert.equal(after.code, 1);
    assert.match(after.out, /🟡 docs\/d\.md {2}tree src depth=1 {2}有变动，等作者复核（\+ remove\.ts，\+ tag\.ts）/);
    assert.match(after.out, /🔴 docs\/d\.md {2}absent src\/remove\.ts {2}缺失，引用指向空气（断言它不在，它却出现了）/);
  } finally {
    p.teardown();
  }
});

test("不认识的命令退 2", async () => {
  const p = setupProject();
  try {
    assert.equal((await p.cli("嘿")).code, 2);
  } finally {
    p.teardown();
  }
});

test("文档本身删了：它的记录 check 算红；confirm 整个忘掉", async () => {
  const p = setupProject();
  try {
    await p.cli("confirm");
    rmSync(join(p.root, "docs", "b.html"));
    const red = await p.cli("check");
    assert.equal(red.code, 1);
    assert.match(red.out, /🔴 docs\/b\.html {2}文档已不存在，记录簿里还留着/);
    const swept = await p.cli("confirm");
    assert.match(swept.out, /🧹 docs\/b\.html {2}文档已不存在，记录已清/);
    const ledger = JSON.parse(p.read(".ledger.json")) as Record<string, unknown>;
    assert.deepEqual(Object.keys(ledger), ["docs/a.md"]);
    assert.equal((await p.cli("check")).code, 0);
  } finally {
    p.teardown();
  }
});

test("confirm 按页限定：只动点名的那篇，别人的页与记录一个字不改", async () => {
  const p = setupProject();
  try {
    const only = await p.cli("confirm", "docs/a.md");
    assert.equal(only.code, 0, only.out);
    assert.match(only.out, /· {2}按页限定：只动 docs\/a\.md/);
    assert.match(only.out, /✅ docs\/a\.md/);
    assert.doesNotMatch(only.out, /docs\/b\.html {2}src/, "没点名的页不该被确认");

    const ledger = JSON.parse(p.read(".ledger.json")) as Record<string, unknown>;
    assert.deepEqual(Object.keys(ledger), ["docs/a.md"]);
    assert.match(p.read("docs/b.html"), /@@livedoc ref src\/greet\.ts:2-3 @@/, "没点名的页记号还是草稿");

    // 反斜杠、`./` 开头、绝对路径都收
    const again = await p.cli("confirm", `.\\docs\\b.html`);
    assert.equal(again.code, 0, again.out);
    assert.match(again.out, /✅ docs\/b\.html/);
    assert.equal((await p.cli("check")).code, 0);
  } finally {
    p.teardown();
  }
});

test("confirm 按页限定：整仓的失踪清扫只对点名的那篇做", async () => {
  const p = setupProject();
  try {
    await p.cli("confirm");
    rmSync(join(p.root, "docs", "a.md"));
    rmSync(join(p.root, "docs", "b.html"));

    // 只点名 a：b 的记录留着（它的红还等着人处理），a 的忘掉
    const one = await p.cli("confirm", "docs/a.md");
    assert.equal(one.code, 0, one.out);
    assert.match(one.out, /🧹 docs\/a\.md {2}文档已不存在，记录已清/);
    assert.doesNotMatch(one.out, /🧹 docs\/b\.html/);
    assert.deepEqual(Object.keys(JSON.parse(p.read(".ledger.json")) as Record<string, unknown>), ["docs/b.html"]);

    const all = await p.cli("confirm");
    assert.match(all.out, /🧹 docs\/b\.html {2}文档已不存在，记录已清/);
    assert.deepEqual(Object.keys(JSON.parse(p.read(".ledger.json")) as Record<string, unknown>), []);
  } finally {
    p.teardown();
  }
});

test("confirm 点名的路径既不是文档也不在记录簿：退 2，什么都不动", async () => {
  const p = setupProject();
  try {
    const before = p.read("docs/a.md");
    const bad = await p.cli("confirm", "docs/没这篇.md");
    assert.equal(bad.code, 2);
    assert.equal(p.read("docs/a.md"), before);
    assert.equal(existsSync(join(p.root, ".ledger.json")), false);
  } finally {
    p.teardown();
  }
});

test("孤儿：文档里删掉引用，check 报红；confirm 清掉", async () => {
  const p = setupProject();
  try {
    await p.cli("confirm");
    writeFileSync(join(p.root, "docs", "a.md"), "# md\n\n没有引用了\n");
    const red = await p.cli("check");
    assert.equal(red.code, 1);
    assert.match(red.out, /🔴 docs\/a\.md {2}src\/greet\.ts:2-3 {2}孤儿记录/);
    const swept = await p.cli("confirm");
    assert.match(swept.out, /🧹 docs\/a\.md {2}src\/greet\.ts:2-3 {2}孤儿记录已清/);
    assert.equal((await p.cli("check")).code, 0);
  } finally {
    p.teardown();
  }
});
