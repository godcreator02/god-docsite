/**
 * 判定层自己的账：编排服务、比较器、确认的机械写回、草稿记号。
 * 用假格式、内存读取器、内存里的旧内容来源——判定层不读盘、不起进程、不认识任何真格式，这里正好把这条也守住。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  blobOf,
  createService,
  draftOf,
  hashNames,
  hashSpan,
  normalizeLines,
  sliceSpan,
} from "../packages/docfirst-pin/src/index.ts";
import type { History, Reader, Reference, Target } from "../packages/docfirst-pin/src/index.ts";
import { fakeFormat, refLine } from "./fake-format.ts";
import { NO_HISTORY } from "./repo.ts";

const CODE = ["// greet", "export function greet(name: string): string {", "  return `hello ${name}`;", "}", ""];

/** 内存读取器：文件表就是全部世界。目录树按路径前缀算，存在性看表里有没有 */
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
    kindOf(path) {
      if (files.has(path)) return "file";
      return [...files.keys()].some((p) => p.startsWith(`${path}/`)) ? "dir" : null;
    },
  };
}

function setup(history: History = NO_HISTORY) {
  const files = new Map<string, string[]>([["src/greet.ts", [...CODE]]]);
  const service = createService({ formats: [fakeFormat("fake-a", ".a"), fakeFormat("fake-b", ".b")], reader: memoryReader(files), history });
  const statuses = (text: string) => service.resolve(DOC, text).items.map((i) => i.status);
  return { files, service, statuses };
}

const DOC = "d.a";
const SPAN: Target = { kind: "span", file: "src/greet.ts", a: 2, b: 3 };
const REF = refLine(SPAN);
const TEXT = `# 标题\n\n${REF}\n\n尾巴\n`;
const accept = { accept: true };
const plain = { accept: false };

test("resolve：没确认过是未确认；确认后新鲜；改了代码变有变动；文件没了是缺失", () => {
  const { files, service, statuses } = setup();
  assert.deepEqual(statuses(TEXT), ["unconfirmed"]);
  const done = service.confirm(DOC, TEXT, plain);
  assert.deepEqual(done.steps.map((s) => s.action), ["recorded"]);
  assert.deepEqual(statuses(done.text), ["fresh"]);
  files.set("src/greet.ts", CODE.map((l) => l.replace("hello", "hey")));
  assert.deepEqual(statuses(done.text), ["changed"]);
  files.delete("src/greet.ts");
  assert.deepEqual(statuses(done.text), ["missing"]);
});

test("确认把记录写在记号上：段哈希与整文件的 blob 名，都是 12 位前缀、都在进程里算", () => {
  const { service } = setup();
  const done = service.confirm(DOC, TEXT, plain);
  const hash = hashSpan(CODE.slice(1, 3));
  const blob = blobOf(CODE);
  assert.match(hash, /^[0-9a-f]{12}$/);
  assert.match(blob, /^[0-9a-f]{12}$/);
  assert.match(done.text, new RegExp(`^REF ref file="src/greet\\.ts" lines="2-3" hash="${hash}" blob="${blob}"$`, "m"));
  assert.deepEqual(service.resolve(DOC, done.text).items[0]!.reference.record, { kind: "content", hash, blob });
});

test("一篇文档两个格式都认领：报错，不靠顺序定胜负", () => {
  const { service } = setup();
  const both = createService({ formats: [fakeFormat("fake-a", ".a"), fakeFormat("fake-也是-a", "a")], reader: memoryReader(new Map()), history: NO_HISTORY });
  assert.equal(service.formatFor(DOC)?.name, "fake-a");
  assert.equal(service.formatFor("d.txt"), null);
  assert.throws(() => both.formatFor(DOC), /都认领了这篇/);
  assert.throws(() => both.resolve("d.txt", ""), /没有格式认领这篇文档/);
});

test("resolveRefs：引用别人认好了也走同一条路，状态一样", () => {
  const { service } = setup();
  const refs: Reference[] = [{ target: SPAN, record: null, at: 0 }];
  assert.deepEqual(service.resolveRefs(DOC, refs).items.map((i) => i.status), ["unconfirmed"]);
});

