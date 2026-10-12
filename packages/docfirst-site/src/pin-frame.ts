/**
 * 钉码投影出的代码块外面包一层 `<div className="docfirst-pin" data-dot="…">`，状态点由样式画在代码块右上角。
 * 颜色在 docfirst-workflow 写的 meta `data-dot="…"` 里；fumadocs 的代码块只把白名单里的 meta 放进属性，读不到它，所以挪到外层。
 * 目录树引用投影成的 `<Files>` 自己带 data-dot，不用包。
 */
import type { TreeNode } from "@godcreator/docfirst-workflow/mdx";

const DOT_IN_META = /\bdata-dot="([^"]+)"/;

function pinFrameOf(code: TreeNode): TreeNode {
  const dot = DOT_IN_META.exec(code.meta ?? "")?.[1];
  if (dot === undefined) throw new Error(`钉码投影出的代码块 meta 里没有 data-dot：${code.meta ?? "（没有 meta）"}`);
  return {
    type: "mdxJsxFlowElement",
    name: "div",
    attributes: [
      { type: "mdxJsxAttribute", name: "className", value: "docfirst-pin" },
      { type: "mdxJsxAttribute", name: "data-dot", value: dot },
    ],
    children: [code],
  };
}

const isPinnedCode = (node: TreeNode): boolean => node.type === "code" && node.data?.["docfirst"] !== undefined;

export function framePinnedCode(tree: TreeNode): void {
  const children = tree.children;
  if (children === undefined) return;
  children.forEach((child, index) => {
    if (isPinnedCode(child)) children[index] = pinFrameOf(child);
    else framePinnedCode(child);
  });
}
