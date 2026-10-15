/**
 * 检查哪些文档、报告长什么样：内容根下除 trajectory/、future/ 之外都进 check、轨迹卡目录顺带做卡校验、
 * trajectory 子命令、`check --json` 那份机读报告。测试用的项目在 cli-project.ts 里搭建（内容根是 docs/）。
 */
import { test } from "vitest";
import assert from "node:assert/strict";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { setupProject, withKeys, withOutputs } from "./cli-project.ts";
import { CODE, run } from "./repo.ts";

interface JsonReport {
  ok: boolean;
  red: number;
  docs: Array<{
    doc: string;
    red: number;
    items: Array<{ target: string; kind: string; status: string; line: number; lines: [number, number]; reason?: string; diff?: string; blocking?: true }>;
    components: Array<{ name: string; line: number }>;
    outputs: Array<{ to: string; status: string; fresh: boolean; reason?: string }>;
  }>;
  trajectory: Array<{ path: string; field: string; value: string; reason: string }>;
}

/** 轨迹卡目录（相对项目根）里写一张卡 */
function card(root: string, name: string, lines: string[], dir = "docs/trajectory"): void {
  mkdirSync(join(root, dir), { recursive: true });
  writeFileSync(join(root, dir, name), lines.join("\n"));
}

test("内容根下的 trajectory/：check 顺带做卡校验，有病卡时退出码 1 且输出含 🔴；卡本身不当文档核对", async () => {
  const p = setupProject();
  try {
    card(p.root, "2026-01-01-bad.md", ["---", "born-at: 一月一号", "type: root", "label: 坏卡", "---", "", "@@docfirst ref src/greet.ts:2-3 @@", ""]);
    const red = await p.cli("check");
    assert.equal(red.code, 1);
    assert.match(red.out, /🔴 docs\/trajectory\/2026-01-01-bad\.md {2}born-at：/);
    assert.match(red.out, /🔴 docs\/trajectory\/2026-01-01-bad\.md {2}docfirst：/, "卡正文里的草稿写法也是病");
    assert.doesNotMatch(red.out, /⚪ docs\/trajectory/, "轨迹卡不进现状区的核对");
  } finally {
    p.teardown();
  }
});

test("轨迹卡目录还没建：check 退出码 0、一条红都不打印；trajectory 子命令退出码 2", async () => {
  const p = setupProject();
  try {
    const green = await p.cli("check");
    assert.equal(green.code, 0, green.out);
    assert.doesNotMatch(green.out, /🔴/);
    assert.equal((await p.cli("trajectory")).code, 2);
  } finally {
    p.teardown();
  }
});

test("配置了 trajectory 目录：check 与 trajectory 都读那个目录；目录还没建时报错里写的是配置的目录", async () => {
  const p = setupProject(withKeys(`trajectory: "cards"`));
  const said: string[] = [];
  const error = console.error;
  console.error = (...args: unknown[]) => void said.push(args.join(" "));
  try {
    assert.equal((await p.cli("trajectory")).code, 2);
    assert.match(said.join("\n"), /这个项目还没有轨迹卡目录 cards（/);
    assert.doesNotMatch(said.join("\n"), /docs\/trajectory/);

    card(p.root, "2026-01-01-root.md", ["---", "born-at: 2026-01-01T08:00", "type: root", "label: 测试项目", "---", ""], "cards");
    card(p.root, "2026-01-02-bad.md", ["---", "born-at: 一月二号", "parent: [2026-01-01-root]", "label: 坏卡", "---", ""], "cards");
    assert.match((await p.cli("trajectory")).out, /^盘 测试项目（2026-01-01-root） {2}0 张卡$/m);
    const red = await p.cli("check");
    assert.equal(red.code, 1);
    assert.match(red.out, /🔴 cards\/2026-01-02-bad\.md {2}born-at：/);
  } finally {
    console.error = error;
    p.teardown();
  }
});

test("合法根卡加子卡：trajectory --json 输出那一张盘的输入（盘心、卡、病卡）与树，不带 --json 打印根卡与卡数", async () => {
  const p = setupProject();
  try {
    card(p.root, "2026-01-01-root.md", ["---", "born-at: 2026-01-01T08:00", "type: root", "label: 测试项目", "---", ""]);
    card(p.root, "2026-01-02-child.md", ["---", "born-at: 2026-01-02T08:00", "parent: [2026-01-01-root]", "label: 子卡", "---", ""]);
    const result = await p.cli("trajectory", "--json");
    assert.equal(result.code, 0, result.out);
    const data = JSON.parse(result.out) as { center: { id: string } | null; cards: Array<{ id: string }>; sick: unknown[]; trees: unknown[] };
    assert.equal(data.center?.id, "2026-01-01-root");
    assert.deepEqual(data.cards.map((c) => c.id), ["2026-01-02-child"]);
    assert.deepEqual(data.sick, []);
    assert.deepEqual(data.trees, [], "一张卡没有关系：没有树");
    const text = await p.cli("trajectory");
    assert.equal(text.code, 0, text.out);
    assert.match(text.out, /^盘 测试项目（2026-01-01-root） {2}1 张卡$/m);
  } finally {
    p.teardown();
  }
});

