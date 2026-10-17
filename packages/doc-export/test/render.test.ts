/**
 * 正本渲染成 Markdown：钉码标记写成代码块，名册里的组件写成机读文字，渲染不了的一次列全。
 * 钉用不读文件的假核对：判定本身归 code-pin 的测试。
 */
import { test } from "vitest";
import assert from "node:assert/strict";
import { mdxMarker } from "@godcreator/code-pin";
import type { DocPin, PinCheck, Target } from "@godcreator/code-pin";
import remarkParse from "remark-parse";
import remarkStringify from "remark-stringify";
import { unified } from "unified";
import remarkMdx from "remark-mdx";
import { machineTextHandlers, renderMachineMarkdown } from "../src/core/index.ts";
import type { Roster } from "../src/core/index.ts";

const T: Target = { kind: "span", file: "src/greet.ts", a: 2, b: 3 };
const CURRENT = ["export function greet(name: string): string {", "  return `hello ${name}`;"];
const RECORD = { kind: "content", hash: "3fa9c2e1b07d", blob: "2689fa073ac6" } as const;
const mark = (target: Target) => mdxMarker(target, target.kind === "tree" ? { kind: "tree", hash: RECORD.hash } : RECORD);

type Outcome = Omit<PinCheck<DocPin>, "pin">;
const FRESH: Outcome = { status: "fresh", lines: [2, 3], current: CURRENT };

function render(text: string, outcome: (pin: DocPin) => Outcome = () => FRESH, roster: Roster = {}): string {
  return renderMachineMarkdown(text, { roster, checkPins: (pins) => pins.map((pin) => ({ ...outcome(pin), pin })) });
}

/** 名册：Note 变引用块；Files 只留子内容，Folder / File 压成一行一个名字 */
const ROSTER: Roster = {
  Note: (node, h) => (h.inline ? h.text(`[note] ${h.textOf(node).trim()}`) : h.quote(`[note] ${h.textOf(node).trim()}`)),
  Files: "children",
  Folder: (node, h) => [h.paragraph(`${h.attr(node, "name") ?? ""}/`), ...h.children()],
  File: (node, h) => h.paragraph(h.attr(node, "name") ?? ""),
};

test("去掉 frontmatter，钉写成带语言与 title 的代码块，别的文字照原样；mdx 里要转义的花括号照样转义", () => {
  const prose = "开头一段，带 `代码` 和 **加粗**，还有 [链接](https://example.com)。\n\n| 表 | 头 |\n| --- | --- |\n| 1 | 2 |\n";
  const text = `---\ntitle: x\n---\n\n# 标题\n\n${prose}\n${mark(T)}\n\n尾巴 \\{ 原样 \\}\n`;
  assert.equal(render(text), `# 标题\n\n${prose}\n\`\`\`ts title="src/greet.ts:2-3"\n${CURRENT.join("\n")}\n\`\`\`\n\n尾巴 \\{ 原样 }\n`, "右花括号单独出现不会开表达式，不用转义");
});

test("行内代码后面紧跟以行内代码开头的加粗段，原样不变（不会把反引号转成 &#x60;）", () => {
  const line = "改完跑 `pnpm doc` **`check` 要绿**，再提交。";
  assert.equal(render(`# x\n\n${line}\n`), `# x\n\n${line}\n`);
});

test("正文里直接写的网址照原文写出：不加尖括号、不改成 [文字](网址)，后面紧跟全角标点时也不把标点和后文并进链接", () => {
  for (const line of [
    "地址 http://example.com/a 打开。",
    "也可以写 www.example.com 或 someone@example.com。",
    "看页面（http://127.0.0.1:4313），不用 `pnpm dev`。",
  ]) {
    assert.equal(render(`${line}\n`), `${line}\n`);
  }
  assert.equal(render("- 列表里：https://example.com，再说\n"), "- 列表里：https://example.com，再说\n");
  assert.equal(render("[写了文字的链接](https://example.com)，照旧\n"), "[写了文字的链接](https://example.com)，照旧\n");
});

test("行段标题写今天的位置；整文件标题是 路径:1-行数；目录树给名字表", () => {
  const whole: Target = { kind: "file", file: "config.json" };
  const tree: Target = { kind: "tree", dir: "src", depth: 1 };
  const out = render([mark(T), "", mark(whole), "", "中间", "", mark(tree), ""].join("\n"), (pin) => {
    if (pin.target.kind === "file") return { ...FRESH, lines: [1, 2], current: ["{", "}"] };
    if (pin.target.kind === "tree") return { ...FRESH, lines: [1, 2], current: ["a.ts", "lib/"] };
    return { ...FRESH, lines: [7, 8] };
  });
  assert.equal(out, ['```ts title="src/greet.ts:7-8"', ...CURRENT, "```", "", '```json title="config.json:1-2"', "{", "}", "```", "", "中间", "", '```text title="src/"', "a.ts", "lib/", "```", ""].join("\n"));
});

test("围栏里的标记是正文，原样不动；内容里有三个反引号时围栏加长", () => {
  const fenced = `\`\`\`mdx\n${mark(T)}\n\`\`\`\n`;
  assert.equal(render(fenced), fenced);
  assert.equal(render(`${mark(T)}\n`, () => ({ ...FRESH, current: ['const s = "```";'] })), '````ts title="src/greet.ts:2-3"\nconst s = "```";\n````\n');
});

test("写在列表项里的钉：代码块跟着列表缩进", () => {
  assert.equal(render(`- 一项：\n\n  ${mark(T)}\n`), `- 一项：\n\n  \`\`\`ts title="src/greet.ts:2-3"\n  ${CURRENT.join("\n  ")}\n  \`\`\`\n`);
});

