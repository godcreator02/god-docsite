/**
 * 装配模块（`@godcreator02/livedoc` 主出口上的那半）的账，全部跨它面上那两个方法测：
 *   `planAttach` 算一套不碰盘——骨架合不合规、名字怎么认、起手页那块钉什么、package.json
 *   怎么合、占位符错了抛不抛，全在它回的那份计划里看得见，一个内部函数都不用点名；
 *   `attachSite` 才落盘——装出来的六区长什么样、骨架里哪份让了位，在临时目录里跑真的。
 * 命令行那一层（认参数、打印、退出码）不在这儿，在 attach.test.ts。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { attachSite, planAttach, DEFAULT_PORT, LIVEDOC_DEPS, type AttachPlan } from "@godcreator02/livedoc";

/** 站件铺出来的那份骨架 package.json，最小的一份 */
function skeletonManifest(port: number | null): string {
  const scripts: Record<string, string> = { build: "next build" };
  if (port !== null) {
    scripts.dev = `next dev -p ${String(port)}`;
    scripts.start = `next start -p ${String(port)}`;
  }
  return `${JSON.stringify({ name: "hello-docs-site", version: "0.1.0", private: true, type: "module", scripts, dependencies: { "fumadocs-core": "16.15.1", next: "16.3.0" } }, null, 2)}\n`;
}

/**
 * 造一个「刚被站件铺好」的骨架：`<tmp>/<仓>/docs-site`，仓根可选地放几样东西。
 * 跑完把整片删掉。
 */
function inSkeleton(
  setup: { port?: number | null; repoFiles?: Record<string, string>; siteFiles?: Record<string, string> },
  body: (site: string, repo: string) => void,
): void {
  const root = mkdtempSync(join(tmpdir(), "god-live-doc-attach-"));
  const repo = join(root, "我的仓");
  const site = join(repo, "docs-site");
  try {
    mkdirSync(join(site, "content", "docs"), { recursive: true });
    writeFileSync(join(site, "package.json"), skeletonManifest(setup.port === undefined ? 4317 : setup.port));
    writeFileSync(join(site, "content", "docs", "index.mdx"), "---\ntitle: 骨架\n---\n");
    writeFileSync(join(site, "content", "docs", "meta.json"), '{ "pages": ["index", "..."] }\n');
    mkdirSync(join(site, "src", "app", "docs"), { recursive: true });
    writeFileSync(join(site, "src", "app", "docs", "layout.tsx"), "export default function Layout() {}\n");
    for (const [rel, text] of Object.entries(setup.siteFiles ?? {})) {
      mkdirSync(dirname(join(site, rel)), { recursive: true });
      writeFileSync(join(site, rel), text, "utf8");
    }
    for (const [rel, text] of Object.entries(setup.repoFiles ?? {})) {
      mkdirSync(dirname(join(repo, rel)), { recursive: true });
      writeFileSync(join(repo, rel), text, "utf8");
    }
    body(site, repo);
  } finally {
    rmSync(root, { recursive: true, force: true, maxRetries: 5 });
  }
}

/** 造一份自带的小模板，用来验渲染本身——不必拿整套六区说事 */
function templateDir(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "god-live-doc-tpl-"));
  for (const [rel, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, rel)), { recursive: true });
    writeFileSync(join(root, rel), text, "utf8");
  }
  return root;
}

/** 计划里那一份文件的正文；不在就当场报出来（比在 undefined 上匹配好读） */
function fileIn(plan: AttachPlan, rel: string): string {
  const found = plan.files.find((file) => file.rel === rel);
  assert.ok(found !== undefined, `计划里没有 ${rel}：${plan.files.map((f) => f.rel).join("、")}`);
  return found.text;
}

test("planAttach：一个字都不写盘，整套六区在回的那份计划里", () => {
  inSkeleton({}, (site) => {
    const plan = planAttach({ siteDir: site });
    assert.equal(plan.target, site);
    assert.equal(existsSync(join(site, "livedoc.config.mjs")), false, "算完盘上什么都没有");
    assert.ok(plan.files.length > 20, `包里带的那套模板一个文件都没读到：${plan.files.length}`);
    assert.equal(
      plan.files.some((file) => file.rel.endsWith(".tpl")),
      false,
      ".tpl 后缀在计划里就已经脱掉了",
    );
    // 骨架那半一份都不在装配的模板里——它们归站件
    for (const rel of ["tsconfig.json", "postcss.config.mjs", "pnpm-workspace.yaml", ".npmrc"]) {
      assert.equal(plan.files.some((f) => f.rel === rel), false, `${rel} 是骨架那半，装配不该碰它`);
    }
  });
});

