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
import { main } from "@godcreator02/live-doc-cli";
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
function setupProject(config: string = CONFIG) {
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
  writeFileSync(join(root, "livedoc.config.mjs"), config);
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

test("被忽略的文件走 hash 记忆：confirm 标明；改了内容 check 报黄、位置不明", async () => {
  const p = setupProject();
  try {
    writeFileSync(join(p.root, ".gitignore"), "vendor/\n");
    run(p.root, ["add", "-A"]);
    run(p.root, ["commit", "-qm", "忽略 vendor"]);
    mkdirSync(join(p.root, "vendor"));
    writeFileSync(join(p.root, "vendor", "lib.ts"), CODE);
    writeFileSync(join(p.root, "docs", "c.md"), "# c\n\n@@livedoc ref vendor/lib.ts:2-3 @@\n");

    const done = await p.cli("confirm");
    assert.equal(done.code, 0);
    assert.match(done.out, /✅ docs\/c\.md {2}vendor\/lib\.ts:2-3 {2}已确认，草稿记号已换成正式记号（hash 记忆：不在 git 里）/);
    assert.match(done.out, /✅ docs\/a\.md {2}src\/greet\.ts:2-3 {2}已确认，草稿记号已换成正式记号\n/, "git 记忆的不标");
    const ledger = JSON.parse(p.read(".ledger.json")) as Record<string, Record<string, { kind: string }>>;
    assert.equal(ledger["docs/c.md"]!["vendor/lib.ts:2-3"]!.kind, "hash");

    writeFileSync(join(p.root, "vendor", "lib.ts"), CODE.replace("hello", "hey"));
    const yellow = await p.cli("check");
    assert.equal(yellow.code, 0);
    assert.match(yellow.out, /🟡 docs\/c\.md {2}vendor\/lib\.ts:2-3 {2}有变动.*位置不明/);
  } finally {
    p.teardown();
  }
});

test("五类引用一篇 md：目录树长出清单、名字和存在性只有记号；多了文件黄、断言不在的出现了红", async () => {
  const p = setupProject();
  try {
    writeFileSync(
      join(p.root, "docs", "d.md"),
      "# d\n\n@@livedoc tree src @@\n\n@@livedoc ref src/greet.ts @@\n\n@@livedoc has src/greet.ts \"export function greet\" @@\n\n@@livedoc absent src/remove.ts @@\n",
    );
    const done = await p.cli("confirm");
    assert.equal(done.code, 0, done.out);
    assert.match(done.out, /✅ docs\/d\.md {2}tree src depth=1 {2}已确认/);
    assert.match(done.out, /✅ docs\/d\.md {2}src\/greet\.ts:all {2}已确认/);
    assert.match(done.out, /✅ docs\/d\.md {2}has src\/greet\.ts "export function greet" {2}已确认/);
    assert.match(done.out, /✅ docs\/d\.md {2}absent src\/remove\.ts {2}已确认/);
    const md = p.read("docs/d.md");
    assert.match(md, /<!-- tree dir="src" depth="1" -->\n```text\ngreet\.ts\n```\n<!-- \/tree -->/);
    assert.match(md, /<!-- ref file="src\/greet\.ts" -->\n```ts\n\/\/ greet\n/);
    assert.match(md, /<!-- has file="src\/greet\.ts" text="export function greet" -->\n\n<!-- absent path="src\/remove\.ts" -->/);

    const green = await p.cli("check");
    assert.match(green.out, /🟢 docs\/d\.md {2}tree src depth=1 {2}新鲜（1 项）/);

    writeFileSync(join(p.root, "src", "tag.ts"), "export const t = 1;\n");
    writeFileSync(join(p.root, "src", "remove.ts"), "");
    const after = await p.cli("check");
    assert.equal(after.code, 1);
    assert.match(after.out, /🟡 docs\/d\.md {2}tree src depth=1 {2}有变动，等作者复核（\+ remove\.ts，\+ tag\.ts）/);
    assert.match(after.out, /🔴 docs\/d\.md {2}absent src\/remove\.ts {2}缺失，引用指向空气（断言它不在，它却出现了）/);
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

/** 把 CONFIG 尾巴换成带 outputs 的：docs/a.md 摆到项目根的 README.md */
function withOutputs(extra: string): string {
  return CONFIG.replace(
    `docs: "docs", out: "out" };`,
    `docs: "docs", out: "out", outputs: ${extra} };`,
  );
}

test("outputs 摆放：render 只写指定目标、不落 out/；check 守生成物——手改了或删了都红，重摆后复原", async () => {
  const p = setupProject(withOutputs(`{ "docs/a.md": ["README.md"] }`));
  try {
    await p.cli("confirm");
    const rendered = await p.cli("render", "--target", "ai");
    assert.equal(rendered.code, 0, rendered.out);
    assert.match(rendered.out, /→ {2}docs\/a\.md {2}摆放到 README\.md/);
    const readme = p.read("README.md");
    assert.match(readme, /```ts\nexport function greet/);
    assert.doesNotMatch(readme, /<!-- ref |<!-- \/ref -->/, "摆放那份也剥记号");
    assert.equal(existsSync(join(p.root, "out")), false, "挂了映射的不再落 out/");

    const green = await p.cli("check");
    assert.equal(green.code, 0, green.out);
    assert.match(green.out, /🟢 docs\/a\.md → README\.md {2}生成物跟 mdx 源一致/);

    writeFileSync(join(p.root, "README.md"), readme + "\n手改一笔\n");
    const edited = await p.cli("check");
    assert.equal(edited.code, 1);
    assert.match(edited.out, /🔴 docs\/a\.md → README\.md {2}生成物跟 mdx 源不一致/);

    rmSync(join(p.root, "README.md"));
    const gone = await p.cli("check");
    assert.equal(gone.code, 1);
    assert.match(gone.out, /🔴 docs\/a\.md → README\.md {2}生成物还不存在——render 摆过去/);

    await p.cli("render", "--target", "ai");
    assert.equal((await p.cli("check")).code, 0, "重摆之后恢复绿");
  } finally {
    p.teardown();
  }
});

