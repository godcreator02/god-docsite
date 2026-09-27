/**
 * 术语自动标注的 remark 插件：把正文里命中的词包成 `<Term def href>词</Term>`。
 *
 * 匹配规矩在 `glossary.ts`（纯逻辑），这里只管「在树上哪些地方能标、换节点怎么换」。
 *
 * **定义直接写成属性**，不在浏览器里查表：组件因此是纯展示的，不用带一份词表进客户端包，
 * 静态导出也照跑。一篇只标第一次，重复的量很小。
 *
 * **挂在 docfirst 自己那个插件之前**（`docfirstMdxOptions` 里就是这个顺序）：那时树上还只有
 * 作者写的散文，引用投影的代码块、目录树都还没注入，标注碰不到它们。
 *
 * 源文件里没有 `<Term>`，它是站构建时加进树的，所以命令行的 check 与 `render` 看到的是原文。
 * 但站构建时同一棵树接着会经过 docfirst 插件的 `stamp`，名册外的组件在那里直接报错：
 * 开了术语标注的站，名册里必须有 `Term` 的规则（本站写成 `Term: "children"`）。
 */
import { buildTermIndex, findTerms } from "./glossary.ts";
import type { TermEntry, TermIndex } from "./glossary.ts";
import type { PluginFile } from "./remark-plugin.ts";
import { walk } from "@godcreator/docfirst-workflow/mdx";
import type { TreeNode } from "@godcreator/docfirst-workflow/mdx";

/** 插件拿到的那份文件信息。跟 remark-plugin.ts 的同形，只用得上路径 */
export interface GlossaryOptions {
  /** 术语表。正本是站里那份数据文件，这儿只收结果 */
  terms: readonly TermEntry[];
  /** 组件名，默认 `Term`。站的 React 表与压平表里都得有这个名字 */
  componentName?: string;
  /** 哪些文件不标。术语页自己一定要跳过，否则自我循环 */
  skipFile?: (path: string) => boolean;
  /** 每篇只标第一次，默认开。关掉就是每处都标——正文会变成一片虚线，别关 */
  oncePerPage?: boolean;
}

/**
 * 这些地方不标，一条都不能少：
 *   code / inlineCode  代码里换词就是改代码。docfirst 的投影块全是代码，这条顺带把它们保住了
 *   heading            标题里换节点会动到 TOC 与锚点
 *   link / 定义        链接里再套一层交互是坏体验；链接定义换了就指不到地方
 *   yaml / toml        frontmatter 不是正文
 *   mdx 表达式与 import 那不是文字，是代码
 */
const SKIP_TYPES = new Set([
  "code",
  "inlineCode",
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

/** 造一个 `<Term>` 行内组件节点 */
function termNode(name: string, text: string, entry: TermEntry): TreeNode {
  const attributes: TreeNode["attributes"] = [{ type: "mdxJsxAttribute", name: "def", value: entry.def }];
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
function splitText(value: string, index: TermIndex, name: string, taken?: Set<string>): TreeNode[] | null {
  const spans = findTerms(value, index, taken);
  if (spans.length === 0) return null;
  const out: TreeNode[] = [];
  let at = 0;
  for (const span of spans) {
    if (span.start > at) out.push({ type: "text", value: value.slice(at, span.start) });
    out.push(termNode(name, value.slice(span.start, span.end), span.entry));
    at = span.end;
  }
  if (at < value.length) out.push({ type: "text", value: value.slice(at) });
  return out;
}

/**
 * 建插件。索引只建一次——站构建时 loader 并发调，每篇重建一遍词表纯属浪费。
 */
export function remarkGlossary(options: GlossaryOptions): (tree: TreeNode, file: PluginFile) => void {
  const index = buildTermIndex(options.terms);
  const name = options.componentName ?? "Term";
  const once = options.oncePerPage !== false;

  return (tree, file) => {
    if (options.skipFile?.(file.path ?? "") === true) return;
    const taken = once ? new Set<string>() : undefined;

    walk(tree, (node, i, parent) => {
      // 机制注入的节点（目录树那棵 Files）整块跳过，不往里走
      if (node.data?.docfirstAi !== undefined) return i === null ? undefined : i + 1;
      if (SKIP_TYPES.has(node.type)) return i === null ? undefined : i + 1;
      // 已经是术语组件了，不往里嵌第二层
      if ((node.type === "mdxJsxTextElement" || node.type === "mdxJsxFlowElement") && node.name === name) {
        return i === null ? undefined : i + 1;
      }
      if (node.type !== "text" || parent === null || i === null) return;

      const pieces = splitText(node.value ?? "", index, name, taken);
      if (pieces === null) return;
      parent.children?.splice(i, 1, ...pieces);
      // 换进去的片段自己不用再走一遍：术语组件不嵌套，文字片段也不会再命中
      return i + pieces.length;
    });
  };
}
