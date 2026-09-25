/**
 * git 比较器的测试，全在临时真 git 仓里跑：
 *   确认的检查——不在 HEAD 里、工作区脏，都拒；一处拒整篇拒
 *   核对的判——行段跟随、绿只认段哈希、vanished、file-missing、blob-missing、changed 带 diff 和旧段
 *   对象库问几次——内容没变不问、同一个 blob 只取一次；确认时同一个文件只问一次 git
 *   hunk 表落盘——同一对内容下次用盘上那份，坏了报错
 *   跟 hash 版的一致性——同一串改动下两个比较器的状态一样
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire, syncBuiltinESMExports } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { createGitComparator, hashText } from "../packages/docfirst-workflow/src/host/index.ts";
import { fakeFormat } from "./fake-format.ts";
import { CODE, run, setupRepo } from "./repo.ts";
import type { GitRecord } from "../packages/docfirst-workflow/src/host/index.ts";

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

test("确认的检查：文件未提交拒、未跟踪拒——一处拒整篇拒", () => {
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
    assert.match(mixed.problems[0]!, /未跟踪.*先 commit/);
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

test("blob 不在对象库（浅克隆 / 历史重写）：红 blob-missing，不当成绿也不抛错", () => {
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

/** 把一个松散对象从对象库里删掉，等价于浅克隆或历史重写之后它取不到了 */
function dropObject(root: string, blob: string): void {
  rmSync(join(root, ".git", "objects", blob.slice(0, 2), blob.slice(2)));
}

test("内容一字没变就不问对象库：记录里的 blob 被删掉了，照样判绿", () => {
  const r = setupRepo({ formats: FORMATS });
  try {
    const done = r.service.confirm(DOC, TEXT);
    dropObject(r.root, record(r, "src/greet.ts:2-3")!.blob);
    assert.deepEqual(r.statuses(DOC, done.text), ["fresh"], "当前内容的 blob 名就是记录里那个，旧内容用不着");
  } finally {
    r.teardown();
  }
});

test("同一个 blob 只从对象库取一次：取过之后对象没了，旧段照样给得出来", () => {
  const r = setupRepo({ formats: FORMATS });
  try {
    const done = r.service.confirm(DOC, TEXT);
    r.write("src/greet.ts", CODE.replace("hello", "hey"));
    r.commit("改问候语");
    const first = r.service.resolve(DOC, done.text).items[0]!;
    dropObject(r.root, record(r, "src/greet.ts:2-3")!.blob);
    const again = r.service.resolve(DOC, done.text).items[0]!;
    assert.equal(again.status, "changed", "blob 名按内容寻址，记住的内容不会过时，不该判成 blob-missing");
    assert.deepEqual(again.old, first.old);
    assert.equal(again.diff, first.diff);
  } finally {
    r.teardown();
  }
});

