/**
 * `livedoc attach` 的**命令层**：认参数、退出码、打出来的那几段话。
 * 端到端走 `main(["attach", …])`，跟别的子命令一样从命令行这头进。
 *
 * 装出来的六区长什么样不在这儿——那是装配模块自己的账，跨 `planAttach` / `attachSite` 测，
 * 见 site.test.ts。这边只问：参数认没认对、话说清楚了没有、退了几。
 *
 * 外加一条**跨两份真相的账**：装配往目标站补的那张依赖表跟工作区各包的版本对得上。
 * 那张表是手写的（工作区里写的是 `workspace:*`，摆进别人的站里装不动），发版抬版本号时
 * 忘了抬它，装出来的站会装到一个旧版——这条测试就是那个门。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { LIVEDOC_DEPS, main } from "@godcreator02/livedoc";

const PACKAGES = join(dirname(fileURLToPath(import.meta.url)), "..", "packages");

/** 包名 → 它在 packages/ 下的目录名。轨迹那个包的目录一直叫 trajectory，包名前面多一截 scope 与产品名 */
const DIR_OF: Record<string, string> = {
  "@godcreator02/livedoc": "livedoc",
  "@godcreator02/livedoc-trajectory": "trajectory",
};

/** 造一个「刚被站件铺好」的骨架，回站目录与仓目录 */
function skeleton(repoFiles: Record<string, string> = {}): { root: string; repo: string; site: string } {
  const root = mkdtempSync(join(tmpdir(), "god-live-doc-attach-cli-"));
  const repo = join(root, "我的仓");
  const site = join(repo, "docs-site");
  mkdirSync(join(site, "content", "docs"), { recursive: true });
  writeFileSync(
    join(site, "package.json"),
    `${JSON.stringify(
      {
        name: "hello-docs-site",
        version: "0.1.0",
        private: true,
        type: "module",
        scripts: { dev: "next dev -p 4317", build: "next build", start: "next start -p 4317" },
        dependencies: { "fumadocs-core": "16.15.1", next: "16.3.0" },
      },
      null,
      2,
    )}\n`,
  );
  writeFileSync(join(site, "content", "docs", "index.mdx"), "---\ntitle: 骨架\n---\n");
  writeFileSync(join(site, "content", "docs", "meta.json"), '{ "pages": ["index", "..."] }\n');
  for (const [rel, text] of Object.entries(repoFiles)) {
    mkdirSync(dirname(join(repo, rel)), { recursive: true });
    writeFileSync(join(repo, rel), text, "utf8");
  }
  return { root, repo, site };
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

test("attach 端到端：在骨架上装六区，退 0，写了哪些文件与接着做什么逐条打出来", async () => {
  const { root, repo, site } = skeleton({
    "package.json": JSON.stringify({ name: "@s/hello" }),
    "src/index.ts": "// 头\nexport const name = 'hello';\n",
  });
  try {
    let code = -1;
    const { out } = await say(async () => void (code = await main(["attach", "--dir", site])));
    assert.equal(code, 0, out);
    assert.match(out, /站跑在骨架挑的那个口：4317/, "端口是骨架挑的，装配只是报出来");
    assert.match(out, /\+ livedoc\.config\.mjs/, "写了哪些文件逐条打出来");
    assert.match(out, /\+ package\.json/, "合并完的那份也算写了一遍");
    assert.doesNotMatch(out, /会\*\*覆盖\*\*/, "仓根没有 README / AGENTS，不警告");
    assert.match(out, /pnpm doc:render[\s\S]*pnpm doc\b/, "接着做里先 render 再 check");
    assert.match(out, /http:\/\/localhost:4317/);
    assert.ok(existsSync(join(site, "livedoc.config.mjs")), "线真接上了");
    assert.equal(readFileSync(join(repo, "src", "index.ts"), "utf8"), "// 头\nexport const name = 'hello';\n", "仓里的代码一个字不动");

    // 已经接过线了：模块抛的那句话原样打成一行 ✖，退 1
    let again = -1;
    const { err } = await say(async () => void (again = await main(["attach", "--dir", site])));
    assert.equal(again, 1);
    assert.match(err, /✖ 这个站已有内容，请人工接线/);
  } finally {
    rmSync(root, { recursive: true, force: true, maxRetries: 5 });
  }
});

test("attach：--dir 没给打用法退 1；站不在 / 不是骨架也退 1；--help 退 0", async () => {
  const { err } = await say(async () => {
    assert.equal(await main(["attach"]), 1);
    assert.equal(await main(["attach", "--dir", join(tmpdir(), "根本没有这个站-livedoc-attach")]), 1);
    assert.equal(await main(["attach", "--dir", tmpdir()]), 1);
  });
  assert.match(err, /用法：livedoc attach --dir/);
  assert.match(err, /✖ 站不在/);
  assert.match(err, /✖ 不是 fumadocs 骨架/);

  const { out } = await say(async () => {
    assert.equal(await main(["attach", "--help"]), 0);
  });
  assert.match(out, /--title  站的显示名/);
});

test("attach：--title 一路带到站页里；仓根已有 README.md 只警告不动它", async () => {
  const { root, repo, site } = skeleton({ "README.md": "# 老 README\n" });
  try {
    let code = -1;
    const { out } = await say(async () => void (code = await main(["attach", "--dir", site, "--title", "打个招呼"])));
    assert.equal(code, 0, out);
    assert.match(out, /⚠ 仓根已有 README\.md：.*会\*\*覆盖\*\*/);
    assert.doesNotMatch(out, /AGENTS\.md：/, "没有的不点名");
    assert.equal(readFileSync(join(repo, "README.md"), "utf8"), "# 老 README\n", "attach 一个字不动它");
    const merged = JSON.parse(readFileSync(join(site, "package.json"), "utf8")) as { description: string };
    assert.match(merged.description, /^打个招呼 的六区文档站/, "--title 一路带到站的包描述里");
  } finally {
    rmSync(root, { recursive: true, force: true, maxRetries: 5 });
  }
});

test("装配那张依赖表跟工作区各包的版本对得上——发版抬了版本号忘了抬它，这条红", () => {
  for (const [name, range] of Object.entries(LIVEDOC_DEPS)) {
    const dir = DIR_OF[name];
    assert.ok(dir !== undefined, `装配表里的 ${name} 在 packages/ 下没有对应目录——新加一条依赖时把 DIR_OF 也补上`);
    const pkg = JSON.parse(readFileSync(join(PACKAGES, dir, "package.json"), "utf8")) as { name: string; version: string };
    assert.equal(pkg.name, name, `${dir} 的包名对不上装配表里的 ${name}`);
    assert.equal(range, `^${pkg.version}`, `装配表里 ${name} 写的是 ${range}，工作区里是 ${pkg.version}——发版时这张表得跟着抬`);
  }
});
