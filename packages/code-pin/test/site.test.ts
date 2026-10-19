/**
 * 站点的 remark 插件：标记换成钉码外框，外框带状态，收起时一行，点开是代码块或文件树。
 * 看的是页面上看得见的东西：外框的状态属性、代码块的语言、标题与起始行号（fumadocs 从 meta 里读的那两样）、
 * 代码内容；最后用 @mdx-js/mdx 编译一页，确认状态真的落到了 HTML 属性上。
 */
import { test } from "vitest";
import assert from "node:assert/strict";
import { compile } from "@mdx-js/mdx";
import type { Code, Root, RootContent } from "mdast";
import type { MdxJsxFlowElement } from "mdast-util-mdx";
import { mdxMarker, parseMdx } from "../src/core/index.ts";
import type { CodePin, DocPin, Pin, PinCheck, Pinner, Target } from "../src/core/index.ts";
import { remarkCodePin, UNLOCATED_NOTE } from "../src/site/index.ts";

const T: Target = { kind: "span", file: "src/greet.ts", a: 2, b: 3 };
const CURRENT = ["export function greet(name: string): string {", "  return `hello ${name}`;"];
const OLD = ["export function greet(name: string): string {", "  return `hi ${name}`;"];

type Outcome = Omit<PinCheck, "pin">;
const FRESH: Outcome = { status: "fresh", lines: [2, 3], current: CURRENT };

/** 不读文件的钉码核心：每处钉按给定的结论核对 */
function pinnerOf(outcome: (pin: Pin) => Outcome): Pinner {
  return {
    check: <P extends Pin>(pins: readonly P[]) => pins.map((pin) => ({ ...outcome(pin), pin })),
    confirm: () => assert.fail("页面上不确认"),
  };
}

/** 一页 mdx 跑一遍插件，交回换上的钉码外框 */
function framesOf(text: string, outcome: (pin: Pin) => Outcome = () => FRESH): CodePin[] {
  const tree = parseMdx(text);
  remarkCodePin({ pinner: pinnerOf(outcome) })(tree, { path: "a.mdx" });
  return tree.children.filter((n): n is CodePin => n.type === "codePin");
}

/** 站点从代码块 meta 里读的几样：标题、起始行号、不带行号 */
function shownOf(node: RootContent): { lang: string | null | undefined; title?: string; lineNumbers?: number; noLineNumbers?: true; value: string } {
  const code = node as Code;
  const title = /title="([^"]*)"/.exec(code.meta ?? "")?.[1];
  const start = /\blineNumbers=(\d+)/.exec(code.meta ?? "")?.[1];
  const off = /\bnoLineNumbers\b/.test(code.meta ?? "");
  return {
    lang: code.lang,
    ...(title !== undefined ? { title } : {}),
    ...(start !== undefined ? { lineNumbers: Number(start) } : {}),
    ...(off ? { noLineNumbers: true as const } : {}),
    value: code.value,
  };
}

const statusOf = (frame: CodePin): unknown => frame.data?.hProperties?.dataPinStatus;
/** 外框里点开才看得见的那块：代码块或文件树（第一个孩子是收起时那一行 summary） */
const bodyOf = (frame: CodePin): RootContent => frame.children[1]!;
const mark = (target: Target) => mdxMarker(target, { kind: "content", hash: "3fa9c2e1b07d", blob: "2689fa073ac6" });

test("确认过与未确认的标记都换成钉码外框：外框带状态，代码块标题写来源、行号对上源文件", () => {
  const frames = framesOf(`${mark(T)}\n\n${mdxMarker(T, null)}\n`, (pin) => (pin.record === null ? { ...FRESH, status: "unconfirmed" } : FRESH));
  assert.deepEqual(frames.map(statusOf), ["fresh", "unconfirmed"]);
  assert.deepEqual(frames[0]!.data?.hProperties?.className, ["code-pin"]);
  assert.deepEqual(shownOf(bodyOf(frames[0]!)), { lang: "ts", title: "src/greet.ts:2-3", lineNumbers: 2, value: CURRENT.join("\n") });
  assert.equal(shownOf(bodyOf(frames[1]!)).title, "src/greet.ts:2-3 · 未确认");
  assert.doesNotMatch((bodyOf(frames[0]!) as Code).meta!, /fresh|green|dot/, "状态不写进代码块的 meta");
});

test("外框收起时只剩一行：写今天的位置与状态；新鲜与未确认默认收起，有变动与缺失默认展开", () => {
  const outcomes: Outcome[] = [
    FRESH,
    { ...FRESH, status: "unconfirmed" },
    { status: "changed", reason: "changed", lines: [2, 3], current: CURRENT },
    { status: "missing", reason: "vanished", lines: [2, 3], current: null, old: OLD },
  ];
  let next = 0;
  const frames = framesOf(`${mark(T)}\n\n${mark(T)}\n\n${mark(T)}\n\n${mark(T)}\n`, () => outcomes[next++]!);
  assert.deepEqual(frames.map((f) => [f.data?.hName, f.data?.hProperties?.open]), [["details", false], ["details", false], ["details", true], ["details", true]]);
  const summary = frames[0]!.children[0]!;
  assert.equal(summary.type, "paragraph");
  assert.equal(summary.data?.hName, "summary");
  assert.deepEqual((summary as { children: { type: string; value: string }[] }).children.map((c) => [c.type, c.value]), [["inlineCode", "src/greet.ts:2-3"], ["text", " · 新鲜"]]);
});

