/**
 * `livedoc init` 的**命令层**：认参数、退出码、打出来的那几段话。
 * 端到端走 `main(["init", …])`，跟别的子命令一样从命令行这头进。
 *
 * 铺出来的站长什么样不在这儿——那是建站模块自己的账，跨 `planSite` / `createSite` 测，
 * 见 site.test.ts。这边只问：参数认没认对、话说清楚了没有、退了几。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { main } from "@godcreator02/live-doc-cli";

/** 造一小片邻居：`<tmp>/<仓名>/package.json`，scripts 按给的写 */
function neighborhood(repos: Record<string, Record<string, string>>): string {
  const root = mkdtempSync(join(tmpdir(), "god-live-doc-init-"));
  for (const [name, scripts] of Object.entries(repos)) {
    mkdirSync(join(root, name), { recursive: true });
    writeFileSync(join(root, name, "package.json"), JSON.stringify({ name, scripts }));
  }
  return root;
}

/** 接住 console.log / console.error，跑完还回去；回的是攒下来的两摊话 */
async function say(body: () => Promise<void>): Promise<{ out: string; err: string }> {
  const said: string[] = [];
  const cried: string[] = [];
  const log = console.log;
  const error = console.error;
  console.log = (...args: unknown[]) => void said.push(args.join(" "));
  console.error = (...args: unknown[]) => void cried.push(args.join(" "));
  try {
    await body();
  } finally {
    console.log = log;
    console.error = error;
  }
  return { out: said.join("\n"), err: cried.join("\n") };
}

test("init 端到端：铺一个站，退 0，铺了哪些文件与接着做什么逐条打出来", async () => {
  const root = neighborhood({ 邻居: { dev: "next dev -p 4310" } });
  const repo = join(root, "我的仓");
  try {
    mkdirSync(join(repo, "src"), { recursive: true });
    writeFileSync(join(repo, "package.json"), JSON.stringify({ name: "@s/hello" }));
    writeFileSync(join(repo, "src", "index.ts"), "// 头\nexport const name = 'hello';\n");

    let code = -1;
    const { out } = await say(async () => void (code = await main(["init", "--dir", repo])));
    assert.equal(code, 0, out);
    assert.match(out, /已占端口：4310/, "邻居占了哪些口说出来");
    assert.match(out, /这个站用：4311/);
    assert.match(out, /docs-site\/livedoc\.config\.mjs/, "铺了哪些文件逐条打出来");
    assert.match(out, /docs-site\/\.next\//, "gitignore 缺的几条只打印，不替人改");
    assert.equal(existsSync(join(repo, ".gitignore")), false, "不改仓里任何已有文件，更不新建");
    assert.doesNotMatch(out, /会\*\*覆盖\*\*/, "仓根没有 README / AGENTS，不警告");
    assert.match(out, /pnpm doc:render[\s\S]*pnpm doc\b/, "接着做里先 render 再 check");
    assert.match(out, /http:\/\/localhost:4311/);
    assert.ok(existsSync(join(repo, "docs-site", "livedoc.config.mjs")), "站真铺出来了");

    // 已经有站了：模块抛的那句话原样打成一行 ✖，退 1
    let again = -1;
    const { err } = await say(async () => void (again = await main(["init", "--dir", repo])));
    assert.equal(again, 1);
    assert.match(err, /✖ 这个仓已经有站了，不覆盖/);
  } finally {
    rmSync(root, { recursive: true, force: true, maxRetries: 5 });
  }
});

test("init：--dir 没给打用法退 1；--port 不是 1024–65535 的整数退 1；--help 退 0", async () => {
  const { err } = await say(async () => {
    assert.equal(await main(["init"]), 1);
    assert.equal(await main(["init", "--dir", join(tmpdir(), "根本没有这个仓-livedoc-init")]), 1);
    assert.equal(await main(["init", "--dir", tmpdir(), "--port", "口"]), 1);
    assert.equal(await main(["init", "--dir", tmpdir(), "--port", "80"]), 1);
  });
  assert.match(err, /用法：livedoc init --dir/);
  assert.match(err, /port 要是 1024–65535 的整数，实得 口/);
  assert.match(err, /✖ 仓不在/);

  const { out } = await say(async () => {
    assert.equal(await main(["init", "--help"]), 0);
  });
  assert.match(out, /--title  站的显示名/);
});

test("init：仓根已有 README.md 只警告不动它——第一次 render 会覆盖，内容得先搬进正本", async () => {
  const root = neighborhood({});
  const repo = join(root, "仓");
  try {
    mkdirSync(repo, { recursive: true });
    writeFileSync(join(repo, "README.md"), "# 老 README\n");
    let code = -1;
    const { out } = await say(async () => void (code = await main(["init", "--dir", repo])));
    assert.equal(code, 0, out);
    assert.match(out, /⚠ 仓根已有 README\.md：.*会\*\*覆盖\*\*/);
    assert.doesNotMatch(out, /AGENTS\.md：/, "没有的不点名");
    assert.equal(readFileSync(join(repo, "README.md"), "utf8"), "# 老 README\n", "init 一个字不动它");
  } finally {
    rmSync(root, { recursive: true, force: true, maxRetries: 5 });
  }
});

test("init：--port 手给的让给你，哪怕被邻居占着——警告一声，站按给的口写", async () => {
  const root = neighborhood({ 邻居: { dev: "next dev -p 4310" } });
  const repo = join(root, "仓");
  try {
    mkdirSync(repo, { recursive: true });
    let code = -1;
    const { out } = await say(async () => void (code = await main(["init", "--dir", repo, "--port", "4310", "--title", "手给的"])));
    assert.equal(code, 0, out);
    assert.match(out, /⚠ 4310 已经被/);
    const pkg = JSON.parse(readFileSync(join(repo, "docs-site", "package.json"), "utf8")) as {
      scripts: Record<string, string>;
      description: string;
    };
    assert.equal(pkg.scripts.start, "next start -p 4310");
    assert.match(pkg.description, /^手给的 /, "--title 一路带到站的包描述里");
  } finally {
    rmSync(root, { recursive: true, force: true, maxRetries: 5 });
  }
});
