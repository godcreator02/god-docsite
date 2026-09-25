/**
 * 解析与 AI 渲染。
 *   parseTree   自己起 remark 认树：parse / write / 名册检查 / 按原文渲染都用它，不碰 fumadocs
 *   renderAi    生成正本按原文渲染成 md：只动 frontmatter 与记号，别的文字逐字节照抄
 *
 * 站上各页的机读版不走这儿，走 fumadocs 的管线（`@godcreator/docfirst-fumadocs` 的 docfirstMarkdownOptions）。
 */
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkFrontmatter from "remark-frontmatter";
import remarkMdx from "remark-mdx";
import { fileOf } from "@godcreator/docfirst-pin";
import type { Item, Listing } from "@godcreator/docfirst-pin";
import { RenderRefusal } from "../format/index.ts";
import { langOf } from "./lang.ts";
import { draftIn, markerOf } from "./recognize.ts";
import { lineOf, walk } from "./tree.ts";
import type { TreeNode } from "./tree.ts";

export function parseTree(text: string): TreeNode {
  return unified().use(remarkParse).use(remarkFrontmatter).use(remarkMdx).parse(text) as unknown as TreeNode;
}

/** 原文里的一处改写：把 [start, end) 换成 text */
interface Edit {
  start: number;
  end: number;
  text: string;
}

/** 能包住这段内容的围栏：比内容里最长的一串反引号多一个，至少三个 */
function fenceFor(lines: string[]): string {
  const longest = Math.max(0, ...lines.map((line) => Math.max(0, ...[...line.matchAll(/`+/g)].map((m) => m[0].length))));
  return "`".repeat(Math.max(3, longest + 1));
}

/** 一处引用换成的代码块：info 串是语言加 `title="路径:起-止"`（目录树是 `目录/`），内容是清单里今天的那几行 */
function blockOf(item: Item): string[] {
  const target = item.reference.target;
  const body = item.current ?? [];
  const file = fileOf(target);
  const info =
    target.kind === "tree"
      ? `text title="${target.dir}/${target.glob !== undefined ? ` ${target.glob}` : ""}"`
      : `${langOf(file!) || "text"} title="${file}:${item.lines[0]}-${item.lines[1]}"`;
  const fence = fenceFor(body);
  return [`${fence}${info}`, ...body, fence];
}

/** 这个节点所在那一行的行首下标 */
const lineStartOf = (text: string, offset: number): number => text.lastIndexOf("\n", offset - 1) + 1;

/** 整行去掉：连同行尾换行；前后都是空行时再吃掉一个空行，别留下两个空行 */
function dropLine(text: string, start: number, end: number): Edit {
  const from = lineStartOf(text, start);
  const newline = text.indexOf("\n", end);
  let to = newline === -1 ? text.length : newline + 1;
  if (text.startsWith("\n", to) && (from === 0 || text.slice(0, from).endsWith("\n\n"))) to += 1;
  return { start: from, end: to, text: "" };
}

/** 换成代码块：续行带上记号那一行行首的前缀（列表缩进、引用块的 `> `），块才留在原来的容器里 */
function replaceWithBlock(text: string, start: number, end: number, block: string[]): Edit {
  const prefix = text.slice(lineStartOf(text, start), start);
  return { start, end, text: block.map((line, i) => (i === 0 ? line : `${prefix}${line}`)).join("\n") };
}

const offsetsOf = (node: TreeNode): [number, number] => [node.position!.start.offset!, node.position!.end!.offset!];

/** 一个节点要做的改写；渲染不了的记进 refusals。交回 true 表示这个节点已经处理完，不往里走 */
function editFor(text: string, node: TreeNode, listing: Listing, edits: Edit[], refusals: string[]): boolean {
  const line = lineOf(node);
  if (node.type === "yaml") {
    const [start, end] = offsetsOf(node);
    edits.push({ start, end: text.startsWith("\n", end) ? end + 1 : end, text: "" });
    return true;
  }
  if (draftIn(node) !== null) {
    refusals.push(`第 ${line} 行是草稿记号，先 docfirst confirm`);
    return true;
  }
  if (markerOf(node) !== null) {
    const item = listing.items.find((it) => it.reference.at === line - 1);
    if (item === undefined) throw new Error(`第 ${line} 行是引用记号，但清单里没有它`);
    const [start, end] = offsetsOf(node);
    const kind = item.reference.target.kind;
    if (kind === "exists" || kind === "has") edits.push(dropLine(text, start, end));
    else if (item.status === "missing") refusals.push(`第 ${line} 行的引用缺失（${item.reason ?? "指向空气"}），先修好`);
    else edits.push(replaceWithBlock(text, start, end, blockOf(item)));
    return true;
  }
  if (node.type === "mdxFlowExpression" || node.type === "mdxTextExpression") {
    refusals.push(`第 ${line} 行有 mdx 表达式 {${(node.value ?? "").trim()}}，生成正本只写 markdown`);
    return true;
  }
  if (node.type === "mdxJsxFlowElement" || node.type === "mdxJsxTextElement") {
    refusals.push(`第 ${line} 行有组件 <${node.name ?? ""}>，生成正本只写 markdown`);
    return true;
  }
  if (node.type === "mdxjsEsm") {
    refusals.push(`第 ${line} 行有 import / export，生成正本只写 markdown`);
    return true;
  }
  return false;
}

/**
 * 生成正本按原文渲染：去掉 frontmatter；每个正式记号换成一个代码块（存在性与名字没有内容，整行去掉）；
 * 其余文字逐字节不动。换行先统一成 LF。
 * 草稿记号、缺失的引用、JSX 组件、别的 mdx 表达式都渲染不了，一次列全、抛 RenderRefusal。
 */
export function renderAi(source: string, listing: Listing): string {
  const text = source.replace(/\r\n/g, "\n");
  const edits: Edit[] = [];
  const refusals: string[] = [];
  walk(parseTree(text), (node, index) => {
    if (!editFor(text, node, listing, edits, refusals)) return undefined;
    return index === null ? undefined : index + 1;
  });
  if (refusals.length > 0) throw new RenderRefusal(refusals.join("；"));
  let out = text;
  for (const edit of edits.sort((a, b) => b.start - a.start)) out = out.slice(0, edit.start) + edit.text + out.slice(edit.end);
  return out;
}
