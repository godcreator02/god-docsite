/**
 * `@godcreator/docfirst-workflow/fumadocs` 里轨迹卡集合那两样东西的测试：`cardSchema`（合法 / 缺 label / 缺 born-at / Date 型
 * born-at 四种情形，只派生字段、不校验）与 `remarkTrajectoryLinks`（关系边段落打标、卡身份形状的 `.md`
 * 链接改写、带路径的 `.md` 放行、wikilink 原样不动）。mdast 树直接手搭——remarkTrajectoryLinks 本身就是个吃 Root
 * 吐 void 的纯函数，不需要真跑一趟 unified 的 parse/stringify 管线。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { cardSchema, remarkTrajectoryLinks } from "@godcreator/docfirst-workflow/fumadocs";
import type { CardFrontmatter } from "@godcreator/docfirst-workflow/fumadocs";
import type { Link, Paragraph, Root, Text } from "@godcreator/docfirst-workflow/fumadocs";

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

test("cardSchema：缺 born-at 不校验，照样出页——卡写得对不对由 docfirst check 报", async () => {
  const schema = cardSchema({ path: "docs/2026-05-06-my-card.md", source: "" });
  const result = await validate(schema, { label: "标题" });
  assert.equal(result.issues, undefined);
  assert.deepEqual(result.value, { title: "标题", label: "标题" });
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

test("cardSchema：卡字段一个都不沾的页不是卡——当普通页放行，title 取 frontmatter、缺了退文件名；description 随行", async () => {
  const schema = cardSchema({ path: "content/trajectory/index.mdx", source: "" });
  const plain = await validate(schema, { title: "轨迹", description: "只增不改" });
  assert.deepEqual(plain.value, { title: "轨迹", description: "只增不改" });
  const bare = await validate(schema, {});
  assert.deepEqual(bare.value, { title: "index" });
  // 沾了任何一个卡字段就是卡：标题取 label，不取 frontmatter 的 title
  const card = await validate(schema, { title: "像页的卡", label: "标题" });
  assert.equal(card.value?.title, "标题");
});

test("cardSchema：卡的 description 也随行透出", async () => {
  const schema = cardSchema({ path: "content/trajectory/2026-05-06-my-card.mdx", source: "" });
  const result = await validate(schema, { label: "标题", "born-at": "2026-05-06", description: "一句" });
  assert.equal(result.value?.description, "一句");
  assert.equal(result.value?.title, "标题");
});

test("remarkTrajectoryLinks：.mdx 链接跟 .md 一样改写成卡页路由；带路径的 .mdx 同样放行", () => {
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
