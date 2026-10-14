/**
 * 站点那一侧的数据：标题规则只有一条；卡页、星轨盘页的 loader 只从卡集合取数据，
 * 汇总结果跟命令行读同一个卡目录逐位相同；卡集合的 mdx 选项经 fumadocs 默认预设。
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "vitest";
import assert from "node:assert/strict";
import { parseCardFile, readCardFile, titleOf } from "../src/core/index.ts";
import { scanCardDir } from "../src/node/index.ts";
import { cardEntryDataOf, cardMdxOptions } from "../src/site/card-collection.ts";
import { cardPageLoader } from "../src/site/card.server.ts";
import type { TrajectorySite } from "../src/site/collection-entries.ts";
import { diskPageLoader } from "../src/site/disk.server.ts";
import { remarkTrajectoryLinks } from "../src/site/remark-trajectory-links.ts";

const FIXTURES = fileURLToPath(new URL("./fixtures/trajectory", import.meta.url));

/** 照 fumadocs-mdx 的做法造卡集合：每个文件经 cardSchema 同一条路得出这一页的数据 */
function collectionOf(files: Array<{ name: string; text: string }>): TrajectorySite["cards"] {
  return { entries: files.map((file) => cardEntryDataOf(file.name, file.text)) };
}

const siteOf = (cards: TrajectorySite["cards"]): TrajectorySite => ({ cards, siteName: "测试站", hrefBase: "/trajectory", docsHref: "/docs" });

/* ================= 标题规则 ================= */

test("标题规则：写了用写的（去掉首尾空白），没写或写成别的形状用卡身份去掉开头的日期段", () => {
  assert.equal(titleOf("2026-05-06-my-card", " 标题 "), "标题");
  assert.equal(titleOf("2026-05-06-my-card", undefined), "my-card");
  assert.equal(titleOf("2026-05-06-my-card", "  "), "my-card");
  assert.equal(titleOf("2026-05-06-my-card", ["甲", "乙"]), "my-card");
  assert.equal(titleOf("pj01", undefined), "pj01", "身份没有日期段就原样当标题");
});

test("标题规则：卡解析、卡集合的页标题、星轨盘上的短名是同一个值", () => {
  const text = "---\nborn-at: 2026-05-06\nparent: [pj01]\n---\n";
  const parsed = parseCardFile("2026-05-06-no-label", "2026-05-06-no-label.md", text);
  assert.equal(parsed.title, "no-label");
  assert.equal(parsed.card?.label, "no-label");
  assert.equal(cardEntryDataOf("2026-05-06-no-label.md", text).title, "no-label");
});

/* ================= frontmatter 读不出来 ================= */

test("frontmatter 写坏了、顶层不是键值表：不是卡，记一条 file 病，不抛错", () => {
  for (const [text, reason] of [
    ["---\nlabel: [没收尾\n---\n", /^frontmatter 不是合法的 YAML/],
    ["---\nlabel: 甲\nlabel: 乙\n---\n", /^frontmatter 不是合法的 YAML/],
    ["---\n- 一个列表\n---\n", /^frontmatter 顶层须是「键: 值」的表$/],
  ] as const) {
    const reading = readCardFile("2026-01-01-坏.md", text);
    assert.equal(reading.card, null, text);
    assert.deepEqual(reading.problems.map((p) => p.field), ["file"], text);
    assert.match(reading.problems[0]?.reason ?? "", reason);
  }
});

test("frontmatter 里出现嵌套的表：按形状不对报病，值原样写出来", () => {
  const parsed = parseCardFile("aa01", "aa01.md", "---\nborn-at: 2026-01-01\nparent: [pj01]\nlabel: 甲\ndomain:\n  a: b\n---\n");
  assert.deepEqual(parsed.problems, [{ field: "domain", value: '{"a":"b"}', reason: "domain 须写成单个值" }]);
  assert.equal(parsed.card?.domain, null);
});

/* ================= loader 只从卡集合取 ================= */

