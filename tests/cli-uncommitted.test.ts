/**
 * check 拦本仓未提交改动引起的黄灯：被钉文件跟文档在同一个 git 仓里、在 `git status --porcelain` 里出现
 * （改了、暂存了、未跟踪），这个黄算红；已经提交的改动引起的黄、被钉文件在别的仓里的黄只报告。
 * 每个仓一次 check 只问一次 status。台子在 cli-project.ts。
 */
import { test } from "vitest";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createRequire, syncBuiltinESMExports } from "node:module";
import { tmpdir } from "node:os";
import { join, relative, sep } from "node:path";
import { setupProject } from "./cli-project.ts";
import { CODE, run, SETTINGS } from "./repo.ts";

interface Item {
  target: string;
  status: string;
  blocking?: true;
}
const itemsOf = (out: string, doc: string): Item[] =>
  (JSON.parse(out) as { docs: Array<{ doc: string; items: Item[] }> }).docs.find((d) => d.doc === doc)!.items;

/** 数这一段里起了几次 git status：换掉 child_process 的 execFileSync，源码里的具名导入经 syncBuiltinESMExports 跟着换 */
async function statusCalls<T>(fn: () => Promise<T>): Promise<{ value: T; calls: number }> {
  const cp = createRequire(import.meta.url)("node:child_process") as typeof import("node:child_process");
  const orig = cp.execFileSync;
  let calls = 0;
  cp.execFileSync = ((file: string, args: string[], opts: object) => {
    if (file === "git" && args.includes("status")) calls += 1;
    return orig(file, args, opts);
  }) as typeof cp.execFileSync;
  syncBuiltinESMExports();
  try {
    return { value: await fn(), calls };
  } finally {
    cp.execFileSync = orig;
    syncBuiltinESMExports();
  }
}

test("被钉文件改了没提交：这个黄算红、退 1，提示同一个提交里 --accept；提交之后只报黄", async () => {
  const p = setupProject();
  try {
    await p.cli("confirm");
    run(p.root, [...SETTINGS, "commit", "-qam", "确认"]);
    writeFileSync(join(p.root, "src", "greet.ts"), CODE.replace("hello", "hey"));

    const red = await p.cli("check");
    assert.equal(red.code, 1);
    assert.match(red.out, /🔴 docs\/a\.mdx {2}src\/greet\.ts:2-3 {2}有变动，是本仓还没提交的改动引起的——在同一个提交里复核，再 docfirst confirm docs\/a\.mdx --accept/);
    const json = await p.cli("check", "--json");
    assert.equal(json.code, 1);
    assert.deepEqual(itemsOf(json.out, "docs/a.mdx").map((i) => [i.status, i.blocking]), [["changed", true]]);

    run(p.root, [...SETTINGS, "add", "src/greet.ts"]);
    assert.equal((await p.cli("check")).code, 1, "只暂存了也算没提交");

    run(p.root, [...SETTINGS, "commit", "-qm", "改问候语"]);
    const yellow = await p.cli("check", "--json");
    assert.equal(yellow.code, 0, "已经提交的改动引起的黄只报告");
    assert.deepEqual(itemsOf(yellow.out, "docs/a.mdx").map((i) => [i.status, i.blocking]), [["changed", undefined]]);
  } finally {
    p.teardown();
  }
});

test("目录树里多了未跟踪的文件：这个黄算红", async () => {
  const p = setupProject();
  try {
    writeFileSync(join(p.root, "docs", "t.mdx"), '# t\n\n{/* tree dir="src" */}\n');
    await p.cli("confirm");
    run(p.root, [...SETTINGS, "add", "-A"]);
    run(p.root, [...SETTINGS, "commit", "-qm", "确认"]);
    writeFileSync(join(p.root, "src", "new.ts"), "export const n = 1;\n");
    const out = await p.cli("check", "--json");
    assert.equal(out.code, 1);
    assert.deepEqual(itemsOf(out.out, "docs/t.mdx").map((i) => [i.status, i.blocking]), [["changed", true]]);
  } finally {
    p.teardown();
  }
});

test("被钉文件在别的仓里：改了没提交也只报黄，不拦这个仓的提交", async () => {
  const p = setupProject();
  const other = mkdtempSync(join(tmpdir(), "god-live-doc-other-"));
  try {
    run(other, ["init", "-q", "-b", "main"]);
    mkdirSync(join(other, "src"));
    writeFileSync(join(other, "src", "lib.ts"), CODE);
    run(other, [...SETTINGS, "add", "-A"]);
    run(other, [...SETTINGS, "commit", "-qm", "起代码"]);
    const rel = relative(p.root, join(other, "src", "lib.ts")).split(sep).join("/");
    writeFileSync(join(p.root, "docs", "x.mdx"), `# x\n\n{/* ref file="${rel}" lines="2-3" */}\n`);
    await p.cli("confirm");
    writeFileSync(join(other, "src", "lib.ts"), CODE.replace("hello", "hey"));
    const out = await p.cli("check", "--json");
    assert.equal(out.code, 0, out.out);
    assert.deepEqual(itemsOf(out.out, "docs/x.mdx").map((i) => [i.status, i.blocking]), [["changed", undefined]]);
  } finally {
    p.teardown();
    rmSync(other, { recursive: true, force: true, maxRetries: 5 });
  }
});

test("一次 check 里每个仓只问一次 git status", async () => {
  const p = setupProject();
  try {
    writeFileSync(join(p.root, "src", "more.ts"), CODE);
    writeFileSync(join(p.root, "docs", "c.mdx"), '# c\n\n{/* ref file="src/more.ts" lines="2-3" */}\n');
    await p.cli("confirm");
    run(p.root, [...SETTINGS, "add", "-A"]);
    run(p.root, [...SETTINGS, "commit", "-qm", "确认"]);
    writeFileSync(join(p.root, "src", "greet.ts"), CODE.replace("hello", "hey"));
    writeFileSync(join(p.root, "src", "more.ts"), CODE.replace("hello", "hey"));
    const { value, calls } = await statusCalls(() => p.cli("check"));
    assert.equal(value.code, 1);
    assert.equal(calls, 1, "三处黄灯、两个文件、一个仓：一次 status");
  } finally {
    p.teardown();
  }
});
