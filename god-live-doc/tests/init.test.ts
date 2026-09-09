/**
 * `livedoc init` 的纯逻辑与落盘各测各的：
 *   纯的那半（挑端口、渲染、pinBlock、认名字）直接喂输入看输出，不碰盘；
 *   扫端口与铺站碰盘，在临时目录里造一小片「邻居」和一个假仓跑真的。
 * 端到端那一档走 `main(["init", …])`，跟别的子命令一样从命令行这头进。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { main } from "@godcreator02/live-doc-cli";
import {
  SITE_TEMPLATE,
  namesFor,
  pickPort,
  pinBlockFrom,
  readTemplate,
  renderSite,
  renderText,
  scanUsedPorts,
} from "@godcreator02/live-doc-cli/init";

const VALUES = { name: "x", title: "标题", pkg: "@s/x", pkgName: "x", port: "4310", pinBlock: "钉" };

/** 造一小片邻居：`<tmp>/<仓名>/package.json`，scripts 按给的写 */
function neighborhood(repos: Record<string, Record<string, string>>): string {
  const root = mkdtempSync(join(tmpdir(), "god-live-doc-init-"));
  for (const [name, scripts] of Object.entries(repos)) {
    mkdirSync(join(root, name), { recursive: true });
    writeFileSync(join(root, name, "package.json"), JSON.stringify({ name, scripts }));
  }
  return root;
}

test("pickPort：没给就从 4310 起找第一个空位；手给的一律让给你，被占也让", () => {
  assert.equal(pickPort([]), 4310);
  assert.equal(pickPort([4310, 4311, 4313]), 4312);
  assert.equal(pickPort(new Map([[4310, "谁"]])), 4311);
  assert.equal(pickPort([4310], 4310), 4310, "手给的被占也让给你——上层只警告");
  assert.equal(pickPort([], 9999), 9999);
});

test("scanUsedPorts：按脚本内容认端口，不按目录名；node_modules 与点开头目录不进", () => {
  const root = neighborhood({
    甲: { dev: "next dev -p 4311" },
    乙: { start: "next start -p 4315", build: "next build" },
    丙: { dev: "vite --port 4312" },
    丁: {},
  });
  try {
    // 站不一定叫 docs-site：这几个仓根本没有 docs-site 目录，认的是 scripts 那一行
    mkdirSync(join(root, "node_modules", "假", "x"), { recursive: true });
    writeFileSync(join(root, "node_modules", "假", "package.json"), JSON.stringify({ scripts: { dev: "next dev -p 4399" } }));
    mkdirSync(join(root, ".藏", "x"), { recursive: true });
    writeFileSync(join(root, ".藏", "package.json"), JSON.stringify({ scripts: { dev: "next dev -p 4398" } }));
    writeFileSync(join(root, "甲", "坏.json"), "{ 不是 json");

    const used = scanUsedPorts(root);
    assert.deepEqual([...used.keys()].sort((a, b) => a - b), [4311, 4315]);
    assert.match(used.get(4311)!, /甲$/);
    assert.equal(pickPort(used), 4310, "4310 还空着");
  } finally {
    rmSync(root, { recursive: true, force: true, maxRetries: 5 });
  }
});

test("scanUsedPorts：邻居不在就是空集合，不抛", () => {
  assert.equal(scanUsedPorts(join(tmpdir(), "根本没有这个目录-livedoc-init")).size, 0);
});

test("renderText：认不出的占位符当场抛——留一个 {{typo}} 在站里没人知道它本来该是什么", () => {
  assert.equal(renderText("跑在 {{port}}，叫 {{title}}", VALUES, "a.tpl"), "跑在 4310，叫 标题");
  assert.throws(() => renderText("{{typo}}", VALUES, "a.tpl"), /认不出的占位符 \{\{typo\}\}（a\.tpl）/);
});

test("renderSite：整套在内存里渲完，.tpl 后缀脱掉", () => {
  const out = renderSite([{ rel: "a/b.json.tpl", text: "{{name}}" }, { rel: "c.txt", text: "无占位符" }], VALUES);
  assert.deepEqual(out, [{ rel: "a/b.json", text: "x" }, { rel: "c.txt", text: "无占位符" }]);
});

