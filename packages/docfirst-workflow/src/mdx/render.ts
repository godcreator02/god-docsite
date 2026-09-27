/**
 * 解析与 AI 渲染。
 *   parseTree   自己调用 remark 解析出语法树：parse / write / 名册检查 / 按原文渲染都用它，不碰 fumadocs
 *   renderAi    生成正本按原文渲染成 md：只动 frontmatter 与记号，别的文字逐字节照抄
 *
 * 站上各页的机读版不走这儿，走 fumadocs 的管线（`@godcreator/docfirst-fumadocs` 的 docfirstMarkdownOptions）。
 */
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkFrontmatter from "remark-frontmatter";
import remarkMdx from "remark-mdx";
import { fileOf, REASON_TEXT } from "@godcreator/code-pin";
import type { Item, Listing } from "../reference/index.ts";
import { langOf } from "./lang.ts";
import { markerOf } from "./recognize.ts";
import { lineOf, walk } from "./tree.ts";
import type { TreeNode } from "./tree.ts";

/** 按原文渲染拒绝渲染（缺失的引用、组件、mdx 表达式）时抛它；摆放按这一类把它报成红，别的错照原样抛 */
export class RenderRefusal extends Error {
  override name = "RenderRefusal";
}

/** 认名字不认 instanceof：渲染与摆放可能各从一份产物加载，拿到的不是同一个类 */
export const isRenderRefusal = (err: unknown): err is RenderRefusal => err instanceof Error && err.name === "RenderRefusal";

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

/** 换成代码块：续行带上记号那一行行首的前缀（列表缩进、引用块的 `> `），块才留在原来的容器里 */
function replaceWithBlock(text: string, start: number, end: number, block: string[]): Edit {
  const prefix = text.slice(lineStartOf(text, start), start);
  return { start, end, text: block.map((line, i) => (i === 0 ? line : `${prefix}${line}`)).join("\n") };
}

const offsetsOf = (node: TreeNode): [number, number] => [node.position!.start.offset!, node.position!.end!.offset!];

/** 缺失的引用一定带着钉码核心给的缺失理由；没带、或带着没有中文说法的 changed，都直接报错 */
function missingReasonOf(item: Item): string {
  if (item.reason === undefined || item.reason === "changed") throw new Error(`缺失的引用没带缺失理由（${item.reason}）`);
  return REASON_TEXT[item.reason];
}

/** 一个节点要做的改写；渲染不了的记进 refusals。交回 true 表示这个节点已经处理完，不往里走 */
function editFor(text: string, node: TreeNode, listing: Listing, edits: Edit[], refusals: string[]): boolean {
  const line = lineOf(node);
  if (node.type === "yaml") {
    const [start, end] = offsetsOf(node);
    edits.push({ start, end: text.startsWith("\n", end) ? end + 1 : end, text: "" });
    return true;
  }
  if (markerOf(node) !== null) {
    const item = listing.items.find((it) => it.reference.at === line - 1);
    if (item === undefined) throw new Error(`第 ${line} 行是引用记号，但清单里没有它`);
    const [start, end] = offsetsOf(node);
    if (item.reference.record === null) refusals.push(`第 ${line} 行的引用还没确认，先 docfirst confirm`);
    else if (item.status === "missing") refusals.push(`第 ${line} 行的引用缺失（${missingReasonOf(item)}），先修好`);
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
 * 生成正本按原文渲染：去掉 frontmatter；每个记号换成一个代码块；
 * 其余文字逐字节不动。换行先统一成 LF。
 * 未确认的引用、缺失的引用、JSX 组件、别的 mdx 表达式都渲染不了，一次列全、抛 RenderRefusal。
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
