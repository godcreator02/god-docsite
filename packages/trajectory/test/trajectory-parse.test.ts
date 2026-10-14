/**
 * 行级迷你 frontmatter 解析器 + 正文提取的用例。
 *
 * 头号断言是「日级 born-at 留字符串」：`born-at: 2026-05-06` 是合法 YAML date，任何 YAML 库
 * 都会给出 Date 对象，String() 之后格式校验全灭、全部日级存量卡被判病挡在盘外——而且是
 * 静默的（盘照出，只是少了卡少了环）。这一条塌了，整个数据层跟着塌。
 */
import { test } from "vitest";
import assert from "node:assert/strict";
import {
  extractMilestones,
  extractRelations,
  parseFrontmatter,
  splitLines,
  stripFrontmatter,
} from "../src/core/index.ts";

test("日级 born-at 留字符串，不被解析成 Date", () => {
  const fm = parseFrontmatter("---\nborn-at: 2026-05-06\n---\n正文");
  assert.equal(fm?.["born-at"], "2026-05-06");
  assert.equal(typeof fm?.["born-at"], "string");
});

test("分钟级 born-at 同样原样留字符串", () => {
  const fm = parseFrontmatter("---\nborn-at: 2026-05-06T00:00\n---\n");
  assert.equal(fm?.["born-at"], "2026-05-06T00:00");
});

test("纯数字 / 布尔样的值也不做类型推断", () => {
  const fm = parseFrontmatter("---\nlabel: 2026\nstatus: true\n---\n");
  assert.equal(fm?.label, "2026");
  assert.equal(fm?.status, "true");
});

test("块式列表：剥成对引号，缩进短横行归上一个键", () => {
  const fm = parseFrontmatter('---\nparent:\n  - "aaaa"\n  - bbbb\n---\n');
  assert.deepEqual(fm?.parent, ["aaaa", "bbbb"]);
});

test("流式列表 `[a, b]`：card-format 正本里 parent 就是这个写法", () => {
  const fm = parseFrontmatter("---\nparent: [2026-01-09-alpha, 2026-02-01-beta]\n---\n");
  assert.deepEqual(fm?.parent, ["2026-01-09-alpha", "2026-02-01-beta"]);
  assert.deepEqual(parseFrontmatter("---\nparent: []\n---\n")?.parent, []);
});

test("单个值与列表各自原样留着，不互相转换", () => {
  const fm = parseFrontmatter("---\nparent: 2026-01-09-alpha\ntype:\n  - root\n---\n");
  assert.equal(fm?.parent, "2026-01-09-alpha");
  assert.deepEqual(fm?.type, ["root"]);
});

test("CRLF 与 BOM 都吃得下", () => {
  assert.deepEqual(parseFrontmatter('﻿---\r\nlabel: 甲\r\nparent:\r\n  - "aaaa"\r\n---\r\n正文'), {
    label: "甲",
    parent: ["aaaa"],
  });
});

test("没有 frontmatter 块回 null", () => {
  assert.equal(parseFrontmatter("没有头的正文"), null);
  assert.equal(parseFrontmatter("---\nlabel: 甲\n"), null);
});

test("frontmatter 剥离：LF / CRLF / 带 BOM 三种形态都剥干净", () => {
  assert.equal(stripFrontmatter("---\nborn-at: x\n---\n正文"), "正文");
  assert.equal(stripFrontmatter("---\r\nborn-at: x\r\n---\r\n正文"), "正文");
  assert.equal(stripFrontmatter("﻿---\nborn-at: x\n---\n正文"), "正文");
});

test("无 frontmatter 原样返回，尾无换行剥成空串", () => {
  assert.equal(stripFrontmatter("没有头的正文"), "没有头的正文");
  assert.equal(stripFrontmatter("---\na: 1\n---"), "");
});

test("切行把 CRLF 一次吃掉，下游正则不必防 \\r", () => {
  assert.deepEqual(splitLines("甲\r\n乙\n丙"), ["甲", "乙", "丙"]);
});

test("链接文字随便写、目标可带锚，照样提取卡身份；一行一条、可多条", () => {
  const { relations, broken } = extractRelations(
    [
      "叙事一段。",
      "supersedes:: [换个叫法](2026-01-01-甲.md)",
      "pivots-from:: [2026-01-02-乙](2026-01-02-乙.md#某一节)",
      "supersedes:: [2026-01-03-丙](2026-01-03-丙.md)",
    ].join("\n"),
  );
  assert.deepEqual(relations, [
    { kind: "supersede", target: "2026-01-01-甲" },
    { kind: "pivot", target: "2026-01-02-乙" },
    { kind: "supersede", target: "2026-01-03-丙" },
  ]);
  assert.deepEqual(broken, []);
});

test("CRLF 行尾的关系行照样收边——Windows 侧写卡工具行尾随缘", () => {
  const { relations } = extractRelations(["叙事一段。", "supersedes:: [2026-01-01-甲](2026-01-01-甲.md)"].join("\r\n"));
  assert.deepEqual(relations, [{ kind: "supersede", target: "2026-01-01-甲" }]);
});

test("行头是关系字段但行形不合的收进 broken——不静默吞行", () => {
  const { relations, broken } = extractRelations(
    ["supersedes:: [2026-01-01-甲](2026-01-01-甲.md) 多了句尾巴", "pivots-from:: 忘了写链接"].join("\n"),
  );
  assert.deepEqual(relations, []);
  assert.deepEqual(broken, [
    { key: "supersedes", target: "[2026-01-01-甲](2026-01-01-甲.md) 多了句尾巴" },
    { key: "pivots-from", target: "忘了写链接" },
  ]);
});

