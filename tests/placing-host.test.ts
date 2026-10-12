/**
 * 摆放的另一个宿主：生成物存在内存里，一个字节都不写磁盘、一次 git 都不运行。
 *
 * `createPlacing` 只经 `PlacingHost` 认识外面——项目那部分（钉码编排、落点表、正本原文）
 * 和生成物那部分（读一个落点、写一个落点）都在接口上。读写真实磁盘的那份适配器住 `load.ts`，这儿是第二份：
 * 落点在一张 Map 里，于是「摆了什么、摆到哪个键上、落点上的内容被改过之后判成什么」全部直接看得见。
 */
import { test } from "vitest";
import assert from "node:assert/strict";
import { createPinner } from "../packages/code-pin/src/index.ts";
import type { Roster } from "../packages/docfirst-workflow/src/mdx/index.ts";
import type { Listing } from "../packages/docfirst-workflow/src/reference/index.ts";
import { createPinning } from "../packages/docfirst-workflow/src/pinning/index.ts";
import type { Pinning } from "../packages/docfirst-workflow/src/pinning/index.ts";
import { createPlacing } from "../packages/docfirst-workflow/src/project/index.ts";
import type { PlacingHost, ProjectConfig } from "../packages/docfirst-workflow/src/project/index.ts";
import { NO_HISTORY } from "./repo.ts";

/** 正本：点名的字段带到生成物头部，没点名的去掉；正文里看着像转义的 `&#x2A;` 原样留着 */
const SOURCE = ["---", "name: block-note", "description: 块笔记怎么用", "secret: 不该随行", "---", "", "# 摆放", "", "一段**加粗**的正文，&#x2A; 原样", ""].join("\n");

/** 整形之后该剩下的那段正文：frontmatter 去掉、开头空行去掉，别的原样 */
const BODY = "# 摆放\n\n一段**加粗**的正文，&#x2A; 原样\n";

/** 什么都读不到的钉码编排：这份测试不验判定 */
const pinningOf = (): Pinning => createPinning(createPinner({ reader: { read: () => null }, history: NO_HISTORY }));

/** 内存宿主：落点是一张 `to → 内容` 的表，没有目录、没有路径解析、没有磁盘 */
function memoryHost(outputs: ProjectConfig["outputs"], source = SOURCE, roster: Roster = {}) {
  const placed = new Map<string, string>();
  const host: PlacingHost = {
    pinning: pinningOf(),
    roster,
    placements: (doc) => (outputs?.[doc] ?? []).map((raw) => (typeof raw === "string" ? { to: raw, frontmatter: [] } : { to: raw.to, frontmatter: raw.frontmatter ?? [] })),
    read: () => source,
    readPlaced: (to) => placed.get(to) ?? null,
    writePlaced: (to, text) => void placed.set(to, text),
  };
  return { placed, placing: createPlacing(host) };
}

test("内存宿主：render 只经 writePlaced 摆东西，落点的键就是配置里写的那个 to", async () => {
  const { placed, placing } = memoryHost({ "docs/a.mdx": ["README.md", { to: "skills/x/SKILL.md", frontmatter: ["name", "description"] }] });

  assert.deepEqual(await placing.render("docs/a.mdx"), [
    { to: "README.md", status: "placed" },
    { to: "skills/x/SKILL.md", status: "placed" },
  ]);
  assert.deepEqual([...placed.keys()], ["README.md", "skills/x/SKILL.md"], "落点原样交给宿主，摆放自己不拼路径");
  assert.equal(placed.get("README.md"), BODY, "字符串写法：frontmatter 整段剥掉，别的文字原样");
  assert.equal(placed.get("skills/x/SKILL.md"), `---\nname: block-note\ndescription: 块笔记怎么用\n---\n\n${BODY}`, "点名的两个字段原样随行，secret 不随行");
});

test("内存宿主：四态全走一遍——没摆过 missing，摆完 fresh，内容被换掉 stale，落点没了又是 missing", async () => {
  const { placed, placing } = memoryHost({ "docs/a.mdx": ["README.md"] });

  assert.deepEqual(await placing.check("docs/a.mdx"), [{ to: "README.md", status: "missing", fresh: false }]);

  await placing.render("docs/a.mdx");
  assert.deepEqual(await placing.check("docs/a.mdx"), [{ to: "README.md", status: "fresh", fresh: true }]);

  placed.set("README.md", `${BODY}\n有人手改了一笔\n`);
  assert.deepEqual(await placing.check("docs/a.mdx"), [{ to: "README.md", status: "stale", fresh: false }]);

  placed.delete("README.md");
  assert.deepEqual(await placing.check("docs/a.mdx"), [{ to: "README.md", status: "missing", fresh: false }]);
});

