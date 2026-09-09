/**
 * 建站模块（`@godcreator02/live-doc-cli/site`）的账，全部跨它面上那两个方法测：
 *   `planSite` 算一套不碰盘——端口怎么挑、名字怎么认、起手页那块钉什么、占位符错了抛不抛，
 *   全在它回的那份计划里看得见，一个内部函数都不用点名；
 *   `createSite` 才落盘——铺出来的六区长什么样、仓里已有的文件动没动，在临时目录里跑真的。
 * 命令行那一层（认参数、打印、退出码）不在这儿，在 init.test.ts。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { createSite, planSite, type SitePlan } from "@godcreator02/live-doc-cli/site";

/** 造一小片邻居：`<tmp>/<仓名>/package.json`，scripts 按给的写 */
function neighborhood(repos: Record<string, Record<string, string>>): string {
  const root = mkdtempSync(join(tmpdir(), "god-live-doc-site-"));
  for (const [name, scripts] of Object.entries(repos)) {
    mkdirSync(join(root, name), { recursive: true });
    writeFileSync(join(root, name, "package.json"), JSON.stringify({ name, scripts }));
  }
  return root;
}

/** 造一份自带的小模板，用来验渲染本身——不必拿整套六区站说事 */
function templateDir(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "god-live-doc-tpl-"));
  for (const [rel, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, rel)), { recursive: true });
    writeFileSync(join(root, rel), text, "utf8");
  }
  return root;
}

/** 计划里那一份文件的正文；不在就当场报出来（比在 undefined 上匹配好读） */
function fileIn(plan: SitePlan, rel: string): string {
  const found = plan.files.find((file) => file.rel === rel);
  assert.ok(found !== undefined, `计划里没有 ${rel}：${plan.files.map((f) => f.rel).join("、")}`);
  return found.text;
}

/** 在一小片邻居里造一个空仓，跑一趟给的活，跑完把整片删掉 */
function inRepo(repos: Record<string, Record<string, string>>, body: (repo: string, root: string) => void): void {
  const root = neighborhood(repos);
  const repo = join(root, "我的仓");
  try {
    mkdirSync(repo, { recursive: true });
    body(repo, root);
  } finally {
    rmSync(root, { recursive: true, force: true, maxRetries: 5 });
  }
}

