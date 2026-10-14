/**
 * 钉码核心：check / confirm 两个动作、比较器、确认时记什么。
 * 直接给目标与记录，用内存读取器、内存里的旧内容来源。
 */
import { test } from "vitest";
import assert from "node:assert/strict";
import { blobOf, createPinner, diffText, hashNames, hashSpan, normalizeLines, sliceSpan } from "../src/index.ts";
import type { History, Pin, PinCheck, Pinner, Reader, Target } from "../src/index.ts";

const CODE = ["// greet", "export function greet(name: string): string {", "  return `hello ${name}`;", "}", ""];

/** 什么旧内容都取不到的来源：比较器只能滑窗 */
const NO_HISTORY: History = { oldText: () => null };

/** 内存读取器：文件表里有的就是全部文件。目录树按路径前缀算 */
function memoryReader(files: Map<string, string[]>): Reader {
  return {
    read: (file) => files.get(file) ?? null,
    list(dir, depth) {
      const prefix = `${dir}/`;
      const out = new Set<string>();
      for (const path of files.keys()) {
        if (!path.startsWith(prefix)) continue;
        const parts = path.slice(prefix.length).split("/");
        for (let i = 1; i <= Math.min(depth, parts.length); i += 1) out.add(parts.slice(0, i).join("/") + (i < parts.length ? "/" : ""));
      }
      return out.size === 0 ? null : [...out].sort();
    },
  };
}

function setup(history: History = NO_HISTORY) {
  const files = new Map<string, string[]>([["src/greet.ts", [...CODE]]]);
  const pinner = createPinner({ reader: memoryReader(files), history });
  const statuses = (pins: Pin[]) => pinner.check(pins).map((v) => v.status);
  return { files, pinner, statuses };
}

const SPAN: Target = { kind: "span", file: "src/greet.ts", a: 2, b: 3 };
const UNCONFIRMED: Pin = { target: SPAN, record: null };
const accept = { accept: true };
const plain = { accept: false };

/** 确认一处，返回写下的那一处（没写下记录就报错） */
function confirmOne(pinner: Pinner, pin: Pin, options = plain): Pin {
  const [step] = pinner.confirm(pinner.check([pin]), options);
  assert.ok(step!.written !== undefined, `这一处没记下来：${step!.action} ${step!.problem ?? ""}`);
  return step!.written!;
}

test("check：没确认过是未确认；确认后新鲜；改了代码变有变动；文件没了是缺失", () => {
  const { files, pinner, statuses } = setup();
  assert.deepEqual(statuses([UNCONFIRMED]), ["unconfirmed"]);
  const steps = pinner.confirm(pinner.check([UNCONFIRMED]), plain);
  assert.deepEqual(steps.map((s) => s.action), ["recorded"]);
  const done = steps[0]!.written!;
  assert.deepEqual(statuses([done]), ["fresh"]);
  files.set("src/greet.ts", CODE.map((l) => l.replace("hello", "hey")));
  assert.deepEqual(statuses([done]), ["changed"]);
  files.delete("src/greet.ts");
  assert.deepEqual(statuses([done]), ["missing"]);
});

test("确认记下段哈希与整文件的 blob 名，都是 12 位前缀、都在进程里算", () => {
  const { pinner } = setup();
  const done = confirmOne(pinner, UNCONFIRMED);
  const hash = hashSpan(CODE.slice(1, 3));
  const blob = blobOf(CODE);
  assert.match(hash, /^[0-9a-f]{12}$/);
  assert.match(blob, /^[0-9a-f]{12}$/);
  assert.deepEqual(done, { target: SPAN, record: { kind: "content", hash, blob } });
});

test("结果带着传进来的那个钉对象：调用方挂在钉上的东西原样带回，确认的每一步带着它的核对结果", () => {
  const { pinner } = setup();
  const pins = [
    { target: { kind: "span", file: "src/nowhere.ts", a: 1, b: 2 } as Target, record: null, line: 3 },
    { ...UNCONFIRMED, line: 5 },
    { target: { kind: "file", file: "src/greet.ts" } as Target, record: null, line: 7 },
  ];
  const checks = pinner.check(pins);
  checks.forEach((check, i) => assert.equal(check.pin, pins[i], "同一个对象，不是拷贝"));
  assert.deepEqual(checks.map((c) => [c.pin.line, c.status]), [[3, "missing"], [5, "unconfirmed"], [7, "unconfirmed"]]);
  const steps = pinner.confirm(checks, plain);
  steps.forEach((step, i) => assert.equal(step.check, checks[i]));
  assert.deepEqual(steps.map((s) => s.action), ["refused", "recorded", "recorded"]);
});