test("pinBlockFrom：找得到 export const name 就钉那一行，行号现找；找不到就写「怎么钉」", () => {
  const source = ["// 头", "", "export const name = 'x';", ""].join("\n");
  const pinned = pinBlockFrom(source);
  assert.match(pinned, /@@livedoc ref \.\.\/src\/index\.ts:3-3 @@/, "行号是数出来的，不写死");

  for (const none of [null, "export function name() {}\n"]) {
    const block = pinBlockFrom(none);
    assert.match(block, /还没钉第一条引用/);
    // 样例记号在围栏里：围栏内容是 code 节点，check 认不出它——硬塞一条钉不住的引用
    // 等于让刚铺好的站开局就报红
    assert.match(block, /```text\n@@livedoc ref/);
  }
});

test("namesFor：包名认得出就用包名的尾巴，认不出退目录名；--title 优先", () => {
  assert.deepEqual(namesFor("D:/a/我的仓", { name: "@scope/hello" }), {
    name: "hello",
    title: "hello",
    pkg: "@scope/hello",
    pkgName: "hello",
  });
  assert.deepEqual(namesFor("D:/a/我的仓", null), { name: "docs", title: "我的仓", pkg: "我的仓", pkgName: "我的仓" });
  assert.equal(namesFor("D:/a/hello", { name: "hello" }, "打个招呼").title, "打个招呼");
});

test("模板：包里带的那份两态都找得到，占位符只有约定的那六个", () => {
  const template = readTemplate();
  assert.ok(existsSync(SITE_TEMPLATE), `模板目录没找到：${SITE_TEMPLATE}`);
  assert.ok(template.length > 0, "模板一个文件都没读到");
  const keys = new Set<string>();
  for (const file of template) for (const m of file.text.matchAll(/\{\{(\w+)\}\}/g)) keys.add(m[1]!);
  for (const key of keys) assert.ok(key in VALUES, `模板里有认不出的占位符 {{${key}}}`);
  // 整套渲得过就说明没有漏网的占位符
  assert.doesNotThrow(() => renderSite(template, VALUES));
});

test("init 端到端：铺一个站，端口按邻居挑，起手页钉住 export const name 那一行", async () => {
  const root = neighborhood({ 邻居: { dev: "next dev -p 4310" } });
  const repo = join(root, "我的仓");
  const said: string[] = [];
  const log = console.log;
  console.log = (...args: unknown[]) => void said.push(args.join(" "));
  try {
    mkdirSync(join(repo, "src"), { recursive: true });
    writeFileSync(join(repo, "package.json"), JSON.stringify({ name: "@s/hello" }));
    writeFileSync(join(repo, "src", "index.ts"), "// 头\nexport const name = 'hello';\n");

    assert.equal(await main(["init", "--dir", repo]), 0, said.join("\n"));
    const site = join(repo, "docs-site");
    const pkg = JSON.parse(readFileSync(join(site, "package.json"), "utf8")) as { name: string; scripts: Record<string, string> };
    assert.equal(pkg.name, "hello-docs-site");
    assert.equal(pkg.scripts.dev, "next dev -p 4311", "4310 被邻居占了，挑下一个");
    assert.match(readFileSync(join(site, "content", "docs", "index.mdx"), "utf8"), /@@livedoc ref \.\.\/src\/index\.ts:2-2 @@/);
    assert.equal(existsSync(join(site, "package.json.tpl")), false, ".tpl 后缀落盘时脱掉");
    assert.match(said.join("\n"), /docs-site\/livedoc\.config\.mjs/, "铺了哪些文件逐条打出来");
    assert.match(said.join("\n"), /docs-site\/\.next\//, "gitignore 缺的几条只打印，不替人改");
    assert.equal(existsSync(join(repo, ".gitignore")), false, "不改仓里任何已有文件，更不新建");
    assert.doesNotMatch(said.join("\n"), /会\*\*覆盖\*\*/, "仓根没有 README / AGENTS，不警告");
    assert.equal(existsSync(join(repo, "README.md")), false, "init 不摆生成物，那是 render 的事");

    // 六区：六个目录各有骨架页与 meta.json，六个集合、六条路由、六条 loader、侧栏六个根节
    const zones = ["docs", "trajectory", "spec", "future", "outputs", "feedback"];
    for (const zone of zones) {
      assert.ok(existsSync(join(site, "content", zone, "meta.json")), `content/${zone}/meta.json`);
      assert.ok(existsSync(join(site, "src", "app", zone, "[[...slug]]", "page.tsx")), `src/app/${zone}/[[...slug]]/page.tsx`);
    }
    const pages = [
      "docs/index.mdx", "docs/system-map.mdx", "docs/glossary.mdx", "trajectory/index.mdx", "spec/index.mdx",
      "future/overview.mdx", "outputs/agents.mdx", "outputs/readme.mdx", "feedback/hatch.mdx", "feedback/inbound.mdx",
    ];
    for (const page of pages) {
      const text = readFileSync(join(site, "content", page), "utf8");
      assert.match(text, /\*\*本页回答\*\*：/, `${page} 头一句要是「本页回答」`);
    }
    const sourceConfig = readFileSync(join(site, "source.config.ts"), "utf8");
    for (const zone of zones) assert.match(sourceConfig, new RegExp(`export const ${zone} = defineDocs\\(\\{\\s*dir: 'content/${zone}'`), `集合 ${zone}`);
    assert.equal((sourceConfig.match(/includeProcessedMarkdown/g) ?? []).length, 2, "只有 docs 与 outputs 开 processed markdown");
    assert.match(sourceConfig, /schema: cardSchema/, "卡集合用 cardSchema");
    const loaders = readFileSync(join(site, "src", "lib", "source.ts"), "utf8");
    for (const base of ["/docs", "/trajectory", "/spec", "/future", "/outputs", "/feedback"]) assert.match(loaders, new RegExp(`baseUrl: '${base}'`));
    const layout = readFileSync(join(site, "src", "app", "layout.tsx"), "utf8");
    assert.equal((layout.match(/zone\('/g) ?? []).length, 6, "侧栏一棵树六个根节");
    assert.match(layout, /root: true/);
    assert.equal(existsSync(join(site, "src", "app", "docs", "layout.tsx")), false, "DocsLayout 抬到根 layout，docs 下不再单独一层");
    const config = readFileSync(join(site, "livedoc.config.mjs"), "utf8");
    assert.match(config, /docs: \['content\/docs', 'content\/outputs'\]/, "check 扫 docs + outputs 两区");
    assert.match(config, /trajectory: 'content\/trajectory'/);
    assert.match(config, /'content\/outputs\/agents\.mdx': \['\.\.\/AGENTS\.md'\]/);
    assert.match(config, /'content\/outputs\/readme\.mdx': \['\.\.\/README\.md'\]/);
    assert.match(readFileSync(join(site, "content", "feedback", "inbound.mdx"), "utf8"), /\{\/\*[\s\S]*## <yyyy-MM-dd> <标题>[\s\S]*\*\/\}/, "inbound 页头注释写明追加格式");
    assert.match(readFileSync(join(site, "content", "spec", "index.mdx"), "utf8"), /有页 = 有活在路上，做完删/);
    assert.match(said.join("\n"), /pnpm doc:render/, "接着做里先 render 再 check");

    // 已经有站了就拒，一个字不覆盖
    const err = console.error;
    const cried: string[] = [];
    console.error = (...args: unknown[]) => void cried.push(args.join(" "));
    assert.equal(await main(["init", "--dir", repo]), 1);
    console.error = err;
    assert.match(cried.join("\n"), /这个仓已经有站了，不覆盖/);
  } finally {
    console.log = log;
    rmSync(root, { recursive: true, force: true, maxRetries: 5 });
  }
});

test("init：仓不在就拒；--dir 没给打用法退 1；--port 不合法退 1", async () => {
  const err = console.error;
  console.error = () => {};
  try {
    assert.equal(await main(["init", "--dir", join(tmpdir(), "根本没有这个仓-livedoc-init")]), 1);
    assert.equal(await main(["init"]), 1);
    assert.equal(await main(["init", "--dir", tmpdir(), "--port", "口"]), 1);
  } finally {
    console.error = err;
  }
});

test("init：仓根已有 README.md / AGENTS.md 只警告不动它——第一次 render 会覆盖，内容得先搬进正本", async () => {
  const root = neighborhood({});
  const repo = join(root, "仓");
  const said: string[] = [];
  const log = console.log;
  console.log = (...args: unknown[]) => void said.push(args.join(" "));
  try {
    mkdirSync(repo, { recursive: true });
    writeFileSync(join(repo, "README.md"), "# 老 README\n");
    assert.equal(await main(["init", "--dir", repo]), 0, said.join("\n"));
    assert.match(said.join("\n"), /⚠ 仓根已有 README\.md：.*会\*\*覆盖\*\*/);
    assert.doesNotMatch(said.join("\n"), /AGENTS\.md：/, "没有的不点名");
    assert.equal(readFileSync(join(repo, "README.md"), "utf8"), "# 老 README\n", "init 一个字不动它");
  } finally {
    console.log = log;
    rmSync(root, { recursive: true, force: true, maxRetries: 5 });
  }
});

test("init：--port 手给的让给你，哪怕被邻居占着", async () => {
  const root = neighborhood({ 邻居: { dev: "next dev -p 4310" } });
  const repo = join(root, "仓");
  const said: string[] = [];
  const log = console.log;
  console.log = (...args: unknown[]) => void said.push(args.join(" "));
  try {
    mkdirSync(repo, { recursive: true });
    assert.equal(await main(["init", "--dir", repo, "--port", "4310", "--title", "手给的"]), 0, said.join("\n"));
    const pkg = JSON.parse(readFileSync(join(repo, "docs-site", "package.json"), "utf8")) as { scripts: Record<string, string> };
    assert.equal(pkg.scripts.start, "next start -p 4310");
    assert.match(said.join("\n"), /⚠ 4310 已经被/);
    assert.match(readFileSync(join(repo, "docs-site", "content", "docs", "index.mdx"), "utf8"), /还没钉第一条引用/);
  } finally {
    console.log = log;
    rmSync(root, { recursive: true, force: true, maxRetries: 5 });
  }
});