test("内存宿主：落点上那份是 CRLF，正文一样就还是 fresh——换行归一是判定的口径，不是宿主的事", async () => {
  const { placed, placing } = memoryHost({ "docs/a.mdx": ["README.md"] });
  placed.set("README.md", BODY.replace(/\n/g, "\r\n"));

  assert.deepEqual(await placing.check("docs/a.mdx"), [{ to: "README.md", status: "fresh", fresh: true }]);
});

test("内存宿主：源里缺点名的字段，这个落点一个字都不写", async () => {
  const { placed, placing } = memoryHost({ "docs/a.mdx": [{ to: "SKILL.md", frontmatter: ["name", "nope"] }] });

  assert.deepEqual(await placing.render("docs/a.mdx"), [{ to: "SKILL.md", status: "no-frontmatter", missing: ["nope"] }]);
  assert.equal(placed.size, 0, "缺字段就不摆——摆一份缺 name 的 SKILL.md 比不摆更糟");
  assert.deepEqual(await placing.check("docs/a.mdx"), [{ to: "SKILL.md", status: "no-frontmatter", fresh: false, missing: ["nope"] }]);
});

test("内存宿主：check 收到调用方判好的清单就直接渲染，不再判一遍", async () => {
  const pinning = pinningOf();
  let resolved = 0;
  const placing = createPlacing({
    pinning: { ...pinning, checkDoc: (doc, text) => (resolved += 1, pinning.checkDoc(doc, text)) },
    roster: {},
    placements: () => [{ to: "README.md", frontmatter: [] }],
    read: () => SOURCE,
    readPlaced: () => BODY,
    writePlaced: () => {},
  });
  const listing: Listing = { doc: "docs/a.mdx", items: [] };

  assert.deepEqual(await placing.check("docs/a.mdx", listing), [{ to: "README.md", status: "fresh", fresh: true }]);
  assert.equal(resolved, 0, "清单是传进来的，摆放自己没判");

  await placing.check("docs/a.mdx");
  assert.equal(resolved, 1, "没传清单就自己判一遍");
});

test("内存宿主：正本渲染不了，每个落点都报 unrenderable、一个字不写；别的错照原样抛", () => {
  const targets = { "docs/a.mdx": ["README.md", { to: "SKILL.md", frontmatter: ["name"] }] };
  const { placed, placing } = memoryHost(targets, `${SOURCE}\n<Note>提示</Note>\n`);
  const reason = "第 11 行有名册外组件 <Note>，先在 docfirst.config 的 components 里给它写机读规则";
  assert.deepEqual(placing.render("docs/a.mdx"), [
    { to: "README.md", status: "unrenderable", reason },
    { to: "SKILL.md", status: "unrenderable", reason },
  ]);
  assert.equal(placed.size, 0);
  assert.deepEqual(placing.check("docs/a.mdx"), [
    { to: "README.md", status: "unrenderable", fresh: false, reason },
    { to: "SKILL.md", status: "unrenderable", fresh: false, reason },
  ]);

  const formal = memoryHost(targets, `${SOURCE}\n{/* ref file="src/greet.ts" lines="2-3" */}\n`).placing;
  assert.throws(() => formal.check("docs/a.mdx", { doc: "docs/a.mdx", items: [] }), /第 11 行是引用记号，但清单里没有它/, "清单对不上正本不是拒绝渲染，照原样抛");
});

test("内存宿主：正本里名册内的组件换成名册给的机读文字，落点照常摆", () => {
  const roster: Roster = { Note: (node, { paragraph, textOf }) => paragraph(`注意：${textOf(node)}`) };
  const { placed, placing } = memoryHost({ "docs/a.mdx": ["README.md"] }, `${SOURCE}\n<Note>提示</Note>\n`, roster);
  assert.deepEqual(placing.render("docs/a.mdx"), [{ to: "README.md", status: "placed" }]);
  assert.equal(placed.get("README.md"), `${BODY}\n注意：提示\n`);
});

test("内存宿主：没挂落点的文档，两个方法都回空清单，宿主一次都没被写过", async () => {
  const { placed, placing } = memoryHost({ "docs/a.mdx": ["README.md"] });

  assert.deepEqual(await placing.render("docs/b.mdx"), []);
  assert.deepEqual(await placing.check("docs/b.mdx"), []);
  assert.equal(placed.size, 0);
});
