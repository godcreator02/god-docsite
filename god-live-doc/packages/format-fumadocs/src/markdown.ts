/**
 * 给 fumadocs 的 processed markdown 用的选项：只有一个 stringify 回调。
 * fumadocs 序列化每个节点前先问它；看到我们打的标就按标出，没标的交回 undefined 让它照默认走。
 * 这里不 import fumadocs：回调拿到的 state 就是 mdast-util-to-markdown 的状态机，
 * 替换节点交给它序列化，跟文档里别的内容是同一套规矩（转义、围栏、列表符号）。
 */
import type { LivedocMark } from "./blocks.ts";
import type { TreeNode } from "./tree.ts";

/** mdast-util-to-markdown 的状态机，用到的就这三样 */
interface State {
  containerFlow(node: TreeNode, info: unknown): string;
  containerPhrasing(node: TreeNode, info: unknown): string;
  handle(node: TreeNode, parent: TreeNode | undefined, state: State, info: unknown): string;
}

export function livedocMarkdownOptions(): {
  stringify(node: TreeNode, parent: TreeNode | undefined, state: State, info: unknown): string | undefined;
} {
  return {
    stringify(node, parent, state, info) {
      const replacement = node.data?.livedocAi;
      if (Array.isArray(replacement)) {
        const box: TreeNode = { type: "root", children: replacement as TreeNode[] };
        return node.type === "mdxJsxTextElement" ? state.containerPhrasing(box, info) : state.containerFlow(box, info);
      }
      const mark = node.data?.livedoc as LivedocMark | undefined;
      if (mark !== undefined && node.type === "code") {
        // AI 那份里不要 meta、也不要 diff 标记：一行来源注释加一块干净的代码
        const plain: TreeNode = { type: "code", lang: node.lang ?? "", value: mark.value };
        return `<!-- 来源 ${mark.source} · ${mark.label} -->\n\n${state.handle(plain, parent, state, info)}`;
      }
      return undefined;
    },
  };
}