test("星轨盘页的 loader：卡集合汇总的结果跟命令行读同一个卡目录逐位相同", async () => {
  const files = readdirSync(FIXTURES).map((name) => ({ name, text: readFileSync(join(FIXTURES, name), "utf8") }));
  const data = diskPageLoader({}, siteOf(collectionOf(files)));
  assert.deepEqual(data.scan, await scanCardDir(FIXTURES));
  assert.ok(data.scan.cards.length > 100, "fixture 的卡都画上了盘");
  assert.deepEqual([data.siteName, data.hrefBase, data.docsHref], ["测试站", "/trajectory", "/docs"]);
});

test("星轨盘页的 loader：同一身份 .md 与 .mdx 都在只认 .mdx，病记在 .mdx 上；卡正文里的钉码记号照样报", () => {
  const card = (label: string, body = ""): string => `---\nborn-at: 2026-01-02\nlabel: ${label}\nparent: [pj01]\n---\n\n${body}\n`;
  const cards = collectionOf([
    { name: "pj01.mdx", text: "---\ntype: root\nborn-at: 2026-01-01\nlabel: 项目\n---\n" },
    { name: "2026-01-02-甲.md", text: card("甲 md") },
    { name: "2026-01-02-甲.mdx", text: card("甲 mdx", "{/* ref file=\"src/a.ts\" lines=\"1-2\" */}") },
  ]);
  const { scan } = diskPageLoader({}, siteOf(cards));
  assert.deepEqual(scan.cards.map((c) => [c.id, c.label]), [["2026-01-02-甲", "甲 mdx"]]);
  assert.deepEqual(
    scan.sick.map((file) => [file.path, file.problems.map((p) => p.field)]),
    [["2026-01-02-甲.mdx", ["file", "docfirst"]]],
  );
});

test("卡页的 loader：按卡身份取字段，同一身份取 .mdx；日期在字段里、标题按同一条规则；没有这张卡回 404", () => {
  const cards = collectionOf([
    { name: "pj01.md", text: "---\ntype: root\nborn-at: 2026-01-01\nlabel: 项目\n---\n" },
    { name: "2026-01-02-甲.md", text: "---\nborn-at: 2026-01-02\nlabel: 旧\nparent: [pj01]\n---\n" },
    { name: "2026-01-02-甲.mdx", text: "---\nborn-at: 2026-01-02T09:30\ntype: choice\ndomain: 域一\nparent: [pj01]\n---\n" },
    { name: "index.mdx", text: "---\ntitle: 轨迹\n---\n" },
  ]);
  const site = siteOf(cards);
  assert.deepEqual(cardPageLoader({ params: { "*": "2026-01-02-甲" } }, site), {
    card: { id: "2026-01-02-甲", title: "甲", bornAt: "2026-01-02T09:30", type: "choice", domain: "域一", parents: ["pj01"] },
    siteName: "测试站",
    hrefBase: "/trajectory",
  });
  assert.deepEqual(cardPageLoader({ params: { "*": "index" } }, site).card, {
    id: "index",
    title: "轨迹",
    bornAt: null,
    type: null,
    domain: null,
    parents: [],
  });
  assert.throws(
    () => cardPageLoader({ params: { "*": "没有的卡" } }, site),
    (thrown: unknown) => thrown instanceof Response && thrown.status === 404,
  );
});

/* ================= 卡集合的 mdx 选项 ================= */

test("cardMdxOptions：经 fumadocs 默认预设（带 GFM 与代码高亮），卡链接改写接在默认插件后面", async () => {
  const options = await cardMdxOptions({ hrefBase: "/trajectory" })("bundler");
  const remarkPlugins = options.remarkPlugins ?? [];
  const pluginNames = remarkPlugins.map((plugin) => (Array.isArray(plugin) ? plugin[0] : plugin)).map((plugin) => (plugin as { name?: string }).name);
  assert.ok(pluginNames.includes("remarkGfm"), `默认预设里该有 remarkGfm，实际：${pluginNames.join("、")}`);
  assert.deepEqual(remarkPlugins.at(-1), [remarkTrajectoryLinks, { hrefBase: "/trajectory" }]);
  const rehypeNames = (options.rehypePlugins ?? []).map((plugin) => (Array.isArray(plugin) ? plugin[0] : plugin)).map((plugin) => (plugin as { name?: string }).name);
  assert.ok(rehypeNames.includes("rehypeCode"), `默认预设里该有代码高亮 rehypeCode，实际：${rehypeNames.join("、")}`);
});
