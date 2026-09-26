/**
 * 树上变换：把引用标记节点换成带状态点的代码块节点。
 * 同一棵树接着既出页面又出 md，所以状态走两个通道：
 *   meta 字符串    给页面：写成 fumadocs 认的那套——title 出标题栏（来源），lineNumbers 让行号跟源
 *                  文件对上，data-dot 只带状态点的颜色；点长什么样归站的 pre 组件
 *   data.docfirst   给 md 的序列化回调：md 里不要 meta，要一行来源注释
 */
import type { Listing } from "@godcreator/docfirst-workflow";
import { draftIn, lineOf, markerOf, walk } from "@godcreator/docfirst-workflow/mdx";
import type { TreeNode } from "@godcreator/docfirst-workflow/mdx";
import { nodeFor } from "./blocks.ts";

export function applyListing(tree: TreeNode, listing: Listing): TreeNode {
  // 正式记号是 mdxFlowExpression，草稿记号是单独成段的一行文字；站上两种都换成带状态点的代码块
  walk(tree, (node, index, parent) => {
    if (markerOf(node) === null && draftIn(node) === null) return;
    if (parent === undefined || parent === null || index === null) return;
    const at = lineOf(node) - 1;
    const item = listing.items.find((it) => it.reference.at === at);
    if (item === undefined) throw new Error(`第 ${at + 1} 行是引用标记，但清单里没有它`);
    parent.children!.splice(index, 1, nodeFor(item));
    return index + 1;
  });
  return tree;
}
