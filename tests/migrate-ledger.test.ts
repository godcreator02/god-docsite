/**
 * `docfirst migrate-ledger`：旧记录簿逐篇逐处写进记号，写完删掉记录簿，列出配置里还要手工改的键。
 * 各站迁完之后，这条命令连同这份测试在下一个版本删掉。台子在 cli-project.ts。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createPinner, hashNames, hashSpan, hashText, normalizeLines } from "../packages/docfirst-pin/src/index.ts";
import { createPinning } from "../packages/docfirst-workflow/src/pinning/index.ts";
import { createGitHistory, createReader } from "../packages/docfirst-workflow/src/project/index.ts";
import { CONFIG, setupProject } from "./cli-project.ts";
import { CODE } from "./repo.ts";

/** 旧记录簿里的段哈希：归一化后 sha256 的完整 64 位 */
const oldHash = (lines: string[]): string => createHash("sha256").update(normalizeLines(lines).join("\n"), "utf8").digest("hex");
const LINES = CODE.split("\n");
const BLOB = hashText(CODE);
const OLD_CONFIG = CONFIG.replace(`content: "docs"`, `formats: [], docs: "docs", comparator: "git", ledger: ".ledger.json"`);

/** 一篇 mdx：每个记号单独成段 */
const docOf = (lines: string[]): string => `${["# m", ...lines].join("\n\n")}\n`;

const DOC = docOf([
  '{/* ref file="src/greet.ts" lines="2-3" */}',
  '{/* ref file="src/greet.ts" lines="6-6" */}',
  '{/* ref file="src/greet.ts" */}',
  '{/* tree dir="src" depth="1" */}',
  '{/* has file="src/greet.ts" text="greet" */}',
  '{/* ref file="src/greet.ts" lines="1-1" */}',
  "@@docfirst ref src/greet.ts:4-4 @@",
]);

const LEDGER = {
  "docs/m.mdx": {
    "src/greet.ts:2-3": { kind: "git", blob: BLOB, commit: "c".repeat(40), lines: [2, 3], hash: oldHash(LINES.slice(1, 3)) },
    "src/greet.ts:6-6": { kind: "hash", lines: [6, 6], hash: oldHash(LINES.slice(5, 6)) },
    "src/greet.ts:all": { kind: "git", blob: BLOB, commit: "c".repeat(40), lines: [1, 6], hash: oldHash(LINES) },
    "tree src depth=1": { kind: "tree", names: ["greet.ts"] },
    'has src/greet.ts "greet"': { kind: "has" },
    "src/greet.ts:9-9": { kind: "hash", lines: [9, 9], hash: "0".repeat(64) },
    "src/greet.ts:4-4": { kind: "hash", lines: [4, 4], hash: oldHash(LINES.slice(3, 4)) },
  },
  "docs/gone.mdx": { "src/greet.ts:1-1": { kind: "hash", lines: [1, 1], hash: "0".repeat(64) } },
};

test("migrate-ledger：记录逐处写进记号，孤儿丢掉，记录簿删掉，列出配置里要改的键；迁完照样新鲜", async () => {
  const p = setupProject(OLD_CONFIG);
  try {
    writeFileSync(join(p.root, "docs", "m.mdx"), DOC);
    writeFileSync(join(p.root, ".ledger.json"), JSON.stringify(LEDGER, null, 2));

    const done = await p.cli("migrate-ledger");
    assert.equal(done.code, 0, done.out);
    assert.match(done.out, /✅ docs\/m\.mdx {2}4 处记号写上了记录/);
    assert.match(done.out, /丢掉 3 条记录/, "文档已经不在的一条、没有记号对应的一条、草稿记号那一条");
    assert.match(done.out, /🧹 已删掉 \.ledger\.json/);
    assert.match(done.out, /删掉 formats：/);
    assert.match(done.out, /删掉 docs：/);
    assert.match(done.out, /删掉 comparator：/);
    assert.match(done.out, /删掉 ledger：/);
    assert.equal(existsSync(join(p.root, ".ledger.json")), false);

    const blob = BLOB.slice(0, 12);
    assert.equal(
      p.read("docs/m.mdx"),
      docOf([
        `{/* ref file="src/greet.ts" lines="2-3" hash="${hashSpan(LINES.slice(1, 3))}" blob="${blob}" */}`,
        `{/* ref file="src/greet.ts" lines="6-6" hash="${hashSpan(LINES.slice(5, 6))}" */}`,
        `{/* ref file="src/greet.ts" hash="${hashSpan(LINES)}" blob="${blob}" */}`,
        `{/* tree dir="src" depth="1" hash="${hashNames(["greet.ts"])}" */}`,
        '{/* has file="src/greet.ts" text="greet" */}',
        '{/* ref file="src/greet.ts" lines="1-1" */}',
        "@@docfirst ref src/greet.ts:4-4 @@",
      ]),
    );

    const pinning = createPinning(createPinner({ reader: createReader(p.root), history: createGitHistory(p.root) }));
    assert.deepEqual(
      pinning.checkDoc("docs/m.mdx", p.read("docs/m.mdx")).items.map((i) => i.status),
      ["fresh", "fresh", "fresh", "fresh", "fresh", "unconfirmed", "unconfirmed"],
      "迁过来的记录跟今天的内容对得上；没记录的与草稿照旧未确认",
    );
  } finally {
    p.teardown();
  }
});

test("migrate-ledger：记录的 kind 跟记号对不上、没有记录簿、存在性记录、文档不是 .mdx，都报错说清楚", async () => {
  const p = setupProject(OLD_CONFIG);
  try {
    await assert.rejects(p.cli("migrate-ledger"), /没有记录簿 \.ledger\.json——没有要迁的/);
    writeFileSync(join(p.root, "docs", "m.mdx"), docOf(['{/* ref file="src/greet.ts" lines="2-3" */}']));
    writeFileSync(join(p.root, ".ledger.json"), JSON.stringify({ "docs/m.mdx": { "src/greet.ts:2-3": { kind: "tree", names: [] } } }));
    await assert.rejects(p.cli("migrate-ledger"), /docs\/m\.mdx 第 3 行 src\/greet\.ts:2-3：记录的 kind tree 对不上这种记号（span）/);
    assert.equal(existsSync(join(p.root, ".ledger.json")), true, "出错就不删记录簿");
    writeFileSync(join(p.root, ".ledger.json"), JSON.stringify({ "docs/m.mdx": { "exists src/greet.ts": { kind: "exists", type: "file" } } }));
    await assert.rejects(p.cli("migrate-ledger"), /docs\/m\.mdx 的 exists src\/greet\.ts 是存在性记录，存在性目标（exists \/ absent）已经删掉/);
    assert.equal(existsSync(join(p.root, ".ledger.json")), true, "存在性记录迁不了，记录簿留着");
    writeFileSync(join(p.root, "docs", "old.md"), "# old\n");
    writeFileSync(join(p.root, ".ledger.json"), JSON.stringify({ "docs/old.md": { "src/greet.ts:2-3": { kind: "hash", lines: [2, 3], hash: "0".repeat(64) } } }));
    await assert.rejects(p.cli("migrate-ledger"), /记录簿里有不是 \.mdx 的文档：docs\/old\.md——docfirst 只认 mdx/);
    assert.equal(existsSync(join(p.root, ".ledger.json")), true, "有不是 mdx 的文档就一处都不迁");
  } finally {
    p.teardown();
  }
});
