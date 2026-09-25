/**
 * 契约测试：**两个适配器**在同一串改动下状态一致——生产那个是 fumadocs 口味的 mdx，
 * 测试那个是 `fake-format.ts`（记号一行 `REF <载荷>`）。
 *
 * 这就是 `Format` 这条接缝存在的理由：它分离的是「怎么认记号」与「怎么判新鲜」两种变化原因。
 * 状态是判定层算的，格式只交引用与记号上的记录——两边不一致就是有人抄了近道。
 * 跑在临时真 git 仓里，旧内容来源是产品用的 git 那份。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import * as mdx from "../packages/docfirst-workflow/src/fumadocs/index.ts";
import type { Format } from "../packages/docfirst-workflow/src/engine/index.ts";
import { fakeFormat } from "./fake-format.ts";
import { CODE, setupRepo } from "./repo.ts";
import type { Repo } from "./repo.ts";

const fake = fakeFormat("fake", ".txt");
const FORMATS = [mdx as unknown as Format, fake];
const DRAFT = "@@docfirst ref src/greet.ts:2-3 @@";
const DOCS = ["docs/a.mdx", "docs/a.txt"];
const START: Record<string, string> = {
  "docs/a.mdx": `---\ntitle: mdx\n---\n\n# mdx\n\n${DRAFT}\n\n尾巴\n`,
  "docs/a.txt": `一\n\n${DRAFT}\n\n尾巴\n`,
};

function start(): Repo {
  const r = setupRepo({ formats: FORMATS });
  for (const doc of DOCS) r.write(doc, START[doc]!);
  return r;
}

const statuses = (r: Repo): string[][] => DOCS.map((doc) => r.statuses(doc, r.read(doc)));
const spans = (r: Repo): Array<[number, number]> => DOCS.map((doc) => r.service.resolve(doc, r.read(doc)).items[0]!.lines);
const same = (s: string): string[][] => DOCS.map(() => [s]);
/** 两篇都确认一遍，交回每篇每处做了什么 */
const confirmAll = (r: Repo, accept = false): string[][] => DOCS.map((doc) => r.confirm(doc, accept).steps.map((s) => s.action));
/** 两篇记号上的记录属性：两个格式写的必须一样 */
const records = (r: Repo): string[] => DOCS.map((doc) => /hash="[^"]+" blob="[^"]+"/.exec(r.read(doc))?.[0] ?? "");

test("两个格式在同一串改动下状态一致，行段跟到同一个地方，记号上的记录也一样", () => {
  const r = start();
  try {
    assert.deepEqual(statuses(r), same("unconfirmed"));

    assert.deepEqual(confirmAll(r), same("recorded"));
    assert.deepEqual(statuses(r), same("fresh"));
    for (const doc of DOCS) assert.ok(!r.read(doc).includes("@@docfirst"), `${doc} 确认后草稿记号还在`);
    const [a, b] = records(r);
    assert.ok(a !== "" && a === b, "两个格式记下的记录一样");

    r.write("src/greet.ts", CODE.replace("hello", "hey"));
    r.commit("改问候语");
    assert.deepEqual(statuses(r), same("changed"));
    assert.deepEqual(confirmAll(r), same("needs-accept"), "黄灯不带 accept 不动");
    assert.deepEqual(confirmAll(r, true), same("accepted"));
    assert.deepEqual(statuses(r), same("fresh"));

    r.write("src/greet.ts", `// 头一行\n// 又一行\n${CODE.replace("hello", "hey")}`);
    r.commit("上面插两行");
    assert.deepEqual(statuses(r), same("fresh"), "内容没变，只是挪了位置");
    assert.deepEqual(spans(r), [[4, 5], [4, 5]], "两个格式跟到同一个新位置");
    assert.deepEqual(confirmAll(r), same("moved"));

    r.write("src/greet.ts", "// greet\nexport const VERSION = 1;\n");
    r.commit("把函数删了");
    assert.deepEqual(statuses(r), same("missing"));
    assert.deepEqual(confirmAll(r), same("refused"));
  } finally {
    r.teardown();
  }
});

test("同一篇里两处引用指向同一段：各带各的记录，两个格式一个样", () => {
  const r = start();
  try {
    r.write("docs/a.mdx", `${DRAFT}\n\n中间\n\n${DRAFT}\n`);
    r.write("docs/a.txt", `${DRAFT}\n\n中间\n\n${DRAFT}\n`);
    assert.deepEqual(confirmAll(r), DOCS.map(() => ["recorded", "recorded"]));
    assert.deepEqual(statuses(r), DOCS.map(() => ["fresh", "fresh"]));
  } finally {
    r.teardown();
  }
});

test("确认幂等：文档已经是正式形态了，再确认一次一个字不变", () => {
  const r = start();
  try {
    confirmAll(r);
    const after = DOCS.map((doc) => r.read(doc));
    assert.deepEqual(confirmAll(r), same("unchanged"));
    assert.deepEqual(DOCS.map((doc) => r.read(doc)), after);
  } finally {
    r.teardown();
  }
});

test("代码没提交也确认得下：记录按工作区内容算", () => {
  const r = start();
  try {
    r.write("src/greet.ts", CODE.replace("hello", "hey"));
    assert.deepEqual(confirmAll(r), same("recorded"));
    assert.deepEqual(statuses(r), same("fresh"));
  } finally {
    r.teardown();
  }
});
