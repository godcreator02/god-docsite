/**
 * 命令行三个动作，在临时真 git 项目里跑一遍：check 报状态、confirm 写回并刷记录簿、render 出产物。
 * 项目的 livedoc.config.mjs 按绝对 file: 地址引格式包的构建产物——临时目录里解析不到包名。
 * 直接调 main，不起子进程：退出码和打印都当场看得见。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { main } from "@god-live-doc/cli";
import { CODE, run } from "./repo.ts";

const PACKAGES = join(dirname(fileURLToPath(import.meta.url)), "..", "packages");
const distUrl = (name: string) => pathToFileURL(join(PACKAGES, name, "dist", "index.mjs")).href;

const CONFIG = `import * as md from ${JSON.stringify(distUrl("format-md"))};
import * as html from ${JSON.stringify(distUrl("format-html"))};

export default { formats: [md, html], docs: "docs", out: "out" };
`;

const DOC_MD = "# md\n\n@@livedoc ref src/greet.ts:2-3 @@\n\n尾巴\n";
const DOC_HTML = '<h1>html</h1>\n<figure>\n  @@livedoc ref src/greet.ts:2-3 @@\n</figure>\n';

/** 起一个能被 loadProject 装配的临时项目，跑几条命令，收集打印 */
function setupProject() {
  const root = mkdtempSync(join(tmpdir(), "god-live-doc-cli-"));
  run(root, ["init", "-q", "-b", "main"]);
  run(root, ["config", "user.email", "test@example.com"]);
  run(root, ["config", "user.name", "test"]);
  run(root, ["config", "core.autocrlf", "false"]);
  mkdirSync(join(root, "src"));
  mkdirSync(join(root, "docs"));
  writeFileSync(join(root, "src", "greet.ts"), CODE);
  writeFileSync(join(root, "docs", "a.md"), DOC_MD);
  writeFileSync(join(root, "docs", "b.html"), DOC_HTML);
  writeFileSync(join(root, "livedoc.config.mjs"), CONFIG);
  run(root, ["add", "-A"]);
  run(root, ["commit", "-q", "-m", "起项目"]);

  const before = process.cwd();
  process.chdir(root);
  const said: string[] = [];
  const log = console.log;
  console.log = (...args: unknown[]) => void said.push(args.join(" "));

  return {
    root,
    said,
    read: (rel: string) => readFileSync(join(root, rel), "utf8"),
    async cli(...args: string[]) {
      said.length = 0;
      const code = await main(args);
      return { code, out: said.join("\n") };
    },
    teardown() {
      console.log = log;
      process.chdir(before);
      rmSync(root, { recursive: true, force: true, maxRetries: 5 });
    },
  };
}

test("check 报未确认；confirm 换记号、投影、刷记录簿；再 check 全绿", async () => {
  const p = setupProject();
  try {
    const first = await p.cli("check");
    assert.equal(first.code, 0, "未确认不算红");
    assert.match(first.out, /⚪ docs\/a\.md {2}src\/greet\.ts:2-3 {2}未确认/);
    assert.match(first.out, /⚪ docs\/b\.html/);

    const done = await p.cli("confirm");
    assert.equal(done.code, 0);
    assert.match(done.out, /✅ docs\/a\.md {2}src\/greet\.ts:2-3 {2}已确认，草稿记号已换成正式记号/);
    assert.match(p.read("docs/a.md"), /<!-- ref file="src\/greet\.ts" lines="2-3" -->\n```ts/);
    assert.match(p.read("docs/b.html"), /<pre data-file="src\/greet\.ts" data-lines="2-3"><code/);
    const ledger = JSON.parse(p.read(".ledger.json")) as Record<string, Record<string, { kind: string }>>;
    assert.equal(ledger["docs/a.md"]!["src/greet.ts:2-3"]!.kind, "git");

    const again = await p.cli("check");
    assert.equal(again.code, 0);
    assert.match(again.out, /🟢 docs\/a\.md/);
    assert.match(again.out, /🟢 docs\/b\.html/);
  } finally {
    p.teardown();
  }
});

test("代码改了：check 报黄、退 0；文件没了：报红、退 1", async () => {
  const p = setupProject();
  try {
    await p.cli("confirm");
    writeFileSync(join(p.root, "src", "greet.ts"), CODE.replace("hello", "hey"));
    run(p.root, ["commit", "-qam", "改问候语"]);
    const yellow = await p.cli("check");
    assert.equal(yellow.code, 0, "有变动等作者复核，不是红");
    assert.match(yellow.out, /🟡 docs\/a\.md {2}src\/greet\.ts:2-3 {2}有变动/);

    rmSync(join(p.root, "src", "greet.ts"));
    const red = await p.cli("check");
    assert.equal(red.code, 1);
    assert.match(red.out, /🔴 docs\/a\.md {2}src\/greet\.ts:2-3 {2}缺失.*文件不在了/);
  } finally {
    p.teardown();
  }
});

test("confirm 遇 problems：打印、退非零、一个字不改", async () => {
  const p = setupProject();
  try {
    writeFileSync(join(p.root, "src", "greet.ts"), CODE.replace("hello", "hey"));
    const before = p.read("docs/a.md");
    const rejected = await p.cli("confirm");
    assert.equal(rejected.code, 1);
    assert.match(rejected.out, /🔴 docs\/a\.md 第 3 行：src\/greet\.ts:2-3 未提交/);
    assert.match(rejected.out, /这篇整篇没确认/);
    assert.equal(p.read("docs/a.md"), before, "拒了就不写回");
    assert.equal(existsSync(join(p.root, ".ledger.json")), false, "拒了就不落记录簿");
  } finally {
    p.teardown();
  }
});

test("render：md 出 ai 那份剥掉记号；html 说产物就是文档本身", async () => {
  const p = setupProject();
  try {
    await p.cli("confirm");
    const rendered = await p.cli("render", "--target", "ai");
    assert.equal(rendered.code, 0);
    assert.match(rendered.out, /→ {2}docs\/a\.md {2}渲染成 ai：out\/a\.md\.ai\.md/);
    assert.match(rendered.out, /· {2}docs\/b\.html {2}html 的产物就是文档本身/);
    const ai = p.read("out/a.md.ai.md");
    assert.doesNotMatch(ai, /<!-- ref |<!-- \/ref -->/);
    assert.match(ai, /```ts\nexport function greet/);
  } finally {
    p.teardown();
  }
});

test("不认识的命令退 2", async () => {
  const p = setupProject();
  try {
    assert.equal((await p.cli("嘿")).code, 2);
  } finally {
    p.teardown();
  }
});

test("孤儿：文档里删掉引用，check 报红；confirm 清掉", async () => {
  const p = setupProject();
  try {
    await p.cli("confirm");
    writeFileSync(join(p.root, "docs", "a.md"), "# md\n\n没有引用了\n");
    const red = await p.cli("check");
    assert.equal(red.code, 1);
    assert.match(red.out, /🔴 docs\/a\.md {2}src\/greet\.ts:2-3 {2}孤儿记录/);
    const swept = await p.cli("confirm");
    assert.match(swept.out, /🧹 docs\/a\.md {2}src\/greet\.ts:2-3 {2}孤儿记录已清/);
    assert.equal((await p.cli("check")).code, 0);
  } finally {
    p.teardown();
  }
});
