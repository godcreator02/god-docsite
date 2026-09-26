/**
 * 卡里不许钉码：卡正文里出现 docfirst 引用记号（草稿或正式）一律报病——
 * 轨迹分区冻结历史，不钉活代码。这是钉码那一侧的规矩，在 workflow 包的 project/card-refs.ts；
 * 既测纯函数 checkDocfirstRefs，也测它接进 scanCardDir 之后 sick 自然带上报病，
 * 以及轨迹包自己的 parseCardFile 不再管它。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { SickFile } from "@godcreator/docfirst-trajectory";
import { checkDocfirstRefs } from "../packages/docfirst-workflow/src/project/card-refs.ts";
import { scanCardDir } from "../packages/docfirst-workflow/src/project/card-dir.ts";
import { card, D, flatProblems, memSick, renderCard, root } from "./trajectory-helpers.ts";
import type { CardSpec } from "./trajectory-helpers.ts";

/** 把卡连同根卡 pj01 写进一个临时目录跑 scanCardDir，交回报病；目录跑完就删 */
async function dirSick(specs: CardSpec[]): Promise<SickFile[]> {
  const dir = mkdtempSync(join(tmpdir(), "god-live-doc-card-refs-"));
  try {
    for (const spec of [root("pj01", D(1)), ...specs]) writeFileSync(join(dir, `${spec.name}.md`), renderCard(spec));
    return (await scanCardDir(dir)).sick;
  } finally {
    rmSync(dir, { recursive: true, force: true, maxRetries: 5 });
  }
}

test("卡正文带 docfirst 草稿记号：整行 @@docfirst ... @@ 报 docfirst 病", () => {
  const problems = checkDocfirstRefs("正文一段。\n\n@@docfirst ref src/greet.ts:2-3 @@\n\n尾巴\n");
  assert.equal(problems.length, 1);
  assert.equal(problems[0]?.field, "docfirst");
  assert.match(problems[0]?.reason ?? "", /草稿记号/);
});

test("普通正文不报 docfirst 病", () => {
  assert.deepEqual(checkDocfirstRefs("正常写的一段叙事，没有任何引用记号。\n\n第二段。\n"), []);
});

test("@@docfirst 少一头哨兵不算记号，不报病", () => {
  assert.deepEqual(checkDocfirstRefs("@@docfirst ref src/greet.ts:2-3\n"), []);
  assert.deepEqual(checkDocfirstRefs("docfirst ref src/greet.ts:2-3 @@\n"), []);
});

test("接进 scanCardDir：带草稿记号的卡正文，sick 自然带上 docfirst 病", async () => {
  const specs = [
    card("dd01-带引用记号的卡", { domain: "域一" }, { body: "叙事一段。\n\n@@docfirst ref src/greet.ts @@\n" }),
  ];
  const problems = flatProblems(await dirSick(specs));
  assert.equal(problems.length, 1);
  assert.equal(problems[0]?.field, "docfirst");
  assert.equal(problems[0]?.path, "dd01-带引用记号的卡.md");
});

test("接进 scanCardDir：正常正文不报 docfirst 病", async () => {
  const specs = [card("dd02-正常的卡", { domain: "域一" }, { body: "正常叙事，没有引用记号。" })];
  assert.deepEqual(await dirSick(specs), []);
});

test("卡正文带正式记号：{/* ref ... */} 等三种花括号注释都报 docfirst 病——confirm 换出来的就是它", () => {
  const cases = [
    '{/* ref file="src/greet.ts" lines="2-3" */}',
    '{/* tree dir="src" depth="1" */}',
    '{/* has file="src/store.ts" text="save" */}',
  ];
  for (const line of cases) {
    const problems = checkDocfirstRefs(`正文一段。\n\n${line}\n`);
    assert.equal(problems.length, 1, line);
    assert.equal(problems[0]?.field, "docfirst");
    assert.match(problems[0]?.reason ?? "", /正式记号 \{\/\* /);
  }
  assert.deepEqual(checkDocfirstRefs("{/* 普通的 mdx 注释，不是记号 */}\n"), []);
  assert.deepEqual(checkDocfirstRefs('<!-- ref file="src/greet.ts" lines="2-3" -->\n'), [], "md 那种开标签不再是记号");
});

test("轨迹包的 parseCardFile 不查钉码记号：同一张卡，内存解析不报 docfirst 病", () => {
  const specs = [card("dd01-带引用记号的卡", { domain: "域一" }, { body: "叙事一段。\n\n@@docfirst ref src/greet.ts @@\n" })];
  assert.deepEqual(memSick(specs), []);
});
