/**
 * 识别器：在 mdast 上认引用标记。只有一份，parse 和 remark 插件都用它。
 * 正式记号是 mdxFlowExpression 节点，值形如 `/* ref file="…" lines="…" hash="…" blob="…" *\/`（载荷是记号语法
 * （`../marker/`）定的那一截，动作词 ref / tree / has，确认过的带着记录属性）。
 * 围栏里的同样文字是 code 节点、行内的是 mdxTextExpression，都认不出来——这就是走语法树的理由。
 * 草稿记号是单独成段的一行普通文字，记号语法定的写法。
 */
import type { Reference, Target } from "@godcreator/docfirst-pin";
import { draftOf, parseFormal } from "../marker/index.ts";
import { lineOf, walk } from "./tree.ts";
import type { TreeNode } from "./tree.ts";

const MARKER = /^\/\*\s*((?:ref|tree|has)\b.*?)\s*\*\/$/s;

/** 这个节点是不是正式记号；是就交载荷（`ref file="…" lines="…"` 那一截），不是给 null */
export function markerOf(node: TreeNode): string | null {
  if (node.type !== "mdxFlowExpression") return null;
  const m = MARKER.exec((node.value ?? "").trim());
  return m === null ? null : m[1]!;
}

/** 这个段落是不是草稿记号（单独成段的一行普通文字）；是就交目标，不是给 null */
export function draftIn(node: TreeNode): Target | null {
  const kids = node.children ?? [];
  const first = kids[0];
  if (node.type !== "paragraph" || kids.length !== 1 || first === undefined || first.type !== "text") return null;
  return draftOf(first.value ?? "", `第 ${lineOf(node)} 行`);
}

/** 正式记号和草稿记号都认 */
export function recognize(tree: TreeNode): Reference[] {
  const refs: Reference[] = [];
  walk(tree, (node) => {
    const line = lineOf(node);
    const payload = markerOf(node);
    if (payload !== null) {
      const formal = parseFormal(payload, `第 ${line} 行`);
      if (formal !== null) refs.push({ ...formal, at: line - 1, extra: { draft: false } });
    }
    const draft = draftIn(node);
    if (draft !== null) refs.push({ target: draft, record: null, at: line - 1, extra: { draft: true } });
  });
  return refs;
}