test("分区按约定：内容根下除 trajectory/、future/ 之外都是现状区，目录里的、根上的都检查，按文档身份排序", async () => {
  const p = setupProject();
  try {
    const unconfirmed = '# x\n\n{/* ref file="src/greet.ts" lines="2-3" */}\n';
    for (const rel of ["more/x.mdx", "more/deep/y.mdx", "future/roadmap.mdx", "future/spec/plan.mdx", "trajectory/2026-01-01-x.md"]) {
      mkdirSync(join(p.root, "docs", rel, ".."), { recursive: true });
      writeFileSync(join(p.root, "docs", rel), unconfirmed);
    }
    const first = await p.cli("check", "--json");
    const report = JSON.parse(first.out) as { docs: Array<{ doc: string }> };
    assert.deepEqual(
      report.docs.map((d) => d.doc),
      ["docs/a.mdx", "docs/b.mdx", "docs/more/deep/y.mdx", "docs/more/x.mdx"],
    );
  } finally {
    p.teardown();
  }
});

test("check --json：整份报告一行 JSON，退出码跟人读模式一样；四态、行号、生成物新鲜度、病卡都在", async () => {
  const p = setupProject(withOutputs(`{ "docs/a.mdx": ["README.md"] }`));
  try {
    const white = await p.cli("check", "--json");
    assert.equal(white.code, 1, "生成物还没生成过，落点是红，退出码跟人读模式一样");
    assert.equal(white.out.split("\n").length, 1, "一行 JSON，别的什么都不打印");
    const first = JSON.parse(white.out) as JsonReport;
    // 正本里的钉还没确认，生成物渲染不了：落点红，ok 假；钉本身是未确认，不算红
    assert.equal(first.ok, false);
    assert.equal(first.red, 1);
    const a = first.docs.find((d) => d.doc === "docs/a.mdx")!;
    assert.deepEqual(a.items, [{ target: "src/greet.ts:2-3", kind: "span", status: "unconfirmed", line: 3, lines: [2, 3] }]);
    assert.deepEqual(a.outputs, [{ to: "README.md", status: "unrenderable", fresh: false, reason: "第 3 行的钉还没确认，先确认再生成" }]);
    assert.deepEqual(first.trajectory, []);

    await p.cli("confirm");
    const green = JSON.parse((await p.cli("check", "--json")).out) as JsonReport;
    assert.equal(green.ok, true);
    assert.equal(green.red, 0);
    assert.equal(green.docs.find((d) => d.doc === "docs/a.mdx")!.items[0]!.status, "fresh");
    assert.deepEqual(green.docs.find((d) => d.doc === "docs/a.mdx")!.outputs, [{ to: "README.md", status: "fresh", fresh: true }]);

    // 代码改了：钉报黄、带 diff。生成物里的代码块是生成那一刻现取的，所以生成物当场跟正本不一致
    // ——outputs 转 stale，这次 check 因此退出码 1。黄本身不是红：红的是那个没重新生成的落点
    writeFileSync(join(p.root, "src", "greet.ts"), CODE.replace("hello", "hey"));
    run(p.root, ["commit", "-qam", "改问候语"]);
    const yellow = await p.cli("check", "--json");
    const changed = JSON.parse(yellow.out) as JsonReport;
    const item = changed.docs.find((d) => d.doc === "docs/a.mdx")!.items[0]!;
    assert.equal(item.status, "changed");
    assert.match(item.diff ?? "", /^- {3}return `hello \$\{name\}`;\n\+ {3}return `hey \$\{name\}`;/m);
    assert.equal(changed.docs.find((d) => d.doc === "docs/a.mdx")!.outputs[0]!.status, "stale");
    assert.equal(yellow.code, 1);
    await p.cli("render");
    assert.equal((await p.cli("check", "--json")).code, 0, "重新生成之后只剩那处黄，退出码 0");

    // 源改了没重新生成 → 生成物 stale；病卡 → trajectory
    writeFileSync(join(p.root, "docs", "a.mdx"), "# md\n\n没有引用了\n");
    rmSync(join(p.root, "docs", "b.mdx"));
    card(p.root, "2026-01-01-bad.mdx", ["---", "born-at: 一月一号", "type: root", "label: 坏卡", "---", ""]);
    const red = await p.cli("check", "--json");
    assert.equal(red.code, 1);
    const last = JSON.parse(red.out) as JsonReport;
    assert.deepEqual(last.docs.map((d) => d.doc), ["docs/a.mdx"]);
    assert.deepEqual(last.docs[0]!.outputs, [{ to: "README.md", status: "stale", fresh: false }]);
    assert.equal(last.trajectory.length, 1);
    assert.equal(last.trajectory[0]!.path, "docs/trajectory/2026-01-01-bad.mdx");
    assert.equal(last.trajectory[0]!.field, "born-at");
    assert.equal(last.red, last.docs.reduce((n, d) => n + d.red, 0) + last.trajectory.length);
  } finally {
    p.teardown();
  }
});