test("标题写今天的位置：行段跟随之后，标记上那几行已经不是这段了", () => {
  const [frame] = framesOf(`${mark(T)}\n`, () => ({ ...FRESH, lines: [7, 8] }));
  assert.deepEqual(shownOf(bodyOf(frame!)!), { lang: "ts", title: "src/greet.ts:7-8", lineNumbers: 7, value: CURRENT.join("\n") });
});

test("有变动：旧行新行渲在同一块里，用 shiki 的 [!code --] / [!code ++]，写明不带行号", () => {
  const diff = [
    { kind: "same", text: OLD[0]! },
    { kind: "removed", text: OLD[1]! },
    { kind: "added", text: CURRENT[1]! },
  ] as const;
  const [frame] = framesOf(`${mark(T)}\n`, () => ({ status: "changed", reason: "changed", lines: [2, 3], current: CURRENT, old: OLD, diff: [...diff] }));
  const shown = shownOf(bodyOf(frame!)!);
  assert.equal(statusOf(frame!), "changed");
  assert.deepEqual([shown.lang, shown.title, shown.lineNumbers, shown.noLineNumbers], ["ts", "src/greet.ts:2-3", undefined, true], "块里夹着已经不存在的旧行，行号对不上源文件");
  assert.match(shown.value, /return `hi \$\{name\}`; \/\/ \[!code --\]/);
  assert.match(shown.value, /return `hello \$\{name\}`; \/\/ \[!code \+\+\]/);
});

test("有变动但取不到旧内容：没有对比，退成一块当前段，标题说有变动；位置不明的只留一句说明", () => {
  const [plain] = framesOf(`${mark(T)}\n`, () => ({ status: "changed", reason: "changed", lines: [2, 3], current: CURRENT }));
  assert.deepEqual(shownOf(bodyOf(plain!)), { lang: "ts", title: "src/greet.ts:2-3 · 有变动", lineNumbers: 2, value: CURRENT.join("\n") });
  const [lost] = framesOf(`${mark(T)}\n`, () => ({ status: "changed", reason: "unlocated", lines: [2, 3], current: CURRENT }));
  assert.deepEqual([shownOf(bodyOf(lost!)).value, shownOf(bodyOf(lost!)).noLineNumbers], [UNLOCATED_NOTE, true]);
});

test("没有行注释的语言：对比退成一块 diff", () => {
  const [frame] = framesOf('{/* ref file="data.json" lines="1-2" */}\n', () => ({
    status: "changed",
    reason: "changed",
    lines: [1, 2],
    current: ["{", '  "a": 2'],
    diff: [
      { kind: "same", text: "{" },
      { kind: "removed", text: '  "a": 1' },
      { kind: "added", text: '  "a": 2' },
    ],
  }));
  const shown = shownOf(bodyOf(frame!)!);
  assert.equal(shown.lang, "diff");
  assert.equal(shown.value, '  {\n-   "a": 1\n+   "a": 2');
  assert.equal(shown.noLineNumbers, true);
});

test("缺失：外框是红的，摆确认时那段；没有旧内容就说没有", () => {
  const [gone] = framesOf(`${mark(T)}\n`, () => ({ status: "missing", reason: "vanished", lines: [2, 3], current: null, old: OLD }));
  assert.equal(statusOf(gone!), "missing");
  assert.deepEqual(shownOf(bodyOf(gone!)), { lang: "ts", title: "文档写下时这段是（src/greet.ts:2-3）", noLineNumbers: true, value: OLD.join("\n") });
  const [blank] = framesOf(`${mark(T)}\n`, () => ({ status: "missing", reason: "file-missing", lines: [2, 3], current: null }));
  assert.equal(shownOf(bodyOf(blank!)).value, "（没有旧内容）");
});

test("整文件：标题只写文件名，行号从 1 起", () => {
  const whole: Target = { kind: "file", file: "config.json" };
  const [frame] = framesOf(`${mark(whole)}\n`, () => ({ status: "fresh", lines: [1, 2], current: ["{", "}"] }));
  assert.deepEqual(shownOf(bodyOf(frame!)!), { lang: "json", title: "config.json", lineNumbers: 1, value: "{\n}" });
});

/** JSX 节点的属性表：值为 null 的裸属性记成 true */
const attrsOf = (node: MdxJsxFlowElement): Record<string, unknown> =>
  Object.fromEntries(node.attributes.map((a) => [(a as { name: string }).name, a.value === null ? true : a.value]));

