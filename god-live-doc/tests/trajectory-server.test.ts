/**
 * `./server` 入口两样东西的测试：`cardSchema`（合法 / 缺 label / 缺 born-at / Date 型
 * born-at 四种判定）与 `remarkTrajectoryLinks`（关系边段落打标、`.md` 链接改写、
 * wikilink 转真链接）。mdast 树直接手搭——remarkTrajectoryLinks 本身就是个吃 Root
 * 吐 void 的纯函数，不需要真跑一趟 unified 的 parse/stringify 管线。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { cardSchema, remarkTrajectoryLinks } from "@godcreator02/live-doc-trajectory/server";
import type { CardFrontmatter } from "@godcreator02/live-doc-trajectory/server";
import type { Link, Paragraph, Root, Text } from "mdast";

/* ================= cardSchema ================= */

// cardSchema.validate() 的类型签名跟协议原文一样，Result 是 { value } / { issues } 二选一的
// 判别联合，且允许同步或 Promise（我们自己的实现永远同步返回值）——测试只想左右手都摸一下，
// 不为了这份联合类型的精确性去逐条 narrow，转成宽松形状读。
interface LooseResult {
  value?: CardFrontmatter;
  issues?: readonly { message: string }[];
}
const validate = async (
  schema: ReturnType<typeof cardSchema>,
  value: unknown,
): Promise<LooseResult> => (await schema["~standard"].validate(value)) as LooseResult;

test("cardSchema：合法 frontmatter 原样透出，label 就是 title", async () => {
  const schema = cardSchema({ path: "docs/2026-05-06-my-card.md", source: "" });
  const result = await validate(schema, {
    label: "标题",
    "born-at": "2026-05-06",
    type: "choice",
    domain: "d1",
    parent: ["p1"],
  });
  assert.deepEqual(result.value, {
    title: "标题",
    label: "标题",
    type: "choice",
    domain: "d1",
    parent: ["p1"],
    "born-at": "2026-05-06",
  });
  assert.equal(result.issues, undefined);
});

test("cardSchema：缺 label 时 title 退到文件名（剥掉日期前缀），不算 issues", async () => {
  const schema = cardSchema({ path: "docs/2026-05-06-my-card.md", source: "" });
  const result = await validate(schema, { "born-at": "2026-05-06" });
  assert.equal(result.issues, undefined);
  assert.equal(result.value?.title, "my-card");
  assert.equal(result.value?.label, undefined);
});

test("cardSchema：born-at 被解析成 Date（fumadocs 自己的 YAML 走的是日级会被转 Date 这条老毛病）时转回字符串", async () => {
  const schema = cardSchema({ path: "docs/2026-05-06-my-card.md", source: "" });
  const result = await validate(schema, { label: "标题", "born-at": new Date("2026-05-06T00:00:00.000Z") });
  assert.equal(result.value?.["born-at"], "2026-05-06");
});

test("cardSchema：缺 born-at 没有兜底，交回 issues", async () => {
  const schema = cardSchema({ path: "docs/2026-05-06-my-card.md", source: "" });
  const result = await validate(schema, { label: "标题" });
  assert.equal(result.value, undefined);
  assert.equal(result.issues?.length, 1);
  assert.match(result.issues![0]!.message, /born-at/);
});

/* ================= remarkTrajectoryLinks ================= */

const text = (value: string): Text => ({ type: "text", value });
const paragraph = (children: Paragraph["children"]): Paragraph => ({ type: "paragraph", children });
const link = (url: string, label: string): Link => ({ type: "link", url, children: [text(label)] });

test("remarkTrajectoryLinks：关系边段落打成 trajectory-edge 的 div，kind 分 supersede / pivot", () => {
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

test("remarkTrajectoryLinks：.md 链接改写成卡页路由，解码百分号、剥 ./ 前缀与 # 锚", () => {
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

test("remarkTrajectoryLinks：wikilink（带别名 / 不带别名）转成真链接，前后文字保留", () => {
  const tree: Root = {
    type: "root",
    children: [paragraph([text("参见 [[old-card|旧卡]] 与 [[other-card]]，完。")])],
  };
  remarkTrajectoryLinks({ hrefBase: "/trajectory" })(tree);
  const p = tree.children[0] as Paragraph;
  const kinds = p.children.map((c) => c.type);
  assert.deepEqual(kinds, ["text", "link", "text", "link", "text"]);
  const [t0, l0, t1, l1, t2] = p.children as [Text, Link, Text, Link, Text];
  assert.equal(t0.value, "参见 ");
  assert.equal(l0.url, "/trajectory/old-card");
  assert.equal((l0.children[0] as Text).value, "旧卡");
  assert.equal(t1.value, " 与 ");
  assert.equal(l1.url, "/trajectory/other-card");
  assert.equal((l1.children[0] as Text).value, "other-card");
  assert.equal(t2.value, "，完。");
});