test("同一段钉两处：各记各的，都新鲜", () => {
  const { pinner, statuses } = setup();
  const steps = pinner.confirm(pinner.check([UNCONFIRMED, UNCONFIRMED]), plain);
  const written = steps.map((s) => s.written!);
  assert.equal(written.length, 2);
  assert.deepEqual(statuses(written), ["fresh", "fresh"]);
});

test("一处钉不住只是那一处不记：红的原样不动，别的照记", () => {
  const { pinner } = setup();
  const bad: Pin = { target: { kind: "span", file: "src/nowhere.ts", a: 1, b: 2 }, record: null };
  const steps = pinner.confirm(pinner.check([UNCONFIRMED, bad]), plain);
  assert.deepEqual(steps.map((s) => s.action), ["recorded", "refused"]);
  assert.equal(steps[1]!.check.reason, "file-missing");
  assert.equal(steps[1]!.written, undefined, "红的那处不记");
});

test("整文件：不写行号就是整个文件；末尾追加也算变；取不到旧内容就没有对比", () => {
  const { files, pinner, statuses } = setup();
  const done = confirmOne(pinner, { target: { kind: "file", file: "src/greet.ts" }, record: null });
  assert.deepEqual(pinner.check([done]).map((v) => [v.status, v.lines]), [["fresh", [1, 4]]]);
  files.set("src/greet.ts", [...CODE.slice(0, -1), "export const NAME = 1;", ""]);
  const check = pinner.check([done])[0]!;
  assert.deepEqual([check.status, check.reason, check.diff], ["changed", "changed", undefined]);
  assert.deepEqual(statuses([done]), ["changed"]);
});

test("目录树：记录是名字表的哈希；名字变了是黄、给当前表不给增删；目录没了是红", () => {
  const { files, pinner } = setup();
  files.set("src/util.ts", ["export const a = 1;"]);
  files.set("src/lib/deep.ts", ["x"]);
  const done = confirmOne(pinner, { target: { kind: "tree", dir: "src", depth: 1 }, record: null });
  assert.deepEqual(done.record, { kind: "tree", hash: hashNames(["greet.ts", "lib/", "util.ts"]) });
  assert.deepEqual(pinner.check([done])[0]!.current, ["greet.ts", "lib/", "util.ts"]);

  files.set("src/tag.ts", ["t"]);
  files.delete("src/util.ts");
  const changed = pinner.check([done])[0]!;
  assert.deepEqual([changed.status, changed.reason, changed.diff, changed.old], ["changed", "changed", undefined, undefined]);
  assert.deepEqual(changed.current, ["greet.ts", "lib/", "tag.ts"]);

  for (const key of [...files.keys()]) if (key.startsWith("src/")) files.delete(key);
  const gone = pinner.check([done])[0]!;
  assert.deepEqual([gone.status, gone.reason], ["missing", "dir-missing"]);
});

test("取不到旧内容时滑窗跟行段：代码整体下移，绿、带新行号；confirm 记下新行号与新 blob", () => {
  const { files, pinner } = setup();
  const done = confirmOne(pinner, UNCONFIRMED);
  files.set("src/greet.ts", ["// 新加的一行", "// 又一行", ...CODE]);
  const check = pinner.check([done])[0]!;
  assert.equal(check.status, "fresh");
  assert.deepEqual(check.lines, [4, 5]);
  const steps = pinner.confirm([check], plain);
  assert.deepEqual(steps.map((s) => s.action), ["moved"]);
  const moved = steps[0]!.written!;
  assert.deepEqual(moved, { target: { kind: "span", file: "src/greet.ts", a: 4, b: 5 }, record: { kind: "content", hash: hashSpan(CODE.slice(1, 3)), blob: blobOf(files.get("src/greet.ts")!) } });
  assert.deepEqual(pinner.confirm(pinner.check([moved]), plain).map((s) => s.action), ["unchanged"], "记下之后原地不动，再确认什么都不记");
});

test("滑窗找不到这段：有变动、位置不明，行号停在旧位置；旧位置超出文件才算缺失", () => {
  const { files, pinner } = setup();
  const done = confirmOne(pinner, UNCONFIRMED);
  files.set("src/greet.ts", ["// 新加的一行", ...CODE.map((l) => l.replace("hello", "hey"))]);
  const moved = pinner.check([done])[0]!;
  assert.deepEqual([moved.status, moved.reason, moved.lines, moved.diff], ["changed", "unlocated", [2, 3], undefined]);

  files.set("src/greet.ts", ["// greet", ""]);
  const gone = pinner.check([done])[0]!;
  assert.deepEqual([gone.status, gone.reason], ["missing", "vanished"]);
});

