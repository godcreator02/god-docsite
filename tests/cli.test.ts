/**
 * 命令行三个动作，在临时真 git 项目里跑一遍：check 报状态、confirm 机械写回、render 出产物。
 * 四类引用各自的报法、黄灯要点名页带 --accept、红的那几处不挡别的，也在这儿。
 * 台子在 cli-project.ts；outputs 摆放在 cli-outputs.test.ts，装配与报告在 cli-report.test.ts。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { setupProject, withOutputs } from "./cli-project.ts";
import { CODE, run } from "./repo.ts";

const CONFIRMED = /^\{\/\* ref file="src\/greet\.ts" lines="2-3" hash="[0-9a-f]{12}" blob="[0-9a-f]{12}" \*\/\}$/m;

test("check 报未确认；confirm 把草稿换成带记录的正式记号；再 check 全绿；没有记录簿", async () => {
  const p = setupProject();
  try {
    const first = await p.cli("check");
    assert.equal(first.code, 0, "未确认不算红");
    assert.match(first.out, /⚪ docs\/a\.mdx {2}src\/greet\.ts:2-3 {2}未确认/);
    assert.match(first.out, /⚪ docs\/b\.mdx/);

    const done = await p.cli("confirm");
    assert.equal(done.code, 0);
    assert.match(done.out, /✅ docs\/a\.mdx {2}src\/greet\.ts:2-3 {2}已确认，草稿记号已换成正式记号/);
    assert.match(p.read("docs/a.mdx"), CONFIRMED, "草稿记号换成了带记录的正式记号");
    assert.match(p.read("docs/b.mdx"), CONFIRMED);
    assert.equal(existsSync(join(p.root, ".ledger.json")), false, "记录写在记号上，没有记录簿");

    const again = await p.cli("check");
    assert.equal(again.code, 0);
    assert.match(again.out, /🟢 docs\/a\.mdx/);
    assert.match(again.out, /🟢 docs\/b\.mdx/);
    assert.equal((await p.cli("confirm")).out, "", "都是原地没动的绿：再确认一行都不打、一个字不改");
  } finally {
    p.teardown();
  }
});

test("已提交的代码改了：check 报黄、退 0；文件没了：报红、退 1", async () => {
  const p = setupProject();
  try {
    await p.cli("confirm");
    writeFileSync(join(p.root, "src", "greet.ts"), CODE.replace("hello", "hey"));
    run(p.root, ["commit", "-qam", "改问候语"]);
    const yellow = await p.cli("check");
    assert.equal(yellow.code, 0, "有变动等作者复核，不是红");
    assert.match(yellow.out, /🟡 docs\/a\.mdx {2}src\/greet\.ts:2-3 {2}有变动/);

    rmSync(join(p.root, "src", "greet.ts"));
    const red = await p.cli("check");
    assert.equal(red.code, 1);
    assert.match(red.out, /🔴 docs\/a\.mdx {2}src\/greet\.ts:2-3 {2}缺失.*文件不在了/);
  } finally {
    p.teardown();
  }
});

test("confirm 不要求先提交：改了没提交的代码照样记得下", async () => {
  const p = setupProject();
  try {
    writeFileSync(join(p.root, "src", "greet.ts"), CODE.replace("hello", "hey"));
    const done = await p.cli("confirm");
    assert.equal(done.code, 0, done.out);
    assert.match(p.read("docs/a.mdx"), CONFIRMED);
  } finally {
    p.teardown();
  }
});

test("confirm 遇红：红的那处不动、别的照写，打印后退 1", async () => {
  const p = setupProject();
  try {
    writeFileSync(join(p.root, "docs", "a.mdx"), "# md\n\n@@docfirst ref src/greet.ts:2-3 @@\n\n@@docfirst ref src/nowhere.ts:1-2 @@\n");
    const done = await p.cli("confirm");
    assert.equal(done.code, 1);
    assert.match(done.out, /🔴 docs\/a\.mdx {2}第 5 行 src\/nowhere\.ts:1-2 {2}缺失（文件不在了），这处没动/);
    const doc = p.read("docs/a.mdx");
    assert.match(doc, CONFIRMED, "钉得住的那处照写");
    assert.match(doc, /^@@docfirst ref src\/nowhere\.ts:1-2 @@$/m, "红的那处原样留着");
  } finally {
    p.teardown();
  }
});

test("黄灯：confirm 原样不动并列出来；--accept 不点名页退 2；点名页带 --accept 才重新记", async () => {
  const p = setupProject();
  try {
    await p.cli("confirm");
    const confirmed = p.read("docs/a.mdx");
    writeFileSync(join(p.root, "src", "greet.ts"), CODE.replace("hello", "hey"));

    const pending = await p.cli("confirm");
    assert.equal(pending.code, 0, "黄不是红");
    assert.match(pending.out, /🟡 docs\/a\.mdx {2}src\/greet\.ts:2-3 {2}有变动，等作者复核——复核后 docfirst confirm docs\/a\.mdx --accept/);
    assert.equal(p.read("docs/a.mdx"), confirmed, "黄灯原样不动");

    const bare = await p.cli("confirm", "--accept");
    assert.equal(bare.code, 2);
    assert.equal(p.read("docs/a.mdx"), confirmed);

    const signed = await p.cli("confirm", "docs/a.mdx", "--accept");
    assert.equal(signed.code, 0, signed.out);
    assert.match(signed.out, /✅ docs\/a\.mdx {2}src\/greet\.ts:2-3 {2}已按今天的内容重新记下/);
    assert.notEqual(p.read("docs/a.mdx"), confirmed);
    assert.match((await p.cli("check")).out, /🟢 docs\/a\.mdx/);
    assert.match((await p.cli("check")).out, /🔴 docs\/b\.mdx {2}src\/greet\.ts:2-3 {2}有变动，是本仓还没提交的改动引起的/, "没点名的页的黄灯还等着人");
  } finally {
    p.teardown();
  }
});

test("绿灯挪了位置：confirm 机械写回新行号", async () => {
  const p = setupProject();
  try {
    await p.cli("confirm");
    writeFileSync(join(p.root, "src", "greet.ts"), `// 头一行\n// 又一行\n${CODE}`);
    run(p.root, ["commit", "-qam", "上面插两行"]);
    const done = await p.cli("confirm");
    assert.equal(done.code, 0, done.out);
    assert.match(done.out, /✅ docs\/a\.mdx {2}src\/greet\.ts:2-3 {2}内容没变、挪到了 4-5，已写回新行号/);
    assert.match(p.read("docs/a.mdx"), /^\{\/\* ref file="src\/greet\.ts" lines="4-5" /m);
  } finally {
    p.teardown();
  }
});

test("render：只处理挂了 outputs 映射的文档，别的文档不渲染、什么都不写", async () => {
  const p = setupProject();
  try {
    await p.cli("confirm");
    const rendered = await p.cli("render");
    assert.equal(rendered.code, 0, rendered.out);
    assert.equal(rendered.out, "");
    assert.equal(existsSync(join(p.root, "out")), false);
  } finally {
    p.teardown();
  }
});

test("render：正本里还有草稿记号就渲染不了，报红退 1、不写落点", async () => {
  const p = setupProject(withOutputs(`{ "docs/a.mdx": ["README.md"] }`));
  try {
    const rendered = await p.cli("render");
    assert.equal(rendered.code, 1);
    assert.match(rendered.out, /🔴 docs\/a\.mdx → README\.md {2}.*第 3 行是草稿记号，先 docfirst confirm/);
    assert.equal(existsSync(join(p.root, "README.md")), false);
  } finally {
    p.teardown();
  }
});

test("四类引用一篇文档：四种记号各自认得回来；多了文件黄、名字没了红", async () => {
  const p = setupProject();
  try {
    writeFileSync(
      join(p.root, "docs", "d.mdx"),
      "# d\n\n@@docfirst tree src @@\n\n@@docfirst ref src/greet.ts @@\n\n@@docfirst has src/greet.ts \"export function greet\" @@\n",
    );
    const done = await p.cli("confirm");
    assert.equal(done.code, 0, done.out);
    assert.match(done.out, /✅ docs\/d\.mdx {2}tree src depth=1 {2}已确认/);
    assert.match(done.out, /✅ docs\/d\.mdx {2}src\/greet\.ts:all {2}已确认/);
    assert.match(done.out, /✅ docs\/d\.mdx {2}has src\/greet\.ts "export function greet" {2}已确认/);
    const doc = p.read("docs/d.mdx");
    assert.match(doc, /^\{\/\* tree dir="src" depth="1" hash="[0-9a-f]{12}" \*\/\}$/m);
    assert.match(doc, /^\{\/\* ref file="src\/greet\.ts" hash="[0-9a-f]{12}" blob="[0-9a-f]{12}" \*\/\}$/m);
    assert.match(doc, /^\{\/\* has file="src\/greet\.ts" text="export function greet" \*\/\}$/m);

    const green = await p.cli("check");
    assert.match(green.out, /🟢 docs\/d\.mdx {2}tree src depth=1 {2}新鲜（1 项）/);

    writeFileSync(join(p.root, "src", "tag.ts"), "export const t = 1;\n");
    writeFileSync(join(p.root, "src", "greet.ts"), CODE.replace("function greet", "function hello"));
    const after = await p.cli("check");
    assert.equal(after.code, 1);
    assert.match(after.out, /🔴 docs\/d\.mdx {2}tree src depth=1 {2}有变动，是本仓还没提交的改动引起的（2 项）/, "多出来的文件还没提交，这个黄算红");
    assert.match(after.out, /🔴 docs\/d\.mdx {2}has src\/greet\.ts "export function greet" {2}缺失（文件里没有这个名字了）/);
  } finally {
    p.teardown();
  }
});

test("求助：--help / -h / help 打用法退 0，一个字不写——confirm 后面带着也一样", async () => {
  const p = setupProject();
  try {
    const before = p.read("docs/a.mdx");
    for (const args of [["--help"], ["-h"], ["help"], ["confirm", "--help"], ["confirm", "-h"], ["check", "--help"], ["confirm", "docs/a.mdx", "--help"], ["confirm", "docs/a.mdx", "--accept", "-h"]]) {
      const got = await p.cli(...args);
      assert.equal(got.code, 0, args.join(" "));
      assert.match(got.out, /docfirst confirm \[文档路径…\]/, args.join(" "));
      assert.match(got.out, /docfirst confirm <文档路径…> --accept/, args.join(" "));
      assert.match(got.out, /按页限定/, args.join(" "));
    }
    assert.equal(p.read("docs/a.mdx"), before, "求助不该确认任何东西");
  } finally {
    p.teardown();
  }
});

test("不认识的开关、不收路径的命令带了路径，都退 2、什么都不动——confirm 不再把开关当没写、跑成全部页", async () => {
  const p = setupProject();
  try {
    const before = p.read("docs/a.mdx");
    for (const args of [["confirm", "--dry-run"], ["confirm", "--json"], ["confirm", "docs/a.mdx", "--acept"], ["render", "--force"], ["check", "--jsno"], ["check", "--accept"], ["trajectory", "-x"], ["check", "docs/a.mdx"], ["render", "docs/a.mdx"], ["migrate-ledger", ".ledger.json"]]) {
      assert.equal((await p.cli(...args)).code, 2, args.join(" "));
    }
    assert.equal(p.read("docs/a.mdx"), before);
    assert.equal((await p.cli("check", "--json")).code, 0, "认的开关照常");
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

test("confirm 按页限定：只动点名的那篇，别人的页一个字不改", async () => {
  const p = setupProject();
  try {
    const only = await p.cli("confirm", "docs/a.mdx");
    assert.equal(only.code, 0, only.out);
    assert.match(only.out, /· {2}按页限定：只动 docs\/a\.mdx/);
    assert.match(only.out, /✅ docs\/a\.mdx/);
    assert.doesNotMatch(only.out, /docs\/b\.mdx {2}src/, "没点名的页不该被确认");
    assert.match(p.read("docs/b.mdx"), /@@docfirst ref src\/greet\.ts:2-3 @@/, "没点名的页记号还是草稿");

    // 反斜杠、`./` 开头、绝对路径都收
    const again = await p.cli("confirm", `.\\docs\\b.mdx`);
    assert.equal(again.code, 0, again.out);
    assert.match(again.out, /✅ docs\/b\.mdx/);
    assert.equal((await p.cli("check")).code, 0);
  } finally {
    p.teardown();
  }
});

test("confirm 点名的路径不是这个项目里的文档：退 2，什么都不动", async () => {
  const p = setupProject();
  try {
    const before = p.read("docs/a.mdx");
    const bad = await p.cli("confirm", "docs/a.mdx", "docs/没这篇.mdx");
    assert.equal(bad.code, 2);
    assert.equal(p.read("docs/a.mdx"), before);
  } finally {
    p.teardown();
  }
});
