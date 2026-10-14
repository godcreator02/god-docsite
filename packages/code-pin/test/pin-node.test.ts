/**
 * 语法树上的钉：标记换成 codePin 节点，核对结果按钉对象配回各自的标记；生成物里的代码块长什么样。
 */
import { test } from "vitest";
import assert from "node:assert/strict";
import { exportCodeOf, mdxMarker, parseMdx, replacePinMarkers } from "../src/core/index.ts";
import type { DocPin, PinCheck, Target } from "../src/core/index.ts";

const T: Target = { kind: "span", file: "src/greet.ts", a: 2, b: 3 };

/** 不读任何文件的核对：每处给一个固定的结果，逐处记下被问到的钉 */
function fakeCheck(asked: DocPin[] = []) {
  return (pins: DocPin[]): PinCheck<DocPin>[] =>
    pins.map((pin) => {
      asked.push(pin);
      return { pin, status: "fresh", lines: [pin.line, pin.line], current: [`第 ${pin.line} 行的钉`] };
    });
}

test("标记换成 codePin：位置照抄标记，核对结果挂在节点上；普通注释原样留着", () => {
  const tree = parseMdx(`# 标题\n\n${mdxMarker(T, null)}\n\n{/* 普通注释 */}\n\n- 列表里\n\n  ${mdxMarker({ kind: "file", file: "a.json" }, null)}\n`);
  const asked: DocPin[] = [];
  const pins = replacePinMarkers(tree, fakeCheck(asked));
  assert.deepEqual(pins.map((p) => [p.type, p.position?.start.line, p.check.pin.line]), [["codePin", 3, 3], ["codePin", 9, 9]]);
  assert.equal(tree.children[1], pins[0], "顶层的标记换掉了");
  assert.equal(tree.children[2]!.type, "mdxFlowExpression", "普通注释不动");
  assert.deepEqual(asked.map((p) => p.line), [3, 9], "一次问完");
});

test("核对结果按钉对象配回：调用方打乱了顺序也配得上", () => {
  const tree = parseMdx(`${mdxMarker(T, null)}\n\n${mdxMarker({ kind: "file", file: "a.json" }, null)}\n`);
  replacePinMarkers(tree, (pins) => fakeCheck()(pins).reverse());
  assert.deepEqual(tree.children.map((n) => (n.type === "codePin" ? n.check.pin.target.kind : n.type)), ["span", "file"]);
});

test("核对结果里混进了不是这棵树上认出的钉：报错，不悄悄漏掉", () => {
  const tree = parseMdx(`${mdxMarker(T, null)}\n`);
  assert.throws(() => replacePinMarkers(tree, () => [{ pin: { target: T, record: null, line: 9 }, status: "fresh", lines: [1, 1], current: [] }]), /第 9 行/);
});

test("没有标记的树：不问核对", () => {
  const tree = parseMdx("# 只有标题\n");
  assert.deepEqual(replacePinMarkers(tree, () => assert.fail("不该核对")), []);
});

test("生成物里的代码块：行段标题写今天的位置，整文件写 路径:1-行数，目录树给名字表", () => {
  const span: PinCheck<DocPin> = { pin: { target: T, record: null, line: 1 }, status: "fresh", lines: [7, 8], current: ["a", "b"] };
  assert.deepEqual(exportCodeOf({ ...span, lines: [7, 8] }), { type: "code", lang: "ts", meta: 'title="src/greet.ts:7-8"', value: "a\nb" });
  assert.deepEqual(exportCodeOf({ ...span, pin: { ...span.pin, target: { kind: "file", file: "config.json" } }, lines: [1, 2] }).meta, 'title="config.json:1-2"');
  const tree = exportCodeOf({ ...span, pin: { ...span.pin, target: { kind: "tree", dir: "src", depth: 1, glob: "*.ts" } }, current: ["a.ts", "lib/"] });
  assert.deepEqual([tree.lang, tree.meta, tree.value], ["text", 'title="src/ *.ts"', "a.ts\nlib/"]);
  assert.equal(exportCodeOf({ ...span, pin: { ...span.pin, target: { kind: "span", file: "x.unknown", a: 1, b: 1 } } }).lang, "text", "认不出的后缀写 text");
});