test("滑窗撞车：取离旧位置最近的一处；两处一样近就不猜", () => {
  const { files, pinner } = setup();
  const done = confirmOne(pinner, UNCONFIRMED);
  const [fn, ret] = [CODE[1]!, CODE[2]!];
  files.set("src/greet.ts", ["a", "b", "c", fn, ret, "}", "d", fn, ret, "}", ""]);
  const near = pinner.check([done])[0]!;
  assert.deepEqual([near.status, near.lines], ["fresh", [4, 5]], "4 和 8 两处，离旧位置 2 更近的是 4");

  files.set("src/greet.ts", [fn, ret, fn, ret, ""]);
  const tie = pinner.check([done])[0]!;
  assert.deepEqual([tie.status, tie.reason], ["changed", "unlocated"], "1 和 3 离旧位置 2 一样近，不猜");
});

test("黄灯：不带 accept 不记、列为待复核；带 accept 按今天的内容重新记，之后新鲜", () => {
  const { files, pinner, statuses } = setup();
  const done = confirmOne(pinner, UNCONFIRMED);
  files.set("src/greet.ts", CODE.map((l) => l.replace("hello", "hey")));
  const pending = pinner.confirm(pinner.check([done]), plain);
  assert.deepEqual(pending.map((s) => [s.action, s.written]), [["needs-accept", undefined]]);
  const signed = pinner.confirm(pinner.check([done]), accept);
  assert.deepEqual(signed.map((s) => s.action), ["accepted"]);
  assert.deepEqual(statuses([signed[0]!.written!]), ["fresh"]);
});

test("内容一字没变就不问旧内容来源；变了才问，一处问一次", () => {
  const asked: string[] = [];
  const counting: History = { oldText: (file, blob) => (asked.push(`${file}@${blob}`), null) };
  const { files, pinner, statuses } = setup(counting);
  const done = confirmOne(pinner, UNCONFIRMED);
  assert.deepEqual(statuses([done]), ["fresh"]);
  assert.deepEqual(asked, [], "段哈希对得上就不取旧内容");
  files.set("src/greet.ts", CODE.map((l) => l.replace("hello", "hey")));
  statuses([done]);
  assert.deepEqual(asked, [`src/greet.ts@${blobOf(CODE)}`]);
});

test("取得到旧内容：按 hunk 表把旧行段映到今天，内容变了是黄、带逐行对比和旧段", () => {
  const old = CODE.join("\n");
  const history: History = { oldText: (_file, blob) => (blob === blobOf(CODE) ? old : null) };
  const { files, pinner } = setup(history);
  const done = confirmOne(pinner, UNCONFIRMED);
  files.set("src/greet.ts", ["// a", "// b", ...CODE.map((l) => l.replace("hello", "hey"))]);
  const check: PinCheck = pinner.check([done])[0]!;
  assert.deepEqual([check.status, check.reason, check.lines], ["changed", "changed", [4, 5]]);
  assert.deepEqual(check.old, CODE.slice(1, 3));
  assert.deepEqual(check.diff, [
    { kind: "same", text: CODE[1] },
    { kind: "removed", text: "  return `hello ${name}`;" },
    { kind: "added", text: "  return `hey ${name}`;" },
  ]);
  assert.match(diffText(check.diff!), /^- {3}return `hello/m);
  assert.match(diffText(check.diff!), /^\+ {3}return `hey/m);
});

test("取得到旧内容：上面插几行、段内没动，按 hunk 跟到新位置还是绿", () => {
  const old = CODE.join("\n");
  const history: History = { oldText: (_file, blob) => (blob === blobOf(CODE) ? old : null) };
  const { files, pinner } = setup(history);
  const done = confirmOne(pinner, UNCONFIRMED);
  files.set("src/greet.ts", ["// a", "// b", "// c", ...CODE]);
  assert.deepEqual(pinner.check([done]).map((c) => [c.status, c.lines]), [["fresh", [5, 6]]]);
});

test("归一化：LF、去行尾空白、去末尾空行；缩进和注释留着", () => {
  assert.deepEqual(normalizeLines(["  a  \r", "\tb", "", "  "]), ["  a", "\tb"]);
  assert.deepEqual(sliceSpan(["x", "y", "z", ""], [2, 3]), ["y", "z"]);
  assert.equal(sliceSpan(["x", "y", ""], [2, 3]), null, "行段超出文件就是切不出来");
  assert.equal(sliceSpan(null, [1, 2]), null);
});
