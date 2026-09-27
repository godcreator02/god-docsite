// 用法：node --experimental-import-meta-resolve probes/2609272230_component-md/component-md.mjs（在仓根运行）
// 按本站 docfirst.config.mjs 的名册（外加一条示例 Divider: "drop"），把几段 mdx 走一遍打标与序列化，打印出来的 md。
// 走的是站构建时同一套：remark-mdx 解析、stamp 打标、fumadocs 的 remarkLLMs 带 docfirst 的序列化回调。
// 这几个依赖装在 packages/docfirst-workflow 下，按那个目录解析。
const workflowDir = new URL("../../packages/docfirst-workflow/package.json", import.meta.url).href;
const load = (specifier) => import(import.meta.resolve(specifier, workflowDir));
const { unified } = await load("unified");
const { default: remarkParse } = await load("remark-parse");
const { default: remarkMdx } = await load("remark-mdx");
const { remarkLLMs } = await load("fumadocs-core/mdx-plugins/remark-llms");
const { stamp } = await load("@godcreator/docfirst-workflow/mdx");
const { docfirstMarkdownOptions } = await load("@godcreator/docfirst-workflow/fumadocs");
const { default: config } = await import("../../docs-site/docfirst.config.mjs");

const roster = { ...config.components, Divider: "drop" };
const cases = {
  "术语标注": '下面讲到「<Term def="x">钉码编排</Term>」的地方',
  "Tabs 分行写": '<Tabs>\n  <Tab title="命令行">\n    运行 `docfirst check`。\n  </Tab>\n  <Tab title="站构建">\n    next build 时同样核对。\n  </Tab>\n</Tabs>',
  "Tab 写成一行": '<Tabs>\n  <Tab title="命令行">运行 `docfirst check`。</Tab>\n</Tabs>',
  "Note 分行与一行": '<Note>\n  名字为空时照样拼出来。\n</Note>\n\n改完先 <Note>保存</Note> 再运行。',
  "Note 一行占一段": '<Note>名字为空时照样拼出来。</Note>',
  "drop": '第一段。\n\n<Divider />\n\n第二段。',
};

for (const [name, source] of Object.entries(cases)) {
  const processor = unified().use(remarkParse).use(remarkMdx);
  const tree = processor.parse(source);
  stamp(tree, roster);
  const file = { data: {} };
  remarkLLMs.call(processor, { ...docfirstMarkdownOptions(), _data: true })(tree, file, () => {});
  console.log(`== ${name}\n${file.data.markdown}`);
}
