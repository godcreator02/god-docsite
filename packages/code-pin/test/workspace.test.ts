/**
 * 给命令行用的那一层：读盘、核对、确认写回；以及「这处黄是不是本仓未提交的改动引起的」探针。
 */
import { test } from "vitest";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createRequire, syncBuiltinESMExports } from "node:module";
import { tmpdir } from "node:os";
import { join, relative, sep } from "node:path";
import type { Target } from "../src/core/index.ts";
import { createPinWorkspace, createUncommittedProbe } from "../src/node/index.ts";
import { CODE, refLine, run, SETTINGS, setupRepo } from "./repo.ts";

const DOC = "docs/a.mdx";
const SPAN: Target = { kind: "span", file: "src/greet.ts", a: 2, b: 3 };

test("工作区：check 只读不写；confirm 有改动才写回文档", () => {
  const r = setupRepo();
  try {
    r.write(DOC, `# a\n\n${refLine(SPAN)}\n`);
    const workspace = createPinWorkspace(r.root);
    assert.deepEqual(workspace.check(DOC).checks.map((c) => c.status), ["unconfirmed"]);
    assert.equal(r.read(DOC), `# a\n\n${refLine(SPAN)}\n`, "check 不写");
    const done = workspace.confirm(DOC, { accept: false });
    assert.equal(done.changed, true);
    assert.equal(r.read(DOC), done.text, "confirm 写回了");
    assert.deepEqual(workspace.check(DOC).checks.map((c) => c.status), ["fresh"]);
    assert.equal(workspace.confirm(DOC, { accept: false }).changed, false);
  } finally {
    r.teardown();
  }
});

/** 数这一段里起了几次 git status */
function statusCalls<T>(fn: () => T): { value: T; calls: number } {
  const cp = createRequire(import.meta.url)("node:child_process") as typeof import("node:child_process");
  const orig = cp.execFileSync;
  let calls = 0;
  cp.execFileSync = ((file: string, args: string[], opts: object) => {
    if (file === "git" && args.includes("status")) calls += 1;
    return orig(file, args, opts);
  }) as typeof cp.execFileSync;
  syncBuiltinESMExports();
  try {
    return { value: fn(), calls };
  } finally {
    cp.execFileSync = orig;
    syncBuiltinESMExports();
  }
}

test("未提交改动探针：被钉文件改了没提交、只暂存了都算；提交之后不算", () => {
  const r = setupRepo();
  try {
    r.write(DOC, "# a\n");
    r.commit("文档");
    assert.equal(createUncommittedProbe(r.root)(DOC, SPAN), false);
    r.write("src/greet.ts", CODE.replace("hello", "hey"));
    assert.equal(createUncommittedProbe(r.root)(DOC, SPAN), true);
    run(r.root, [...SETTINGS, "add", "src/greet.ts"]);
    assert.equal(createUncommittedProbe(r.root)(DOC, SPAN), true, "只暂存了也算没提交");
    r.commit("改问候语");
    assert.equal(createUncommittedProbe(r.root)(DOC, SPAN), false);
  } finally {
    r.teardown();
  }
});

test("未提交改动探针：目录树里多了未跟踪的文件算；被钉文件在别的仓里不算", () => {
  const r = setupRepo();
  const other = mkdtempSync(join(tmpdir(), "code-pin-other-"));
  try {
    r.write(DOC, "# a\n");
    r.commit("文档");
    r.write("src/new.ts", "export const n = 1;\n");
    assert.equal(createUncommittedProbe(r.root)(DOC, { kind: "tree", dir: "src", depth: 1 }), true);

    run(other, ["init", "-q", "-b", "main"]);
    mkdirSync(join(other, "src"));
    writeFileSync(join(other, "src", "lib.ts"), CODE);
    run(other, [...SETTINGS, "add", "-A"]);
    run(other, [...SETTINGS, "commit", "-qm", "起代码"]);
    writeFileSync(join(other, "src", "lib.ts"), CODE.replace("hello", "hey"));
    const rel = relative(r.root, join(other, "src", "lib.ts")).split(sep).join("/");
    assert.equal(createUncommittedProbe(r.root)(DOC, { kind: "span", file: rel, a: 2, b: 3 }), false, "别的仓的改动不拦这个仓");
  } finally {
    r.teardown();
    rmSync(other, { recursive: true, force: true, maxRetries: 5 });
  }
});

test("未提交改动探针：一个探针里每个仓只问一次 git status", () => {
  const r = setupRepo();
  try {
    r.write("src/more.ts", CODE);
    r.write(DOC, "# a\n");
    r.commit("文档");
    r.write("src/greet.ts", CODE.replace("hello", "hey"));
    r.write("src/more.ts", CODE.replace("hello", "hey"));
    const probe = createUncommittedProbe(r.root);
    const { value, calls } = statusCalls(() => [probe(DOC, SPAN), probe(DOC, { ...SPAN, file: "src/more.ts" }), probe(DOC, SPAN)]);
    assert.deepEqual(value, [true, true, true]);
    assert.equal(calls, 1);
  } finally {
    r.teardown();
  }
});
