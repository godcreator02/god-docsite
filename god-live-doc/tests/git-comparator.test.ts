/**
 * git 比较器的账，全在临时真 git 仓里跑：
 *   确认的门——不在 HEAD 里、工作区脏，都拒；一处拒整篇拒
 *   核对的判——行段跟随、绿只认段哈希、vanished、file-missing、blob-missing、changed 带 diff 和旧段
 *   跟 hash 版的一致性——同一串改动下两个比较器的状态一样
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createGitComparator } from "@god-live-doc/project";
import { fakeFormat } from "./fake-format.ts";
import { CODE, run, setupRepo } from "./repo.ts";
import type { GitRecord } from "@god-live-doc/project";

const FORMATS = [fakeFormat("fake", ".a")];
const DOC = "docs/a.a";
const REF = "REF src/greet.ts:2-3";
const TEXT = `# 标题\n\n${REF}\n\n尾巴\n`;
const record = (r: { ledger: { dump(): Record<string, Record<string, unknown>> } }, key: string) =>
  r.ledger.dump()[DOC]?.[key] as GitRecord | undefined;

test("确认：记的是 blob、commit、行段、段哈希，仓里不存第二份内容", () => {
  const r = setupRepo({ formats: FORMATS });
  try {
    const done = r.service.confirm(DOC, TEXT);
    assert.deepEqual(done.problems, []);
    const pinned = record(r, "src/greet.ts:2-3")!;
    assert.equal(pinned.kind, "git");
    assert.match(pinned.blob, /^[0-9a-f]{40}$/);
    assert.match(pinned.commit, /^[0-9a-f]{40}$/);
    assert.deepEqual(pinned.lines, [2, 3]);
    assert.match(pinned.hash, /^[0-9a-f]{64}$/);
    assert.deepEqual(r.statuses(DOC, done.text), ["fresh"]);
  } finally {
    r.teardown();
  }
});

test("确认的门：文件未提交拒、不在 HEAD 里（未跟踪 / 被忽略）拒——一处拒整篇拒", () => {
  const r = setupRepo({ formats: FORMATS });
  try {
    r.write("src/greet.ts", CODE.replace("hello", "hey"));
    const dirty = r.service.confirm(DOC, TEXT);
    assert.equal(dirty.problems.length, 1);
    assert.match(dirty.problems[0]!, /未提交/);
    assert.equal(r.ledger.dump()[DOC], undefined, "拒了就一条都不写");

    r.commit("改代码");
    r.write("src/untracked.ts", "const a = 1;\nconst b = 2;\n");
    const mixed = r.service.confirm(DOC, `${TEXT}\nREF src/untracked.ts:1-2\n`);
    assert.equal(mixed.problems.length, 1);
    assert.match(mixed.problems[0]!, /不在 HEAD 里/);
    assert.equal(r.ledger.dump()[DOC], undefined, "一处钉不住，另一处也不落");
  } finally {
    r.teardown();
  }
});

test("行段跟随：上面插几行，段跟到新位置；确认后键换成新行段，旧键当孤儿清掉", () => {
  const r = setupRepo({ formats: FORMATS });
  try {
    const done = r.service.confirm(DOC, TEXT);
    r.write("src/greet.ts", `// 头一行\n// 又一行\n${CODE}`);
    r.commit("上面插两行");
    const item = r.service.resolve(DOC, done.text).items[0]!;
    assert.equal(item.status, "fresh", "内容没变，只是挪了位置");
    assert.deepEqual(item.lines, [4, 5], "段跟到了 4-5");

    const again = r.service.confirm(DOC, done.text);
    assert.deepEqual(again.problems, []);
    assert.match(again.text, /^REF src\/greet\.ts:4-5$/m, "记号写回成新行段");
    assert.deepEqual(Object.keys(r.ledger.dump()[DOC] ?? {}), ["src/greet.ts:4-5"], "旧键已清");
  } finally {
    r.teardown();
  }
});

test("有变动：黄，带给人看的 diff 和从 blob 取回的旧段", () => {
  const r = setupRepo({ formats: FORMATS });
  try {
    const done = r.service.confirm(DOC, TEXT);
    r.write("src/greet.ts", CODE.replace("hello", "hey"));
    r.commit("改问候语");
    const item = r.service.resolve(DOC, done.text).items[0]!;
    assert.equal(item.status, "changed");
    assert.equal(item.reason, "changed");
    assert.deepEqual(item.old, ["export function greet(name: string): string {", "  return `hello ${name}`;"]);
    assert.deepEqual(item.current, ["export function greet(name: string): string {", "  return `hey ${name}`;"]);
    assert.match(item.diff!, /^- {3}return `hello/m, "删掉的旧行前面加 `- `");
    assert.match(item.diff!, /^\+ {3}return `hey/m, "新行前面加 `+ `");
    assert.match(item.diff!, /^ {2}export function greet/m, "没动的行前面两个空格");
  } finally {
    r.teardown();
  }
});

test("整段删光：红 vanished，旧段还能从 blob 取回来", () => {
  const r = setupRepo({ formats: FORMATS });
  try {
    const done = r.service.confirm(DOC, TEXT);
    r.write("src/greet.ts", "// greet\nexport const VERSION = 1;\n");
    r.commit("把函数删了");
    const item = r.service.resolve(DOC, done.text).items[0]!;
    assert.equal(item.status, "missing");
    assert.equal(item.reason, "vanished");
    assert.equal(item.current, null);
    assert.equal(item.old?.length, 2);
  } finally {
    r.teardown();
  }
});

test("文件没了：红 file-missing", () => {
  const r = setupRepo({ formats: FORMATS });
  try {
    const done = r.service.confirm(DOC, TEXT);
    r.drop("src/greet.ts");
    const item = r.service.resolve(DOC, done.text).items[0]!;
    assert.equal(item.status, "missing");
    assert.equal(item.reason, "file-missing");
  } finally {
    r.teardown();
  }
});

test("blob 不在对象库（浅克隆 / 历史重写）：红 blob-missing，不当成绿也不炸", () => {
  const r = setupRepo({ formats: FORMATS });
  try {
    const done = r.service.confirm(DOC, TEXT);
    const key = "src/greet.ts:2-3";
    const pinned = r.ledger.dump()[DOC]![key] as GitRecord;
    // 把记录里的 blob 换成一个对象库里没有的哈希，等价于浅克隆后旧对象取不到
    r.ledger.dump()[DOC]![key] = { ...pinned, blob: "0".repeat(40) };
    const item = r.service.resolve(DOC, done.text).items[0]!;
    assert.equal(item.status, "missing");
    assert.equal(item.reason, "blob-missing");
  } finally {
    r.teardown();
  }
});

test("项目根是 git 的子目录：HEAD:<路径> 翻成仓根相对，照样钉得住", () => {
  const outer = mkdtempSync(join(tmpdir(), "god-live-doc-outer-"));
  try {
    run(outer, ["init", "-q", "-b", "main"]);
    run(outer, ["config", "user.email", "test@example.com"]);
    run(outer, ["config", "user.name", "test"]);
    run(outer, ["config", "core.autocrlf", "false"]);
    const inner = join(outer, "member");
    execFileSync("node", ["-e", `require("node:fs").mkdirSync(${JSON.stringify(join(inner, "src"))}, { recursive: true })`], { timeout: 30_000 });
    execFileSync("node", ["-e", `require("node:fs").writeFileSync(${JSON.stringify(join(inner, "src", "greet.ts"))}, ${JSON.stringify(CODE)})`], { timeout: 30_000 });
    run(outer, ["add", "-A"]);
    run(outer, ["commit", "-q", "-m", "起代码"]);

    const comparator = createGitComparator({ root: inner });
    const snapshot = comparator.snapshot({ file: "src/greet.ts", a: 2, b: 3 }, CODE.split("\n"));
    assert.ok("record" in snapshot, `子目录里该钉得住，实际：${JSON.stringify(snapshot)}`);
  } finally {
    rmSync(outer, { recursive: true, force: true, maxRetries: 5 });
  }
});

test("git 版与 hash 版：同一串改动下状态一致", () => {
  const steps: Array<(r: ReturnType<typeof setupRepo>) => void> = [
    () => {},
    (r) => {
      r.write("src/greet.ts", CODE.replace("hello", "hey"));
      r.commit("改问候语");
    },
    (r) => {
      r.write("src/greet.ts", "// greet\nexport const VERSION = 1;\n");
      r.commit("把函数删了");
    },
    (r) => r.drop("src/greet.ts"),
  ];
  const trace = (comparator: "hash" | undefined) => {
    const r = setupRepo({ formats: FORMATS, ...(comparator !== undefined ? { comparator } : {}) });
    try {
      const out = [r.statuses(DOC, TEXT)];
      const done = r.service.confirm(DOC, TEXT);
      assert.deepEqual(done.problems, [], "第一步就该确认得下来");
      for (const step of steps) {
        step(r);
        out.push(r.statuses(DOC, done.text));
      }
      return out;
    } finally {
      r.teardown();
    }
  };
  assert.deepEqual(trace(undefined), trace("hash"));
  assert.deepEqual(trace(undefined), [["unconfirmed"], ["fresh"], ["changed"], ["missing"], ["missing"]]);
});