test("outputs 配置的地盘规则：绝对路径、落进文档目录、一个目标两个文档写，装配时都拒", async () => {
  const cases: [string, RegExp][] = [
    [withOutputs(`{ "docs/a.md": ["C:/绝对/路径.md"] }`), /绝对路径不认/],
    [withOutputs(`{ "docs/a.md": ["docs/copy.md"] }`), /落进了文档目录/],
    [withOutputs(`{ "docs/a.md": ["README.md"], "docs/b.html": ["README.md"] }`), /一个目标只许一个文档写/],
  ];
  for (const [config, message] of cases) {
    const p = setupProject(config);
    try {
      await assert.rejects(p.cli("check"), message);
    } finally {
      p.teardown();
    }
  }
});

test("文档本身删了：它的记录 check 算红；confirm 整个忘掉", async () => {
  const p = setupProject();
  try {
    await p.cli("confirm");
    rmSync(join(p.root, "docs", "b.html"));
    const red = await p.cli("check");
    assert.equal(red.code, 1);
    assert.match(red.out, /🔴 docs\/b\.html {2}文档已不存在，记录簿里还留着/);
    const swept = await p.cli("confirm");
    assert.match(swept.out, /🧹 docs\/b\.html {2}文档已不存在，记录已清/);
    const ledger = JSON.parse(p.read(".ledger.json")) as Record<string, unknown>;
    assert.deepEqual(Object.keys(ledger), ["docs/a.md"]);
    assert.equal((await p.cli("check")).code, 0);
  } finally {
    p.teardown();
  }
});

/** 把 CONFIG 尾巴换成带 trajectory 的：项目根下 trajectory/ 目录挂上轨迹卡校验 */
function withTrajectory(): string {
  return CONFIG.replace(`docs: "docs", out: "out" };`, `docs: "docs", out: "out", trajectory: "trajectory" };`);
}

test("配了 trajectory 的项目：check 顺带跑卡校验，病卡退 1 且输出含 🔴", async () => {
  const p = setupProject(withTrajectory());
  try {
    mkdirSync(join(p.root, "trajectory"));
    writeFileSync(
      join(p.root, "trajectory", "2026-01-01-bad.md"),
      ["---", "born-at: 一月一号", "type: root", "label: 坏卡", "---", "", "正文。", ""].join("\n"),
    );
    const red = await p.cli("check");
    assert.equal(red.code, 1);
    assert.match(red.out, /🔴 trajectory\/2026-01-01-bad\.md {2}born-at：/);
  } finally {
    p.teardown();
  }
});

