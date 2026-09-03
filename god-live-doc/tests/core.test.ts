/**
 * 核心自己的账：编排服务 + hash 比较器 + 草稿记号。
 * 用假格式包、内存读取器、内存记录簿——核心不读盘、不认识任何真格式，这里正好把这条也守住。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createHashComparator,
  createKindComparator,
  createService,
  draftOf,
  targetKey,
  keyToTarget,
  normalizeLines,
  sliceSpan,
} from "@god-live-doc/core";
import type { Comparator, Ledger, MemoRecord, Reader, Reference, Target } from "@god-live-doc/core";
import { fakeFormat } from "./fake-format.ts";

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

function memoryLedger(): Ledger & { dump(): Record<string, Record<string, MemoRecord>> } {
  const data: Record<string, Record<string, MemoRecord>> = {};
  return {
    get: (doc, target) => data[doc]?.[targetKey(target)] ?? null,
    set(doc, target, record) {
      (data[doc] ??= {})[targetKey(target)] = record;
    },
    list: (doc) => Object.entries(data[doc] ?? {}).map(([key, record]) => ({ target: keyToTarget(key), record })),
    remove(doc, target) {
      delete data[doc]?.[targetKey(target)];
    },
    docs: () => Object.keys(data).filter((doc) => Object.keys(data[doc] ?? {}).length > 0),
    save() {},
    dump: () => data,
  };
}

function setup(comparator: Comparator = createHashComparator()) {
  const files = new Map<string, string[]>([["src/greet.ts", [...CODE]]]);
  const ledger = memoryLedger();
  const service = createService({
    formats: [fakeFormat("fake-a", ".a"), fakeFormat("fake-b", ".b")],
    reader: memoryReader(files),
    ledger,
    comparator,
  });
  return { files, ledger, service };
}

const DOC = "d.a";
const REF = "REF src/greet.ts:2-3";
const TEXT = `# 标题\n\n${REF}\n\n尾巴\n`;

test("resolve：没确认过是未确认；确认后新鲜；改了代码变有变动；文件没了是缺失", () => {
  const { files, service } = setup();
  const statuses = (text = TEXT) => service.resolve(DOC, text).items.map((i) => i.status);
  assert.deepEqual(statuses(), ["unconfirmed"]);
  const done = service.confirm(DOC, TEXT);
  assert.deepEqual(done.problems, []);
  assert.deepEqual(statuses(done.text), ["fresh"]);
  files.set("src/greet.ts", CODE.map((l) => l.replace("hello", "hey")));
  assert.deepEqual(statuses(done.text), ["changed"]);
  files.delete("src/greet.ts");
  assert.deepEqual(statuses(done.text), ["missing"]);
});

test("文档删了、挪了：strays 按文档清单一览，forget 整个忘掉，别的文档不动", () => {
  const { ledger, service } = setup();
  service.confirm(DOC, TEXT);
  service.confirm("e.a", TEXT);
  assert.deepEqual(service.strays([DOC, "e.a"]), []);
  assert.deepEqual(service.strays([DOC]), ["e.a"]);
  assert.deepEqual(service.forget([DOC]), ["e.a"]);
  assert.deepEqual(ledger.docs(), [DOC]);
  assert.deepEqual(service.resolve(DOC, TEXT).items.map((i) => i.status), ["fresh"]);
});

test("一篇文档两个格式包都认领：报错，不靠顺序定胜负", () => {
  const { service } = setup();
  const both = createService({
    formats: [fakeFormat("fake-a", ".a"), fakeFormat("fake-也是-a", "a")],
    reader: memoryReader(new Map()),
    ledger: memoryLedger(),
    comparator: createHashComparator(),
  });
  assert.equal(service.formatFor(DOC)?.name, "fake-a");
  assert.equal(service.formatFor("d.txt"), null);
  assert.throws(() => both.formatFor(DOC), /都认领了这篇/);
  assert.throws(() => both.resolve("d.txt", ""), /没有格式包认领这篇文档/);
});

test("resolveRefs：引用别人认好了也走同一条路，状态一样", () => {
  const { service } = setup();
  const refs: Reference[] = [{ target: { kind: "span", file: "src/greet.ts", a: 2, b: 3 }, at: 0 }];
  assert.deepEqual(service.resolveRefs(DOC, refs).items.map((i) => i.status), ["unconfirmed"]);
});

test("孤儿：文档里删掉引用，记录还在就报孤儿；再确认一次清掉", () => {
  const { ledger, service } = setup();
  service.confirm(DOC, TEXT);
  const empty = "# 标题\n\n没有引用了\n";
  assert.equal(service.resolve(DOC, empty).orphans.length, 1);
  service.confirm(DOC, empty);
  assert.equal(service.resolve(DOC, empty).orphans.length, 0);
  assert.deepEqual(ledger.dump()[DOC], {});
});

test("同一篇里两处引用指向同一段：共用一条记录，不算孤儿", () => {
  const { ledger, service } = setup();
  const text = `${REF}\n\n${REF}\n`;
  const done = service.confirm(DOC, text);
  assert.deepEqual(service.resolve(DOC, done.text).items.map((i) => i.status), ["fresh", "fresh"]);
  assert.equal(Object.keys(ledger.dump()[DOC] ?? {}).length, 1);
  assert.equal(service.resolve(DOC, done.text).orphans.length, 0);
});

test("一处钉不住整篇拒：记录簿一条不写，文档一个字不改", () => {
  const { ledger, service } = setup();
  const text = `${REF}\n\nREF src/nowhere.ts:1-2\n`;
  const done = service.confirm(DOC, text);
  assert.equal(done.problems.length, 1);
  assert.match(done.problems[0]!, /第 3 行/);
  assert.equal(done.changed, false);
  assert.equal(done.text, text);
  assert.equal(ledger.dump()[DOC], undefined);
});

test("草稿记号：核心认它、报未确认；确认后格式包换成正式记号", () => {
  const { service } = setup();
  const text = "# 标题\n\n@@livedoc ref src/greet.ts:2-3 @@\n\n尾巴\n";
  const listing = service.resolve(DOC, text);
  assert.deepEqual(listing.items.map((i) => [i.status, i.reference.extra?.draft]), [["unconfirmed", true]]);
  const done = service.confirm(DOC, text);
  assert.match(done.text, /^REF src\/greet\.ts:2-3$/m);
  assert.doesNotMatch(done.text, /@@livedoc/);
});

test("草稿记号的哨兵：头尾 @@ 都在才算，载荷要过 toTarget", () => {
  const where = "第 1 行";
  assert.deepEqual(draftOf("@@livedoc ref src/greet.ts:2-3 @@", where), { kind: "span", file: "src/greet.ts", a: 2, b: 3 });
  assert.deepEqual(draftOf("   @@livedoc ref src/greet.ts:2-3 @@  ", where), { kind: "span", file: "src/greet.ts", a: 2, b: 3 });
  assert.equal(draftOf("@@livedoc ref src/greet.ts:2-3", where), null, "少尾哨兵");
  assert.equal(draftOf("livedoc ref src/greet.ts:2-3 @@", where), null, "少头哨兵");
  assert.equal(draftOf("这句话里有 @@livedoc ref src/greet.ts:2-3 @@ 不算", where), null);
  assert.throws(() => draftOf("@@livedoc ref src/greet.ts:3-2 @@", where), /行号不合理/);
});

test("别家的记录：kind 对不上，比较器自己当没确认过，不猜；核心不看 kind", () => {
  const { ledger, service } = setup();
  ledger.set(DOC, { kind: "span", file: "src/greet.ts", a: 2, b: 3 }, { kind: "别的", hash: "x" });
  assert.deepEqual(service.resolve(DOC, TEXT).items.map((i) => i.status), ["unconfirmed"]);
});

test("整文件：不写行号就是整个文件；末尾追加也算变", () => {
  const { files, service } = setup();
  const done = service.confirm(DOC, "REF src/greet.ts:all\n");
  assert.deepEqual(done.problems, []);
  assert.deepEqual(service.resolve(DOC, done.text).items.map((i) => [i.status, i.lines]), [["fresh", [1, 4]]]);
  files.set("src/greet.ts", [...CODE.slice(0, -1), "export const NAME = 1;", ""]);
  assert.deepEqual(service.resolve(DOC, done.text).items.map((i) => i.status), ["changed"]);
});

test("目录树：名字多了少了是黄带 diff、目录没了是红；按 kind 分派，记录存名字表", () => {
  const { files, ledger, service } = setup(createKindComparator({ span: createHashComparator() }));
  files.set("src/util.ts", ["export const a = 1;"]);
  files.set("src/lib/deep.ts", ["x"]);
  const done = service.confirm(DOC, "REF tree src depth=1\n");
  assert.deepEqual(done.problems, []);
  assert.deepEqual(ledger.dump()[DOC]!["tree src depth=1"], { kind: "tree", names: ["greet.ts", "lib/", "util.ts"] });
  assert.deepEqual(service.resolve(DOC, done.text).items[0]!.current, ["greet.ts", "lib/", "util.ts"]);

  files.set("src/tag.ts", ["t"]);
  files.delete("src/util.ts");
  const changed = service.resolve(DOC, done.text).items[0]!;
  assert.equal(changed.status, "changed");
  assert.match(changed.diff!, /^\+ tag\.ts$/m);
  assert.match(changed.diff!, /^- util\.ts$/m);
  assert.deepEqual(changed.old, ["greet.ts", "lib/", "util.ts"]);

  for (const key of [...files.keys()]) if (key.startsWith("src/")) files.delete(key);
  const gone = service.resolve(DOC, done.text).items[0]!;
  assert.deepEqual([gone.status, gone.reason], ["missing", "dir-missing"]);

  const deep = service.resolve(DOC, "REF tree src depth=2\n").items[0]!;
  assert.equal(deep.status, "missing");
});

test("存在性：在就绿、没了红、类型变了红；absent 反过来，它出现了就红；两种都没有黄", () => {
  const { files, service } = setup(createKindComparator({ span: createHashComparator() }));
  const text = "REF exists src/greet.ts\n\nREF absent src/remove.ts\n\nREF exists src\n";
  assert.deepEqual(service.resolve(DOC, text).items.map((i) => i.status), ["unconfirmed", "unconfirmed", "unconfirmed"]);
  const done = service.confirm(DOC, text);
  assert.deepEqual(done.problems, []);
  assert.deepEqual(service.resolve(DOC, done.text).items.map((i) => i.status), ["fresh", "fresh", "fresh"]);

  files.set("src/remove.ts", [""]);
  files.delete("src/greet.ts");
  files.set("src/greet.ts/index.ts", ["x"]);
  const items = service.resolve(DOC, done.text).items;
  assert.deepEqual(items.map((i) => [i.status, i.reason]), [["missing", "type-changed"], ["missing", "appeared"], ["fresh", undefined]]);

  const refuse = service.confirm(DOC, "REF absent src/remove.ts\n");
  assert.match(refuse.problems[0]!, /断言它不在，它却在/);
});

test("名字：文件里有这个字面量就绿，没了红；没有黄", () => {
  const { files, service } = setup(createKindComparator({ span: createHashComparator() }));
  const text = 'REF has src/greet.ts "export function greet"\n';
  const done = service.confirm(DOC, text);
  assert.deepEqual(done.problems, []);
  const fresh = service.resolve(DOC, done.text).items[0]!;
  assert.deepEqual([fresh.status, fresh.lines], ["fresh", [2, 2]]);
  files.set("src/greet.ts", CODE.map((l) => l.replace("greet(", "hello(")));
  assert.deepEqual(service.resolve(DOC, done.text).items.map((i) => [i.status, i.reason]), [["missing", "text-missing"]]);
  assert.match(service.confirm(DOC, text).problems[0]!, /文件里没有这个名字/);
});

test("草稿记号的五种写法，和记录簿键的来回", () => {
  const where = "第 1 行";
  const cases: Array<[string, Target]> = [
    ["@@livedoc ref config.json @@", { kind: "file", file: "config.json" }],
    ["@@livedoc tree src @@", { kind: "tree", dir: "src", depth: 1 }],
    ["@@livedoc tree src/ depth=2 glob=*.test.ts @@", { kind: "tree", dir: "src", depth: 2, glob: "*.test.ts" }],
    ["@@livedoc exists src/store.ts @@", { kind: "exists", path: "src/store.ts", absent: false }],
    ["@@livedoc absent src/remove.ts @@", { kind: "exists", path: "src/remove.ts", absent: true }],
    ['@@livedoc has src/store.ts "export function save" @@', { kind: "has", file: "src/store.ts", text: "export function save" }],
    ["@@livedoc has src/a:b.ts save @@", { kind: "has", file: "src/a:b.ts", text: "save" }],
  ];
  for (const [line, target] of cases) {
    assert.deepEqual(draftOf(line, where), target, line);
    assert.deepEqual(keyToTarget(targetKey(target)), target, targetKey(target));
  }
  assert.equal(targetKey({ kind: "has", file: "a.ts", text: 'say("hi")' }), 'has a.ts "say(\\"hi\\")"');
  assert.equal(draftOf("@@livedoc probe src @@", where), null, "动作词不认识");
});

test("hash 比较器滑窗跟行段：代码整体下移，绿、带新行号；确认后记号写回新行段", () => {
  const { files, service } = setup();
  const done = service.confirm(DOC, TEXT);
  files.set("src/greet.ts", ["// 新加的一行", "// 又一行", ...CODE]);
  const item = service.resolve(DOC, done.text).items[0]!;
  assert.equal(item.status, "fresh");
  assert.deepEqual(item.lines, [4, 5]);
  const again = service.confirm(DOC, done.text);
  assert.match(again.text, /^REF src\/greet\.ts:4-5$/m);
});

test("hash 比较器找不到这段：有变动、位置不明，行号停在旧位置；旧位置超出文件才算缺失", () => {
  const { files, service } = setup();
  const done = service.confirm(DOC, TEXT);
  files.set("src/greet.ts", ["// 新加的一行", ...CODE.map((l) => l.replace("hello", "hey"))]);
  const moved = service.resolve(DOC, done.text).items[0]!;
  assert.equal(moved.status, "changed");
  assert.equal(moved.reason, "unlocated");
  assert.deepEqual(moved.lines, [2, 3], "没有旧内容可比，行号停在记录里那几行");
  assert.equal(moved.diff, undefined);

  files.set("src/greet.ts", ["// greet", ""]);
  const gone = service.resolve(DOC, done.text).items[0]!;
  assert.equal(gone.status, "missing");
  assert.equal(gone.reason, "vanished");
});

test("hash 比较器滑窗撞车：取离旧位置最近的一处；两处一样近就不猜", () => {
  const { files, service } = setup();
  const done = service.confirm(DOC, TEXT);
  const [fn, ret] = [CODE[1]!, CODE[2]!];
  files.set("src/greet.ts", ["a", "b", "c", fn, ret, "}", "d", fn, ret, "}", ""]);
  const near = service.resolve(DOC, done.text).items[0]!;
  assert.equal(near.status, "fresh");
  assert.deepEqual(near.lines, [4, 5], "4 和 8 两处，离旧位置 2 更近的是 4");

  files.set("src/greet.ts", [fn, ret, fn, ret, ""]);
  const tie = service.resolve(DOC, done.text).items[0]!;
  assert.equal(tie.status, "changed");
  assert.equal(tie.reason, "unlocated", "1 和 3 离旧位置 2 一样近，不猜");
});

test("归一化：LF、去行尾空白、去末尾空行；缩进和注释留着", () => {
  assert.deepEqual(normalizeLines(["  a  \r", "\tb", "", "  "]), ["  a", "\tb"]);
  assert.deepEqual(sliceSpan(["x", "y", "z", ""], [2, 3]), ["y", "z"]);
  assert.equal(sliceSpan(["x", "y", ""], [2, 3]), null, "行段超出文件就是切不出来");
  assert.equal(sliceSpan(null, [1, 2]), null);
});

test("键和目标是一对：文件名里带冒号也认得回来", () => {
  const t: Target = { kind: "span", file: "src/a:b.ts", a: 2, b: 3 };
  assert.equal(targetKey(t), "src/a:b.ts:2-3");
  assert.deepEqual(keyToTarget(targetKey(t)), t);
});
