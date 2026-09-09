/**
 * 本仓独有的第四层校验：卡正文里出现 livedoc 引用记号（草稿或正式）一律报病——
 * 轨迹分区冻结历史，不钉活代码。既测纯函数 checkLivedocRefs，也测它接进
 * parseCardFile 之后 scanDir/memSick 自然带上报病。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { checkLivedocRefs } from "@godcreator02/livedoc-trajectory";
import { card, flatProblems, memSick } from "./trajectory-helpers.ts";

test("卡正文带 livedoc 草稿记号：整行 @@livedoc ... @@ 报 livedoc 病", () => {
  const problems = checkLivedocRefs("正文一段。\n\n@@livedoc ref src/greet.ts:2-3 @@\n\n尾巴\n");
  assert.equal(problems.length, 1);
  assert.equal(problems[0]?.field, "livedoc");
  assert.match(problems[0]?.reason ?? "", /草稿记号/);
});

test("卡正文带 md 正式记号：<!-- ref ... --> 等五种开标签都报 livedoc 病", () => {
  const cases = [
    '<!-- ref file="src/greet.ts" lines="2-3" -->',
    '<!-- tree dir="src" depth="1" -->',
    '<!-- exists path="src/store.ts" -->',
    '<!-- absent path="src/gone.ts" -->',
    '<!-- has file="src/store.ts" text="save" -->',
  ];
  for (const line of cases) {
    const problems = checkLivedocRefs(`正文一段。\n\n${line}\n`);
    assert.equal(problems.length, 1, line);
    assert.equal(problems[0]?.field, "livedoc");
    assert.match(problems[0]?.reason ?? "", /正式记号/);
  }
});

test("普通正文不报 livedoc 病", () => {
  assert.deepEqual(checkLivedocRefs("正常写的一段叙事，没有任何引用记号。\n\n第二段。\n"), []);
});

test("@@livedoc 少一头哨兵不算记号，不报病", () => {
  assert.deepEqual(checkLivedocRefs("@@livedoc ref src/greet.ts:2-3\n"), []);
  assert.deepEqual(checkLivedocRefs("livedoc ref src/greet.ts:2-3 @@\n"), []);
});

test("接进 parseCardFile：带草稿记号的卡正文，scanDir 口径的 sick 自然带上 livedoc 病", () => {
  const specs = [
    card("dd01-带引用记号的卡", { domain: "域一" }, { body: "叙事一段。\n\n@@livedoc ref src/greet.ts @@\n" }),
  ];
  const problems = flatProblems(memSick(specs));
  assert.equal(problems.length, 1);
  assert.equal(problems[0]?.field, "livedoc");
  assert.equal(problems[0]?.path, "dd01-带引用记号的卡.md");
});

test("接进 parseCardFile：正常正文不报 livedoc 病", () => {
  const specs = [card("dd02-正常的卡", { domain: "域一" }, { body: "正常叙事，没有引用记号。" })];
  assert.deepEqual(memSick(specs), []);
});

test("卡正文带 mdx 正式记号：{/* ref ... */} 等五种花括号注释都报 livedoc 病——卡是 .mdx 时 confirm 换出来的就是它", () => {
  const cases = [
    '{/* ref file="src/greet.ts" lines="2-3" */}',
    '{/* tree dir="src" depth="1" */}',
    '{/* exists path="src/store.ts" */}',
    '{/* absent path="src/gone.ts" */}',
    '{/* has file="src/store.ts" text="save" */}',
  ];
  for (const line of cases) {
    const problems = checkLivedocRefs(`正文一段。\n\n${line}\n`);
    assert.equal(problems.length, 1, line);
    assert.equal(problems[0]?.field, "livedoc");
    assert.match(problems[0]?.reason ?? "", /正式记号 \{\/\* /);
  }
  assert.deepEqual(checkLivedocRefs("{/* 普通的 mdx 注释，不是记号 */}\n"), []);
});