test("正文里的普通 wikilink 不是关系边", () => {
  assert.deepEqual(extractRelations("参见 [[2026-01-01-甲]] 那张卡。"), { relations: [], broken: [] });
});

test("关系行只认标准 md 链接：wikilink、目标包在 <> 里都算写歪的行", () => {
  const { relations, broken } = extractRelations(
    ["supersedes:: [[2026-01-01-甲]]", "pivots-from:: [乙](<2026-01-02-乙.md>)"].join("\n"),
  );
  assert.deepEqual(relations, []);
  assert.deepEqual(broken, [
    { key: "supersedes", target: "[[2026-01-01-甲]]" },
    { key: "pivots-from", target: "[乙](<2026-01-02-乙.md>)" },
  ]);
});

test("md link 形态照样成边：目标剥 `.md` 后即卡身份，链接文字随便写", () => {
  const { relations, broken } = extractRelations(
    [
      "叙事一段。",
      "supersedes:: [2026-01-01-甲](2026-01-01-甲.md)",
      "pivots-from:: [换个叫法](2026-01-02-乙.md)",
    ].join("\n"),
  );
  assert.deepEqual(relations, [
    { kind: "supersede", target: "2026-01-01-甲" },
    { kind: "pivot", target: "2026-01-02-乙" },
  ]);
  assert.deepEqual(broken, []);
});

test("md link 的 `./` 前缀 / 百分号编码 / `#` 锚 / 缺 `.md` 全还原成同一身份", () => {
  const lines = [
    "supersedes:: [甲](./2026-01-01-甲.md)",
    "supersedes:: [甲](2026-01-01-%E7%94%B2.md)",
    "supersedes:: [甲](2026-01-01-甲.md#某一节)",
    "supersedes:: [甲](2026-01-01-甲)",
  ];
  for (const line of lines) {
    assert.deepEqual(extractRelations(line).relations, [{ kind: "supersede", target: "2026-01-01-甲" }]);
  }
});

test("目标里的括号与空格走百分号编码，原样带括号的目标不当边、进 broken", () => {
  assert.deepEqual(
    extractRelations("pivots-from:: [乙](2026-01-02-lastwarn%28%29-捞-warning.md)").relations,
    [{ kind: "pivot", target: "2026-01-02-lastwarn()-捞-warning" }],
  );
  assert.deepEqual(extractRelations("pivots-from:: [乙](2026-01-02-lastwarn()-捞-warning.md)").broken, [
    { key: "pivots-from", target: "[乙](2026-01-02-lastwarn()-捞-warning.md)" },
  ]);
});

test("坏形态的 md link 不炸：空目标 / 多尾巴 / 只有文字，全收进 broken", () => {
  const { relations, broken } = extractRelations(
    [
      "supersedes:: [甲]()",
      "supersedes:: [甲](2026-01-01-甲.md) 多了句尾巴",
      "pivots-from:: [光有文字没链接]",
      "supersedes:: [坏编码](2026-01-01-%ZZ.md)",
    ].join("\n"),
  );
  /* 孤零零的 `%` 解不开：不抛异常，按原样当身份收边 */
  assert.deepEqual(relations, [{ kind: "supersede", target: "2026-01-01-%ZZ" }]);
  assert.deepEqual(broken, [
    { key: "supersedes", target: "[甲]()" },
    { key: "supersedes", target: "[甲](2026-01-01-甲.md) 多了句尾巴" },
    { key: "pivots-from", target: "[光有文字没链接]" },
  ]);
});

test("正文里的普通 md link 不是关系边", () => {
  assert.deepEqual(extractRelations("参见 [那张卡](2026-01-01-甲.md) 的说法。"), { relations: [], broken: [] });
});

const MILESTONE_BODY = [
  "## 在做什么",
  "",
  "正文若干。",
  "",
  "## 里程碑",
  "",
  "- 2026-01-20｜次座",
  "- 2026-01-10｜首座｜第一座里程碑的说明。",
  "- 不是日期｜报出来｜日期解不出来的行报出来。",
  "- 少了竖线的一行",
  "（区块里别的说明文字不管）",
  "",
  "## 其他区块",
  "",
  "- 2026-01-25｜不算｜出了区块就不算。",
].join("\n");

test("固定区块内每行一座，描述可缺、结果按日期升序，下一个 H2 止；以 - 开头却写坏的行报出来", () => {
  assert.deepEqual(extractMilestones(MILESTONE_BODY), {
    milestones: [
      { date: "2026-01-10", name: "首座", desc: "第一座里程碑的说明。" },
      { date: "2026-01-20", name: "次座", desc: "" },
    ],
    broken: ["- 不是日期｜报出来｜日期解不出来的行报出来。", "- 少了竖线的一行"],
  });
});

test("没这块即空列表", () => {
  assert.deepEqual(extractMilestones("## 在做什么\n\n没里程碑。"), { milestones: [], broken: [] });
});

test("md link 目标带 .mdx 后缀也还原成同一身份——卡文件两种后缀都认", () => {
  for (const line of ["supersedes:: [甲](2026-01-01-甲.mdx)", "supersedes:: [甲](./2026-01-01-甲.mdx#节)"]) {
    assert.deepEqual(extractRelations(line).relations, [{ kind: "supersede", target: "2026-01-01-甲" }]);
  }
});