test("同一篇里两处引用指向同一段：各带各的记录，都新鲜", () => {
  const { service, statuses } = setup();
  const done = service.confirm(DOC, `${REF}\n\n${REF}\n`, plain);
  assert.deepEqual(statuses(done.text), ["fresh", "fresh"]);
  assert.equal(done.text.match(/hash="/g)?.length, 2);
});

test("一处钉不住只是那一处不动：红的原样留着，别的照写", () => {
  const { service } = setup();
  const bad = refLine({ kind: "span", file: "src/nowhere.ts", a: 1, b: 2 });
  const text = `${REF}\n\n${bad}\n`;
  const done = service.confirm(DOC, text, plain);
  assert.deepEqual(done.steps.map((s) => s.action), ["recorded", "refused"]);
  assert.equal(done.steps[1]!.item.reason, "file-missing");
  const lines = done.text.split("\n");
  assert.match(lines[0]!, /hash="[0-9a-f]{12}"/, "钉得住的那处写上了记录");
  assert.equal(lines[2], bad, "红的那处一个字没动");
});

test("草稿记号：判定层认它、报未确认；确认后格式换成正式记号", () => {
  const { service } = setup();
  const text = "# 标题\n\n@@docfirst ref src/greet.ts:2-3 @@\n\n尾巴\n";
  const listing = service.resolve(DOC, text);
  assert.deepEqual(listing.items.map((i) => [i.status, i.reference.extra?.draft]), [["unconfirmed", true]]);
  const done = service.confirm(DOC, text, plain);
  assert.match(done.text, /^REF ref file="src\/greet\.ts" lines="2-3" hash="[0-9a-f]{12}" blob="[0-9a-f]{12}"$/m);
  assert.doesNotMatch(done.text, /@@docfirst/);
});

test("没写记录属性的正式记号（人手写的）跟草稿一样算未确认，确认时补上记录", () => {
  const { service, statuses } = setup();
  assert.deepEqual(statuses(TEXT), ["unconfirmed"]);
  assert.deepEqual(service.confirm(DOC, TEXT, plain).steps.map((s) => s.action), ["recorded"]);
});

test("草稿记号的哨兵：头尾 @@ 都在才算，载荷要过 toTarget", () => {
  const where = "第 1 行";
  assert.deepEqual(draftOf("@@docfirst ref src/greet.ts:2-3 @@", where), { kind: "span", file: "src/greet.ts", a: 2, b: 3 });
  assert.deepEqual(draftOf("   @@docfirst ref src/greet.ts:2-3 @@  ", where), { kind: "span", file: "src/greet.ts", a: 2, b: 3 });
  assert.equal(draftOf("@@docfirst ref src/greet.ts:2-3", where), null, "少尾哨兵");
  assert.equal(draftOf("docfirst ref src/greet.ts:2-3 @@", where), null, "少头哨兵");
  assert.equal(draftOf("这句话里有 @@docfirst ref src/greet.ts:2-3 @@ 不算", where), null);
  assert.throws(() => draftOf("@@docfirst ref src/greet.ts:3-2 @@", where), /行号不合理/);
  assert.equal(draftOf("@@docfirst probe src @@", where), null, "动作词不认识");
});

test("整文件：不写行号就是整个文件；末尾追加也算变；取不到旧内容就没有 diff", () => {
  const { files, service, statuses } = setup();
  const done = service.confirm(DOC, `${refLine({ kind: "file", file: "src/greet.ts" })}\n`, plain);
  assert.deepEqual(service.resolve(DOC, done.text).items.map((i) => [i.status, i.lines]), [["fresh", [1, 4]]]);
  files.set("src/greet.ts", [...CODE.slice(0, -1), "export const NAME = 1;", ""]);
  const item = service.resolve(DOC, done.text).items[0]!;
  assert.deepEqual([item.status, item.reason, item.diff], ["changed", "changed", undefined]);
  assert.deepEqual(statuses(done.text), ["changed"]);
});

test("目录树：记录是名字表的哈希；名字变了是黄、给当前表不给增删；目录没了是红", () => {
  const { files, service } = setup();
  files.set("src/util.ts", ["export const a = 1;"]);
  files.set("src/lib/deep.ts", ["x"]);
  const done = service.confirm(DOC, `${refLine({ kind: "tree", dir: "src", depth: 1 })}\n`, plain);
  assert.match(done.text, new RegExp(`^REF tree dir="src" depth="1" hash="${hashNames(["greet.ts", "lib/", "util.ts"])}"$`, "m"));
  assert.deepEqual(service.resolve(DOC, done.text).items[0]!.current, ["greet.ts", "lib/", "util.ts"]);

  files.set("src/tag.ts", ["t"]);
  files.delete("src/util.ts");
  const changed = service.resolve(DOC, done.text).items[0]!;
  assert.deepEqual([changed.status, changed.reason, changed.diff, changed.old], ["changed", "changed", undefined, undefined]);
  assert.deepEqual(changed.current, ["greet.ts", "lib/", "tag.ts"]);

  for (const key of [...files.keys()]) if (key.startsWith("src/")) files.delete(key);
  const gone = service.resolve(DOC, done.text).items[0]!;
  assert.deepEqual([gone.status, gone.reason], ["missing", "dir-missing"]);
});

test("存在性：记录是类型；在就绿、没了红、类型变了红；absent 反过来，它出现了就红；两种都没有黄", () => {
  const { files, service, statuses } = setup();
  const text = [
    refLine({ kind: "exists", path: "src/greet.ts", absent: false }),
    refLine({ kind: "exists", path: "src/remove.ts", absent: true }),
    refLine({ kind: "exists", path: "src", absent: false }),
  ].join("\n\n");
  assert.deepEqual(statuses(text), ["unconfirmed", "unconfirmed", "unconfirmed"]);
  const done = service.confirm(DOC, text, plain);
  assert.match(done.text, /^REF exists path="src\/greet\.ts" type="file"$/m);
  assert.match(done.text, /^REF absent path="src\/remove\.ts" type="absent"$/m);
  assert.match(done.text, /^REF exists path="src" type="dir"$/m);
  assert.deepEqual(statuses(done.text), ["fresh", "fresh", "fresh"]);

  files.set("src/remove.ts", [""]);
  files.delete("src/greet.ts");
  files.set("src/greet.ts/index.ts", ["x"]);
  const items = service.resolve(DOC, done.text).items;
  assert.deepEqual(items.map((i) => [i.status, i.reason]), [["missing", "type-changed"], ["missing", "appeared"], ["fresh", undefined]]);

  const refuse = service.confirm(DOC, refLine({ kind: "exists", path: "src/remove.ts", absent: true }), plain);
  assert.match(refuse.steps[0]!.item.reason!, /appeared/);
});

test("名字：正式记号本身就是确认过；文件里有这个字面量就绿，没了红；草稿要 confirm", () => {
  const { files, service, statuses } = setup();
  const has: Target = { kind: "has", file: "src/greet.ts", text: "export function greet" };
  const fresh = service.resolve(DOC, `${refLine(has)}\n`).items[0]!;
  assert.deepEqual([fresh.status, fresh.lines], ["fresh", [2, 2]]);
  const draft = '@@docfirst has src/greet.ts "export function greet" @@\n';
  assert.deepEqual(statuses(draft), ["unconfirmed"]);
  assert.match(service.confirm(DOC, draft, plain).text, /^REF has file="src\/greet\.ts" text="export function greet"$/m);
  files.set("src/greet.ts", CODE.map((l) => l.replace("greet(", "hello(")));
  assert.deepEqual(service.resolve(DOC, `${refLine(has)}\n`).items.map((i) => [i.status, i.reason]), [["missing", "text-missing"]]);
  assert.equal(service.confirm(DOC, draft, plain).steps[0]!.action, "refused");
});

test("取不到旧内容时滑窗跟行段：代码整体下移，绿、带新行号；confirm 机械写回新行号与新 blob", () => {
  const { files, service } = setup();
  const done = service.confirm(DOC, TEXT, plain);
  files.set("src/greet.ts", ["// 新加的一行", "// 又一行", ...CODE]);
  const item = service.resolve(DOC, done.text).items[0]!;
  assert.equal(item.status, "fresh");
  assert.deepEqual(item.lines, [4, 5]);
  const again = service.confirm(DOC, done.text, plain);
  assert.deepEqual(again.steps.map((s) => s.action), ["moved"]);
  assert.match(again.text, new RegExp(`^REF ref file="src/greet\\.ts" lines="4-5" hash="${hashSpan(CODE.slice(1, 3))}" blob="${blobOf(files.get("src/greet.ts")!)}"$`, "m"));
  assert.deepEqual(service.confirm(DOC, again.text, plain).steps.map((s) => s.action), ["unchanged"], "写回之后原地不动，再确认一个字不改");
});

test("滑窗找不到这段：有变动、位置不明，行号停在旧位置；旧位置超出文件才算缺失", () => {
  const { files, service } = setup();
  const done = service.confirm(DOC, TEXT, plain);
  files.set("src/greet.ts", ["// 新加的一行", ...CODE.map((l) => l.replace("hello", "hey"))]);
  const moved = service.resolve(DOC, done.text).items[0]!;
  assert.deepEqual([moved.status, moved.reason, moved.lines, moved.diff], ["changed", "unlocated", [2, 3], undefined]);

  files.set("src/greet.ts", ["// greet", ""]);
  const gone = service.resolve(DOC, done.text).items[0]!;
  assert.deepEqual([gone.status, gone.reason], ["missing", "vanished"]);
});

test("滑窗撞车：取离旧位置最近的一处；两处一样近就不猜", () => {
  const { files, service } = setup();
  const done = service.confirm(DOC, TEXT, plain);
  const [fn, ret] = [CODE[1]!, CODE[2]!];
  files.set("src/greet.ts", ["a", "b", "c", fn, ret, "}", "d", fn, ret, "}", ""]);
  const near = service.resolve(DOC, done.text).items[0]!;
  assert.deepEqual([near.status, near.lines], ["fresh", [4, 5]], "4 和 8 两处，离旧位置 2 更近的是 4");

  files.set("src/greet.ts", [fn, ret, fn, ret, ""]);
  const tie = service.resolve(DOC, done.text).items[0]!;
  assert.deepEqual([tie.status, tie.reason], ["changed", "unlocated"], "1 和 3 离旧位置 2 一样近，不猜");
});

test("黄灯：不带 accept 原样不动、列为待复核；带 accept 按今天的内容重新记，之后新鲜", () => {
  const { files, service, statuses } = setup();
  const done = service.confirm(DOC, TEXT, plain);
  files.set("src/greet.ts", CODE.map((l) => l.replace("hello", "hey")));
  const pending = service.confirm(DOC, done.text, plain);
  assert.deepEqual(pending.steps.map((s) => s.action), ["needs-accept"]);
  assert.equal(pending.changed, false);
  const signed = service.confirm(DOC, done.text, accept);
  assert.deepEqual(signed.steps.map((s) => s.action), ["accepted"]);
  assert.deepEqual(statuses(signed.text), ["fresh"]);
});

test("内容一字没变就不问旧内容来源；变了才问，一处问一次", () => {
  const asked: string[] = [];
  const counting: History = { oldText: (file, blob) => (asked.push(`${file}@${blob}`), null), hunks: NO_HISTORY.hunks };
  const { files, service, statuses } = setup(counting);
  const done = service.confirm(DOC, TEXT, plain);
  assert.deepEqual(statuses(done.text), ["fresh"]);
  assert.deepEqual(asked, [], "段哈希对得上就不取旧内容");
  files.set("src/greet.ts", CODE.map((l) => l.replace("hello", "hey")));
  statuses(done.text);
  assert.deepEqual(asked, [`src/greet.ts@${blobOf(CODE)}`]);
});

test("取得到旧内容：按 hunk 表把旧行段映到今天，内容变了是黄、带 diff 和旧段", () => {
  const old = CODE.join("\n");
  const history: History = {
    oldText: (_file, blob) => (blob === blobOf(CODE) ? old : null),
    // 头上插两行、第 3 行改掉：旧 0 行后插 2 行，旧第 3 行换成新第 5 行
    hunks: () => [
      { oldStart: 0, oldLen: 0, newStart: 1, newLen: 2 },
      { oldStart: 3, oldLen: 1, newStart: 5, newLen: 1 },
    ],
  };
  const { files, service } = setup(history);
  const done = service.confirm(DOC, TEXT, plain);
  files.set("src/greet.ts", ["// a", "// b", ...CODE.map((l) => l.replace("hello", "hey"))]);
  const item = service.resolve(DOC, done.text).items[0]!;
  assert.deepEqual([item.status, item.reason, item.lines], ["changed", "changed", [4, 5]]);
  assert.deepEqual(item.old, CODE.slice(1, 3));
  assert.match(item.diff!, /^- {3}return `hello/m);
  assert.match(item.diff!, /^\+ {3}return `hey/m);
});

test("从旧记录簿迁来的只有 hash 的记录：照样核对，挪了位置靠滑窗", () => {
  const { files, service } = setup();
  const text = `REF ref file="src/greet.ts" lines="2-3" hash="${hashSpan(CODE.slice(1, 3))}"\n`;
  assert.deepEqual(service.resolve(DOC, text).items.map((i) => i.status), ["fresh"]);
  files.set("src/greet.ts", ["// 头一行", ...CODE]);
  assert.deepEqual(service.resolve(DOC, text).items.map((i) => [i.status, i.lines]), [["fresh", [3, 4]]]);
});

test("归一化：LF、去行尾空白、去末尾空行；缩进和注释留着", () => {
  assert.deepEqual(normalizeLines(["  a  \r", "\tb", "", "  "]), ["  a", "\tb"]);
  assert.deepEqual(sliceSpan(["x", "y", "z", ""], [2, 3]), ["y", "z"]);
  assert.equal(sliceSpan(["x", "y", ""], [2, 3]), null, "行段超出文件就是切不出来");
  assert.equal(sliceSpan(null, [1, 2]), null);
});
