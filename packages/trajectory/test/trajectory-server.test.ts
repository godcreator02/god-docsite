/**
 * 站点卡集合用的两样东西：`cardSchema`（从文件全文读出每一页的数据，不用 fumadocs 解析好的值、不校验）与
 * `remarkTrajectoryLinks`（关系边段落转成带 data-kind 的 div、卡身份形状的 `.md` 链接改写、带路径的 `.md` 不改写、
 * wikilink 原样不动）。mdast 树直接手写——remarkTrajectoryLinks 本身就是个收 Root、返回 void 的函数。
 */
import { test } from "vitest";
import assert from "node:assert/strict";
import { cardSchema } from "../src/site/card-collection.ts";
import type { CardEntryData } from "../src/site/card-collection.ts";
import { remarkTrajectoryLinks } from "../src/site/remark-trajectory-links.ts";
import type { Link, Paragraph, Root, Text } from "../src/site/remark-trajectory-links.ts";

/* ================= cardSchema ================= */

/** validate 的结果按协议是 { value } / { issues } 二选一、可同步可 Promise；测试只读 value */
async function entryDataOf(path: string, source: string, fumadocsValue: unknown = {}): Promise<CardEntryData> {
  const result = (await cardSchema({ path, source })["~standard"].validate(fumadocsValue)) as { value?: CardEntryData; issues?: unknown };
  assert.equal(result.issues, undefined, "cardSchema 不校验，永远交回 value");
  return result.value as CardEntryData;
}

const CARD = ["---", "label: 标题", "born-at: 2026-05-06", "type: choice", "domain: d1", "parent: [p1]", "---", "", "正文。", ""].join("\n");

test("cardSchema：从文件全文读，日级 born-at 是字符串；fumadocs 交来的值（born-at 已是 Date）不用", async () => {
  const data = await entryDataOf("D:/site/trajectory/2026-05-06-my-card.md", CARD, { "born-at": new Date("2026-05-06T00:00:00.000Z") });
  assert.equal(data.title, "标题");
  assert.equal(data.cardFile.name, "2026-05-06-my-card.md");
  assert.deepEqual(data.cardFile.card, {
    id: "2026-05-06-my-card",
    path: "2026-05-06-my-card.md",
    type: "choice",
    parent: ["p1"],
    domain: "d1",
    label: "标题",
    bornAt: "2026-05-06",
    relations: [],
    milestones: null,
  });
  assert.equal("description" in data, false, "没写 description 就没有这个键");
});

test("cardSchema：缺 label 时标题用卡身份去掉日期段，病跟着数据走、不算 issues", async () => {
  const data = await entryDataOf("C:\\site\\trajectory\\2026-05-06-my-card.md", ["---", "born-at: 2026-05-06", "parent: [p1]", "---", ""].join("\n"));
  assert.equal(data.title, "my-card");
  assert.deepEqual(data.cardFile.problems.map((p) => p.reason), ["缺 label（全卡必填）"]);
});

test("cardSchema：一个卡字段都没有的页不是卡——标题取 frontmatter 的 title，缺了用文件名去掉日期段；description 原样带上", async () => {
  const plain = await entryDataOf("/s/trajectory/index.mdx", "---\ntitle: 轨迹\ndescription: 只增不改\n---\n导读。\n");
  assert.equal(plain.title, "轨迹");
  assert.equal(plain.description, "只增不改");
  assert.equal(plain.cardFile.card, null);
  assert.equal((await entryDataOf("/s/trajectory/index.mdx", "导读。\n")).title, "index");
  /* 有任何一个卡字段就是卡：标题取 label，不取 title */
  assert.equal((await entryDataOf("/s/trajectory/x.mdx", "---\ntitle: 像页的卡\nlabel: 标题\n---\n")).title, "标题");
});

test("cardSchema：卡的 description 也原样带上", async () => {
  const data = await entryDataOf("/s/trajectory/2026-05-06-my-card.mdx", "---\nlabel: 标题\nborn-at: 2026-05-06\ndescription: 一句\n---\n");
  assert.equal(data.description, "一句");
});

test("cardSchema：frontmatter 读不出来时这一页不是卡，病记在这一页的数据里", async () => {
  const data = await entryDataOf("/s/trajectory/2026-05-06-bad.md", "---\nlabel: [没收尾\n---\n");
  assert.equal(data.title, "bad");
  assert.equal(data.cardFile.card, null);
  assert.equal(data.cardFile.problems[0]?.field, "file");
  assert.match(data.cardFile.problems[0]?.reason ?? "", /^frontmatter 不是合法的 YAML/);
});

