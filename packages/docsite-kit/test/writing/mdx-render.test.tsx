/**
 * 真实 MDX 编译链上的证据：@mdx-js/mdx evaluate + React 渲染。
 * 「Term 进组件表能渲出来」「标注只包不改」在这一层核；
 * Markdown 输出不用手工序列化证明——那由 fixture 站的 getText('processed') 测试验真实公开输出。
 */
import { evaluate } from "@mdx-js/mdx";
import remarkMath from "remark-math";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { remarkGlossary } from "../../src/writing/glossary-remark.js";
import type { TermEntry } from "../../src/writing/glossary.js";
import { Term } from "../../src/writing/term.js";
import { Tex } from "../../src/writing/tex.js";

const terms: TermEntry[] = [
  { term: "命令总线", def: "组件间传命令的一条通道", href: "/docs/glossary-demo" },
  { term: "pane", def: "界面上的一个窗格" },
];

async function renderMdx(source: string): Promise<string> {
  const { default: Content } = await evaluate(source, {
    jsx,
    jsxs,
    Fragment,
    remarkPlugins: [remarkMath, remarkGlossary({ terms })],
  });
  return renderToStaticMarkup(<Content components={{ Term, Tex }} />);
}

describe("MDX 真渲染", () => {
  it("标注出的 <Term> 经组件表渲成点线词，定义与详解链接都在属性里", async () => {
    const html = await renderMdx("提到命令总线一次。");
    expect(html).toContain('class="docsite-term"');
    expect(html).toContain("组件间传命令的一条通道");
    expect(html).toContain('href="/docs/glossary-demo"');
    expect(html).toContain(">命令总线<");
  });

  it("一篇只标第一次，第二次出现是普通文字", async () => {
    const html = await renderMdx("pane 出现两次：pane。");
    expect(html.match(/class="docsite-term"/g)).toHaveLength(1);
  });

  it("公式、代码、链接里的词不标，公式照常交给 remark-math", async () => {
    const html = await renderMdx("$pane + x$、`pane`、[pane](/x)，正文 pane 标这一次。");
    expect(html.match(/class="docsite-term"/g)).toHaveLength(1);
  });

  it("Tex：行内与块级公式都渲出 KaTeX，写错的公式直接报错", async () => {
    const html = await renderMdx("<Tex>{String.raw`\\alpha`}</Tex>");
    expect(html).toContain("katex");
    const block = renderToStaticMarkup(<Tex block>{String.raw`\int_0^1 x^2\,dx`}</Tex>);
    expect(block).toContain("katex-display");
    expect(() => renderToStaticMarkup(<Tex>{String.raw`\frac{a`}</Tex>)).toThrow();
  });
});

describe("Term 的 id（React SSR 安全）", () => {
  it("同一页多个术语：定义框 id 互不重复，aria-describedby 各指向自己的定义框", async () => {
    const html = await renderMdx("命令总线与 pane 都出现。");
    const ids = [...html.matchAll(/class="docsite-term-pop" id="([^"]+)"/g)].map((m) => m[1]);
    const described = [...html.matchAll(/aria-describedby="([^"]+)"/g)].map((m) => m[1]);
    expect(new Set(ids).size).toBe(2);
    expect(described).toEqual(expect.arrayContaining(ids));
  });

  it("两次独立的服务端渲染互不影响（id 由 useId 生成，不靠模块级计数）", async () => {
    const first = await renderMdx("提到命令总线。");
    const second = await renderMdx("提到命令总线。");
    const idOf = (html: string) => html.match(/class="docsite-term-pop" id="([^"]+)"/)![1];
    expect(idOf(first)).toBe(idOf(second));
    expect(idOf(first)).toMatch(/^[:«»\$A-Za-z0-9_-]+$/); // useId 的输出形态，不是手拼的序号
  });
});
