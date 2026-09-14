/**
 * 扫卡目录那一处碰盘的逻辑：`.mdx` 与 `.md` 都是卡、身份是去掉后缀的文件名主干、同一主干两种
 * 后缀都在只认 `.mdx`。临时目录里造几张真文件跑 scanDir；挑文件那半（pickCardFiles）纯函数直接喂。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pickCardFiles, scanDir } from "@team/docfirst-trajectory";

const CARD = (label: string): string => ["---", "born-at: 2026-01-02T08:00", `label: ${label}`, "parent: [pj01]", "---", "", "正文。", ""].join("\n");

test("pickCardFiles：.md / .mdx 都要，别的后缀不要；同一主干两者都在只留 .mdx；排过序", () => {
  assert.deepEqual(pickCardFiles(["b.md", "a.mdx", "c.txt", "meta.json", "b.mdx", "d.md"]), ["a.mdx", "b.mdx", "d.md"]);
  assert.deepEqual(pickCardFiles([]), []);
});

test("scanDir：.mdx 卡进盘，身份不带后缀；.md 卡照旧；同主干两份只出 .mdx 那张", async () => {
  const dir = mkdtempSync(join(tmpdir(), "god-live-doc-scan-"));
  try {
    writeFileSync(join(dir, "pj01.mdx"), ["---", "type: root", "born-at: 2026-01-01", "label: 项目", "---", ""].join("\n"));
    writeFileSync(join(dir, "2026-01-02-甲.mdx"), CARD("甲"));
    writeFileSync(join(dir, "2026-01-03-乙.md"), CARD("乙"));
    writeFileSync(join(dir, "2026-01-04-丙.md"), CARD("丙 md"));
    writeFileSync(join(dir, "2026-01-04-丙.mdx"), CARD("丙 mdx"));
    writeFileSync(join(dir, "index.mdx"), "---\ntitle: 轨迹\n---\n\n导读页，不是卡。\n");
    const { cards, sick } = await scanDir(dir);
    assert.deepEqual(
      cards.map((c) => [c.id, c.path, c.label]),
      [
        ["2026-01-02-甲", "2026-01-02-甲.mdx", "甲"],
        ["2026-01-03-乙", "2026-01-03-乙.md", "乙"],
        ["2026-01-04-丙", "2026-01-04-丙.mdx", "丙 mdx"],
        ["pj01", "pj01.mdx", "项目"],
      ],
    );
    assert.deepEqual(sick, [], "导读页六个字段一个不沾，不是卡、不报病");
  } finally {
    rmSync(dir, { recursive: true, force: true, maxRetries: 5 });
  }
});
