/**
 * 正本到落点：同一段正文、加上点名的 frontmatter 字段；落点表的两种写法；frontmatter 按 YAML 读、原样抄行。
 * 钉用不读文件的假核对，生成物不落盘：纯 core。
 */
import { test } from "vitest";
import assert from "node:assert/strict";
import type { DocPin, PinCheck } from "@godcreator/code-pin";
import { pickFrontmatter, placementsOf, planOutputs, sameOutput } from "../src/core/index.ts";
import type { OutputPlacement, Roster } from "../src/core/index.ts";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { visit } from "unist-util-visit";

/** 一段 Markdown 读出来的文字：解析后把文字节点连起来 */
function readText(markdown: string): string {
  const out: string[] = [];
  visit(unified().use(remarkParse).parse(markdown), "text", (node) => void out.push(node.value));
  return out.join("");
}

/** 正本：点名的字段带到生成物头部，没点名的去掉；正文里看着像转义的 `&#x2A;` 渲染出来还是一个星号 */
const SOURCE = ["---", "name: block-note", "description: 块笔记怎么用", "secret: 不该随行", "---", "", "# 摆放", "", "一段**加粗**的正文，&#x2A; 原样", ""].join("\n");

const options = (roster: Roster = {}) => ({ roster, checkPins: (pins: DocPin[]): PinCheck<DocPin>[] => pins.map((pin) => ({ pin, status: "fresh", lines: [1, 1], current: ["x"] })) });
const plan = (source: string, placements: OutputPlacement[], roster?: Roster) => planOutputs(source, placements, options(roster));
const textOf = (p: ReturnType<typeof plan>[number]): string => {
  assert.ok("text" in p, `这个落点生成不了：${JSON.stringify(p)}`);
  return p.text;
};

test("字符串写法：frontmatter 整段去掉，正文开头不留空行；看着像转义的字符渲染出来是同一个字", () => {
  const [readme] = plan(SOURCE, [{ to: "README.md", frontmatter: [] }]);
  const body = textOf(readme!);
  assert.match(body, /^# 摆放\n\n一段\*\*加粗\*\*的正文，/);
  assert.equal(readText(body), readText(SOURCE.slice(SOURCE.indexOf("# 摆放"))), "读出来的文字跟正本一样");
  assert.match(readText(body), /\* 原样$/);
});

test("对象写法：点名的字段按点名的顺序原样带到头部，没点名的不带", () => {
  const [readme, skill] = plan(SOURCE, [
    { to: "README.md", frontmatter: [] },
    { to: "skills/x/SKILL.md", frontmatter: ["description", "name"] },
  ]);
  assert.equal(textOf(skill!), `---\ndescription: 块笔记怎么用\nname: block-note\n---\n\n${textOf(readme!)}`);
});

test("源里缺点名的字段：这个落点报 no-frontmatter、说缺哪几个；没有 frontmatter 就全缺", () => {
  assert.deepEqual(plan(SOURCE, [{ to: "SKILL.md", frontmatter: ["name", "nope"] }]), [{ to: "SKILL.md", problem: "no-frontmatter", missing: ["nope"] }]);
  assert.deepEqual(plan("# 没有头\n", [{ to: "SKILL.md", frontmatter: ["name"] }]), [{ to: "SKILL.md", problem: "no-frontmatter", missing: ["name"] }]);
});

test("正本渲染不了：每个落点都报 unrenderable，原因是同一句", () => {
  const reason = "第 11 行有名册外组件 <Note>，先在名册里给它写机读规则";
  assert.deepEqual(plan(`${SOURCE}\n<Note>提示</Note>\n`, [{ to: "README.md", frontmatter: [] }, { to: "SKILL.md", frontmatter: ["name"] }]), [
    { to: "README.md", problem: "unrenderable", reason },
    { to: "SKILL.md", problem: "unrenderable", reason },
  ]);
});

test("正本里名册内的组件换成机读文字，落点照常生成", () => {
  const roster: Roster = { Note: (node, { paragraph, textOf: text }) => paragraph(`注意：${text(node)}`) };
  assert.match(textOf(plan(`${SOURCE}\n<Note>提示</Note>\n`, [{ to: "README.md", frontmatter: [] }], roster)[0]!), /\n\n注意：提示\n$/);
});

test("frontmatter：多行的值、块式列表原样抄；BOM 与 CRLF 不影响；不是合法 YAML 报错", () => {
  const source = "﻿---\r\nname: x\r\ndescription: >-\r\n  第一行\r\n  第二行\r\ntags:\r\n  - a\r\n  - b\r\n---\r\n\r\n正文\r\n";
  assert.deepEqual(pickFrontmatter(source, ["description", "tags"]), { lines: ["description: >-", "  第一行", "  第二行", "tags:", "  - a", "  - b"], missing: [] });
  assert.throws(() => pickFrontmatter("---\nname: [x\n---\n", ["name"]), /frontmatter 不是合法的 YAML/);
  assert.throws(() => pickFrontmatter("---\n- a\n---\n", ["name"]), /映射/);
});

test("落点表：字符串写法等于 frontmatter 为空；形状不对当场报错", () => {
  assert.deepEqual(placementsOf({ "a.mdx": ["README.md", { to: "SKILL.md", frontmatter: ["name"] }] }), {
    "a.mdx": [
      { to: "README.md", frontmatter: [] },
      { to: "SKILL.md", frontmatter: ["name"] },
    ],
  });
  assert.throws(() => placementsOf({ "a.mdx": [] }), /落点得是非空数组/);
  assert.throws(() => placementsOf({ "a.mdx": [{ to: "" }] }), /非空的相对路径/);
  assert.throws(() => placementsOf({ "a.mdx": [{ to: "x.md", frontmatter: [""] }] }), /字段名数组/);
});

test("算不算同一份：换行归一", () => {
  assert.equal(sameOutput("# a\r\n\r\nb\r\n", "# a\n\nb\n"), true);
  assert.equal(sameOutput("# a\n", "# b\n"), false);
});
