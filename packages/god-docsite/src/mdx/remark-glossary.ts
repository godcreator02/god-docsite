/**
 * 术语自动标注的 remark 插件：把正文里命中的词包成 `<Term def href>词</Term>`。
 * 只在构建期由 Node 走（站点的集合配置引入 `./compile` 出口），浏览器端的组件表只用 `Term` 组件本身。
 *
 * 匹配规矩在 `glossary.ts`（纯逻辑），这里只管「在树上哪些地方能标、换节点怎么换」。
 *
 * **定义直接写成属性**，不在浏览器里查表：组件因此是纯展示的，不用带一份词表进客户端包，
 * 静态导出也照跑。一篇只标第一次，重复的量很小。
 *
 * **必须排在 remark-math 之后**：那时 `$…$`、`$$…$$` 已经是 math/inlineMath 节点、不再是文字，
 * 标注才碰不到公式（集合的 remarkPlugins 里两个插件的先后就是这个约束）。
 *
 * 源文件里没有 `<Term>`，它是站构建时加进树的。Markdown 导出（fumadocs-mdx 公开的
 * `getText('processed')`）怎么还原 `<Term>` 由导出时传的组件表决定，本库不另设还原协议。
 */
import type { Text } from "mdast";
import type { MdxJsxFlowElement, MdxJsxTextElement } from "mdast-util-mdx-jsx";
import type { Node, Parent } from "unist";
import { buildTermIndex, findTerms } from "../core/glossary.js";
import type { TermEntry, TermIndex } from "../core/glossary.js";

export interface GlossaryOptions {
  /** 术语表。正本是站里那份数据文件，这儿只收结果 */
  terms: readonly TermEntry[];
  /** 哪些文件不标：术语页自己要跳过（否则自我循环）；集合分发由集合配置负责，不用这个 */
  skipFile?: (path: string) => boolean;
}

/** 标出来的组件名。站点的 React 组件表里要有这个名字 */
const TERM_COMPONENT_NAME = "Term";

/**
 * 这些地方不标，一条都不能少：
 *   code / inlineCode  代码里换词就是改代码
 *   math / inlineMath  公式（remark-math 转换后的节点），换了就打坏公式
 *   heading            标题里换节点会动到 TOC 与锚点
 *   link / 定义        链接里再套一层交互是坏体验；链接定义换了就指不到地方
 *   yaml / toml        frontmatter 不是正文
 *   mdx 表达式与 import 那不是文字，是代码
 */
const SKIP_TYPES = new Set([
  "code",
  "inlineCode",
  "inlineMath",
  "math",
  "heading",
  "link",
  "linkReference",
  "definition",
  "footnoteDefinition",
  "yaml",
  "toml",
  "mdxjsEsm",
  "mdxFlowExpression",
  "mdxTextExpression",
]);

type Visitor = (node: Node, index: number | null, parent: Parent | null) => number | void;

/**
 * 先序遍历。visitor 交回数字时，从那个下标继续——等于跳过刚换进去的节点（术语组件不嵌套、文字片段不会再命中）；
 * 交回 undefined 就往里走。根节点以 index=null、parent=null 过一遍。
 */
function walkTree(root: Node, visitor: Visitor): void {
  const visitChildren = (parent: Parent): void => {
    let i = 0;
    while (i < parent.children.length) {
      const child = parent.children[i]!;
      const resume = visitor(child, i, parent);
      if (resume === undefined) {
        if ("children" in child) visitChildren(child as Parent);
        i += 1;
      } else {
        i = resume;
      }
    }
  };
  if (visitor(root, null, null) === undefined && "children" in root) visitChildren(root as Parent);
}

/** 造一个 `<Term>` 行内组件节点 */
function termNode(name: string, text: string, entry: TermEntry): MdxJsxTextElement {
  const attributes: MdxJsxTextElement["attributes"] = [{ type: "mdxJsxAttribute", name: "def", value: entry.def }];
  if (entry.href !== undefined) attributes.push({ type: "mdxJsxAttribute", name: "href", value: entry.href });
  return {
    type: "mdxJsxTextElement",
    name,
    attributes,
    children: [{ type: "text", value: text }],
  };
}

/**
 * 一个文字节点 → 一串「原文片段 + 术语组件」。没命中就交回 null，让调用方原样留着。
 */
function splitText(value: string, index: TermIndex, name: string, taken: Set<string>): Array<Text | MdxJsxTextElement> | null {
  const spans = findTerms(value, index, taken);
  if (spans.length === 0) return null;
  const out: Array<Text | MdxJsxTextElement> = [];
  let at = 0;
  for (const span of spans) {
    if (span.start > at) out.push({ type: "text", value: value.slice(at, span.start) });
    out.push(termNode(name, value.slice(span.start, span.end), span.entry));
    at = span.end;
  }
  if (at < value.length) out.push({ type: "text", value: value.slice(at) });
  return out;
}

/** remark 插件拿到的文件：路径从 vfile 来，只用得到这一个字段 */
type PluginFile = { path?: string };

/**
 * 建插件（unified 插件形态：直接放集合 mdxOptions 的 remarkPlugins 数组里）。索引只建一次——
 * 站构建时 loader 并发调，每篇重建一遍词表纯属浪费。对同一棵树跑两遍也安全：已经是 `<Term>` 的节点跳过，不会嵌出第二层。
 */
export function remarkGlossary(options: GlossaryOptions): () => (tree: Node, file: PluginFile) => void {
  const index = buildTermIndex(options.terms);

  return () => (tree, file) => {
    if (file.path !== undefined && options.skipFile?.(file.path) === true) return;
    const taken = new Set<string>();

    walkTree(tree, (node, i, parent) => {
      if (SKIP_TYPES.has(node.type)) return i === null ? undefined : i + 1;
      // 已经是术语组件了，不往里嵌第二层
      const asMdx = node as Partial<MdxJsxFlowElement>;
      if ((node.type === "mdxJsxTextElement" || node.type === "mdxJsxFlowElement") && asMdx.name === TERM_COMPONENT_NAME) {
        return i === null ? undefined : i + 1;
      }
      if (node.type !== "text" || parent === null || i === null) return;

      const pieces = splitText((node as Text).value, index, TERM_COMPONENT_NAME, taken);
      if (pieces === null) return;
      parent.children.splice(i, 1, ...pieces);
      // 换进去的片段自己不用再走一遍：术语组件不嵌套，文字片段也不会再命中
      return i + pieces.length;
    });
  };
}
