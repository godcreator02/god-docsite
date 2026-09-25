/**
 * `docfirst migrate-ledger`：旧记录簿逐篇逐处写进记号，写完删掉记录簿，列出配置里还要手工改的键。
 * 各站迁完之后，这条命令连同这份测试在下一个版本删掉。台子在 cli-project.ts。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createService, hashNames, hashSpan, hashText, normalizeLines } from "../packages/docfirst-pin/src/index.ts";
import { createGitHistory, createReader } from "../packages/docfirst-workflow/src/project/index.ts";
import { CONFIG, setupProject } from "./cli-project.ts";
import { fakeFormat } from "./fake-format.ts";
import { CODE } from "./repo.ts";

/** 旧记录簿里的段哈希：归一化后 sha256 的完整 64 位 */
const oldHash = (lines: string[]): string => createHash("sha256").update(normalizeLines(lines).join("\n"), "utf8").digest("hex");
const LINES = CODE.split("\n");
const BLOB = hashText(CODE);
const OLD_CONFIG = CONFIG.replace(`content: "docs"`, `docs: "docs", comparator: "git", ledger: ".ledger.json"`);

const DOC = [
  "# m",
  "",
  'REF ref file="src/greet.ts" lines="2-3"',
  'REF ref file="src/greet.ts" lines="6-6"',
  'REF ref file="src/greet.ts"',
  'REF tree dir="src" depth="1"',
  'REF exists path="src/greet.ts"',
  'REF absent path="src/gone.ts"',
  'REF has file="src/greet.ts" text="greet"',
  'REF ref file="src/greet.ts" lines="1-1"',
  "@@docfirst ref src/greet.ts:4-4 @@",
  "",
].join("\n");

const LEDGER = {
  "docs/m.md": {
    "src/greet.ts:2-3": { kind: "git", blob: BLOB, commit: "c".repeat(40), lines: [2, 3], hash: oldHash(LINES.slice(1, 3)) },
    "src/greet.ts:6-6": { kind: "hash", lines: [6, 6], hash: oldHash(LINES.slice(5, 6)) },
    "src/greet.ts:all": { kind: "git", blob: BLOB, commit: "c".repeat(40), lines: [1, 6], hash: oldHash(LINES) },
    "tree src depth=1": { kind: "tree", names: ["greet.ts"] },
    "exists src/greet.ts": { kind: "exists", type: "file" },
    "absent src/gone.ts": { kind: "exists", type: "absent" },
    'has src/greet.ts "greet"': { kind: "has" },
    "src/greet.ts:9-9": { kind: "hash", lines: [9, 9], hash: "0".repeat(64) },
    "src/greet.ts:4-4": { kind: "hash", lines: [4, 4], hash: oldHash(LINES.slice(3, 4)) },
  },
  "docs/gone.md": { "src/greet.ts:1-1": { kind: "hash", lines: [1, 1], hash: "0".repeat(64) } },
};

test("migrate-ledger：记录逐处写进记号，孤儿丢掉，记录簿删掉，列出配置里要改的键；迁完照样新鲜", async () => {
  const p = setupProject(OLD_CONFIG);
  try {
    writeFileSync(join(p.root, "docs", "m.md"), DOC);
    writeFileSync(join(p.root, ".ledger.json"), JSON.stringify(LEDGER, null, 2));

    const done = await p.cli("migrate-ledger");
    assert.equal(done.code, 0, done.out);
    assert.match(done.out, /✅ docs\/m\.md {2}6 处记号写上了记录/);
    assert.match(done.out, /丢掉 3 条记录/, "文档已经不在的一条、没有记号对应的一条、草稿记号那一条");
    assert.match(done.out, /🧹 已删掉 \.ledger\.json/);
    assert.match(done.out, /删掉 docs：/);
    assert.match(done.out, /删掉 comparator：/);
    assert.match(done.out, /删掉 ledger：/);
    assert.equal(existsSync(join(p.root, ".ledger.json")), false);

    const blob = BLOB.slice(0, 12);
    assert.deepEqual(p.read("docs/m.md").split("\n"), [
      "# m",
      "",
      `REF ref file="src/greet.ts" lines="2-3" hash="${hashSpan(LINES.slice(1, 3))}" blob="${blob}"`,
      `REF ref file="src/greet.ts" lines="6-6" hash="${hashSpan(LINES.slice(5, 6))}"`,
      `REF ref file="src/greet.ts" hash="${hashSpan(LINES)}" blob="${blob}"`,
      `REF tree dir="src" depth="1" hash="${hashNames(["greet.ts"])}"`,
      'REF exists path="src/greet.ts" type="file"',
      'REF absent path="src/gone.ts" type="absent"',
      'REF has file="src/greet.ts" text="greet"',
      'REF ref file="src/greet.ts" lines="1-1"',
      "@@docfirst ref src/greet.ts:4-4 @@",
      "",
    ]);

    const service = createService({ formats: [fakeFormat("fake-md", ".md")], reader: createReader(p.root), history: createGitHistory(p.root) });
    assert.deepEqual(
      service.resolve("docs/m.md", p.read("docs/m.md")).items.map((i) => i.status),
      ["fresh", "fresh", "fresh", "fresh", "fresh", "fresh", "fresh", "unconfirmed", "unconfirmed"],
      "迁过来的记录跟今天的内容对得上；没记录的与草稿照旧未确认",
    );
  } finally {
    p.teardown();
  }
});

test("migrate-ledger：记录的 kind 跟记号对不上、没有记录簿，都报错说清楚", async () => {
  const p = setupProject(OLD_CONFIG);
  try {
    await assert.rejects(p.cli("migrate-ledger"), /没有记录簿 \.ledger\.json——没有要迁的/);
    writeFileSync(join(p.root, "docs", "m.md"), 'REF ref file="src/greet.ts" lines="2-3"\n');
    writeFileSync(join(p.root, ".ledger.json"), JSON.stringify({ "docs/m.md": { "src/greet.ts:2-3": { kind: "tree", names: [] } } }));
    await assert.rejects(p.cli("migrate-ledger"), /docs\/m\.md 第 1 行 src\/greet\.ts:2-3：记录的 kind tree 对不上这种记号（span）/);
    assert.equal(existsSync(join(p.root, ".ledger.json")), true, "出错就不删记录簿");
  } finally {
    p.teardown();
  }
});