/* ================= remarkTrajectoryLinks ================= */

const text = (value: string): Text => ({ type: "text", value });
const paragraph = (children: Paragraph["children"]): Paragraph => ({ type: "paragraph", children });
const link = (url: string, label: string): Link => ({ type: "link", url, children: [text(label)] });

test("remarkTrajectoryLinks：关系边段落转成 className 为 trajectory-edge 的 div，kind 分 supersede / pivot", () => {
  const tree: Root = {
    type: "root",
    children: [
      paragraph([text("supersedes:: "), link("old-card.md", "换个叫法")]),
      paragraph([text("pivots-from:: "), link("other-card.md", "另起一枝")]),
      paragraph([text("普通正文，不是关系边。")]),
    ],
  };
  remarkTrajectoryLinks({ hrefBase: "/trajectory" })(tree);
  const [supersede, pivot, plain] = tree.children as Paragraph[];
  const dataOf = (p: Paragraph): Record<string, unknown> | undefined => p.data as Record<string, unknown> | undefined;
  assert.deepEqual(dataOf(supersede!)?.["hProperties"], { className: "trajectory-edge", "data-kind": "supersede" });
  assert.deepEqual(dataOf(pivot!)?.["hProperties"], { className: "trajectory-edge", "data-kind": "pivot" });
  assert.equal(plain!.data, undefined);
});

test("remarkTrajectoryLinks：.md 链接改写成卡页路由，解码百分号、去掉 ./ 前缀与 # 锚", () => {
  const tree: Root = {
    type: "root",
    children: [
      paragraph([link("./old-card.md", "甲")]),
      paragraph([link("2026-05-06-%E4%B9%99.md#some-anchor", "乙")]),
      paragraph([link("https://example.com/not-a-card", "丙")]),
    ],
  };
  remarkTrajectoryLinks({ hrefBase: "/trajectory" })(tree);
  const [p1, p2, p3] = tree.children as Paragraph[];
  assert.equal((p1!.children[0] as Link).url, "/trajectory/old-card");
  assert.equal((p2!.children[0] as Link).url, "/trajectory/2026-05-06-乙");
  assert.equal((p3!.children[0] as Link).url, "https://example.com/not-a-card");
});

test("remarkTrajectoryLinks：带路径的 .md 链接（引材料）不改写——那不是卡身份", () => {
  const tree: Root = {
    type: "root",
    children: [
      paragraph([link("../assets/re01-probe/README.md", "实验材料包")]),
      paragraph([link("sub/夹层.md", "夹层")]),
      paragraph([link("https://example.com/readme.md", "站外")]),
    ],
  };
  remarkTrajectoryLinks({ hrefBase: "/trajectory" })(tree);
  const [p1, p2, p3] = tree.children as Paragraph[];
  assert.equal((p1!.children[0] as Link).url, "../assets/re01-probe/README.md");
  assert.equal((p2!.children[0] as Link).url, "sub/夹层.md");
  assert.equal((p3!.children[0] as Link).url, "https://example.com/readme.md");
});

test("remarkTrajectoryLinks：wikilink 不是卡链接，原样留作文字", () => {
  const tree: Root = {
    type: "root",
    children: [paragraph([text("参见 [[old-card|旧卡]] 与 [[other-card]]，完。")])],
  };
  remarkTrajectoryLinks({ hrefBase: "/trajectory" })(tree);
  const p = tree.children[0] as Paragraph;
  assert.deepEqual(p.children, [text("参见 [[old-card|旧卡]] 与 [[other-card]]，完。")]);
});

test("remarkTrajectoryLinks：.mdx 链接跟 .md 一样改写成卡页路由；带路径的 .mdx 同样不改写", () => {
  const tree: Root = {
    type: "root",
    children: [
      paragraph([link("2026-05-06-甲.mdx", "甲")]),
      paragraph([link("./2026-05-06-乙.mdx#锚", "乙")]),
      paragraph([link("../docs/别处.mdx", "别处")]),
    ],
  };
  remarkTrajectoryLinks({ hrefBase: "/trajectory" })(tree);
  const [p1, p2, p3] = tree.children as Paragraph[];
  assert.equal((p1!.children[0] as Link).url, "/trajectory/2026-05-06-甲");
  assert.equal((p2!.children[0] as Link).url, "/trajectory/2026-05-06-乙");
  assert.equal((p3!.children[0] as Link).url, "../docs/别处.mdx");
});
