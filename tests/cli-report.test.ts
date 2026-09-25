/**
 * 扫哪些文档、报告长什么样：内容根下除 trajectory/、future/ 之外都进 check、轨迹卡目录顺带跑卡校验、
 * 配置里不认识的键报错、`check --json` 那份机读报告。台子在 cli-project.ts（内容根是 docs/）。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CONFIG, setupProject, withKeys, withOutputs } from "./cli-project.ts";
import { CODE, run } from "./repo.ts";

interface JsonReport {
  ok: boolean;
  red: number;
  docs: Array<{
    doc: string;
    red: number;
    items: Array<{ target: string; kind: string; status: string; line: number; lines: [number, number]; draft: boolean; reason?: string; diff?: string; blocking?: true }>;
    components: Array<{ name: string; line: number }>;
    outputs: Array<{ to: string; status: string; fresh: boolean; reason?: string }>;
  }>;
  trajectory: Array<{ path: string; field: string; value: string; reason: string }>;
}

/** 内容根下轨迹卡目录里写一张卡 */
function card(root: string, name: string, lines: string[]): void {
  mkdirSync(join(root, "docs", "trajectory"), { recursive: true });
  writeFileSync(join(root, "docs", "trajectory", name), lines.join("\n"));
}

test("内容根下的 trajectory/：check 顺带跑卡校验，病卡退 1 且输出含 🔴；卡本身不当文档核对", async () => {
  const p = setupProject();
  try {
    card(p.root, "2026-01-01-bad.md", ["---", "born-at: 一月一号", "type: root", "label: 坏卡", "---", "", "@@docfirst ref src/greet.ts:2-3 @@", ""]);
    const red = await p.cli("check");
    assert.equal(red.code, 1);
    assert.match(red.out, /🔴 docs\/trajectory\/2026-01-01-bad\.md {2}born-at：/);
    assert.doesNotMatch(red.out, /⚪ docs\/trajectory/, "轨迹卡不进现状区的核对");
  } finally {
    p.teardown();
  }
});

