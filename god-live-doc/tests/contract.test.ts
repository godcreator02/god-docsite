/**
 * 契约测试：三个格式包（md、fumadocs 口味的 mdx、html）在同一串改动下状态一致。
 * 状态是核心算的，格式包只交引用——不一致就是有人抄了近道。
 * 跑在临时真 git 仓里，比较器是产品用的那个 git 版。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import * as md from "@god-live-doc/format-md";
import * as mdx from "@god-live-doc/format-fumadocs";
import * as html from "@god-live-doc/format-html";
import type { Format } from "@god-live-doc/core";
import { CODE, setupRepo } from "./repo.ts";
import type { Repo } from "./repo.ts";

const FORMATS = [md, mdx, html] as unknown as Format[];
const DRAFT = "@@livedoc ref src/greet.ts:2-3 @@";
const DOCS = ["docs/a.md", "docs/a.mdx", "docs/a.html"];
const START: Record<string, string> = {
  "docs/a.md": `# md\n\n${DRAFT}\n\n尾巴\n`,
  "docs/a.mdx": `---\ntitle: mdx\n---\n\n# mdx\n\n${DRAFT}\n\n尾巴\n`,
  "docs/a.html": `<h1>html</h1>\n<figure>\n  <figcaption>签名</figcaption>\n  ${DRAFT}\n</figure>\n<p>尾巴</p>\n`,
};

function start(): Repo {
  const r = setupRepo({ formats: FORMATS });
  for (const doc of DOCS) r.write(doc, START[doc]!);
  return r;
}

const statuses = (r: Repo): string[][] => DOCS.map((doc) => r.statuses(doc, r.read(doc)));
const spans = (r: Repo): Array<[number, number]> => DOCS.map((doc) => r.service.resolve(doc, r.read(doc)).items[0]!.lines);
const same = (s: string): string[][] => DOCS.map(() => [s]);

function confirmAll(r: Repo): string[] {
  const problems: string[] = [];
  for (const doc of DOCS) {
    const done = r.service.confirm(doc, r.read(doc));
    problems.push(...done.problems);
    if (done.changed) r.write(doc, done.text);
  }
  return problems;
}

test("三个格式包在同一串改动下状态一致，行段也跟到同一个地方", () => {
  const r = start();
  try {
    assert.deepEqual(statuses(r), same("unconfirmed"));

    assert.deepEqual(confirmAll(r), []);
    assert.deepEqual(statuses(r), same("fresh"));
    for (const doc of DOCS) assert.ok(!r.read(doc).includes("@@livedoc"), `${doc} 确认后草稿记号还在`);

    r.write("src/greet.ts", CODE.replace("hello", "hey"));
    r.commit("改问候语");
    assert.deepEqual(statuses(r), same("changed"));

    assert.deepEqual(confirmAll(r), []);
    assert.deepEqual(statuses(r), same("fresh"));

    r.write("src/greet.ts", `// 头一行\n// 又一行\n${CODE.replace("hello", "hey")}`);
    r.commit("上面插两行");
    assert.deepEqual(statuses(r), same("fresh"), "内容没变，只是挪了位置");
    assert.deepEqual(spans(r), [[4, 5], [4, 5], [4, 5]], "三个格式包跟到同一个新位置");

    r.write("src/greet.ts", "// greet\nexport const VERSION = 1;\n");
    r.commit("把函数删了");
    assert.deepEqual(statuses(r), same("missing"));
  } finally {
    r.teardown();
  }
});

test("删掉引用 → 三篇都报孤儿；再确认一次都清掉", () => {
  const r = start();
  try {
    confirmAll(r);
    r.write("docs/a.md", "# md\n\n没有引用了\n");
    r.write("docs/a.mdx", "---\ntitle: mdx\n---\n\n# mdx\n\n没有引用了\n");
    r.write("docs/a.html", "<p>没有引用了</p>\n");
    const orphans = (): number[] => DOCS.map((doc) => r.service.resolve(doc, r.read(doc)).orphans.length);
    assert.deepEqual(orphans(), [1, 1, 1]);
    confirmAll(r);
    assert.deepEqual(orphans(), [0, 0, 0]);
  } finally {
    r.teardown();
  }
});

test("同一篇里两处引用指向同一段：共用一条记录，三个格式包一个样", () => {
  const r = start();
  try {
    r.write("docs/a.md", `${DRAFT}\n\n中间\n\n${DRAFT}\n`);
    r.write("docs/a.mdx", `${DRAFT}\n\n中间\n\n${DRAFT}\n`);
    r.write("docs/a.html", `<p>${"一"}</p>\n${DRAFT}\n<p>中间</p>\n${DRAFT}\n`);
    assert.deepEqual(confirmAll(r), []);
    assert.deepEqual(statuses(r), DOCS.map(() => ["fresh", "fresh"]));
    assert.deepEqual(
      DOCS.map((doc) => Object.keys(r.ledger.dump()[doc] ?? {}).length),
      [1, 1, 1],
      "两处引用同一段，记录簿里只该有一条",
    );
  } finally {
    r.teardown();
  }
});

test("确认幂等：文档已经是正式形态了，再确认一次一个字不变", () => {
  const r = start();
  try {
    confirmAll(r);
    const after = DOCS.map((doc) => r.read(doc));
    confirmAll(r);
    assert.deepEqual(DOCS.map((doc) => r.read(doc)), after);
  } finally {
    r.teardown();
  }
});

test("代码未提交：三篇都拒，记录簿一条不写", () => {
  const r = start();
  try {
    confirmAll(r);
    r.write("src/greet.ts", CODE.replace("hello", "hey"));
    const before = DOCS.map((doc) => r.read(doc));
    const problems = confirmAll(r);
    assert.equal(problems.length, 3, "三篇各报一处未提交");
    for (const problem of problems) assert.match(problem, /未提交/);
    assert.deepEqual(DOCS.map((doc) => r.read(doc)), before, "拒了就不写回");
  } finally {
    r.teardown();
  }
});
