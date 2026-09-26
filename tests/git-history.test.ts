/**
 * 行段与整文件的比较器接上 git 那份旧内容来源，全在临时真 git 仓里跑：
 *   确认不要求先提交——脏文件、未跟踪文件都记得下，而且一次 git 都不起
 *   核对：行段按 hunk 跟随、绿只认段哈希、vanished、file-missing、changed 带 diff 和旧段
 *   取不到旧内容（确认后没提交就又改了、blob 名缩写有歧义）——退回滑窗，不报错
 *   对象库问几次——内容没变不问、同一个 blob 只取一次
 *   hunk 表落盘——同一对内容下次用盘上那份，坏了报错
 *   跟取不到任何旧内容的比较一致——同一串改动下状态一样
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire, syncBuiltinESMExports } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { blobOf, hashText } from "../packages/docfirst-pin/src/index.ts";
import type { History } from "../packages/docfirst-pin/src/index.ts";
import { createGitHistory } from "../packages/docfirst-workflow/src/project/index.ts";
import { readBlob } from "../packages/docfirst-workflow/src/project/git.ts";
import { CODE, NO_HISTORY, refLine, run, SETTINGS, setupRepo } from "./repo.ts";
import type { Repo } from "./repo.ts";

const DOC = "docs/a.mdx";
const REF = refLine({ kind: "span", file: "src/greet.ts", a: 2, b: 3 });
const TEXT = `# 标题\n\n${REF}\n\n尾巴\n`;

/** 起仓、写好文档、确认一次 */
function confirmed(history?: History): Repo {
  const r = setupRepo({ ...(history !== undefined ? { history } : {}) });
  r.write(DOC, TEXT);
  const done = r.confirm(DOC);
  assert.deepEqual(done.steps.map((s) => s.action), ["recorded"]);
  return r;
}

const first = (r: Repo) => r.pinning.checkDoc(DOC, r.read(DOC)).items[0]!;

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

test("确认不要求先提交：改了没提交、未跟踪的文件都记得下，一次 git 都不起", () => {
  const r = setupRepo();
  try {
    r.write("src/greet.ts", CODE.replace("hello", "hey"));
    r.write("src/untracked.ts", "const a = 1;\nconst b = 2;\n");
    r.write(DOC, `${TEXT}\n${refLine({ kind: "span", file: "src/untracked.ts", a: 1, b: 2 })}\n`);
    const { value: done, calls } = gitCalls(() => r.confirm(DOC));
    assert.deepEqual(done.steps.map((s) => s.action), ["recorded", "recorded"]);
    assert.deepEqual(calls, [], "blob 名在进程里算");
    assert.match(r.read(DOC), new RegExp(`blob="${hashText(CODE.replace("hello", "hey")).slice(0, 12)}"`), "记的是工作区内容的 blob 名");
  } finally {
    r.teardown();
  }
});

test("记下的 blob 名就是这份内容提交后的 blob 名（前 12 位）", () => {
  const r = confirmed();
  try {
    const head = run(r.root, ["rev-parse", "HEAD:src/greet.ts"]).trim();
    assert.match(r.read(DOC), new RegExp(`blob="${head.slice(0, 12)}"`));
  } finally {
    r.teardown();
  }
});

