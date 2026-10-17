/**
 * 配置的读取、校验与归一，以及装配时的文档身份：不经命令行，项目只有一份 docfirst.config.mjs 和空的内容根。
 */
import { afterAll, test } from "vitest";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fumadocsRoster } from "@godcreator/doc-export";
import { loadConfig } from "../src/config.ts";
import type { DocfirstConfig } from "../src/config.ts";
import { assembleProject } from "../src/project.ts";

const roots: string[] = [];

function tempRoot(contentDir = "content"): string {
  const root = mkdtempSync(join(tmpdir(), "docfirst-config-"));
  roots.push(root);
  mkdirSync(join(root, contentDir), { recursive: true });
  return root;
}

/** 起一个只有配置和空内容根的临时项目，读它的配置：`body` 是 default 导出里的那几项 */
function configOf(body: string, contentDir = "content"): Promise<DocfirstConfig> {
  const root = tempRoot(contentDir);
  writeFileSync(join(root, "docfirst.config.mjs"), `export default { ${body} };\n`);
  return loadConfig(root);
}

afterAll(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true, maxRetries: 5 });
});

test("内容根：没配是 content；配了照用，尾斜杠与反斜杠归一；轨迹卡目录没配时在内容根下", async () => {
  const plain = await configOf("");
  assert.equal(plain.contentDir, "content");
  assert.equal(plain.trajectoryDir, "content/trajectory");
  const nested = await configOf(String.raw`content: "site\\content/"`, "site/content");
  assert.equal(nested.contentDir, "site/content");
  assert.equal(nested.trajectoryDir, "site/content/trajectory");
});

test("轨迹卡目录：配了 trajectory 就是项目根下的那个目录，反斜杠与尾斜杠归一", async () => {
  assert.equal((await configOf(String.raw`trajectory: "trajectory\\"`)).trajectoryDir, "trajectory");
});

test("名册：不写是空表；fumadocsRoster 为 true 时先用现成的 fumadocs 名册，components 里同名的盖过它", async () => {
  assert.deepEqual((await configOf("")).roster, {});
  const own = (await configOf(`components: { Divider: "drop" }`)).roster;
  assert.deepEqual(Object.keys(own), ["Divider"]);
  const both = (await configOf(`fumadocsRoster: true, components: { Divider: "drop", Note: "children" }`)).roster;
  assert.deepEqual(Object.keys(both).sort(), ["Divider", "File", "Files", "Folder", "Note"]);
  assert.equal(both.Note, "children");
  assert.equal(both.Files, fumadocsRoster.Files);
  assert.deepEqual((await configOf(`fumadocsRoster: false`)).roster, {});
});

test("outputs：字符串写法等于 frontmatter 为空；对象写法原样", async () => {
  const config = await configOf(`outputs: { "a.mdx": ["../README.md", { to: "../x/SKILL.md", frontmatter: ["name", "description"] }, { to: "Y.md" }] }`);
  assert.deepEqual(config.outputs, {
    "a.mdx": [
      { to: "../README.md", frontmatter: [] },
      { to: "../x/SKILL.md", frontmatter: ["name", "description"] },
      { to: "Y.md", frontmatter: [] },
    ],
  });
});

test("glossary 移到站点配置了：出现就报错，说清它去了哪", async () => {
  await assert.rejects(configOf(`glossary: { terms: "src/glossary.mjs" }`), /glossary 这一项移到站点配置了：术语表的位置与不标注的页由站点声明/);
});

test("配置形状不对一次列全：不认识的键、content 空串、名册规则、fumadocsRoster 与 outputs 的类型", async () => {
  const body = `formats: "fumadocs", content: " ", comparator: "git", components: { Box: "kids", Hint: 1 }, fumadocsRoster: "yes", outputs: [], trajectory: ""`;
  await assert.rejects(configOf(body), (err: Error) => {
    for (const piece of [
      "有 8 处要改",
      "不认识的键 formats：配置只认 content / components / fumadocsRoster / outputs / trajectory",
      "不认识的键 comparator",
      "content 要是一个非空目录",
      "trajectory 要是一个非空目录",
      'components.Box 的规则要是 "children"、"drop" 或函数',
      "components.Hint 的规则",
      "fumadocsRoster 要是 true 或 false",
      "outputs 要是「正本 → 落点数组」的对象",
    ]) {
      assert.ok(err.message.includes(piece), `报错里该有「${piece}」：${err.message}`);
    }
    return true;
  });
});

test("配置文件只认 docfirst.config.mjs：写成 .js 当作没有配置，报错说要哪个文件", async () => {
  const root = tempRoot();
  writeFileSync(join(root, "docfirst.config.js"), "export default {};\n");
  await assert.rejects(loadConfig(root), /下没有 docfirst\.config\.mjs/);
});

test("default 导出不是对象：报错", async () => {
  const root = tempRoot();
  writeFileSync(join(root, "docfirst.config.mjs"), "export default [];\n");
  await assert.rejects(loadConfig(root), /要 export default 一个对象/);
});

test("项目根下还有 src/components/：装配时报错，讲解组件要挪到页面的同名文件夹或 content/_components/", () => {
  const root = tempRoot();
  mkdirSync(join(root, "src", "components", "x"), { recursive: true });
  writeFileSync(join(root, "src", "components", "x", "x.data.mjs"), "export const code = 1;\n");
  assert.throws(() => assembleProject(root, { contentDir: "content", trajectoryDir: "trajectory", roster: {}, outputs: {} }), /src\/components\/.*content\/_components\//);
});

test("站点 app/components/ 下有带钉码标记的代码文件：装配时报错，要挪到 content/_components/；不带标记的站点代码照旧放", () => {
  const root = tempRoot();
  const config = { contentDir: "content", trajectoryDir: "trajectory", roster: {}, outputs: {} };
  mkdirSync(join(root, "app", "components", "layout"), { recursive: true });
  writeFileSync(join(root, "app", "components", "layout", "sidebar.tsx"), "/* 站点自己的布局 */\nexport const Sidebar = () => null;\n");
  assert.deepEqual(assembleProject(root, config).docs, []);

  writeFileSync(join(root, "app", "components", "y.data.mjs"), '/* ref file="src/greet.ts" lines="2-3" */\nexport const code = 1;\n');
  assert.throws(() => assembleProject(root, config), /app\/components\/ 下有带钉码标记的文件：app\/components\/y\.data\.mjs——.*content\/_components\//);
});

test("内容根不在：装配时报错", async () => {
  const root = tempRoot();
  writeFileSync(join(root, "docfirst.config.mjs"), `export default { content: "nope" };\n`);
  assert.throws(() => assembleProject(root, { contentDir: "nope", trajectoryDir: "nope/trajectory", roster: {}, outputs: {} }), /内容根 nope 不是项目根下的目录/);
});

test("docIdOf：绝对路径按项目根算，相对路径原样收；反斜杠与 ./ 前缀归一", async () => {
  const root = tempRoot();
  const p = assembleProject(root, { contentDir: "content", trajectoryDir: "content/trajectory", roster: {}, outputs: {} });
  assert.equal(p.docIdOf(join(root, "docs", "a.md")), "docs/a.md");
  assert.equal(p.docIdOf("docs/a.md"), "docs/a.md");
  assert.equal(p.docIdOf("./docs/a.md"), "docs/a.md");
  assert.equal(p.docIdOf("docs\\a.md"), "docs/a.md");
});
