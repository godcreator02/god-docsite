/**
 * 树的最小型别与遍历。
 * mdx 格式在 mdast 上干活，但只碰几个字段——与其把整套 mdast 型别拖进来，不如在这儿写清楚用到的那几样：
 * 规则作者看得懂，换宿主时也知道要提供什么。
 */

export interface JsxAttribute {
  type: string;
  name?: string;
  value?: string | { value?: string } | null;
}

/** 树上的一个节点。字段都是可选的——不同类型的节点带的东西不一样 */
export interface TreeNode {
  type: string;
  value?: string;
  lang?: string | null;
  meta?: string | null;
  depth?: number;
  name?: string | null;
  attributes?: JsxAttribute[];
  children?: TreeNode[];
  data?: Record<string, unknown>;
  /** 解析器给的位置；offset 是在原文里的字符下标，按原文渲染时靠它切 */
  position?: { start: { line: number; column: number; offset?: number }; end?: { line: number; column: number; offset?: number } };
}

/**
 * 深度优先走一遍树。访问函数交回数字表示「这个位置的节点换过了，从这个下标接着走」，
 * 别的一律继续往下走——applyListing 换节点靠的就是这条。
 */
export function walk(root: TreeNode, fn: (node: TreeNode, index: number | null, parent: TreeNode | null) => number | void): void {
  const step = (node: TreeNode, index: number | null, parent: TreeNode | null): number | void => {
    const jumped = fn(node, index, parent);
    if (typeof jumped === "number") return jumped;
    const kids = node.children;
    if (kids === undefined) return undefined;
    for (let i = 0; i < kids.length; ) {
      const next = step(kids[i]!, i, node);
      i = typeof next === "number" ? next : i + 1;
    }
    return undefined;
  };
  step(root, null, null);
}

/** 节点在文档里的行号（1 起）；没有位置信息的当第一行 */
export const lineOf = (node: TreeNode): number => node.position?.start.line ?? 1;
