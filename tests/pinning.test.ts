/**
 * 钉码编排的账：格式认引用、钉码核心判定、结果按顺序配回文档路径与行号、确认时交格式写回。
 * 用假格式与内存读取器：判定本身由 core.test.ts 守，这里只看先后顺序与配回去的位置。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { blobOf, createPinner, hashSpan } from "../packages/docfirst-pin/src/index.ts";
import type { Target } from "../packages/docfirst-pin/src/index.ts";
import { formatPicker } from "../packages/docfirst-workflow/src/format/index.ts";
import { createPinning } from "../packages/docfirst-workflow/src/pinning/index.ts";
import { fakeFormat, refLine } from "./fake-format.ts";
import { NO_HISTORY } from "./repo.ts";

const CODE = ["// greet", "export function greet(name: string): string {", "  return `hello ${name}`;", "}", ""];
const DOC = "d.a";
const SPAN: Target = { kind: "span", file: "src/greet.ts", a: 2, b: 3 };
const plain = { accept: false };

function setup() {
  const files = new Map<string, string[]>([["src/greet.ts", [...CODE]]]);
  const pinner = createPinner({ reader: { read: (file) => files.get(file) ?? null }, history: NO_HISTORY });
  const pinning = createPinning(pinner, formatPicker([fakeFormat("fake-a", ".a"), fakeFormat("fake-b", ".b")]));
  return { files, pinning };
}

test("checkDoc：格式认出的每处按原来的顺序配回文档、行号、是不是草稿", () => {
  const { pinning } = setup();
  const text = `# 标题\n\n${refLine(SPAN)}\n\n@@docfirst ref src/nowhere.ts:1-2 @@\n\n${refLine({ kind: "has", file: "src/greet.ts", text: "greet" })}\n`;
  const listing = pinning.checkDoc(DOC, text);
  assert.equal(listing.doc, DOC);
  assert.deepEqual(
    listing.items.map((i) => [i.doc, i.reference.at, i.reference.draft, i.status]),
    [
      [DOC, 2, false, "unconfirmed"],
      [DOC, 4, true, "missing"],
      [DOC, 6, false, "fresh"],
    ],
  );
  assert.equal(listing.items[1]!.reason, "file-missing");
  assert.deepEqual(listing.items[0]!.current, CODE.slice(1, 3));
});

test("checkReferences：引用别人认好了也走同一条路，结果跟 checkDoc 一样", () => {
  const { pinning } = setup();
  const text = `${refLine(SPAN)}\n`;
  const byText = pinning.checkDoc(DOC, text);
  assert.deepEqual(pinning.checkReferences(DOC, [{ target: SPAN, record: null, at: 0, draft: false }]), byText);
});

test("confirmDoc：草稿换成带记录的正式记号，步骤与清单一一对应，写回的引用留在原来那一行", () => {
  const { pinning } = setup();
  const text = "# 标题\n\n@@docfirst ref src/greet.ts:2-3 @@\n\n尾巴\n";
  const done = pinning.confirmDoc(DOC, text, plain);
  assert.equal(done.changed, true);
  assert.deepEqual(done.steps.map((s) => s.item), done.listing.items);
  assert.deepEqual(done.steps.map((s) => [s.action, s.item.reference.draft, s.written?.at, s.written?.draft]), [["recorded", true, 2, false]]);
  assert.equal(done.text, `# 标题\n\nREF ref file="src/greet.ts" lines="2-3" hash="${hashSpan(CODE.slice(1, 3))}" blob="${blobOf(CODE)}"\n\n尾巴\n`);
  assert.deepEqual(pinning.checkDoc(DOC, done.text).items.map((i) => [i.status, i.reference.draft]), [["fresh", false]]);
});

test("confirmDoc：一处钉不住只是那一处不动，别的照写；什么都不用写时原文不变", () => {
  const { pinning } = setup();
  const bad = refLine({ kind: "span", file: "src/nowhere.ts", a: 1, b: 2 });
  const done = pinning.confirmDoc(DOC, `${refLine(SPAN)}\n\n${bad}\n`, plain);
  assert.deepEqual(done.steps.map((s) => s.action), ["recorded", "refused"]);
  const lines = done.text.split("\n");
  assert.match(lines[0]!, /hash="[0-9a-f]{12}"/, "钉得住的那处写上了记录");
  assert.equal(lines[2], bad, "红的那处一个字没动");
  const again = pinning.confirmDoc(DOC, done.text, plain);
  assert.deepEqual(again.steps.map((s) => s.action), ["unchanged", "refused"]);
  assert.deepEqual([again.changed, again.text], [false, done.text]);
});

test("confirmDoc：黄灯不带 accept 原样不动，带 accept 按今天的内容重新记", () => {
  const { files, pinning } = setup();
  const confirmed = pinning.confirmDoc(DOC, `${refLine(SPAN)}\n`, plain).text;
  files.set("src/greet.ts", CODE.map((l) => l.replace("hello", "hey")));
  const pending = pinning.confirmDoc(DOC, confirmed, plain);
  assert.deepEqual([pending.steps[0]!.action, pending.changed], ["needs-accept", false]);
  const signed = pinning.confirmDoc(DOC, confirmed, { accept: true });
  assert.equal(signed.steps[0]!.action, "accepted");
  assert.deepEqual(pinning.checkDoc(DOC, signed.text).items.map((i) => i.status), ["fresh"]);
});

test("一篇文档两个格式都认领、或者没有格式认领：报错，不靠顺序定胜负", () => {
  const { pinning } = setup();
  const pinner = createPinner({ reader: { read: () => null }, history: NO_HISTORY });
  const both = createPinning(pinner, formatPicker([fakeFormat("fake-a", ".a"), fakeFormat("fake-也是-a", "a")]));
  assert.throws(() => both.checkDoc(DOC, ""), /fake-a、fake-也是-a 都认领了这篇/);
  assert.throws(() => pinning.checkDoc("d.txt", ""), /d\.txt：没有格式认领这篇文档/);
  assert.throws(() => pinning.confirmDoc("d.txt", "", plain), /没有格式认领这篇文档/);
});