test("公式照原样：$…$ 与 $$…$$ 里的花括号不是 mdx 表达式", () => {
  const text = "状态 $x = [\\,i,\\ v_c\\,]^{\\mathsf T}$，候选 $\\Delta_{(+,-)}$。\n\n$$\nS \\in \\{-1,\\ 0,\\ +1\\}\n$$\n";
  assert.equal(render(text), text);
});

test("CRLF 的正本按 LF 出", () => {
  assert.equal(render("# x\r\n\r\n正文\r\n"), "# x\n\n正文\n");
});

test("组件换成名册给的机读文字；drop 的组件不出现；写在列表项里的跟着缩进", () => {
  const roster: Roster = {
    Steps: (_node, { paragraph }) => [paragraph("第 1 步：注册"), paragraph("第 2 步：撤掉")],
    Hint: (node, { paragraph, textOf }) => paragraph(`注意：${textOf(node)}`),
    Hidden: "drop",
  };
  const out = render("# x\n\n前一段 **加粗**\n\n<Steps />\n\n<Hidden>不要</Hidden>\n\n后一段\n", () => FRESH, roster);
  assert.match(out, /^# x\n\n前一段 \*\*加粗\*\*\n\n第 1 步：注册\n\n第 2 步：撤掉\n\n+后一段\n$/);
  assert.doesNotMatch(out, /不要/);
  assert.equal(render("- 一项：\n\n  <Hint>小心</Hint>\n", () => FRESH, roster), "- 一项：\n\n  注意：小心\n");
});

test("规则交回的子内容里再嵌套的组件也换成它的机读文字；行内组件不拆断句子", () => {
  const roster: Roster = { Box: "children", Hint: (node, { paragraph, textOf }) => paragraph(`注意：${textOf(node)}`), ...ROSTER };
  assert.equal(render("<Box>\n  外层\n\n  <Hint>里层</Hint>\n</Box>\n", () => FRESH, roster), "外层\n\n注意：里层\n");
  assert.equal(render("一句话里有 <Note>提示</Note> 接着说。\n", () => FRESH, ROSTER), "一句话里有 \\[note] 提示 接着说。\n", "方括号转义了，读出来还是 [note]");
});

test("作者手写的 Files：一行一个名字，文件夹带尾斜杠", () => {
  const doc = '<Files>\n  <Folder name="src" defaultOpen>\n    <File name="add.ts" />\n  </Folder>\n  <File name="package.json" />\n</Files>\n';
  assert.equal(render(doc, () => FRESH, ROSTER), "src/\n\nadd.ts\n\npackage.json\n");
});

test("组件里的钉也写成代码块", () => {
  const roster: Roster = { Box: "children" };
  assert.equal(render(`<Box>\n  ${mark(T)}\n</Box>\n`, () => FRESH, roster), `\`\`\`ts title="src/greet.ts:2-3"\n${CURRENT.join("\n")}\n\`\`\`\n`);
});

test("名册外组件、规则交回里嵌套的名册外组件都渲染不了", () => {
  assert.throws(
    () => render("<Box>\n  <Unknown />\n</Box>\n", () => FRESH, { Box: "children" }),
    (err: Error) => err.name === "RenderRefusal" && err.message.includes("第 1 行的组件 <Box> 换不成机读文字：第 2 行：名册外组件 <Unknown>"),
  );
  assert.doesNotThrow(() => render("<Hidden>\n  <Unknown />\n</Hidden>\n", () => FRESH, { Hidden: "drop" }), "drop 掉的组件里面是什么不管");
});

test("没确认的钉、缺失的钉、名册外组件、mdx 表达式、import 都渲染不了，一次列全、抛 RenderRefusal", () => {
  const text = [
    "import x from 'y';",
    "",
    "正文",
    "",
    mark({ kind: "span", file: "src/gone.ts", a: 1, b: 2 }),
    "",
    "<Note>提示</Note>",
    "",
    "{1 + 1}",
    "",
    "{/* 普通注释 */}",
    "",
    mdxMarker(T, null),
    "",
  ].join("\n");
  assert.throws(
    () =>
      render(text, (pin) => {
        if (pin.record === null) return { ...FRESH, status: "unconfirmed" };
        return pin.target.kind === "span" && pin.target.file === "src/gone.ts" ? { status: "missing", reason: "file-missing", lines: [1, 2], current: null } : FRESH;
      }),
    (err: Error) => {
      assert.equal(err.name, "RenderRefusal");
      for (const piece of [
        "第 1 行有 import / export",
        "第 5 行的钉缺失（文件不在了）",
        "第 7 行有名册外组件 <Note>",
        "第 9 行有 mdx 表达式 {1 + 1}",
        "第 11 行有 mdx 表达式 {/* 普通注释 */}",
        "第 13 行的钉还没确认",
      ]) {
        assert.ok(err.message.includes(piece), `报错里该有「${piece}」：${err.message}`);
      }
      return true;
    },
  );
});

test("handlers 不改树：同一棵树序列化两次结果一样，树上的组件还在", () => {
  const processor = unified().use(remarkParse).use(remarkMdx).use(remarkStringify, { handlers: machineTextHandlers(ROSTER) });
  const tree = processor.parse("前\n\n<Note>\n  提示\n</Note>\n");
  const once = processor.stringify(tree);
  assert.equal(processor.stringify(tree), once);
  assert.equal(once, "前\n\n> \\[note] 提示\n");
  assert.equal(tree.children[1]!.type, "mdxJsxFlowElement");
});
