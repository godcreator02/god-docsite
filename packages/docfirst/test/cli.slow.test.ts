/**
 * 命令行三个动作，在临时真 git 项目里跑一遍：check 报状态、confirm 机械写回、render 出产物。
 * 三类钉码各自的报法、黄灯要点名页带 --accept、红的那几处不影响别处的写回，也在这儿。
 * 临时项目由 cli-project.ts 建；生成物在 cli-outputs.slow.test.ts，分区与报告在 cli-report.slow.test.ts。
 */
import { test } from "vitest";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { setupProject, UNCONFIRMED, withOutputs } from "./cli-project.ts";
import { CODE, run } from "./repo.ts";

const CONFIRMED = /^\{\/\* ref file="src\/greet\.ts" lines="2-3" hash="[0-9a-f]{12}" blob="[0-9a-f]{12}" \*\/\}$/m;

test("check 报未确认；confirm 给不带记录的标记写上记录；再 check 全绿", async () => {
  const p = setupProject();
  try {
    const first = await p.cli("check");
    assert.equal(first.code, 0, "未确认不算红");
    assert.match(first.out, /⚪ docs\/a\.mdx {2}src\/greet\.ts:2-3 {2}未确认/);
    assert.match(first.out, /⚪ docs\/b\.mdx/);

    const done = await p.cli("confirm");
    assert.equal(done.code, 0);
    assert.match(done.out, /✅ docs\/a\.mdx {2}src\/greet\.ts:2-3 {2}已确认，写上了记录/);
    assert.match(p.read("docs/a.mdx"), CONFIRMED, "标记上写上了记录");
    assert.match(p.read("docs/b.mdx"), CONFIRMED);

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
    const gone = '{/* ref file="src/nowhere.ts" lines="1-2" */}';
    writeFileSync(join(p.root, "docs", "a.mdx"), `# md\n\n${UNCONFIRMED}\n\n${gone}\n`);
    const done = await p.cli("confirm");
    assert.equal(done.code, 1);
    assert.match(done.out, /🔴 docs\/a\.mdx {2}第 5 行 src\/nowhere\.ts:1-2 {2}缺失（文件不在了），这处没动/);
    const doc = p.read("docs/a.mdx");
    assert.match(doc, CONFIRMED, "钉得住的那处照写");
    assert.ok(doc.split("\n").includes(gone), "红的那处原样留着");
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

test("render：正本里有渲染不了的东西，报红退 1、不写落点", async () => {
  const p = setupProject(withOutputs(`{ "docs/a.mdx": ["README.md"] }`));
  try {
    writeFileSync(join(p.root, "docs", "a.mdx"), `# md\n\n<Note>提示</Note>\n`);
    const rendered = await p.cli("render");
    assert.equal(rendered.code, 1);
    assert.match(rendered.out, /🔴 docs\/a\.mdx → README\.md {2}.*第 3 行有名册外组件 <Note>/);
    assert.equal(existsSync(join(p.root, "README.md")), false);
  } finally {
    p.teardown();
  }
});

test("check 只查生成正本里的名册外组件：普通页面上的组件不要机读规则", async () => {
  const p = setupProject(withOutputs(`{ "docs/a.mdx": ["README.md"] }`));
  try {
    writeFileSync(join(p.root, "docs", "b.mdx"), `# 普通页\n\n<Steps />\n`);
    writeFileSync(join(p.root, "docs", "a.mdx"), `# 正本\n\n<Steps />\n`);
    const checked = await p.cli("check");
    assert.equal(checked.code, 1);
    assert.match(checked.out, /🔴 docs\/a\.mdx {2}第 3 行 <Steps> {2}名册外组件/);
    assert.doesNotMatch(checked.out, /docs\/b\.mdx {2}第 3 行 <Steps>/, "普通页面上的组件不进名册检查");
  } finally {
    p.teardown();
  }
});

test("配置 fumadocsRoster: true 才认 fumadocs 自带的组件；components 里的规则跟它叠在一起", async () => {
  const doc = '# 正本\n\n<Note>\n  提示\n</Note>\n\n<Files>\n  <File name="a.ts" />\n</Files>\n\n<Divider />\n';
  const bare = setupProject(withOutputs(`{ "docs/a.mdx": ["README.md"] }, components: { Divider: "drop" }`));
  try {
    writeFileSync(join(bare.root, "docs", "a.mdx"), doc);
    const red = await bare.cli("check");
    assert.equal(red.code, 1);
    assert.match(red.out, /第 3 行 <Note> {2}名册外组件/);
    assert.match(red.out, /第 7 行 <Files> {2}名册外组件/);
    assert.doesNotMatch(red.out, /<Divider>/);
  } finally {
    bare.teardown();
  }
  const p = setupProject(withOutputs(`{ "docs/a.mdx": ["README.md"] }, components: { Divider: "drop" }, fumadocsRoster: true`));
  try {
    writeFileSync(join(p.root, "docs", "a.mdx"), doc);
    const rendered = await p.cli("render");
    assert.equal(rendered.code, 0, rendered.out);
    assert.match(p.read("README.md"), /^# 正本\n\n> \\\[note\] 提示\n\na\.ts\n/);
    assert.equal((await p.cli("check")).code, 0);
  } finally {
    p.teardown();
  }
});

test("has 标记：check 报错到文档与行，说清动作词只有 ref / tree", async () => {
  const p = setupProject();
  try {
    writeFileSync(join(p.root, "docs", "d.mdx"), '# d\n\n{/* has file="src/greet.ts" text="export function greet" */}\n');
    await assert.rejects(p.cli("check"), /docs\/d\.mdx 第 3 行：标记的动作词只有 ref \/ tree，不认识 has/);
  } finally {
    p.teardown();
  }
});

test("目录树与整文件一篇文档：两种标记各自认得回来；多了文件黄", async () => {
  const p = setupProject();
  try {
    writeFileSync(join(p.root, "docs", "d.mdx"), '# d\n\n{/* tree dir="src" */}\n\n{/* ref file="src/greet.ts" */}\n');
    const done = await p.cli("confirm");
    assert.equal(done.code, 0, done.out);
    assert.match(done.out, /✅ docs\/d\.mdx {2}tree src depth=1 {2}已确认/);
    assert.match(done.out, /✅ docs\/d\.mdx {2}src\/greet\.ts:all {2}已确认/);
    const doc = p.read("docs/d.mdx");
    assert.match(doc, /^\{\/\* tree dir="src" depth="1" hash="[0-9a-f]{12}" \*\/\}$/m);
    assert.match(doc, /^\{\/\* ref file="src\/greet\.ts" hash="[0-9a-f]{12}" blob="[0-9a-f]{12}" \*\/\}$/m);

    const green = await p.cli("check");
    assert.match(green.out, /🟢 docs\/d\.mdx {2}tree src depth=1 {2}新鲜（1 项）/);

    writeFileSync(join(p.root, "src", "tag.ts"), "export const t = 1;\n");
    const after = await p.cli("check");
    assert.equal(after.code, 1);
    assert.match(after.out, /🔴 docs\/d\.mdx {2}tree src depth=1 {2}有变动，是本仓还没提交的改动引起的（2 项）/, "多出来的文件还没提交，这个黄算红");
  } finally {
    p.teardown();
  }
});

test("讲解组件的源码也是现状区：页面同名文件夹里与内容根下 _components/ 里的块注释标记一样核对与确认", async () => {
  const p = setupProject();
  try {
    const pageDir = join(p.root, "docs", "x");
    const sharedDir = join(p.root, "docs", "_components", "y");
    mkdirSync(pageDir, { recursive: true });
    mkdirSync(sharedDir, { recursive: true });
    writeFileSync(join(pageDir, "x.data.mjs"), '/* ref file="src/greet.ts" lines="2-3" */\nexport const code = "greet";\n');
    writeFileSync(join(pageDir, "x.css"), '/* ref file="src/greet.ts" lines="2-3" */\n.x { color: red; }\n');
    writeFileSync(join(sharedDir, "y.tsx"), '/* ref file="src/greet.ts" lines="2-3" */\nexport const Y = () => null;\n');
    const first = await p.cli("check");
    assert.match(first.out, /⚪ docs\/x\/x\.data\.mjs {2}src\/greet\.ts:2-3 {2}未确认/);
    assert.match(first.out, /⚪ docs\/_components\/y\/y\.tsx {2}src\/greet\.ts:2-3 {2}未确认/);
    const report = JSON.parse((await p.cli("check", "--json")).out) as { docs: Array<{ doc: string }> };
    assert.equal(report.docs.some((d) => d.doc === "docs/x/x.data.mjs"), true);
    assert.equal(report.docs.some((d) => d.doc === "docs/x/x.css"), false, "没有哪种代码格式认领 .css：不进现状区");
    await p.cli("confirm", "docs/x/x.data.mjs");
    assert.match(p.read("docs/x/x.data.mjs"), /^\/\* ref file="src\/greet\.ts" lines="2-3" hash="[0-9a-f]{12}" blob="[0-9a-f]{12}" \*\/$/m);
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

test("不认识的开关、不收路径的命令带了路径，都退 2、什么都不动——confirm 不把开关当没写、跑成全部页", async () => {
  const p = setupProject();
  try {
    const before = p.read("docs/a.mdx");
    for (const args of [["confirm", "--dry-run"], ["confirm", "--json"], ["confirm", "docs/a.mdx", "--acept"], ["render", "--force"], ["check", "--jsno"], ["check", "--accept"], ["trajectory", "-x"], ["check", "docs/a.mdx"], ["render", "docs/a.mdx"]]) {
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
    assert.ok(p.read("docs/b.mdx").split("\n").includes(UNCONFIRMED), "没点名的页标记还没有记录");

    // 反斜杠、`./` 开头、绝对路径都收
    const again = await p.cli("confirm", `.\\docs\\b.mdx`);
    assert.equal(again.code, 0, again.out);
    assert.match(again.out, /✅ docs\/b\.mdx/);
    assert.equal((await p.cli("check")).code, 0);
    assert.equal((await p.cli("confirm", join(p.root, "docs", "a.mdx"))).code, 0);
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
