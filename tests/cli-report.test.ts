/**
 * 扫哪些文档、报告长什么样：docs 给数组时几个目录一起扫、配了 trajectory 顺带跑卡校验、
 * `check --json` 那份机读报告。台子在 cli-project.ts。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CONFIG, setupProject, withTrajectory } from "./cli-project.ts";
import { CODE, run } from "./repo.ts";

interface JsonReport {
  ok: boolean;
  red: number;
  docs: Array<{
    doc: string;
    red: number;
    items: Array<{ target: string; kind: string; status: string; line: number; lines: [number, number]; draft: boolean; reason?: string; diff?: string; blocking?: true }>;
    components: Array<{ name: string; line: number }>;
    outputs: Array<{ to: string; status: string; fresh: boolean }>;
  }>;
  trajectory: Array<{ path: string; field: string; value: string; reason: string }>;
}

test("配了 trajectory 的项目：check 顺带跑卡校验，病卡退 1 且输出含 🔴", async () => {
  const p = setupProject(withTrajectory());
  try {
    mkdirSync(join(p.root, "trajectory"));
    writeFileSync(
      join(p.root, "trajectory", "2026-01-01-bad.md"),
      ["---", "born-at: 一月一号", "type: root", "label: 坏卡", "---", "", "正文。", ""].join("\n"),
    );
    const red = await p.cli("check");
    assert.equal(red.code, 1);
    assert.match(red.out, /🔴 trajectory\/2026-01-01-bad\.md {2}born-at：/);
  } finally {
    p.teardown();
  }
});

test("配了 trajectory 但目录还不存在：check 退 0、一条红都不打——「这里还没有轨迹记录」是合法状态", async () => {
  const p = setupProject(withTrajectory());
  try {
    const green = await p.cli("check");
    assert.equal(green.code, 0, green.out);
    assert.doesNotMatch(green.out, /🔴/, "没配和配了但目录没建是两件事，后者扫出来是空集合");
  } finally {
    p.teardown();
  }
});

test("配了 trajectory 的项目：合法根卡加子卡，trajectory --json 出的 JSON 里 disks 有一张盘", async () => {
  const p = setupProject(withTrajectory());
  try {
    mkdirSync(join(p.root, "trajectory"));
    writeFileSync(
      join(p.root, "trajectory", "2026-01-01-root.md"),
      ["---", "born-at: 2026-01-01T08:00", "type: root", "label: 测试项目", "---", ""].join("\n"),
    );
    writeFileSync(
      join(p.root, "trajectory", "2026-01-02-child.md"),
      ["---", "born-at: 2026-01-02T08:00", "parent: [2026-01-01-root]", "label: 子卡", "---", ""].join("\n"),
    );
    const result = await p.cli("trajectory", "--json");
    assert.equal(result.code, 0, result.out);
    const data = JSON.parse(result.out) as { disks: unknown[] };
    assert.equal(data.disks.length, 1);
  } finally {
    p.teardown();
  }
});

test("docs 给数组：几个目录一起扫，报告按文档身份排序；目录套目录同一篇只算一次", async () => {
  const p = setupProject(CONFIG.replace(`docs: "docs"`, `docs: ["docs", "more", "more/deep"]`));
  try {
    mkdirSync(join(p.root, "more", "deep"), { recursive: true });
    writeFileSync(join(p.root, "more", "x.md"), "# x\n\n@@docfirst ref src/greet.ts:2-3 @@\n");
    writeFileSync(join(p.root, "more", "deep", "y.md"), "# y\n\n@@docfirst ref src/greet.ts:2-3 @@\n");
    const first = await p.cli("check", "--json");
    assert.equal(first.code, 0, first.out);
    const report = JSON.parse(first.out) as { docs: Array<{ doc: string }> };
    assert.deepEqual(
      report.docs.map((d) => d.doc),
      ["docs/a.md", "docs/b.html", "more/deep/y.md", "more/x.md"],
    );
  } finally {
    p.teardown();
  }
});

test("docs 配成空数组或空串：装配时拒", async () => {
  for (const bad of [`docs: []`, `docs: ""`, `docs: ["docs", ""]`]) {
    const p = setupProject(CONFIG.replace(`docs: "docs"`, bad));
    try {
      await assert.rejects(p.cli("check"), /docs 得是一个非空目录/);
    } finally {
      p.teardown();
    }
  }
});

test("check --json：整份报告一行 JSON，退出码跟人读模式一样；四态、行号、outputs 新鲜度、病卡都在", async () => {
  const p = setupProject(
    CONFIG.replace(`docs: "docs", out: "out" };`, `docs: "docs", out: "out", outputs: { "docs/a.md": ["README.md"] }, trajectory: "trajectory" };`),
  );
  try {
    const white = await p.cli("check", "--json");
    assert.equal(white.code, 1, "outputs 还没摆是红，退出码跟人读模式一样");
    assert.equal(white.out.split("\n").length, 1, "一行 JSON，别的什么都不打");
    const first = JSON.parse(white.out) as JsonReport;
    // outputs 还没摆：红，ok 假；引用本身是未确认
    assert.equal(first.ok, false);
    assert.equal(first.red, 1);
    const a = first.docs.find((d) => d.doc === "docs/a.md")!;
    assert.deepEqual(a.items, [{ target: "src/greet.ts:2-3", kind: "span", status: "unconfirmed", line: 3, lines: [2, 3], draft: true }]);
    assert.deepEqual(a.outputs, [{ to: "README.md", status: "missing", fresh: false }]);
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
    mkdirSync(join(p.root, "trajectory"));
    writeFileSync(join(p.root, "trajectory", "2026-01-01-bad.mdx"), ["---", "born-at: 一月一号", "type: root", "label: 坏卡", "---", ""].join("\n"));
    const red = await p.cli("check", "--json");
    assert.equal(red.code, 1);
    const last = JSON.parse(red.out) as JsonReport;
    assert.deepEqual(last.docs.map((d) => d.doc), ["docs/a.md"]);
    assert.deepEqual(last.docs[0]!.outputs, [{ to: "README.md", status: "stale", fresh: false }]);
    assert.equal(last.trajectory.length, 1);
    assert.equal(last.trajectory[0]!.path, "trajectory/2026-01-01-bad.mdx");
    assert.equal(last.trajectory[0]!.field, "born-at");
    assert.equal(last.red, last.docs.reduce((n, d) => n + d.red, 0) + last.trajectory.length);
  } finally {
    p.teardown();
  }
});