test("行段跟随：上面插几行，段按 hunk 跟到新位置；confirm 写回新行号", () => {
  const r = confirmed();
  try {
    r.write("src/greet.ts", `// 头一行\n// 又一行\n${CODE}`);
    r.commit("上面插两行");
    const item = first(r);
    assert.equal(item.status, "fresh", "内容没变，只是挪了位置");
    assert.deepEqual(item.lines, [4, 5], "段跟到了 4-5");

    const again = r.confirm(DOC);
    assert.deepEqual(again.steps.map((s) => s.action), ["moved"]);
    assert.match(r.read(DOC), /^\{\/\* ref file="src\/greet\.ts" lines="4-5" /m, "记号写回成新行段");
  } finally {
    r.teardown();
  }
});

test("有变动：黄，带给人看的 diff 和从 blob 取回的旧段", () => {
  const r = confirmed();
  try {
    r.write("src/greet.ts", CODE.replace("hello", "hey"));
    const item = first(r);
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

test("整段删光：红 vanished，旧段还能从 blob 取回来；文件没了：红 file-missing，旧段照样取得回", () => {
  const r = confirmed();
  try {
    r.write("src/greet.ts", "// greet\nexport const VERSION = 1;\n");
    const gone = first(r);
    assert.deepEqual([gone.status, gone.reason, gone.current, gone.old?.length], ["missing", "vanished", null, 2]);
    r.drop("src/greet.ts");
    const dropped = first(r);
    assert.deepEqual([dropped.status, dropped.reason, dropped.old?.length], ["missing", "file-missing", 2]);
  } finally {
    r.teardown();
  }
});

test("确认之后没提交又改了：记录里的 blob 不在对象库，退回滑窗——挪了位置照样绿，改了是位置不明的黄", () => {
  const r = setupRepo();
  try {
    r.write("src/greet.ts", `// 没提交的一行\n${CODE}`);
    r.write(DOC, TEXT.replace('lines="2-3"', 'lines="3-4"'));
    r.confirm(DOC);
    r.write("src/greet.ts", `// 又一行\n// 没提交的一行\n${CODE}`);
    assert.deepEqual([first(r).status, first(r).lines], ["fresh", [4, 5]]);
    r.write("src/greet.ts", `// 又一行\n${CODE.replace("hello", "hey")}`);
    const item = first(r);
    assert.deepEqual([item.status, item.reason, item.diff], ["changed", "unlocated", undefined]);
  } finally {
    r.teardown();
  }
});

/** 把一个松散对象从对象库里删掉，等价于浅克隆或历史重写之后它取不到了 */
function dropObject(root: string, file: string): void {
  const blob = run(root, ["rev-parse", `HEAD:${file}`]).trim();
  rmSync(join(root, ".git", "objects", blob.slice(0, 2), blob.slice(2)));
}

test("内容一字没变就不问对象库：记录里的 blob 被删掉了，照样判绿", () => {
  const r = confirmed();
  try {
    dropObject(r.root, "src/greet.ts");
    const { value, calls } = gitCalls(() => r.statuses(DOC, r.read(DOC)));
    assert.deepEqual(value, ["fresh"]);
    assert.deepEqual(calls, [], "段哈希对得上，旧内容用不着");
  } finally {
    r.teardown();
  }
});

test("同一个 blob 只从对象库取一次：取过之后对象没了，旧段照样给得出来", () => {
  const r = confirmed();
  try {
    r.write("src/greet.ts", CODE.replace("hello", "hey"));
    const before = first(r);
    dropObject(r.root, "src/greet.ts");
    const again = first(r);
    assert.equal(again.status, "changed", "blob 名按内容寻址，记住的内容不会过时");
    assert.deepEqual(again.old, before.old);
    assert.equal(again.diff, before.diff);
  } finally {
    r.teardown();
  }
});

test("取旧内容：缩写不在对象库、缩写有歧义都给 null，不抛错", () => {
  const r = setupRepo();
  try {
    assert.equal(readBlob(r.root, "0123456789ab"), null, "不在对象库");
    // 一次写进两千个对象（内容固定，名字也就固定），挑两个前 4 位相同的，用这 4 位去问
    const dir = join(r.root, "many");
    mkdirSync(dir);
    const files = Array.from({ length: 2000 }, (_, i) => {
      writeFileSync(join(dir, String(i)), `x${i}\n`);
      return `many/${i}`;
    });
    const names = run(r.root, ["hash-object", "-w", "--", ...files]).trim().split("\n");
    const seen = new Set<string>();
    const prefix = names.map((name) => name.slice(0, 4)).find((p) => (seen.has(p) ? true : (seen.add(p), false)))!;
    assert.ok(prefix !== undefined, "两千个对象里总有两个前 4 位相同");
    assert.equal(readBlob(r.root, prefix), null, "缩写有歧义");
    assert.equal(readBlob(r.root, names[0]!.slice(0, 12)), "x0\n", "缩写唯一就取得到");
  } finally {
    r.teardown();
  }
});

/** 这对内容在盘上那份 hunk 表的位置：跟 git.ts 落盘的布局一致 */
const hunkFile = (oldText: string, newText: string) => join(tmpdir(), "docfirst-cache", "hunks", `${hashText(oldText)}-${hashText(newText)}.json`);

test("hunk 表按内容寻址落盘：同一对内容下次直接用盘上那份，不再 diff", () => {
  const r = confirmed();
  const moved = `// ${randomUUID()}\n// 又一行\n${CODE}`;
  const planted = hunkFile(CODE, moved);
  try {
    r.write("src/greet.ts", moved);
    mkdirSync(dirname(planted), { recursive: true });
    writeFileSync(planted, "[]");
    const item = first(r);
    assert.equal(item.status, "changed", "盘上那份谎称没有差异，段就留在 2-3 行，那儿已经是插进来的注释——用了盘上那份才会判黄");
  } finally {
    rmSync(planted, { force: true });
    r.teardown();
  }
});

test("hunk 表算完落盘；盘上那份坏了就报错说是哪个文件，不当没有", () => {
  const r = confirmed();
  const moved = `// ${randomUUID()}\n${CODE}`;
  let path = hunkFile(CODE, moved);
  try {
    r.write("src/greet.ts", moved);
    assert.equal(first(r).status, "fresh");
    assert.deepEqual(JSON.parse(readFileSync(path, "utf8")), [{ oldStart: 0, oldLen: 0, newStart: 1, newLen: 1 }]);

    const corrupt = `// ${randomUUID()}\n${CODE}`;
    r.write("src/greet.ts", corrupt);
    rmSync(path, { force: true });
    path = hunkFile(CODE, corrupt);
    writeFileSync(path, "不是 json");
    assert.throws(() => first(r), /hunk 缓存文件认不出/);
  } finally {
    rmSync(path, { force: true });
    r.teardown();
  }
});

test("项目根是 git 的子目录：按文件自己的位置找仓，照样取得到旧内容", () => {
  const outer = mkdtempSync(join(tmpdir(), "god-live-doc-outer-"));
  try {
    run(outer, ["init", "-q", "-b", "main"]);
    const inner = join(outer, "member");
    execFileSync("node", ["-e", `require("node:fs").mkdirSync(${JSON.stringify(join(inner, "src"))}, { recursive: true })`], { timeout: 30_000 });
    writeFileSync(join(inner, "src", "greet.ts"), CODE);
    run(outer, [...SETTINGS, "add", "-A"]);
    run(outer, [...SETTINGS, "commit", "-q", "-m", "起代码"]);
    assert.equal(createGitHistory(inner).oldText("src/greet.ts", blobOf(CODE.split("\n"))), CODE);
  } finally {
    rmSync(outer, { recursive: true, force: true, maxRetries: 5 });
  }
});

test("整文件：末尾追加也黄，diff 是整份对整份；行段版对同一改动是绿的", () => {
  const r = setupRepo();
  try {
    r.write(DOC, `${refLine({ kind: "file", file: "src/greet.ts" })}\n\n${REF}\n`);
    r.confirm(DOC);
    assert.deepEqual(r.statuses(DOC, r.read(DOC)), ["fresh", "fresh"]);
    r.write("src/greet.ts", `${CODE}export const NAME = "x";\n`);
    const [all, span] = r.pinning.checkDoc(DOC, r.read(DOC)).items;
    assert.equal(span!.status, "fresh", "行段没被碰到");
    assert.equal(all!.status, "changed");
    assert.match(all!.diff!, /^\+ export const NAME/m);
    assert.deepEqual(all!.lines, [1, 7]);
  } finally {
    r.teardown();
  }
});

test("仓按 autocrlf 存 LF、工作区是 CRLF：blob 名照样对得上，旧内容取得到", () => {
  const r = setupRepo();
  try {
    const crlf = CODE.replace(/\n/g, "\r\n");
    r.write("src/crlf.ts", crlf);
    run(r.root, ["-c", "core.autocrlf=true", ...SETTINGS.slice(0, 4), "add", "-A"]);
    run(r.root, ["-c", "core.autocrlf=true", ...SETTINGS.slice(0, 4), "commit", "-q", "-m", "CRLF 文件"]);
    r.write(DOC, `${refLine({ kind: "span", file: "src/crlf.ts", a: 2, b: 3 })}\n`);
    r.confirm(DOC);
    r.write("src/crlf.ts", crlf.replace("hello", "hey"));
    const item = first(r);
    assert.deepEqual([item.status, item.reason], ["changed", "changed"], "取得到旧内容才有 changed 与 diff");
    assert.ok(item.diff !== undefined);
  } finally {
    r.teardown();
  }
});

test("git 那份与取不到旧内容的：同一串改动下状态一致", () => {
  const steps: Array<(r: Repo) => void> = [
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
  const trace = (history: typeof NO_HISTORY | undefined) => {
    const r = setupRepo({ ...(history !== undefined ? { history } : {}) });
    try {
      r.write(DOC, TEXT);
      const out = [r.statuses(DOC, TEXT)];
      r.confirm(DOC);
      for (const step of steps) {
        step(r);
        out.push(r.statuses(DOC, r.read(DOC)));
      }
      return out;
    } finally {
      r.teardown();
    }
  };
  assert.deepEqual(trace(undefined), trace(NO_HISTORY));
  assert.deepEqual(trace(undefined), [["unconfirmed"], ["fresh"], ["changed"], ["missing"], ["missing"]]);
});
