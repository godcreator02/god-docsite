import { describe, expect, it } from "vitest";
import remarkMath from "remark-math";
import remarkMdx from "remark-mdx";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { remarkGlossary } from "../src/glossary-remark.js";
import type { TermEntry } from "../src/glossary.js";

const terms: TermEntry[] = [
  { term: "命令总线", def: "组件间传命令的一条通道", href: "/docs/glossary-demo" },
  { term: "pane", def: "界面上的一个窗格" },
];

/** 把一段 MDX 解析成树；remarkMath 与标注的先后照站点 source.config.ts 的接法 */
function parse(source: string) {
  return unified().use(remarkParse).use(remarkMdx).use(remarkMath).parse(source);
}

type AnyNode = { type: string; name?: string; value?: string; attributes?: Array<{ name: string; value?: unknown }>; children?: AnyNode[] };

/** 树里全部 `<Term>` 节点 */
function termsOf(node: AnyNode): AnyNode[] {
  const own = node.type === "mdxJsxTextElement" && node.name === "Term" ? [node] : [];
  return [...own, ...(node.children ?? []).flatMap(termsOf)];
}

/** 树里全部文字（含 Term 里的），拼接起来——「标注只包不改」就体现在这串字不变 */
function allText(node: AnyNode): string {
  return (node.type === "text" ? node.value ?? "" : "") + (node.children ?? []).map(allText).join("");
}

const countTerms = (root: AnyNode): number => termsOf(root).length;
const markAll = remarkGlossary({ terms })();
/** 集合分发：只在集合 A（content/docs/）里标，集合 B 与别处不标——站点 skipFile 的样本形态 */
const onlyCollectionA = remarkGlossary({ terms, skipFile: (path) => !path.replaceAll("\\", "/").includes("/content/docs/") })();

const asTree = (tree: unknown) => tree as unknown as AnyNode;

describe("remarkGlossary 编译边界", () => {
  it("正文里的词包成 <Term def href>，原词一个字不差", () => {
    const tree = parse("正文里提到命令总线一次。");
    markAll(tree, { path: "content/docs/a.mdx" });
    const marked = termsOf(asTree(tree));
    expect(marked).toHaveLength(1);
    expect(marked[0]!.children).toEqual([{ type: "text", value: "命令总线" }]);
    expect(marked[0]!.attributes).toContainEqual({ type: "mdxJsxAttribute", name: "def", value: "组件间传命令的一条通道" });
    expect(marked[0]!.attributes).toContainEqual({ type: "mdxJsxAttribute", name: "href", value: "/docs/glossary-demo" });
    expect(allText(asTree(tree))).toBe("正文里提到命令总线一次。");
  });

  it.each([
    ["代码块", "```\n命令总线\n```\n"],
    ["行内代码", "`命令总线` 是一段代码"],
    ["标题", "## 命令总线\n\n正文。"],
    ["链接文字", "[命令总线](/x) 是个链接"],
    ["链接定义", "[a]: /命令总线\n\n正文。"],
    ["frontmatter", "---\ntitle: 命令总线\n---\n\n正文。"],
    ["MDX import", "import X from \"命令总线\"\n\n正文。"],
    ["MDX 表达式", "1 + {\"命令总线\"}"],
  ])("%s 里的词不标", (_label, source) => {
    const tree = parse(source);
    markAll(tree, { path: "content/docs/a.mdx" });
    expect(countTerms(asTree(tree))).toBe(0);
  });

  it("公式里的词不标——remarkMath 先跑，$…$ 已是 math 节点不是文字", () => {
    const tree = parse("公式 $命令总线 + x$ 与块级：\n\n$$\n命令总线\n$$");
    markAll(tree, { path: "content/docs/a.mdx" });
    expect(countTerms(asTree(tree))).toBe(0);
  });

  it("正文里的西文词要词边界，打不坏别的词", () => {
    const tree = parse("panes 很多，pane 一个。");
    markAll(tree, { path: "content/docs/a.mdx" });
    expect(countTerms(asTree(tree))).toBe(1);
  });

  it("skipFile 跳过的文件不标——集合 A 标、集合 B 不标（Windows 路径也认）", () => {
    const docsTree = parse("提到命令总线。");
    onlyCollectionA(docsTree, { path: "C:/site/content/docs/a.mdx" });
    expect(countTerms(asTree(docsTree))).toBe(1);
    const notesTree = parse("提到命令总线。");
    onlyCollectionA(notesTree, { path: "C:\\site\\content\\notes\\a.mdx" });
    expect(countTerms(asTree(notesTree))).toBe(0);
  });

  it("同一棵树跑两遍不嵌出第二层 Term", () => {
    const tree = parse("正文里的 pane。");
    markAll(tree, { path: "content/docs/a.mdx" });
    markAll(tree, { path: "content/docs/a.mdx" });
    const marked = termsOf(asTree(tree));
    expect(marked).toHaveLength(1);
    expect(marked[0]!.children!.every((child) => child.type === "text")).toBe(true);
  });

  it("手写的 <Term> 里的词不会被再包一层", () => {
    const tree = parse("手写的 <Term def=\"x\">pane</Term> 不嵌套。");
    markAll(tree, { path: "content/docs/a.mdx" });
    expect(countTerms(asTree(tree))).toBe(1);
  });

  it("没给路径的文件照样标（评论这类内存里的树）", () => {
    const tree = parse("pane");
    markAll(tree, {});
    expect(countTerms(asTree(tree))).toBe(1);
  });
});
