/**
 * 摆放的另一个宿主：生成物存在内存里，一个字节都不落盘、一次 git 都不起。
 *
 * `createPlacing` 只经 `PlacingHost` 认识外面——项目那半（根、配置、服务、名册、落点表、正本原文）
 * 和生成物那半（读一个落点、写一个落点）都在接口上。真盘那份适配器住 `load.ts`，这儿是第二份：
 * 落点在一张 Map 里，于是「摆了什么、摆到哪个键上、盘上那份被动过之后判成什么」全部直接看得见。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHashComparator, createService } from "../packages/docfirst-workflow/src/engine/index.ts";
import type { Format, Listing, Reader } from "../packages/docfirst-workflow/src/engine/index.ts";
import { createPlacing } from "../packages/docfirst-workflow/src/host/index.ts";
import type { PlacingHost, ProjectConfig } from "../packages/docfirst-workflow/src/host/index.ts";
import { memoryLedger } from "./repo.ts";

/**
 * 假格式：这份测试验的是摆放，不是认记号，所以 parse 一处引用都不认。
 * renderAi 出的那份故意带上三样要被整形掉的东西——整段 frontmatter、站上的标题锚记、
 * 逃逸了一半的加粗——摆放产物里它们都不该还在。
 */
const format: Format = {
  name: "fake",
  claims: (doc) => doc.endsWith(".md"),
  parse: () => [],
  write: (text) => text,
  marker: () => "",
  renderAi: () => ["---", "title: 站上的头部", "---", "", "# 摆放 [#bai-fang]", "", "一段&#x2A;*加粗**的正文", ""].join("\n"),
};

/** 整形之后该剩下的那段正文：frontmatter 剥掉、锚记剥掉、加粗还原、开头空行去掉 */
const BODY = "# 摆放\n\n一段**加粗**的正文\n";

/** 正本：点名的字段随行到生成物头部，没点名的剥掉 */
const SOURCE = ["---", "name: block-note", "description: 块笔记怎么用", "secret: 不该随行", "---", "", "# 摆放", ""].join("\n");

/** 内存宿主：落点是一张 `to → 内容` 的表，没有目录、没有路径解析、没有磁盘 */
function memoryHost(outputs: ProjectConfig["outputs"], source = SOURCE) {
  const placed = new Map<string, string>();
  const reader: Reader = { read: () => null };
  const config = { formats: [format], outputs } as ProjectConfig;
  const host: PlacingHost = {
    root: "/内存里没有根",
    config,
    service: createService({ formats: [format], reader, ledger: memoryLedger(), comparator: createHashComparator() }),
    roster: undefined,
    placements: (doc) => (outputs?.[doc] ?? []).map((raw) => (typeof raw === "string" ? { to: raw, frontmatter: [] } : { to: raw.to, frontmatter: raw.frontmatter ?? [] })),
    read: () => source,
    readPlaced: (to) => placed.get(to) ?? null,
    writePlaced: (to, text) => void placed.set(to, text),
  };
  return { placed, placing: createPlacing(host) };
}

test("内存宿主：render 只经 writePlaced 摆东西，落点的键就是配置里写的那个 to", async () => {
  const { placed, placing } = memoryHost({ "docs/a.md": ["README.md", { to: "skills/x/SKILL.md", frontmatter: ["name", "description"] }] });

  assert.deepEqual(await placing.render("docs/a.md"), [
    { to: "README.md", status: "placed" },
    { to: "skills/x/SKILL.md", status: "placed" },
  ]);
  assert.deepEqual([...placed.keys()], ["README.md", "skills/x/SKILL.md"], "落点原样交给宿主，摆放自己不拼路径");
  assert.equal(placed.get("README.md"), BODY, "字符串写法：frontmatter 整段剥掉，锚记与逃逸的加粗都整形过");
  assert.equal(placed.get("skills/x/SKILL.md"), `---\nname: block-note\ndescription: 块笔记怎么用\n---\n\n${BODY}`, "点名的两个字段原样随行，secret 不随行");
});

