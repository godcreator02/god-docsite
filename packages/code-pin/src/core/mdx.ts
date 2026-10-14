/**
 * mdx 里的钉码标记：单独一行的花括号注释 `{/* ref file="…" lines="…" *\/}`，在语法树上是 mdxFlowExpression。
 * 围栏里同样的文字是 code 节点、行内的是 mdxTextExpression，都不算标记——这是走语法树、不按行匹配的理由。
 *
 * 解析认 remark-math 的公式（`$…$`、`$$…$$`）：公式里的花括号不是 mdx 表达式，跟接了公式的站读法一致。
 */
import type { Root, RootContent } from "mdast";
import type { MdxFlowExpression } from "mdast-util-mdx";
import remarkFrontmatter from "remark-frontmatter";
import remarkMath from "remark-math";
import remarkMdx from "remark-mdx";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { visit } from "unist-util-visit";
import type { DocPin, PinFormat } from "./doc-pins.ts";
import { formalOf, markerErrors, parseFormal } from "./marker.ts";
import type { MemoRecord, Target } from "./types.ts";

/** mdx 的标记外壳：单独一行的花括号注释 */
export const braceComment = (payload: string): string => `{/* ${payload} */}`;

/** mdx 里的一处标记：还没确认的 record 是 null，不带记录属性 */
export const mdxMarker = (target: Target, record: MemoRecord | null): string => braceComment(formalOf(target, record));

export function parseMdx(text: string): Root {
  return unified().use(remarkParse).use(remarkFrontmatter).use(remarkMath).use(remarkMdx).parse(text);
}

const COMMENT = /^\/\*(.*?)\*\/$/s;

/** 花括号注释里那一截；不是注释给 null */
function commentOf(node: MdxFlowExpression): string | null {
  return COMMENT.exec(node.value.trim())?.[1] ?? null;
}

/** 节点在文档里的行号（1 起）。解析器给的节点都带位置；没有位置的标记写不回去，也说不清在哪 */
export function lineOf(node: RootContent): number {
  const line = node.position?.start.line;
  if (line === undefined) throw new Error(`语法树上的 ${node.type} 节点没有位置信息，认不出它在文档第几行`);
  return line;
}

/** 语法树上的一处标记：认出的钉，与它在树上的位置 */
export interface MarkerPlace {
  pin: DocPin;
  node: MdxFlowExpression;
  parent: { children: RootContent[] };
  index: number;
}

/** 认出树上全部标记；写坏的一次列全再报错 */
export function findMarkers(tree: Root): MarkerPlace[] {
  const places: MarkerPlace[] = [];
  const errors = markerErrors();
  visit(tree, "mdxFlowExpression", (node, index, parent) => {
    const payload = commentOf(node);
    if (payload === null) return;
    const line = lineOf(node);
    const parsed = errors.attempt(() => parseFormal(payload, `第 ${line} 行`));
    if (parsed !== null) places.push({ pin: { ...parsed, line }, node, parent: parent!, index: index! });
  });
  errors.throwIfAny();
  return places;
}

/** 写回只重写标记那一行（行号与记录可能都换了），写上记录；行尾的 \r 留着 */
function write(text: string, written: Array<{ line: number; target: Target; record: MemoRecord }>): string {
  const lines = text.split("\n");
  for (const { line, target, record } of written) lines[line - 1] = mdxMarker(target, record) + (lines[line - 1]!.endsWith("\r") ? "\r" : "");
  return lines.join("\n");
}

/** mdx 格式：认领全部 .mdx */
export const mdxFormat: PinFormat = {
  name: "mdx 格式",
  claims: (file) => file.endsWith(".mdx"),
  parse: (text) => findMarkers(parseMdx(text)).map((place) => place.pin),
  write,
};
