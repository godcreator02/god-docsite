/**
 * docfirst 的模板 template/：文档维护要的起始物，叠在站点根上（不进 app/features/）——配置、三份生成物的正本、
 * 现状区与未来区的起始页、第一张轨迹卡。路径与站点模板（content/index.mdx、content/meta.json）不重叠。
 * 叠到一个只有首页的站点根上：配置按新字段表校验通过，render 之后 check 全绿，trajectory 认出起始根卡。
 */
import { test } from "vitest";
import assert from "node:assert/strict";
import { cpSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { main } from "../src/cli.ts";
import { loadConfig } from "../src/config.ts";
import { run, SETTINGS } from "./repo.ts";

const PKG_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const TEMPLATE = join(PKG_ROOT, "template");

function filesUnder(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? filesUnder(join(dir, entry.name)) : [relative(TEMPLATE, join(dir, entry.name)).replaceAll("\\", "/")],
  );
}

test("模板文件齐全", () => {
  assert.deepEqual(filesUnder(TEMPLATE).sort(), [
    "content/docs/meta.json",
    "content/docs/outputs/agents.mdx",
    "content/docs/outputs/claude.mdx",
    "content/docs/outputs/readme.mdx",
    "content/future/meta.json",
    "content/future/overview.mdx",
    "docfirst.config.mjs",
    "trajectory/2026-01-01-site-born.md",
  ]);
});

test("配置是新格式：按字段表校验通过，名册带上 fumadocs 那几个与 Term，卡目录在站点根", async () => {
  const config = await loadConfig(TEMPLATE);
  assert.equal(config.contentDir, "content");
  assert.equal(config.trajectoryDir, "trajectory");
  assert.deepEqual(Object.keys(config.roster).sort(), ["File", "Files", "Folder", "Note", "Term"]);
  assert.deepEqual(Object.keys(config.outputs).sort(), ["content/docs/outputs/agents.mdx", "content/docs/outputs/claude.mdx", "content/docs/outputs/readme.mdx"]);
});

test("叠在站点根上就能用：render 生成仓根三份生成物，之后 check 全绿；trajectory 认出起始根卡", async () => {
  const repo = mkdtempSync(join(tmpdir(), "docfirst-template-"));
  const site = join(repo, "site");
  const said: string[] = [];
  const log = console.log;
  console.log = (...args: unknown[]) => void said.push(args.join(" "));
  try {
    mkdirSync(join(site, "content"), { recursive: true });
    writeFileSync(join(site, "content", "index.mdx"), "---\ntitle: 首页\n---\n\n站点模板的首页。\n");
    cpSync(TEMPLATE, site, { recursive: true });
    run(repo, ["init", "-q", "-b", "main"]);
    run(repo, [...SETTINGS, "add", "-A"]);
    run(repo, [...SETTINGS, "commit", "-q", "-m", "建站"]);

    assert.equal(await main(["render"], site), 0, said.join("\n"));
    said.length = 0;
    assert.equal(await main(["check"], site), 0, said.join("\n"));
    said.length = 0;
    assert.equal(await main(["trajectory"], site), 0, said.join("\n"));
    assert.match(said.join("\n"), /^盘 起始（2026-01-01-site-born） {2}0 张卡/, "根卡认作盘心，盘上还没有别的卡");
  } finally {
    console.log = log;
    rmSync(repo, { recursive: true, force: true, maxRetries: 5 });
  }
});

test("package.json 把 template 发出去：gwb-docfirst 建站后从装好的包里复制它", () => {
  const pkg = JSON.parse(readFileSync(join(PKG_ROOT, "package.json"), "utf8")) as { files: string[] };
  assert.ok(pkg.files.includes("template"));
});