test("planSite：一个字都不写盘，整套站在回的那份计划里", () => {
  inRepo({}, (repo) => {
    const plan = planSite({ repoDir: repo });
    assert.equal(plan.target, join(repo, "docs-site"));
    assert.equal(existsSync(plan.target), false, "算完盘上什么都没有");
    assert.ok(plan.files.length > 20, `包里带的那套模板一个文件都没读到：${plan.files.length}`);
    assert.match(fileIn(plan, "package.json"), /"description": "我的仓 的六区文档站/, "仓名一路带进了模板");
    assert.equal(
      plan.files.some((file) => file.rel.endsWith(".tpl")),
      false,
      ".tpl 后缀在计划里就已经脱掉了",
    );
  });
});

test("planSite：端口按邻居 package.json 的脚本内容认，不按目录名——node_modules 与点开头目录不进", () => {
  inRepo(
    {
      甲: { dev: "next dev -p 4311" },
      乙: { start: "next start -p 4315", build: "next build" },
      丙: { dev: "vite --port 4312" },
      丁: {},
    },
    (repo, root) => {
      // 站不一定叫 docs-site：这几个仓根本没有 docs-site 目录，认的是 scripts 那一行
      mkdirSync(join(root, "node_modules", "假", "x"), { recursive: true });
      writeFileSync(join(root, "node_modules", "假", "package.json"), JSON.stringify({ scripts: { dev: "next dev -p 4399" } }));
      mkdirSync(join(root, ".藏", "x"), { recursive: true });
      writeFileSync(join(root, ".藏", "package.json"), JSON.stringify({ scripts: { dev: "next dev -p 4398" } }));
      writeFileSync(join(root, "甲", "坏.json"), "{ 不是 json");

      const plan = planSite({ repoDir: repo });
      assert.deepEqual([...plan.used.keys()].sort((a, b) => a - b), [4311, 4315]);
      assert.match(plan.used.get(4311)!, /甲$/, "占口的是谁也说得出来");
      assert.equal(plan.port, 4310, "4310 还空着，从段首起找第一个空位");
      assert.match(fileIn(plan, "package.json"), /"dev": "next dev -p 4310"/);
    },
  );
});

test("planSite：邻居目录不在就是空集合，不抛", () => {
  inRepo({}, (repo) => {
    const plan = planSite({ repoDir: repo, neighborhood: join(tmpdir(), "根本没有这个目录-livedoc-site") });
    assert.equal(plan.used.size, 0);
    assert.equal(plan.port, 4310);
  });
});

test("planSite：手给的口一律让给你，被邻居占着也让——占了谁在 used 里看得出来", () => {
  inRepo({ 邻居: { dev: "next dev -p 4310" } }, (repo) => {
    const plan = planSite({ repoDir: repo, port: 4310 });
    assert.equal(plan.port, 4310);
    assert.match(plan.used.get(4310)!, /邻居$/, "撞上了，让给你但说得出是谁在占");
    assert.match(fileIn(plan, "package.json"), /"start": "next start -p 4310"/);
  });
});

test("planSite：名字从仓根 package.json 认，认不出退目录名，title 优先", () => {
  inRepo({}, (repo) => {
    writeFileSync(join(repo, "package.json"), JSON.stringify({ name: "@scope/hello" }));
    assert.match(fileIn(planSite({ repoDir: repo }), "package.json"), /"name": "hello-docs-site"/, "带 scope 的取尾巴那一截");
    assert.match(fileIn(planSite({ repoDir: repo, title: "打个招呼" }), "package.json"), /"description": "打个招呼 的六区文档站/);

    rmSync(join(repo, "package.json"));
    const fallback = planSite({ repoDir: repo });
    assert.match(fileIn(fallback, "package.json"), /"name": "docs-docs-site"/, "目录名不是合法 npm 名字，退到 docs");
    assert.match(fileIn(fallback, "package.json"), /"description": "我的仓 的六区文档站/);
  });
});

test("planSite：起手页的第一条引用现找——有 export const name 就钉那一行，没有就写「怎么钉」", () => {
  inRepo({}, (repo) => {
    mkdirSync(join(repo, "src"), { recursive: true });
    writeFileSync(join(repo, "src", "index.ts"), ["// 头", "", "export const name = 'x';", ""].join("\n"));
    const pinned = fileIn(planSite({ repoDir: repo }), "content/docs/index.mdx");
    assert.match(pinned, /@@livedoc ref \.\.\/src\/index\.ts:3-3 @@/, "行号是数出来的，不写死");

    writeFileSync(join(repo, "src", "index.ts"), "export function name() {}\n");
    const none = fileIn(planSite({ repoDir: repo }), "content/docs/index.mdx");
    assert.match(none, /还没钉第一条引用/);
    // 样例记号在围栏里：围栏内容是 code 节点，check 认不出它——硬塞一条钉不住的引用
    // 等于让刚铺好的站开局就报红
    assert.match(none, /```text\n@@livedoc ref/);
  });
});

test("planSite：模板里有认不出的占位符当场抛，盘上一个字都还没写", () => {
  inRepo({}, (repo) => {
    const template = templateDir({ "a.txt.tpl": "{{typo}}" });
    try {
      assert.throws(() => planSite({ repoDir: repo, template }), /认不出的占位符 \{\{typo\}\}（a\.txt\.tpl）/);
      assert.equal(existsSync(join(repo, "docs-site")), false);
    } finally {
      rmSync(template, { recursive: true, force: true, maxRetries: 5 });
    }
  });
});

test("planSite：仓不在、不是目录、站已经在，三种都在算的那一半就抛", () => {
  inRepo({}, (repo) => {
    assert.throws(() => planSite({ repoDir: join(repo, "没有这个仓") }), /仓不在/);
    writeFileSync(join(repo, "文件"), "");
    assert.throws(() => planSite({ repoDir: join(repo, "文件") }), /不是目录/);
    mkdirSync(join(repo, "docs-site"));
    assert.throws(() => planSite({ repoDir: repo }), /这个仓已经有站了，不覆盖/);
  });
});

test("createSite：整套落盘——六区各有集合、路由、骨架页，配置预置两区进 check", () => {
  inRepo({ 邻居: { dev: "next dev -p 4310" } }, (repo) => {
    mkdirSync(join(repo, "src"), { recursive: true });
    writeFileSync(join(repo, "package.json"), JSON.stringify({ name: "@s/hello" }));
    writeFileSync(join(repo, "src", "index.ts"), "// 头\nexport const name = 'hello';\n");

    const result = createSite({ repoDir: repo });
    const site = join(repo, "docs-site");
    assert.equal(result.port, 4311, "4310 被邻居占了，挑下一个");
    assert.ok(result.written.includes("docs-site/livedoc.config.mjs"), "落了哪些文件逐条报出来");
    assert.equal(result.written.length, result.files.length);
    assert.equal(existsSync(join(site, "package.json.tpl")), false, ".tpl 后缀落盘时脱掉");
    const pkg = JSON.parse(readFileSync(join(site, "package.json"), "utf8")) as { name: string; scripts: Record<string, string> };
    assert.equal(pkg.name, "hello-docs-site");
    assert.equal(pkg.scripts.dev, "next dev -p 4311");
    assert.match(readFileSync(join(site, "content", "docs", "index.mdx"), "utf8"), /@@livedoc ref \.\.\/src\/index\.ts:2-2 @@/);

    // 六区：六个目录各有骨架页与 meta.json，六个集合、六条路由、侧栏六个根节
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
      assert.match(readFileSync(join(site, "content", page), "utf8"), /\*\*本页回答\*\*：/, `${page} 头一句要是「本页回答」`);
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

    // 铺过一次就拒第二次，一个字不覆盖
    assert.throws(() => createSite({ repoDir: repo }), /这个仓已经有站了，不覆盖/);
  });
});

test("createSite：仓里已有的文件一个字不动——gitignore 缺的、会被 render 覆盖的都只报出来", () => {
  inRepo({}, (repo) => {
    writeFileSync(join(repo, "README.md"), "# 老 README\n");
    const result = createSite({ repoDir: repo });
    assert.deepEqual(result.missingGitignore, ["docs-site/.next/", "docs-site/.source/", "docs-site/out/"]);
    assert.equal(existsSync(join(repo, ".gitignore")), false, "不替人改 .gitignore，更不新建");
    assert.deepEqual(result.overwrites, ["README.md"], "仓根已有的生成物点名，没有的不点");
    assert.equal(readFileSync(join(repo, "README.md"), "utf8"), "# 老 README\n", "建站一个字不动它");
    assert.equal(existsSync(join(repo, "AGENTS.md")), false, "建站不摆生成物，那是 render 的事");

    writeFileSync(join(repo, ".gitignore"), "docs-site/.next/\n");
    rmSync(join(repo, "docs-site"), { recursive: true, force: true });
    assert.deepEqual(createSite({ repoDir: repo }).missingGitignore, ["docs-site/.source/", "docs-site/out/"], "有的那条不再报");
  });
});