test("配了 trajectory 但目录还不存在：check 退 0、一条红都不打——「这里还没有轨迹记录」是合法状态", async () => {
  const p = setupProject(withTrajectory());
  try {
    const green = await p.cli("check");
    assert.equal(green.code, 0, green.out);
    assert.doesNotMatch(green.out, /🔴/, "没配和配了但目录没建是两件事，后者扫出来是空集合");
  } finally {
    p.teardown();
  }
});

test("配了 trajectory 的项目：合法根卡加子卡，trajectory --json 出的 JSON 里 disks 有一张盘", async () => {
  const p = setupProject(withTrajectory());
  try {
    mkdirSync(join(p.root, "trajectory"));
    writeFileSync(
      join(p.root, "trajectory", "2026-01-01-root.md"),
      ["---", "born-at: 2026-01-01T08:00", "type: root", "label: 测试项目", "---", ""].join("\n"),
    );
    writeFileSync(
      join(p.root, "trajectory", "2026-01-02-child.md"),
      ["---", "born-at: 2026-01-02T08:00", "parent: [2026-01-01-root]", "label: 子卡", "---", ""].join("\n"),
    );
    const result = await p.cli("trajectory", "--json");
    assert.equal(result.code, 0, result.out);
    const data = JSON.parse(result.out) as { disks: unknown[] };
    assert.equal(data.disks.length, 1);
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

/* ── docs 数组、outputs 对象写法、check --json ─────────────────────────────── */

test("docs 给数组：几个目录一起扫，报告按文档身份排序；目录套目录同一篇只算一次", async () => {
  const p = setupProject(CONFIG.replace(`docs: "docs"`, `docs: ["docs", "more", "more/deep"]`));
  try {
    mkdirSync(join(p.root, "more", "deep"), { recursive: true });
    writeFileSync(join(p.root, "more", "x.md"), "# x\n\n@@livedoc ref src/greet.ts:2-3 @@\n");
    writeFileSync(join(p.root, "more", "deep", "y.md"), "# y\n\n@@livedoc ref src/greet.ts:2-3 @@\n");
    const first = await p.cli("check", "--json");
    assert.equal(first.code, 0, first.out);
    const report = JSON.parse(first.out) as { docs: Array<{ doc: string }> };
    assert.deepEqual(
      report.docs.map((d) => d.doc),
      ["docs/a.md", "docs/b.html", "more/deep/y.md", "more/x.md"],
    );
  } finally {
    p.teardown();
  }
});

test("docs 配成空数组或空串：装配时拒", async () => {
  for (const bad of [`docs: []`, `docs: ""`, `docs: ["docs", ""]`]) {
    const p = setupProject(CONFIG.replace(`docs: "docs"`, bad));
    try {
      await assert.rejects(p.cli("check"), /docs 得是一个非空目录/);
    } finally {
      p.teardown();
    }
  }
});

test("outputs 目标落进第二个文档目录也拒", async () => {
  const p = setupProject(CONFIG.replace(`docs: "docs", out: "out" };`, `docs: ["docs", "more"], out: "out", outputs: { "docs/a.md": ["more/copy.md"] } };`));
  try {
    await assert.rejects(p.cli("check"), /落进了文档目录/);
  } finally {
    p.teardown();
  }
});

const SKILL_DOC = [
  "---",
  "name: block-note",
  "description: 块笔记怎么用",
  "tags:",
  "  - 笔记",
  "  - 块",
  "secret: 不该随行",
  "---",
  "",
  "# skill",
  "",
  "@@livedoc ref src/greet.ts:2-3 @@",
  "",
].join("\n");

test("outputs 对象写法：点名的 frontmatter 字段原样随行到生成物头部（块式列表跟着走），没点名的剥掉；字符串写法照旧全剥", async () => {
  const p = setupProject(
    withOutputs(`{ "docs/s.md": [{ to: "skills/x/SKILL.md", frontmatter: ["name", "tags"] }, "PLAIN.md"] }`),
  );
  try {
    writeFileSync(join(p.root, "docs", "s.md"), SKILL_DOC);
    run(p.root, ["add", "-A"]);
    run(p.root, ["commit", "-qm", "加 skill 源"]);
    assert.equal((await p.cli("confirm")).code, 0);
    const rendered = await p.cli("render", "--target", "ai");
    assert.equal(rendered.code, 0, rendered.out);
    assert.match(rendered.out, /→ {2}docs\/s\.md {2}摆放到 skills\/x\/SKILL\.md/);
    const skill = p.read("skills/x/SKILL.md");
    assert.ok(skill.startsWith("---\nname: block-note\ntags:\n  - 笔记\n  - 块\n---\n\n# skill\n"), skill);
    assert.doesNotMatch(skill, /description:|secret:/, "没点名的字段不随行");
    const plain = p.read("PLAIN.md");
    assert.ok(plain.startsWith("# skill\n"), `字符串写法整段剥掉：${plain.slice(0, 40)}`);
    assert.match(skill, /```ts\nexport function greet/, "正文照样是投影过的 md");

    const green = await p.cli("check");
    assert.equal(green.code, 0, green.out);
    assert.match(green.out, /🟢 docs\/s\.md → skills\/x\/SKILL\.md {2}生成物跟 mdx 源一致/);
    assert.match(green.out, /🟢 docs\/s\.md → PLAIN\.md {2}生成物跟 mdx 源一致/);

    // 手改头部一个字：跟源不一致，红
    writeFileSync(join(p.root, "skills", "x", "SKILL.md"), skill.replace("block-note", "block-notes"));
    const stale = await p.cli("check");
    assert.equal(stale.code, 1);
    assert.match(stale.out, /🔴 docs\/s\.md → skills\/x\/SKILL\.md {2}生成物跟 mdx 源不一致/);
  } finally {
    p.teardown();
  }
});

test("outputs 点名了源里没有的 frontmatter 字段：render 不摆、退 1；check 红并说缺哪个", async () => {
  const p = setupProject(withOutputs(`{ "docs/s.md": [{ to: "SKILL.md", frontmatter: ["name", "nope"] }] }`));
  try {
    writeFileSync(join(p.root, "docs", "s.md"), SKILL_DOC);
    run(p.root, ["add", "-A"]);
    run(p.root, ["commit", "-qm", "加 skill 源"]);
    await p.cli("confirm");
    const rendered = await p.cli("render", "--target", "ai");
    assert.equal(rendered.code, 1);
    assert.match(rendered.out, /🔴 docs\/s\.md → SKILL\.md {2}mdx 源的 frontmatter 里没有 nope——补上再 render/);
    assert.equal(existsSync(join(p.root, "SKILL.md")), false, "缺字段就不摆");
    const red = await p.cli("check", "--json");
    assert.equal(red.code, 1);
    const report = JSON.parse(red.out) as { docs: Array<{ doc: string; outputs: Array<{ to: string; status: string; missing?: string[] }> }> };
    const entry = report.docs.find((d) => d.doc === "docs/s.md")!;
    assert.deepEqual(entry.outputs, [{ to: "SKILL.md", status: "no-frontmatter", missing: ["nope"] }]);
  } finally {
    p.teardown();
  }
});

test("outputs 对象写法的形状：to 空、frontmatter 不是字符串数组，装配时拒", async () => {
  const cases: [string, RegExp][] = [
    [withOutputs(`{ "docs/a.md": [{ to: "" }] }`), /每个目标得是非空的相对路径/],
    [withOutputs(`{ "docs/a.md": [{ to: "X.md", frontmatter: "name" }] }`), /frontmatter 得是字段名数组/],
    [withOutputs(`{ "docs/a.md": [] }`), /目标得是非空数组/],
  ];
  for (const [config, message] of cases) {
    const p = setupProject(config);
    try {
      await assert.rejects(p.cli("check"), message);
    } finally {
      p.teardown();
    }
  }
});

interface JsonReport {
  ok: boolean;
  red: number;
  docs: Array<{
    doc: string;
    red: number;
    items: Array<{ target: string; kind: string; status: string; line: number; lines: [number, number]; draft: boolean; reason?: string; diff?: string }>;
    orphans: string[];
    components: Array<{ name: string; line: number }>;
    outputs: Array<{ to: string; status: string }>;
  }>;
  strays: string[];
  trajectory: Array<{ path: string; field: string; value: string; reason: string }>;
}

test("check --json：整份报告一行 JSON，退出码跟人读模式一样；四态、行号、outputs 新鲜度、孤儿、失踪文档、病卡都在", async () => {
  const p = setupProject(
    CONFIG.replace(`docs: "docs", out: "out" };`, `docs: "docs", out: "out", outputs: { "docs/a.md": ["README.md"] }, trajectory: "trajectory" };`),
  );
  try {
    const white = await p.cli("check", "--json");
    assert.equal(white.code, 1, "outputs 还没摆是红，退出码跟人读模式一样");
    assert.equal(white.out.split("\n").length, 1, "一行 JSON，别的什么都不打");
    const first = JSON.parse(white.out) as JsonReport;
    // outputs 还没摆：红，ok 假；引用本身是未确认
    assert.equal(first.ok, false);
    assert.equal(first.red, 1);
    const a = first.docs.find((d) => d.doc === "docs/a.md")!;
    assert.deepEqual(a.items, [{ target: "src/greet.ts:2-3", kind: "span", status: "unconfirmed", line: 3, lines: [2, 3], draft: true }]);
    assert.deepEqual(a.outputs, [{ to: "README.md", status: "missing" }]);
    assert.deepEqual(first.strays, []);
    assert.deepEqual(first.trajectory, []);

    await p.cli("confirm");
    await p.cli("render", "--target", "ai");
    const green = JSON.parse((await p.cli("check", "--json")).out) as JsonReport;
    assert.equal(green.ok, true);
    assert.equal(green.red, 0);
    assert.equal(green.docs.find((d) => d.doc === "docs/a.md")!.items[0]!.status, "fresh");
    assert.deepEqual(green.docs.find((d) => d.doc === "docs/a.md")!.outputs, [{ to: "README.md", status: "fresh" }]);

    // 代码改了：黄，带 diff，退 0。md 格式的投影住在文档里、confirm 才刷新，所以生成物此刻还跟源一致
    writeFileSync(join(p.root, "src", "greet.ts"), CODE.replace("hello", "hey"));
    run(p.root, ["commit", "-qam", "改问候语"]);
    const yellow = await p.cli("check", "--json");
    const changed = JSON.parse(yellow.out) as JsonReport;
    const item = changed.docs.find((d) => d.doc === "docs/a.md")!.items[0]!;
    assert.equal(item.status, "changed");
    assert.match(item.diff ?? "", /hey/);
    assert.equal(changed.docs.find((d) => d.doc === "docs/a.md")!.outputs[0]!.status, "fresh");
    assert.equal(yellow.code, 0);

    // 源改了没重摆 → 生成物 stale；引用删掉 → 孤儿；文档删掉 → 失踪；病卡 → trajectory
    writeFileSync(join(p.root, "docs", "a.md"), "# md\n\n没有引用了\n");
    rmSync(join(p.root, "docs", "b.html"));
    mkdirSync(join(p.root, "trajectory"));
    writeFileSync(join(p.root, "trajectory", "2026-01-01-bad.mdx"), ["---", "born-at: 一月一号", "type: root", "label: 坏卡", "---", ""].join("\n"));
    const red = await p.cli("check", "--json");
    assert.equal(red.code, 1);
    const last = JSON.parse(red.out) as JsonReport;
    assert.deepEqual(last.docs.find((d) => d.doc === "docs/a.md")!.orphans, ["src/greet.ts:2-3"]);
    assert.deepEqual(last.docs.find((d) => d.doc === "docs/a.md")!.outputs, [{ to: "README.md", status: "stale" }]);
    assert.deepEqual(last.strays, ["docs/b.html"]);
    assert.equal(last.trajectory.length, 1);
    assert.equal(last.trajectory[0]!.path, "trajectory/2026-01-01-bad.mdx");
    assert.equal(last.trajectory[0]!.field, "born-at");
    assert.equal(last.red, last.docs.reduce((n, d) => n + d.red, 0) + last.strays.length + last.trajectory.length);
  } finally {
    p.teardown();
  }
});