test("内存宿主：四态全走一遍——没摆过 missing，摆完 fresh，内容被换掉 stale，落点没了又是 missing", async () => {
  const { placed, placing } = memoryHost({ "docs/a.md": ["README.md"] });

  assert.deepEqual(await placing.check("docs/a.md"), [{ to: "README.md", status: "missing", fresh: false }]);

  await placing.render("docs/a.md");
  assert.deepEqual(await placing.check("docs/a.md"), [{ to: "README.md", status: "fresh", fresh: true }]);

  placed.set("README.md", `${BODY}\n有人手改了一笔\n`);
  assert.deepEqual(await placing.check("docs/a.md"), [{ to: "README.md", status: "stale", fresh: false }]);

  placed.delete("README.md");
  assert.deepEqual(await placing.check("docs/a.md"), [{ to: "README.md", status: "missing", fresh: false }]);
});

test("内存宿主：落点上那份是 CRLF，正文一样就还是 fresh——换行归一是判定的口径，不是宿主的事", async () => {
  const { placed, placing } = memoryHost({ "docs/a.md": ["README.md"] });
  placed.set("README.md", BODY.replace(/\n/g, "\r\n"));

  assert.deepEqual(await placing.check("docs/a.md"), [{ to: "README.md", status: "fresh", fresh: true }]);
});

test("内存宿主：源里缺点名的字段，这个落点一个字都不写", async () => {
  const { placed, placing } = memoryHost({ "docs/a.md": [{ to: "SKILL.md", frontmatter: ["name", "nope"] }] });

  assert.deepEqual(await placing.render("docs/a.md"), [{ to: "SKILL.md", status: "no-frontmatter", missing: ["nope"] }]);
  assert.equal(placed.size, 0, "缺字段就不摆——摆一份缺 name 的 SKILL.md 比不摆更糟");
  assert.deepEqual(await placing.check("docs/a.md"), [{ to: "SKILL.md", status: "no-frontmatter", fresh: false, missing: ["nope"] }]);
});

test("内存宿主：check 收到调用方判好的清单就原样交给格式，不再判一遍", async () => {
  const handed: Listing[] = [];
  const counted: Format = { ...format, renderAi: (text, listing, ctx) => (handed.push(listing), format.renderAi!(text, listing, ctx)) };
  const service = createService({ formats: [counted], reader: { read: () => null }, ledger: memoryLedger(), comparator: createHashComparator() });
  let resolved = 0;
  const outputs = { "docs/a.md": ["README.md"] };
  const placing = createPlacing({
    root: "/内存里没有根",
    config: { formats: [counted], outputs } as ProjectConfig,
    service: { ...service, resolve: (doc, text) => (resolved += 1, service.resolve(doc, text)) },
    roster: undefined,
    placements: () => [{ to: "README.md", frontmatter: [] }],
    read: () => SOURCE,
    readPlaced: () => BODY,
    writePlaced: () => {},
  });
  const listing: Listing = { doc: "docs/a.md", items: [], orphans: [] };

  assert.deepEqual(await placing.check("docs/a.md", listing), [{ to: "README.md", status: "fresh", fresh: true }]);
  assert.equal(resolved, 0, "清单是传进来的，摆放自己没判");
  assert.equal(handed[0], listing, "格式拿到的就是传进来的那一份");

  await placing.check("docs/a.md");
  assert.equal(resolved, 1, "没传清单就自己判一遍");
});

test("内存宿主：没挂落点的文档，两个方法都回空清单，宿主一次都没被写过", async () => {
  const { placed, placing } = memoryHost({ "docs/a.md": ["README.md"] });

  assert.deepEqual(await placing.render("docs/b.md"), []);
  assert.deepEqual(await placing.check("docs/b.md"), []);
  assert.equal(placed.size, 0);
});
