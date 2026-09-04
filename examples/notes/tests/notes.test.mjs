/**
 * 记事本手册的账：五类引用在这个项目里怎么表现。
 * 每条测试把项目拷进一个临时 git 仓（node_modules 用联接指回来），改一处代码、跑 check、对打印。
 * 文档站「五类引用：一篇手册里怎么用」那章「改了之后」几段的输出，抄的就是这里断言的这几行。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { main } from "@godcreator02/live-doc-cli";

const HERE = process.cwd();
const DOC = "docs/handbook.mdx";
const git = (cwd, args) => execFileSync("git", args, { cwd, encoding: "utf8", timeout: 30_000, stdio: ["pipe", "pipe", "pipe"] });

/** 项目拷进临时仓、提交一次；跑命令时 cwd 切过去、把打印收起来 */
function stage() {
  const root = mkdtempSync(join(tmpdir(), "notes-"));
  for (const name of ["src", "docs", "config.json", "livedoc.config.mjs", ".ledger.json", "package.json", ".gitignore"]) {
    cpSync(join(HERE, name), join(root, name), { recursive: true });
  }
  symlinkSync(join(HERE, "node_modules"), join(root, "node_modules"), "junction");
  git(root, ["init", "-q", "-b", "main"]);
  git(root, ["config", "user.email", "test@example.com"]);
  git(root, ["config", "user.name", "test"]);
  git(root, ["config", "core.autocrlf", "false"]);
  git(root, ["add", "-A"]);
  git(root, ["commit", "-q", "-m", "起项目"]);

  const before = process.cwd();
  process.chdir(root);
  const said = [];
  const log = console.log;
  console.log = (...args) => void said.push(args.join(" "));
  return {
    root,
    read: (rel) => readFileSync(join(root, rel), "utf8"),
    write: (rel, text) => writeFileSync(join(root, rel), text),
    commit: (message) => {
      git(root, ["add", "-A"]);
      git(root, ["commit", "-q", "-m", message]);
    },
    async check() {
      said.length = 0;
      const code = await main(["check"]);
      return { code, out: said.join("\n") };
    },
    teardown() {
      console.log = log;
      process.chdir(before);
      rmSync(root, { recursive: true, force: true, maxRetries: 5 });
    },
  };
}

test("手册全绿：五类引用各一行", async () => {
  const p = stage();
  try {
    const { code, out } = await p.check();
    assert.equal(code, 0, out);
    assert.match(out, /🟢 docs\/handbook\.mdx {2}tree src depth=1 {2}新鲜（4 项）/);
    assert.match(out, /🟢 docs\/handbook\.mdx {2}config\.json:all {2}新鲜/);
    assert.match(out, /🟢 docs\/handbook\.mdx {2}has src\/store\.ts "export function load" {2}新鲜/);
    assert.match(out, /🟢 docs\/handbook\.mdx {2}has src\/store\.ts "export function save" {2}新鲜/);
    assert.match(out, /🟢 docs\/handbook\.mdx {2}src\/store\.ts:16-19 {2}新鲜/);
    assert.match(out, /🟢 docs\/handbook\.mdx {2}absent src\/remove\.ts {2}新鲜/);
    assert.doesNotMatch(out, /🟡|🔴|⚪/);
  } finally {
    p.teardown();
  }
});

test("目录树：加了 src/tag.ts 没提交，清单就黄，说多了哪个", async () => {
  const p = stage();
  try {
    p.write("src/tag.ts", "export function tag(): void {}\n");
    const { code, out } = await p.check();
    assert.equal(code, 0, "黄不是错");
    assert.match(out, /🟡 docs\/handbook\.mdx {2}tree src depth=1 {2}有变动，等作者复核（\+ tag\.ts）/);
  } finally {
    p.teardown();
  }
});

test("整文件：config.json 末尾加一项，整文件黄；要是钉的是 2-3 两行，新加的第 4 行在段尾之后，还是绿的", async () => {
  const p = stage();
  try {
    p.write("config.json", '{\n  "file": "notes.json",\n  "dateFormat": "YYYY-MM-DD",\n  "backup": true\n}\n');
    p.commit("加 backup");
    const { out } = await p.check();
    assert.match(out, /🟡 docs\/handbook\.mdx {2}config\.json:all {2}有变动，等作者复核/);
  } finally {
    p.teardown();
  }
});

test("名字：save 改名成 write，芯片红退 1；行段那处只是黄——改名对 git 是改了一行", async () => {
  const p = stage();
  try {
    p.write("src/store.ts", p.read("src/store.ts").replace("export function save", "export function write"));
    p.write("src/add.ts", p.read("src/add.ts").replaceAll("save", "write"));
    p.commit("save 改名 write");
    const { code, out } = await p.check();
    assert.equal(code, 1);
    assert.match(out, /🔴 docs\/handbook\.mdx {2}has src\/store\.ts "export function save" {2}缺失，引用指向空气（文件里没有这个名字了）/);
    assert.match(out, /🟢 docs\/handbook\.mdx {2}has src\/store\.ts "export function load" {2}新鲜/);
    assert.match(out, /🟡 docs\/handbook\.mdx {2}src\/store\.ts:16-19 {2}有变动，等作者复核/);
  } finally {
    p.teardown();
  }
});

test("行段：save 改成追加写，名字没动——芯片还是绿，代码块黄", async () => {
  const p = stage();
  try {
    p.write(
      "src/store.ts",
      p.read("src/store.ts").replace("writeFileSync(config.file, json);", 'appendFileSync(config.file, json + "\\n");').replace("writeFileSync }", "appendFileSync }"),
    );
    p.commit("改成追加");
    const { code, out } = await p.check();
    assert.equal(code, 0);
    assert.match(out, /🟢 docs\/handbook\.mdx {2}has src\/store\.ts "export function save" {2}新鲜/);
    assert.match(out, /🟡 docs\/handbook\.mdx {2}src\/store\.ts:16-19 {2}有变动，等作者复核/);
  } finally {
    p.teardown();
  }
});

test("存在性：src/remove.ts 又出现了，断言不在的那处红退 1；目录树也跟着黄", async () => {
  const p = stage();
  try {
    p.write("src/remove.ts", "export function remove(): void {}\n");
    const { code, out } = await p.check();
    assert.equal(code, 1);
    assert.match(out, /🔴 docs\/handbook\.mdx {2}absent src\/remove\.ts {2}缺失，引用指向空气（断言它不在，它却出现了）/);
    assert.match(out, /🟡 docs\/handbook\.mdx {2}tree src depth=1 {2}有变动，等作者复核（\+ remove\.ts）/);
  } finally {
    p.teardown();
  }
});
