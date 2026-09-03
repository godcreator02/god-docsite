/**
 * 核心自己的账：编排服务 + hash 比较器 + 草稿记号。
 * 用假格式包、内存读取器、内存记录簿——核心不读盘、不认识任何真格式，这里正好把这条也守住。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createHashComparator,
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

function memoryReader(files: Map<string, string[]>): Reader {
  return { read: (file) => files.get(file) ?? null };
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
  const refs: Reference[] = [{ target: { file: "src/greet.ts", a: 2, b: 3 }, at: 0 }];
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
  assert.deepEqual(draftOf("@@livedoc ref src/greet.ts:2-3 @@", where), { file: "src/greet.ts", a: 2, b: 3 });
  assert.deepEqual(draftOf("   @@livedoc ref src/greet.ts:2-3 @@  ", where), { file: "src/greet.ts", a: 2, b: 3 });
  assert.equal(draftOf("@@livedoc ref src/greet.ts:2-3", where), null, "少尾哨兵");
  assert.equal(draftOf("livedoc ref src/greet.ts:2-3 @@", where), null, "少头哨兵");
  assert.equal(draftOf("这句话里有 @@livedoc ref src/greet.ts:2-3 @@ 不算", where), null);
  assert.equal(draftOf("@@livedoc tree src @@", where), null, "动作词只有 ref");
  assert.throws(() => draftOf("@@livedoc ref src/greet.ts:3-2 @@", where), /行号不合理/);
});

test("换比较器：记录的 kind 对不上就当没确认过，不猜", () => {
  const { files, ledger, service } = setup();
  service.confirm(DOC, TEXT);
  const other = createService({
    formats: [fakeFormat("fake-a", ".a")],
    reader: memoryReader(files),
    ledger,
    comparator: { ...createHashComparator(), kind: "别的" },
  });
  assert.deepEqual(other.resolve(DOC, TEXT).items.map((i) => i.status), ["unconfirmed"]);
});

test("hash 比较器不跟行段：代码整体下移，它只会说有变动", () => {
  const { files, service } = setup();
  const done = service.confirm(DOC, TEXT);
  files.set("src/greet.ts", ["// 新加的一行", ...CODE]);
  const item = service.resolve(DOC, done.text).items[0]!;
  assert.equal(item.status, "changed");
  assert.deepEqual(item.lines, [2, 3], "hash 版记的是记号上那几行，不会跟到 3-4");
});

test("归一化：LF、去行尾空白、去末尾空行；缩进和注释留着", () => {
  assert.deepEqual(normalizeLines(["  a  \r", "\tb", "", "  "]), ["  a", "\tb"]);
  assert.deepEqual(sliceSpan(["x", "y", "z", ""], [2, 3]), ["y", "z"]);
  assert.equal(sliceSpan(["x", "y", ""], [2, 3]), null, "行段超出文件就是切不出来");
  assert.equal(sliceSpan(null, [1, 2]), null);
});

test("键和目标是一对：文件名里带冒号也认得回来", () => {
  const t: Target = { file: "src/a:b.ts", a: 2, b: 3 };
  assert.equal(targetKey(t), "src/a:b.ts:2-3");
  assert.deepEqual(keyToTarget(targetKey(t)), t);
});