test("planAttach：端口从骨架的脚本里认，装配不改它；认不出退 next 的默认口", () => {
  inSkeleton({ port: 4317 }, (site) => {
    const plan = planAttach({ siteDir: site });
    assert.equal(plan.port, 4317);
    assert.match(fileIn(plan, "content/outputs/readme.mdx"), /localhost:4317/);
    const merged = JSON.parse(plan.manifest) as { scripts: Record<string, string> };
    assert.equal(merged.scripts.dev, "next dev -p 4317", "骨架写的那几条脚本一个字不动");
  });
  inSkeleton({ port: null }, (site) => {
    assert.equal(planAttach({ siteDir: site }).port, DEFAULT_PORT);
  });
});

test("planAttach：package.json 只加不减——补 doc 脚本与 livedoc 依赖，骨架写的一律留着", () => {
  inSkeleton({}, (site) => {
    const plan = planAttach({ siteDir: site });
    const merged = JSON.parse(plan.manifest) as {
      name: string;
      scripts: Record<string, string>;
      dependencies: Record<string, string>;
      devDependencies: Record<string, string>;
      description: string;
    };
    assert.equal(merged.name, "hello-docs-site", "骨架挑的包名不动");
    assert.equal(merged.dependencies["fumadocs-core"], "16.15.1", "骨架装的依赖不动");
    assert.equal(merged.scripts.build, "next build");
    assert.equal(merged.scripts.doc, "livedoc check");
    assert.equal(merged.scripts["doc:render"], "livedoc render");
    assert.equal(merged.scripts["verify:roster"], "node scripts/verify-roster.mjs");
    for (const [name, range] of Object.entries(LIVEDOC_DEPS)) assert.equal(merged.devDependencies[name], range);
    assert.match(merged.description, /我的仓 的六区文档站/);
    // 合并完的那份也在待写清单里——落盘只走一条路
    assert.equal(fileIn(plan, "package.json"), plan.manifest);
  });
});

