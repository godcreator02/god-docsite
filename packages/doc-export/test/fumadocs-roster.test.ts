/**
 * 现成的 fumadocs 名册：Note、Files / Folder / File 在生成物里写成什么，以及它能跟使用方自己的名册叠在一起用。
 */
import { test } from "vitest";
import assert from "node:assert/strict";
import { fumadocsRoster, renderMachineMarkdown, unknownComponents } from "../src/core/index.ts";
import type { Roster } from "../src/core/index.ts";
import { parseMdx } from "@godcreator/code-pin";

const render = (text: string, roster: Roster = fumadocsRoster): string => renderMachineMarkdown(text, { roster, checkPins: () => [] });

test("只认 fumadocs 自带的四个组件", () => {
  assert.deepEqual(Object.keys(fumadocsRoster).sort(), ["File", "Files", "Folder", "Note"]);
});

test("块级 Note 变引用块，句子里的 Note 变一段行内文字", () => {
  assert.equal(render("前\n\n<Note>\n  提示\n</Note>\n"), "前\n\n> \\[note] 提示\n");
  assert.equal(render("一句话里有 <Note>提示</Note> 接着说。\n"), "一句话里有 \\[note] 提示 接着说。\n");
});

test("作者手写的文件树：一行一个名字，文件夹带尾斜杠，子项跟在后面", () => {
  const doc = '<Files>\n  <Folder name="src" defaultOpen>\n    <File name="add.ts" />\n  </Folder>\n  <File name="package.json" />\n</Files>\n';
  assert.equal(render(doc), "src/\n\nadd.ts\n\npackage.json\n");
});

test("并进使用方的名册：两张表的组件都认，名册检查只报两张表都没有的", () => {
  const roster: Roster = { ...fumadocsRoster, Term: "children" };
  assert.equal(render("有 <Term>钉</Term> 一词。\n\n<Note>\n  提示\n</Note>\n", roster), "有 钉 一词。\n\n> \\[note] 提示\n");
  assert.deepEqual(unknownComponents(parseMdx("<Note>a</Note>\n\n<Tabs />\n"), roster), [{ name: "Tabs", line: 3 }]);
});