test("目录树：换成 fumadocs 的 Files，根是展开的文件夹、名字按路径嵌套；目录没了只剩一个禁用的根", () => {
  const tree: Target = { kind: "tree", dir: "src", depth: 2 };
  const names = ["add.ts", "lib/", "lib/deep.ts", "util/"];
  const [frame] = framesOf(`${mdxMarker(tree, { kind: "tree", hash: "3fa9c2e1b07d" })}\n`, () => ({ status: "fresh", lines: [1, 4], current: names }));
  assert.deepEqual(frame!.data?.hProperties?.dataPinKind, "tree");
  const files = bodyOf(frame!) as MdxJsxFlowElement;
  assert.equal(files.name, "Files");
  const root = files.children[0] as MdxJsxFlowElement;
  assert.deepEqual([root.name, attrsOf(root)], ["Folder", { name: "src/", defaultOpen: true }]);
  const kids = root.children as MdxJsxFlowElement[];
  assert.deepEqual(kids.map((n) => [n.name, attrsOf(n).name]), [["File", "add.ts"], ["Folder", "lib"], ["Folder", "util"]]);
  assert.deepEqual(attrsOf(kids[1]!), { name: "lib", defaultOpen: true }, "有子项的文件夹展开");
  assert.deepEqual(attrsOf(kids[2]!), { name: "util", disabled: true }, "到最大深度、没有子项的文件夹禁用");

  const [gone] = framesOf(`${mdxMarker(tree, { kind: "tree", hash: "3fa9c2e1b07d" })}\n`, () => ({ status: "missing", reason: "dir-missing", lines: [1, 1], current: null }));
  const goneRoot = (bodyOf(gone!) as MdxJsxFlowElement).children[0] as MdxJsxFlowElement;
  assert.deepEqual(attrsOf(goneRoot), { name: "src/", disabled: true });
  assert.equal(attrsOf(goneRoot.children[0] as MdxJsxFlowElement).name, "（目录不在了）");
});

test("目录树有变动：外框是黄的，摆今天的名字表；带 glob 的根写成「目录/ glob」", () => {
  const tree: Target = { kind: "tree", dir: "src", depth: 1, glob: "*.ts" };
  const [frame] = framesOf(`${mdxMarker(tree, { kind: "tree", hash: "3fa9c2e1b07d" })}\n`, () => ({ status: "changed", reason: "changed", lines: [1, 2], current: ["add.ts", "new.ts"] }));
  assert.equal(statusOf(frame!), "changed");
  const root = (bodyOf(frame!) as MdxJsxFlowElement).children[0] as MdxJsxFlowElement;
  assert.deepEqual(attrsOf(root), { name: "src/ *.ts", defaultOpen: true });
  assert.deepEqual((root.children as MdxJsxFlowElement[]).map((n) => attrsOf(n).name), ["add.ts", "new.ts"]);
});

test("标记写坏了：报错带上是哪一页、第几行；普通注释原样留着", () => {
  const tree: Root = parseMdx('{/* 普通注释 */}\n\n{/* probe dir="src" */}\n');
  assert.throws(() => remarkCodePin({ pinner: pinnerOf(() => FRESH) })(tree, { path: "docs/a.mdx" }), /^Error: docs\/a\.mdx 第 3 行：标记的动作词只有 ref \/ tree/);
  const plain = parseMdx("{/* 普通注释 */}\n");
  remarkCodePin({ pinner: pinnerOf(() => FRESH) })(plain, { path: "docs/a.mdx" });
  assert.equal(plain.children[0]!.type, "mdxFlowExpression");
});

test("编译成页面：外框是带状态属性的 details，summary 在前、代码块在里面；目录树用到站点登记的 Files 组件", async () => {
  const pinner = pinnerOf((pin: Pin) =>
    pin.target.kind === "tree" ? { status: "changed", reason: "changed", lines: [1, 1], current: ["a.ts"] } : { ...FRESH, status: "unconfirmed" },
  );
  const out = String(await compile(`# 页\n\n${mdxMarker(T, null)}\n\n${mdxMarker({ kind: "tree", dir: "src", depth: 1 }, null)}\n`, { remarkPlugins: [[remarkCodePin, { pinner }]] }));
  assert.match(out, /_components\.details|"details"/);
  assert.match(out, /_components\.summary|"summary"/);
  assert.match(out, /className: "code-pin"/);
  assert.match(out, /"data-pin-status": "unconfirmed"/);
  assert.match(out, /"data-pin-status": "changed"/);
  assert.match(out, /"data-pin-kind": "tree"/);
  assert.match(out, /export function greet/);
  assert.match(out, /_components\.Files|Files/);
});

test("核对结果按钉对象配回标记：同一页几处钉各拿各的结果", () => {
  const seen: DocPin[] = [];
  const frames = framesOf(`${mark(T)}\n\n${mark({ kind: "file", file: "config.json" })}\n`, (pin) => {
    seen.push(pin as DocPin);
    return pin.target.kind === "file" ? { status: "missing", reason: "file-missing", lines: [1, 1], current: null } : FRESH;
  });
  assert.deepEqual(frames.map(statusOf), ["fresh", "missing"]);
  assert.deepEqual(seen.map((p) => p.line), [1, 3]);
});