test("planAttach：名字从仓根 package.json 认，认不出退仓的目录名，title 优先", () => {
  inSkeleton({ repoFiles: { "package.json": JSON.stringify({ name: "@scope/hello" }) } }, (site) => {
    assert.match(fileIn(planAttach({ siteDir: site }), "content/docs/index.mdx"), /`hello` 是什么/);
    assert.match(fileIn(planAttach({ siteDir: site, title: "打个招呼" }), "content/docs/index.mdx"), /^# 打个招呼$/m);
  });
  inSkeleton({}, (site) => {
    assert.match(fileIn(planAttach({ siteDir: site }), "content/docs/index.mdx"), /^# 我的仓$/m, "仓根没有 package.json，退目录名");
  });
});

test("planAttach：起手页的第一条引用现找——有 export const name 就钉那一行，没有就写「怎么钉」", () => {
  inSkeleton({ repoFiles: { "src/index.ts": ["// 头", "", "export const name = 'x';", ""].join("\n") } }, (site) => {
    assert.match(fileIn(planAttach({ siteDir: site }), "content/docs/index.mdx"), /@@livedoc ref \.\.\/src\/index\.ts:3-3 @@/, "行号是数出来的，不写死");
  });
  inSkeleton({ repoFiles: { "src/index.ts": "export function name() {}\n" } }, (site) => {
    const none = fileIn(planAttach({ siteDir: site }), "content/docs/index.mdx");
    assert.match(none, /还没钉第一条引用/);
    // 样例记号在围栏里：围栏内容是 code 节点，check 认不出它——硬塞一条钉不住的引用
    // 等于让刚接好线的站开局就报红
    assert.match(none, /```text\n@@livedoc ref/);
  });
});

test("planAttach：模板里有认不出的占位符当场抛，盘上一个字都还没写", () => {
  inSkeleton({}, (site) => {
    const template = templateDir({ "a.txt.tpl": "{{typo}}" });
    try {
      assert.throws(() => planAttach({ siteDir: site, template }), /认不出的占位符 \{\{typo\}\}（a\.txt\.tpl）/);
      assert.equal(existsSync(join(site, "a.txt")), false);
    } finally {
      rmSync(template, { recursive: true, force: true, maxRetries: 5 });
    }
  });
});

/**
 * 装配唯一的那道门。四条拒的理由各说各的——「这个站已有内容」那两条是约定本身：
 * 只在刚铺好的骨架上跑，跑了半年的站人工接线。
 */
test("planAttach：不在 / 不是目录 / 不是 fumadocs 骨架 / 已经接过线 / content 下有内容，五种都在算的那一半就抛", () => {
  inSkeleton({}, (site, repo) => {
    assert.throws(() => planAttach({ siteDir: join(repo, "没有这个站") }), /站不在/);
    writeFileSync(join(repo, "文件"), "");
    assert.throws(() => planAttach({ siteDir: join(repo, "文件") }), /不是目录/);
    assert.doesNotThrow(() => planAttach({ siteDir: site }), "刚铺好的骨架放行");
  });

  inSkeleton({ siteFiles: { "livedoc.config.mjs": "export default {}" } }, (site) => {
    assert.throws(() => planAttach({ siteDir: site }), /这个站已有内容，请人工接线：.*已经有 livedoc\.config\.mjs/);
  });

  inSkeleton({ siteFiles: { "content/docs/写过的页.mdx": "# 有人写过\n", "content/trajectory/x.mdx": "" } }, (site) => {
    assert.throws(() => planAttach({ siteDir: site }), /这个站已有内容，请人工接线：content\/ 下有骨架之外的 docs\/写过的页\.mdx、trajectory/);
  });

  const root = mkdtempSync(join(tmpdir(), "god-live-doc-attach-bare-"));
  try {
    const bare = join(root, "空目录");
    mkdirSync(bare);
    assert.throws(() => planAttach({ siteDir: bare }), /不是 fumadocs 骨架：.*没有 package\.json/);
    writeFileSync(join(bare, "package.json"), JSON.stringify({ name: "x", dependencies: { vite: "1" } }));
    assert.throws(() => planAttach({ siteDir: bare }), /不是 fumadocs 骨架：.*没有 fumadocs-core/);
  } finally {
    rmSync(root, { recursive: true, force: true, maxRetries: 5 });
  }
});

test("attachSite：整套落盘——六区各有集合、路由、骨架页，配置预置两区进 check", () => {
  inSkeleton(
    {
      repoFiles: { "package.json": JSON.stringify({ name: "@s/hello" }), "src/index.ts": "// 头\nexport const name = 'hello';\n" },
    },
    (site) => {
      const result = attachSite({ siteDir: site });
      assert.ok(result.written.includes("livedoc.config.mjs"), "写了哪些文件逐条报出来");
      assert.equal(result.written.length, result.files.length);
      assert.equal(existsSync(join(site, "livedoc.config.mjs.tpl")), false, ".tpl 后缀落盘时脱掉");
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
      // 骨架那份 DocsLayout 让位：留着就是两层 DocsLayout 套着渲，侧栏出现两遍
      assert.deepEqual(result.superseded, ["src/app/docs/layout.tsx"]);
      assert.equal(existsSync(join(site, "src", "app", "docs", "layout.tsx")), false);
      const config = readFileSync(join(site, "livedoc.config.mjs"), "utf8");
      assert.match(config, /docs: \['content\/docs', 'content\/outputs'\]/, "check 扫 docs + outputs 两区");
      assert.match(config, /trajectory: 'content\/trajectory'/);
      assert.match(config, /'content\/outputs\/agents\.mdx': \['\.\.\/AGENTS\.md'\]/);
      assert.match(config, /'content\/outputs\/readme\.mdx': \['\.\.\/README\.md'\]/);
      assert.match(readFileSync(join(site, "content", "feedback", "inbound.mdx"), "utf8"), /\{\/\*[\s\S]*## <yyyy-MM-dd> <标题>[\s\S]*\*\/\}/, "inbound 页头注释写明追加格式");
      assert.match(readFileSync(join(site, "content", "spec", "index.mdx"), "utf8"), /有页 = 有活在路上，做完删/);

      // 装过一次就拒第二次——这时站里已经有 livedoc.config.mjs
      assert.throws(() => attachSite({ siteDir: site }), /这个站已有内容，请人工接线/);
    },
  );
});

test("attachSite：仓根一个字不动——会被 render 覆盖的只报出来", () => {
  inSkeleton({ repoFiles: { "README.md": "# 老 README\n" } }, (site, repo) => {
    const result = attachSite({ siteDir: site });
    assert.deepEqual(result.overwrites, ["README.md"], "仓根已有的生成物点名，没有的不点");
    assert.equal(readFileSync(join(repo, "README.md"), "utf8"), "# 老 README\n", "装配一个字不动它");
    assert.equal(existsSync(join(repo, "AGENTS.md")), false, "装配不摆生成物，那是 render 的事");
  });
});
