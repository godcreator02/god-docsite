/**
 * 没有构建管线的消费方：两个格式包并存、确认后代码投影进文档、render 各说各话、换比较器的账。
 * 走的是装好的包（link 过来的构建产物），不是源码——这条测试同时也在验「装完就能用」。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createService, createHashComparator } from "@godcreator02/live-doc-core";
import { createLedger, createReader, createGitComparator } from "@godcreator02/live-doc-project";
import { loadProject } from "@godcreator02/live-doc-project";
import * as md from "@godcreator02/live-doc-format-md";
import * as html from "@godcreator02/live-doc-format-html";

const CLI = "node_modules/@godcreator02/live-doc-cli/dist/cli.mjs";
const run = (...args) => execFileSync("node", [CLI, ...args], { encoding: "utf8", timeout: 120_000 });
const project = await loadProject(process.cwd());
const read = (rel) => readFileSync(rel, "utf8");

test("一个项目两种格式并存：md 归 md 包，html 归 html 包", () => {
  assert.deepEqual(project.docs(), ["content/docs/greet.html", "content/docs/guide.md"]);
  assert.equal(project.service.formatFor("content/docs/greet.html").name, "html");
  assert.equal(project.service.formatFor("content/docs/guide.md").name, "md");
});

test("已确认：两篇都新鲜，代码投影进了文档，草稿记号不见了", () => {
  for (const doc of project.docs()) {
    const listing = project.service.resolve(doc, project.read(doc));
    assert.ok(listing.items.length > 0, `${doc} 一处引用都没有`);
    assert.deepEqual(listing.items.map((i) => i.status), listing.items.map(() => "fresh"), `${doc} 不是全绿`);
    assert.equal(listing.orphans.length, 0);
    // 认到的都是正式记号了；正文里讲草稿写法那句话（写在 <code> 里）不算记号
    assert.deepEqual(listing.items.map((i) => i.reference.extra.draft), listing.items.map(() => false), `${doc} 里还留着草稿记号`);
  }
  assert.match(
    read("content/docs/greet.html"),
    /<figcaption>src\/greet\.ts 的签名<\/figcaption>\n\s*<pre data-file="src\/greet\.ts" data-lines="2-3"><code class="language-ts">export function greet/,
  );
  assert.match(read("content/docs/guide.md"), /<!-- ref file="src\/greet\.ts" lines="2-3" -->\n```ts\nexport function greet[\s\S]*```\n<!-- \/ref -->/);
});

test("记录簿记的是 hash 版：没有 blob、没有 commit", () => {
  const ledger = JSON.parse(read(".ledger.json"));
  for (const table of Object.values(ledger)) {
    for (const record of Object.values(table)) {
      assert.equal(record.kind, "hash");
      assert.equal(record.blob, undefined, "hash 版不记 blob");
      assert.deepEqual(Object.keys(record).sort(), ["hash", "kind", "lines"]);
    }
  }
});

test("展示区不是记忆：手改围栏里的字，状态还是新鲜", () => {
  const doc = "content/docs/guide.md";
  const tampered = project.read(doc).replace("hello", "手改");
  assert.deepEqual(project.service.resolve(doc, tampered).items.map((i) => i.status), ["fresh"]);
});

test("render：md 出 ai 那份剥掉记号；html 说产物就是文档本身", () => {
  const out = run("render", "--target", "ai");
  assert.match(out, /content\/docs\/greet\.html\s+html 的产物就是文档本身，人和 AI 都读它/);
  assert.match(out, /content\/docs\/guide\.md\s+渲染成 ai/);
  const ai = read("out/guide.md.ai.md");
  assert.doesNotMatch(ai, /<!-- ref |<!-- \/ref -->/);
  assert.match(ai, /```ts\nexport function greet/);
});

test("换比较器：git 版看这本 hash 记录簿，一律当未确认——不猜", () => {
  const doc = "content/docs/guide.md";
  const swapped = createService({
    formats: [md, html],
    reader: createReader(process.cwd()),
    ledger: createLedger(".ledger.json"),
    comparator: createGitComparator({ root: process.cwd() }),
  });
  assert.deepEqual(swapped.resolve(doc, project.read(doc)).items.map((i) => i.status), ["unconfirmed"]);

  // 换回来还是绿的：记录一个字没动，只是刚才那位比较器不认它
  const back = createService({
    formats: [md, html],
    reader: createReader(process.cwd()),
    ledger: createLedger(".ledger.json"),
    comparator: createHashComparator(),
  });
  assert.deepEqual(back.resolve(doc, project.read(doc)).items.map((i) => i.status), ["fresh"]);
});

test("check 全绿，退 0", () => {
  const out = run("check");
  assert.match(out, /🟢 content\/docs\/greet\.html/);
  assert.match(out, /🟢 content\/docs\/guide\.md/);
  assert.doesNotMatch(out, /🔴|🟡/);
});
