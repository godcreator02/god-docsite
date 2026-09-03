/**
 * 给 fumadocs 的 processed markdown 用的选项：只有一个 stringify 回调。
 * fumadocs 序列化每个节点前先问它；看到我们打的标就按标出，没标的交回 undefined 让它照默认走。
 * 这里不 import fumadocs：回调拿到的 state 就是 mdast-util-to-markdown 的状态机，
 * 替换节点交给它序列化，跟文档里别的内容是同一套规矩（转义、围栏、列表符号）。
 *
 * 回调的形参声明成 unknown：fumadocs 那头要求的是完整 mdast 型别，这个包只认树上的几个字段，
 * 形参放宽才对得上它的签名——真正的形状在函数体里就地收窄。
 */
import type { LivedocMark } from "./blocks.ts";
import type { TreeNode } from "./tree.ts";

/** mdast-util-to-markdown 的状态机，用到的就这三样 */
interface State {
  containerFlow(node: TreeNode, info: unknown): string;
  containerPhrasing(node: TreeNode, info: unknown): string;
  handle(node: TreeNode, parent: TreeNode | undefined, state: State, info: unknown): string;
}

export interface MarkdownOptions {
  stringify(node: unknown, parent: unknown, state: unknown, info: unknown): string | undefined;
}

export function livedocMarkdownOptions(): MarkdownOptions {
  return {
    stringify(rawNode, rawParent, rawState, info) {
      const node = rawNode as TreeNode;
      const state = rawState as State;
      const replacement = node.data?.livedocAi;
      const mark = node.data?.livedoc as LivedocMark | undefined;
      if (Array.isArray(replacement)) {
        const box: TreeNode = { type: "root", children: replacement as TreeNode[] };
        const body = node.type === "mdxJsxTextElement" ? state.containerPhrasing(box, info) : state.containerFlow(box, info);
        // 引用注入的组件（目录树那棵 Files）还带着来源，AI 那份前面加一行
        return mark === undefined ? body : `<!-- 来源 ${mark.source} · ${mark.label} -->\n\n${body}`;
      }
      if (mark !== undefined && node.type === "code") {
        // 芯片（存在性、名字）没有内容，AI 那份里只留一行来源注释
        if (mark.chip === true) return `<!-- 来源 ${mark.source} · ${mark.label} -->`;
        // AI 那份里不要 meta、也不要 diff 标记：一行来源注释加一块干净的代码
        const plain: TreeNode = { type: "code", lang: node.lang ?? "", value: mark.value };
        return `<!-- 来源 ${mark.source} · ${mark.label} -->\n\n${state.handle(plain, rawParent as TreeNode | undefined, state, info)}`;
      }
      return undefined;
    },
  };
}
