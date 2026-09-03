/**
 * auto 比较器的账：记忆按被引文件的位置挑，一个项目里 git 记录和 hash 记录并存。
 *   本仓已提交 → git；被 .gitignore 忽略 → hash；不在任何仓里 → hash
 *   另一个仓 → git（跨仓：脏了照样拒、行段照样跟、diff 照样出）
 *   未跟踪没忽略 → 拒「先 commit」；仓还没提交过 → 拒
 *   软链接（pnpm 那种 node_modules → 工作区包）按真实路径算
 *   核对按记录的 kind 转发；认不得的 kind 当没确认过
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, sep } from "node:path";
import { fakeFormat } from "./fake-format.ts";
import { CODE, run, setupRepo } from "./repo.ts";

const FORMATS = [fakeFormat("fake", ".a")];
const DOC = "docs/a.a";
const posix = (p: string) => p.split(sep).join("/");
const kinds = (r: ReturnType<typeof setupRepo>) => Object.values(r.ledger.dump()[DOC] ?? {}).map((rec) => rec.kind);

test("本仓已提交走 git，被 .gitignore 忽略走 hash：同一篇里两种记录并存，各自核对", () => {
  const r = setupRepo({ formats: FORMATS, comparator: "auto" });
  try {
    r.write(".gitignore", "vendor/\n");
    r.commit("忽略 vendor");
    r.write("vendor/lib.ts", CODE);
    const text = "REF src/greet.ts:2-3\n\nREF vendor/lib.ts:2-3\n";
    const done = r.service.confirm(DOC, text);
    assert.deepEqual(done.problems, []);
    assert.deepEqual(kinds(r), ["git", "hash"]);
    assert.deepEqual(r.statuses(DOC, done.text), ["fresh", "fresh"]);

    // 忽略的那份挪了位置：hash 滑窗跟上；改了内容：位置不明
    r.write("vendor/lib.ts", `// 头一行\n${CODE}`);
    const moved = r.service.resolve(DOC, done.text).items[1]!;
    assert.equal(moved.status, "fresh");
    assert.deepEqual(moved.lines, [3, 4]);
    r.write("vendor/lib.ts", CODE.replace("hello", "hey"));
    const edited = r.service.resolve(DOC, done.text).items[1]!;
    assert.equal(edited.status, "changed");
    assert.equal(edited.reason, "unlocated");
  } finally {
    r.teardown();
  }
});

test("不在任何仓里的文件走 hash", () => {
  const r = setupRepo({ formats: FORMATS, comparator: "auto" });
  const outside = mkdtempSync(join(tmpdir(), "god-live-doc-outside-"));
  try {
    writeFileSync(join(outside, "lib.ts"), CODE);
    const rel = posix(relative(r.root, join(outside, "lib.ts")));
    const done = r.service.confirm(DOC, `REF ${rel}:2-3\n`);
    assert.deepEqual(done.problems, []);
    assert.deepEqual(kinds(r), ["hash"]);
    assert.deepEqual(r.statuses(DOC, done.text), ["fresh"]);
  } finally {
    r.teardown();
    rmSync(outside, { recursive: true, force: true, maxRetries: 5 });
  }
});

test("另一个仓里的文件走 git：记的是那个仓的 blob 和 commit；脏了拒；挪了行跟得住；改了给 diff", () => {
  const r = setupRepo({ formats: FORMATS, comparator: "auto" });
  const other = setupRepo({ formats: FORMATS });
  try {
    const rel = posix(relative(r.root, join(other.root, "src", "greet.ts")));
    const text = `REF ${rel}:2-3\n`;
    const done = r.service.confirm(DOC, text);
    assert.deepEqual(done.problems, []);
    const pinned = r.ledger.dump()[DOC]![`${rel}:2-3`] as { kind: string; commit: string };
    assert.equal(pinned.kind, "git");
    assert.equal(pinned.commit, run(other.root, ["rev-parse", "HEAD"]).trim(), "commit 是外仓的 HEAD");
    assert.deepEqual(r.statuses(DOC, done.text), ["fresh"]);

    other.write("src/greet.ts", `// 头一行\n// 又一行\n${CODE}`);
    const dirty = r.service.confirm(DOC, done.text);
    assert.match(dirty.problems[0]!, /未提交/, "外仓脏了照样拒");

    other.commit("上面插两行");
    const moved = r.service.resolve(DOC, done.text).items[0]!;
    assert.equal(moved.status, "fresh");
    assert.deepEqual(moved.lines, [4, 5]);

    other.write("src/greet.ts", CODE.replace("hello", "hey"));
    other.commit("改问候语");
    const edited = r.service.resolve(DOC, done.text).items[0]!;
    assert.equal(edited.status, "changed");
    assert.match(edited.diff!, /^- {3}return `hello/m);
    assert.deepEqual(edited.old, ["export function greet(name: string): string {", "  return `hello ${name}`;"]);
  } finally {
    r.teardown();
    other.teardown();
  }
});

test("未跟踪且没被忽略：拒，先 commit，不退成 hash", () => {
  const r = setupRepo({ formats: FORMATS, comparator: "auto" });
  try {
    r.write("src/new.ts", CODE);
    const done = r.service.confirm(DOC, "REF src/new.ts:2-3\n");
    assert.equal(done.problems.length, 1);
    assert.match(done.problems[0]!, /未跟踪.*先 commit/);
    assert.equal(r.ledger.dump()[DOC], undefined);
  } finally {
    r.teardown();
  }
});

test("仓还没有一次提交：拒，说清楚", () => {
  const r = setupRepo({ formats: FORMATS, comparator: "auto" });
  const fresh = mkdtempSync(join(tmpdir(), "god-live-doc-unborn-"));
  try {
    run(fresh, ["init", "-q", "-b", "main"]);
    writeFileSync(join(fresh, "lib.ts"), CODE);
    const rel = posix(relative(r.root, join(fresh, "lib.ts")));
    const done = r.service.confirm(DOC, `REF ${rel}:2-3\n`);
    assert.match(done.problems[0]!, /还没有一次提交/);
  } finally {
    r.teardown();
    rmSync(fresh, { recursive: true, force: true, maxRetries: 5 });
  }
});

test("软链接按真实路径算：node_modules 里指向已提交目录的链接，走 git 不走 hash", () => {
  const r = setupRepo({ formats: FORMATS, comparator: "auto" });
  try {
    r.write(".gitignore", "node_modules/\n");
    r.write("lib/greet.ts", CODE);
    r.commit("起 lib");
    mkdirSync(join(r.root, "node_modules"));
    // Windows 上目录联接不用管理员权限，pnpm 摆的也是这种；别的平台退成普通目录软链
    symlinkSync(join(r.root, "lib"), join(r.root, "node_modules", "lib"), "junction");
    const done = r.service.confirm(DOC, "REF node_modules/lib/greet.ts:2-3\n");
    assert.deepEqual(done.problems, []);
    assert.deepEqual(kinds(r), ["git"]);
    assert.deepEqual(r.statuses(DOC, done.text), ["fresh"]);
  } finally {
    r.teardown();
  }
});

test("目录树、存在性、名字走核心那三个：清单按 .gitignore 过滤，改名红、多文件黄", () => {
  const r = setupRepo({ formats: FORMATS, comparator: "auto" });
  try {
    r.write(".gitignore", "dist/\n");
    r.write("src/dist/out.js", "x");
    r.write("src/util.ts", "export const a = 1;\n");
    r.commit("起结构");
    const text = 'REF tree src depth=1\n\nREF exists src/greet.ts\n\nREF absent src/remove.ts\n\nREF has src/greet.ts "export function greet"\n';
    const done = r.service.confirm(DOC, text);
    assert.deepEqual(done.problems, []);
    assert.deepEqual(kinds(r), ["tree", "exists", "exists", "has"]);
    const items = r.service.resolve(DOC, done.text).items;
    assert.deepEqual(items.map((i) => i.status), ["fresh", "fresh", "fresh", "fresh"]);
    assert.deepEqual(items[0]!.current, ["greet.ts", "util.ts"], "dist/ 被忽略，不进清单");

    r.write("src/tag.ts", "export const t = 1;\n");
    r.write("src/remove.ts", "");
    r.write("src/greet.ts", CODE.replace("function greet", "function hello"));
    const after = r.service.resolve(DOC, done.text).items;
    assert.deepEqual(after.map((i) => [i.status, i.reason]), [["changed", "changed"], ["fresh", undefined], ["missing", "appeared"], ["missing", "text-missing"]]);
    assert.match(after[0]!.diff!, /^\+ tag\.ts$/m);
  } finally {
    r.teardown();
  }
});

test("核对按记录的 kind 转发：认不得的 kind 当没确认过", () => {
  const r = setupRepo({ formats: FORMATS, comparator: "auto" });
  try {
    r.ledger.set(DOC, { kind: "span", file: "src/greet.ts", a: 2, b: 3 }, { kind: "别的" });
    assert.deepEqual(r.statuses(DOC, "REF src/greet.ts:2-3\n"), ["unconfirmed"]);
  } finally {
    r.teardown();
  }
});