test("轨迹卡目录还没建：check 退 0、一条红都不打——「这里还没有轨迹记录」是合法状态；trajectory 子命令退 2", async () => {
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

test("合法根卡加子卡：trajectory --json 出的 JSON 里 disks 有一张盘", async () => {
  const p = setupProject();
  try {
    card(p.root, "2026-01-01-root.md", ["---", "born-at: 2026-01-01T08:00", "type: root", "label: 测试项目", "---", ""]);
    card(p.root, "2026-01-02-child.md", ["---", "born-at: 2026-01-02T08:00", "parent: [2026-01-01-root]", "label: 子卡", "---", ""]);
    const result = await p.cli("trajectory", "--json");
    assert.equal(result.code, 0, result.out);
    const data = JSON.parse(result.out) as { disks: unknown[] };
    assert.equal(data.disks.length, 1);
  } finally {
    p.teardown();
  }
});

test("分区按约定：内容根下除 trajectory/、future/ 之外都是现状区，目录里的、根上的都扫，按文档身份排序", async () => {
  const p = setupProject();
  try {
    const draft = "# x\n\n@@docfirst ref src/greet.ts:2-3 @@\n";
    for (const rel of ["more/x.md", "more/deep/y.md", "future/roadmap.md", "future/spec/plan.md", "trajectory/2026-01-01-x.md"]) {
      mkdirSync(join(p.root, "docs", rel, ".."), { recursive: true });
      writeFileSync(join(p.root, "docs", rel), draft);
    }
    const first = await p.cli("check", "--json");
    const report = JSON.parse(first.out) as { docs: Array<{ doc: string }> };
    assert.deepEqual(
      report.docs.map((d) => d.doc),
      ["docs/a.md", "docs/b.html", "docs/more/deep/y.md", "docs/more/x.md"],
    );
  } finally {
    p.teardown();
  }
});

test("配置里不认识的键报错：删掉的旧键说清该怎么改，别的键列出认得的有哪些；一次列全", async () => {
  const p = setupProject(withKeys(`docs: ["docs"], trajectory: "t", comparator: "git", ledger: ".ledger.json", fumadocs: {}, docz: 1`));
  try {
    await assert.rejects(p.cli("check"), (err: Error) => {
      for (const piece of [
        "有 6 处要改",
        "删掉 docs：现状区按约定是内容根下除 trajectory/、future/ 之外的全部",
        "删掉 trajectory：轨迹卡目录固定是内容根下的 trajectory/",
        "删掉 comparator",
        "删掉 ledger：记录写在各记号上；旧记录簿先在项目根跑 docfirst migrate-ledger",
        "删掉 fumadocs",
        "不认识的键 docz：配置只认 formats / content / out / components / outputs",
      ]) {
        assert.ok(err.message.includes(piece), `报错里该有「${piece}」：${err.message}`);
      }
      return true;
    });
  } finally {
    p.teardown();
  }
});

test("content 写错、内容根不在：装配时拒", async () => {
  for (const [config, message] of [
    [CONFIG.replace(`content: "docs"`, `content: ""`), /content 要是一个非空目录/],
    [CONFIG.replace(`content: "docs"`, `content: "nope"`), /内容根 nope 不是项目根下的目录/],
  ] as const) {
    const p = setupProject(config);
    try {
      await assert.rejects(p.cli("check"), message);
    } finally {
      p.teardown();
    }
  }
});

test("check --json：整份报告一行 JSON，退出码跟人读模式一样；四态、行号、outputs 新鲜度、病卡都在", async () => {
  const p = setupProject(withOutputs(`{ "docs/a.md": ["README.md"] }`));
  try {
    const white = await p.cli("check", "--json");
    assert.equal(white.code, 1, "正本还有草稿记号、渲染不了，落点是红，退出码跟人读模式一样");
    assert.equal(white.out.split("\n").length, 1, "一行 JSON，别的什么都不打");
    const first = JSON.parse(white.out) as JsonReport;
    // 草稿记号渲染不了：落点红，ok 假；引用本身是未确认
    assert.equal(first.ok, false);
    assert.equal(first.red, 1);
    const a = first.docs.find((d) => d.doc === "docs/a.md")!;
    assert.deepEqual(a.items, [{ target: "src/greet.ts:2-3", kind: "span", status: "unconfirmed", line: 3, lines: [2, 3], draft: true }]);
    assert.deepEqual(a.outputs, [{ to: "README.md", status: "unrenderable", fresh: false, reason: "第 3 行是草稿记号，先 docfirst confirm" }]);
    assert.deepEqual(first.trajectory, []);

    await p.cli("confirm");
    const green = JSON.parse((await p.cli("check", "--json")).out) as JsonReport;
    assert.equal(green.ok, true);
    assert.equal(green.red, 0);
    assert.equal(green.docs.find((d) => d.doc === "docs/a.md")!.items[0]!.status, "fresh");
    assert.deepEqual(green.docs.find((d) => d.doc === "docs/a.md")!.outputs, [{ to: "README.md", status: "fresh", fresh: true }]);

    // 代码改了：引用报黄、带 diff。假格式的投影是**渲染那一刻现取的**，所以生成物当场跟源不一致
    // ——outputs 转 stale，整趟因此退 1。黄本身不是红：红的是那个没重摆的落点
    writeFileSync(join(p.root, "src", "greet.ts"), CODE.replace("hello", "hey"));
    run(p.root, ["commit", "-qam", "改问候语"]);
    const yellow = await p.cli("check", "--json");
    const changed = JSON.parse(yellow.out) as JsonReport;
    const item = changed.docs.find((d) => d.doc === "docs/a.md")!.items[0]!;
    assert.equal(item.status, "changed");
    assert.match(item.diff ?? "", /hey/);
    assert.equal(changed.docs.find((d) => d.doc === "docs/a.md")!.outputs[0]!.status, "stale");
    assert.equal(yellow.code, 1);
    await p.cli("render");
    assert.equal((await p.cli("check", "--json")).code, 0, "重摆之后只剩那处黄，退 0");

    // 源改了没重摆 → 生成物 stale；病卡 → trajectory
    writeFileSync(join(p.root, "docs", "a.md"), "# md\n\n没有引用了\n");
    rmSync(join(p.root, "docs", "b.html"));
    card(p.root, "2026-01-01-bad.mdx", ["---", "born-at: 一月一号", "type: root", "label: 坏卡", "---", ""]);
    const red = await p.cli("check", "--json");
    assert.equal(red.code, 1);
    const last = JSON.parse(red.out) as JsonReport;
    assert.deepEqual(last.docs.map((d) => d.doc), ["docs/a.md"]);
    assert.deepEqual(last.docs[0]!.outputs, [{ to: "README.md", status: "stale", fresh: false }]);
    assert.equal(last.trajectory.length, 1);
    assert.equal(last.trajectory[0]!.path, "docs/trajectory/2026-01-01-bad.mdx");
    assert.equal(last.trajectory[0]!.field, "born-at");
    assert.equal(last.red, last.docs.reduce((n, d) => n + d.red, 0) + last.trajectory.length);
  } finally {
    p.teardown();
  }
});