/** 数这一段里起了几次 git：换掉 child_process 的 execFileSync，源码里的具名导入经 syncBuiltinESMExports 跟着换 */
function gitCalls<T>(fn: () => T): { value: T; calls: string[][] } {
  const cp = createRequire(import.meta.url)("node:child_process") as typeof import("node:child_process");
  const orig = cp.execFileSync;
  const calls: string[][] = [];
  cp.execFileSync = ((file: string, args: string[], opts: object) => {
    if (file === "git") calls.push(args);
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

const SAME_FILE_THREE_TIMES = "REF src/greet.ts:1-1\n\nREF src/greet.ts:2-3\n\nREF src/greet.ts:6-6\n";

for (const comparator of [undefined, "auto"] as const) {
  test(`确认时同一个文件只问一次 git（${comparator ?? "git"} 比较器）：三处引用钉同一个干净文件，只起一句 rev-parse`, () => {
    const r = setupRepo({ formats: FORMATS, ...(comparator !== undefined ? { comparator } : {}) });
    try {
      const { value: done, calls } = gitCalls(() => r.service.confirm(DOC, SAME_FILE_THREE_TIMES));
      assert.deepEqual(done.problems, []);
      assert.deepEqual(calls.map((args) => args[0]), ["rev-parse"], "工作区跟 blob 字节一样就算干净，不再问 status；在 HEAD 里就不问 check-ignore");
    } finally {
      r.teardown();
    }
  });
}

test("工作区跟 blob 字节不同、git 认为干净（autocrlf 换行转换）：照样钉得住", () => {
  const r = setupRepo({ formats: FORMATS });
  try {
    run(r.root, ["config", "core.autocrlf", "true"]);
    r.write("src/crlf.ts", "const a = 1;\r\nconst b = 2;\r\n");
    run(r.root, ["-c", "user.email=test@example.com", "-c", "user.name=test", "add", "-A"]);
    run(r.root, ["-c", "user.email=test@example.com", "-c", "user.name=test", "commit", "-q", "-m", "CRLF 文件"]);
    const done = r.service.confirm(DOC, "REF src/crlf.ts:1-2\n");
    assert.deepEqual(done.problems, [], "字节比不上就问 git status，由 git 按换行转换判干净");
  } finally {
    r.teardown();
  }
});

/** 这对内容在盘上那份 hunk 表的位置：跟 git.ts 落盘的布局一致 */
const hunkFile = (oldBlob: string, newText: string) => join(tmpdir(), "docfirst-cache", "hunks", `${oldBlob}-${hashText(newText)}.json`);

test("hunk 表按内容寻址落盘：同一对内容下次直接用盘上那份，不再 diff", () => {
  const r = setupRepo({ formats: FORMATS });
  const moved = `// ${randomUUID()}\n// 又一行\n${CODE}`;
  let planted = "";
  try {
    const done = r.service.confirm(DOC, TEXT);
    r.write("src/greet.ts", moved);
    r.commit("上面插两行");
    planted = hunkFile(record(r, "src/greet.ts:2-3")!.blob, moved);
    mkdirSync(dirname(planted), { recursive: true });
    writeFileSync(planted, "[]");
    const item = r.service.resolve(DOC, done.text).items[0]!;
    assert.equal(item.status, "changed", "盘上那份谎称没有差异，段就留在 2-3 行，那儿已经是插进来的注释——用了盘上那份才会判黄");
  } finally {
    if (planted !== "") rmSync(planted, { force: true });
    r.teardown();
  }
});

test("hunk 表算完落盘；盘上那份坏了就报错说是哪个文件，不当没有", () => {
  const r = setupRepo({ formats: FORMATS });
  const moved = `// ${randomUUID()}\n${CODE}`;
  let path = "";
  try {
    const done = r.service.confirm(DOC, TEXT);
    r.write("src/greet.ts", moved);
    r.commit("上面插一行");
    path = hunkFile(record(r, "src/greet.ts:2-3")!.blob, moved);
    assert.equal(r.service.resolve(DOC, done.text).items[0]!.status, "fresh");
    assert.deepEqual(JSON.parse(readFileSync(path, "utf8")), [{ oldStart: 0, oldLen: 0, newStart: 1, newLen: 1 }]);

    const corrupt = `// ${randomUUID()}\n${CODE}`;
    r.write("src/greet.ts", corrupt);
    rmSync(path, { force: true });
    path = hunkFile(record(r, "src/greet.ts:2-3")!.blob, corrupt);
    writeFileSync(path, "不是 json");
    assert.throws(() => r.service.resolve(DOC, done.text), /hunk 缓存文件认不出/);
  } finally {
    if (path !== "") rmSync(path, { force: true });
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
    const snapshot = comparator.snapshot({ kind: "span", file: "src/greet.ts", a: 2, b: 3 }, CODE.split("\n"));
    assert.ok("record" in snapshot, `子目录里该钉得住，实际：${JSON.stringify(snapshot)}`);
  } finally {
    rmSync(outer, { recursive: true, force: true, maxRetries: 5 });
  }
});

test("整文件：末尾追加也黄，diff 是整份对整份；行段版对同一改动是绿的", () => {
  const r = setupRepo({ formats: FORMATS });
  try {
    const text = "REF src/greet.ts:all\n\nREF src/greet.ts:2-3\n";
    const done = r.service.confirm(DOC, text);
    assert.deepEqual(done.problems, []);
    assert.deepEqual(r.statuses(DOC, done.text), ["fresh", "fresh"]);
    const whole = r.ledger.dump()[DOC]!["src/greet.ts:all"] as GitRecord;
    assert.deepEqual(whole.lines, [1, 6]);

    r.write("src/greet.ts", `${CODE}export const NAME = "x";\n`);
    r.commit("末尾追加一行");
    const [all, span] = r.service.resolve(DOC, done.text).items;
    assert.equal(span!.status, "fresh", "行段没被碰到");
    assert.equal(all!.status, "changed");
    assert.match(all!.diff!, /^\+ export const NAME/m);
    assert.deepEqual(all!.lines, [1, 7]);
  } finally {
    r.teardown();
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
