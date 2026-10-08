/**
 * 扫卡目录那一处碰盘的逻辑：`.mdx` 与 `.md` 都是卡、身份是去掉后缀的文件名主干、同一主干两种
 * 后缀都在只认 `.mdx`。临时目录里造几张真文件跑 scanCardDir；挑文件那半（pickCardFiles）纯函数直接喂。
 */
import { test } from "vitest";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pickCardFiles, scanCardDir, scanCards } from "@godcreator/docfirst-workflow/cards";

const CARD = (label: string): string => ["---", "born-at: 2026-01-02T08:00", `label: ${label}`, "parent: [pj01]", "---", "", "正文。", ""].join("\n");

test("pickCardFiles：.md / .mdx 都要，别的后缀不要；同一主干两者都在只留 .mdx；排过序", () => {
  assert.deepEqual(pickCardFiles(["b.md", "a.mdx", "c.txt", "meta.json", "b.mdx", "d.md"]), ["a.mdx", "b.mdx", "d.md"]);
  assert.deepEqual(pickCardFiles([]), []);
});

test("scanCardDir：.mdx 卡进盘，身份不带后缀；.md 卡照旧；同主干两份只出 .mdx 那张、并在它上面报病", async () => {
  const dir = mkdtempSync(join(tmpdir(), "god-live-doc-scan-"));
  try {
    writeFileSync(join(dir, "pj01.mdx"), ["---", "type: root", "born-at: 2026-01-01", "label: 项目", "---", ""].join("\n"));
    writeFileSync(join(dir, "2026-01-02-甲.mdx"), CARD("甲"));
    writeFileSync(join(dir, "2026-01-03-乙.md"), CARD("乙"));
    writeFileSync(join(dir, "2026-01-04-丙.md"), CARD("丙 md"));
    writeFileSync(join(dir, "2026-01-04-丙.mdx"), CARD("丙 mdx"));
    writeFileSync(join(dir, "index.mdx"), "---\ntitle: 轨迹\n---\n\n导读页，不是卡。\n");
    const { center, cards, sick } = await scanCardDir(dir);
    assert.deepEqual(
      cards.map((c) => [c.id, c.label]),
      [
        ["2026-01-02-甲", "甲"],
        ["2026-01-03-乙", "乙"],
        ["2026-01-04-丙", "丙 mdx"],
      ],
    );
    assert.equal(center?.id, "pj01");
    assert.deepEqual(sick, [{ path: "2026-01-04-丙.mdx", problems: [{ field: "file", value: "2026-01-04-丙.md", reason: "同一身份还有一个 2026-01-04-丙.md：只认 .mdx，删掉或改名那一份" }] }], "导读页卡体系字段一个不沾，不是卡、不报病；丙两个文件报在 .mdx 上");
  } finally {
    rmSync(dir, { recursive: true, force: true, maxRetries: 5 });
  }
});

test("scanCards：纯函数吃已经读好的文件，挑卡、解析、按身份排序，跟读盘那条同一口径", () => {
  const { center, cards, sick } = scanCards([
    { name: "2026-01-04-丙.md", text: CARD("丙 md") },
    { name: "2026-01-04-丙.mdx", text: CARD("丙 mdx") },
    { name: "2026-01-02-甲.mdx", text: CARD("甲") },
    { name: "notes.txt", text: CARD("不是卡") },
    { name: "pj01.md", text: ["---", "type: root", "born-at: 2026-01-01", "label: 项目", "---", ""].join("\n") },
  ]);
  assert.deepEqual(cards.map((c) => [c.id, c.label]), [
    ["2026-01-02-甲", "甲"],
    ["2026-01-04-丙", "丙 mdx"],
  ]);
  assert.deepEqual(center, { id: "pj01", label: "项目", bornAt: "2026-01-01", kind: "root", milestones: [] });
  assert.deepEqual(sick, [{ path: "2026-01-04-丙.mdx", problems: [{ field: "file", value: "2026-01-04-丙.md", reason: "同一身份还有一个 2026-01-04-丙.md：只认 .mdx，删掉或改名那一份" }] }]);
});

test("scanCardDir：只有目录不存在算空盘，别的读取失败原样抛出", async () => {
  const dir = mkdtempSync(join(tmpdir(), "god-live-doc-scan-"));
  try {
    const file = join(dir, "不是目录.md");
    writeFileSync(file, CARD("甲"));
    await assert.rejects(scanCardDir(file), (err: NodeJS.ErrnoException) => err.code === "ENOTDIR");
  } finally {
    rmSync(dir, { recursive: true, force: true, maxRetries: 5 });
  }
});