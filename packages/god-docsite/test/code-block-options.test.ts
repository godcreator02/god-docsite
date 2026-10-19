/**
 * 代码块默认带行号：走 fumadocs 真实的代码高亮（rehypeCode），看 <pre> 上 fumadocs CodeBlock 读的两个属性。
 */
import { evaluate } from "@mdx-js/mdx";
import { rehypeCode } from "fumadocs-core/mdx-plugins/rehype-code";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { siteRehypeCodeOptions } from "../src/mdx/code-block-options.js";

async function preOf(markdown: string): Promise<string> {
  const { default: Content } = await evaluate(markdown, { jsx, jsxs, Fragment, rehypePlugins: [[rehypeCode, siteRehypeCodeOptions]] });
  const html = renderToStaticMarkup(jsx(Content, {}));
  const pre = /<pre[^>]*>/.exec(html);
  if (pre === null) throw new Error(`渲出的页面里没有 <pre>：${html}`);
  return pre[0];
}

describe("代码块的行号", () => {
  it("什么都没写：带行号，从 1 起", async () => {
    const pre = await preOf("```ts\nconst a = 1\n```\n");
    expect(pre).toContain('data-line-numbers="true"');
    expect(pre).not.toContain("data-line-numbers-start");
  });

  it("没写语言、text 输出、一行的块也都带", async () => {
    expect(await preOf("```\nplain\n```\n")).toContain('data-line-numbers="true"');
    expect(await preOf("```text\nexit 0\n```\n")).toContain('data-line-numbers="true"');
  });

  it("lineNumbers=N：从 N 起编号", async () => {
    const pre = await preOf("```c lineNumbers=295\nint x;\n```\n");
    expect(pre).toContain('data-line-numbers="true"');
    expect(pre).toContain('data-line-numbers-start="295"');
  });

  it("noLineNumbers：不带行号，这个词也不留在别的属性里", async () => {
    const pre = await preOf('```ts title="a.ts" noLineNumbers\nconst a = 1\n```\n');
    expect(pre).not.toContain("data-line-numbers");
    expect(pre).not.toContain("noLineNumbers");
    expect(pre).toContain('title="a.ts"');
  });

  it("fumadocs 自己的标记照旧：noCopy 关掉复制", async () => {
    const pre = await preOf("```ts noCopy\nconst a = 1\n```\n");
    expect(pre).toContain('allowCopy="false"');
    expect(pre).toContain('data-line-numbers="true"');
  });
});
