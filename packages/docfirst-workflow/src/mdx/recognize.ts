/**
 * 识别器：在 mdast 上认引用标记。只有一份，parse 和 remark 插件都用它。
 * 记号是 mdxFlowExpression 节点，值形如 `/* ref file="…" lines="…" hash="…" blob="…" *\/`（载荷是记号写法
 * （`../marker/`）定的那一截，动作词 ref / tree / has，确认过的带着记录属性，还没确认的没有）。
 * 围栏里的同样文字是 code 节点、行内的是 mdxTextExpression，都认不出来——这就是走语法树的理由。
 * 段落里以 `@@docfirst` 开头的一行是已经删掉的草稿写法，报错。
 */
import type { Reference } from "../reference/index.ts";
import { isRemovedDraftLine, markerErrors, parseFormal, removedDraftError } from "../marker/index.ts";
import { lineOf, walk } from "./tree.ts";
import type { TreeNode } from "./tree.ts";

/** mdx 的记号外壳：单独一行的花括号注释 */
export const braceComment = (payload: string): string => `{/* ${payload} */}`;

const COMMENT = /^\/\*(.*?)\*\/$/s;

/** 花括号注释里那一截；不是花括号注释给 null */
function commentOf(node: TreeNode): string | null {
  if (node.type !== "mdxFlowExpression") return null;
  const m = COMMENT.exec((node.value ?? "").trim());
  return m === null ? null : m[1]!;
}

/** 这个节点是不是记号；是就交载荷（`ref file="…" lines="…"` 那一截），普通注释和别的节点给 null */
export function markerOf(node: TreeNode): string | null {
  const payload = commentOf(node);
  if (payload === null) return null;
  return parseFormal(payload, `第 ${lineOf(node)} 行`) === null ? null : payload.trim();
}

/** 段落里的文字节点有没有以 @@docfirst 开头的一行；有就报错到那一行。节点的第一截只有是段落开头时才算一行的开头 */
function assertNoRemovedDraft(node: TreeNode, index: number | null, parent: TreeNode | null): void {
  if (node.type !== "text" || parent?.type !== "paragraph") return;
  const lines = (node.value ?? "").split("\n");
  lines.forEach((line, i) => {
    if (i === 0 && index !== 0) return;
    if (isRemovedDraftLine(line)) throw removedDraftError(`第 ${lineOf(node) + i} 行`, braceComment);
  });
}

/** 认出全部记号；写坏的记号与草稿写法一次列全再报错 */
export function recognize(tree: TreeNode): Reference[] {
  const refs: Reference[] = [];
  const errors = markerErrors();
  walk(tree, (node, index, parent) => {
    errors.attempt(() => assertNoRemovedDraft(node, index, parent));
    const payload = commentOf(node);
    if (payload === null) return;
    const line = lineOf(node);
    const parsed = errors.attempt(() => parseFormal(payload, `第 ${line} 行`));
    if (parsed !== null) refs.push({ ...parsed, at: line - 1 });
  });
  errors.throwIfAny();
  return refs;
}
