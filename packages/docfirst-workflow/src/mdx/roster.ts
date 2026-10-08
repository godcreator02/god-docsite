/**
 * 组件名册的机制。名册的内容不在这里：项目在 docfirst.config.mjs 里声明自己的表，
 * 这里只提供「按一张表给组件标上机读文字」的能力与写规则用的几个帮手。fumadocs 自带组件的规则
 * 在 `@godcreator/docfirst-workflow/fumadocs/roster`，项目展开它再加自己的。
 *
 * 同一张表有两处用：站上每页的机读版（stamp），与生成正本渲染成 md（machineNodesOf，见 render.ts）。
 * 给站标上机读文字时不改树：同一棵树还要生成页面。每个组件节点的 data 上写明「机读版里它是什么样」，
 * 真正序列化是 fumadocs 的事（见 `@godcreator/docfirst-workflow/fumadocs` 的 markdown.ts 回调）。
 *
 * 规则三种写法：
 *   函数        (node, helpers) => 一个或一组普通 markdown 节点。纯函数：节点进节点出，不读文件
 *   "children"  只留子内容，去掉外壳
 *   "drop"      整个不进机读版
 * 嵌套的组件不用规则处理：子节点还在树上，各自标上各自的机读文字。
 * 机读文字只给生成物：生成正本里的名册外组件由 check 与 render 报错；站构建时 stamp 不标它们，也不报错。
 *
 * 契约：函数规则只能通过 helpers 读节点（attr / textOf）、造节点（text / heading / paragraph / quote /
 * children），节点本身对规则是黑盒——不碰 node.type、node.children 这些字段。守住这条，同一张表换个
 * 宿主照样能用：宿主各自提供一套 helpers，造的是自己的节点。
 */
import { lineOf, walk } from "./tree.ts";
import type { TreeNode } from "./tree.ts";

export interface Helpers {
  roster: Roster;
  attr(node: TreeNode, name: string): string | undefined;
  textOf(node: TreeNode): string;
  text(value: string): TreeNode;
  heading(depth: number, value: string): TreeNode;
  paragraph(value: string): TreeNode;
  quote(value: string): TreeNode;
  /** 这处是不是写在句子里的行内组件 */
  inline: boolean;
  children(): TreeNode[];
}

export type Rule = "children" | "drop" | ((node: TreeNode, helpers: Helpers) => TreeNode | TreeNode[]);
export type Roster = Record<string, Rule>;

const isComponent = (n: TreeNode): boolean => n.type === "mdxJsxFlowElement" || n.type === "mdxJsxTextElement";

/** 组件里的纯文本（嵌套的一律拉平） */
export function textOf(node: TreeNode): string {
  if (node.type === "text") return node.value ?? "";
  if (node.type === "inlineCode") return `\`${node.value ?? ""}\``;
  return (node.children ?? []).map(textOf).join("");
}

/** 组件的某个属性值；表达式属性拿不到，给 undefined */
export function attr(node: TreeNode, name: string): string | undefined {
  const found = (node.attributes ?? []).find((x) => x.type === "mdxJsxAttribute" && x.name === name);
  if (found === undefined) return undefined;
  const value = found.value;
  if (typeof value === "string") return value;
  return value?.value;
}

export const text = (value: string): TreeNode => ({ type: "text", value });
export const heading = (depth: number, value: string): TreeNode => ({ type: "heading", depth, children: [text(value)] });
export const paragraph = (value: string): TreeNode => ({ type: "paragraph", children: [text(value)] });
export const quote = (value: string): TreeNode => ({ type: "blockquote", children: [paragraph(value)] });

const PHRASING = new Set([
  "text", "emphasis", "strong", "delete", "inlineCode", "link", "linkReference", "image", "imageReference",
  "break", "footnoteReference", "mdxTextExpression", "mdxJsxTextElement",
]);

/**
 * 组件的子内容，整理成规则能交回的形状。
 * 块级组件写在一行里时，子节点是行内内容（文字、行内组件），不能直接放到块级位置：
 * 连续的行内节点归成一个段落，块级节点原样保留。行内组件的子内容原样交回。
 */
export function childrenOf(node: TreeNode): TreeNode[] {
  const kids = node.children ?? [];
  if (node.type === "mdxJsxTextElement") return [...kids];
  const out: TreeNode[] = [];
  let run: TreeNode[] = [];
  const flush = (): void => {
    if (run.length > 0) out.push({ type: "paragraph", children: run });
    run = [];
  };
  for (const child of kids) {
    if (PHRASING.has(child.type)) run.push(child);
    else {
      flush();
      out.push(child);
    }
  }
  flush();
  return out;
}

function apply(rule: Rule, node: TreeNode, roster: Roster): TreeNode[] {
  if (rule === "drop") return [];
  if (rule === "children") return childrenOf(node);
  const helpers: Helpers = {
    roster,
    attr,
    textOf,
    text,
    heading,
    paragraph,
    quote,
    inline: node.type === "mdxJsxTextElement",
    children: () => childrenOf(node),
  };
  const out = rule(node, helpers);
  return Array.isArray(out) ? out : [out];
}

/**
 * 按名册给树上每个组件标上机读文字。写进节点 data 的有两种字段，都是 fumadocs 序列化时认的：
 *   data.docfirstAi     一组替换节点，回调里用 fumadocs 的 state 序列化（嵌套组件顺着走）
 *   data._stringify    fumadocs 自己定义的字段；{ text: "" } 表示整个不要
 * 已经带 docfirstAi 的节点（目录树引用注入的 Files）跳过、不往里走。名册外的组件不标：普通页面上的组件不要求机读规则。
 * import 语句不用管：fumadocs 自己会把 mdxjsEsm 滤掉。
 */
export function stamp(tree: TreeNode, roster: Roster): TreeNode {
  walk(tree, (node, index) => {
    // 换节点时生成的节点（目录树那棵 Files）已经带着机读文字，不在名册里找它，也不往它里面走
    if (node.data?.docfirstAi !== undefined) return index === null ? undefined : index + 1;
    if (!isComponent(node)) return;
    const rule = roster[node.name ?? ""];
    if (rule === undefined) return;
    const nodes = apply(rule, node, roster);
    node.data ??= {};
    if (nodes.length === 0) node.data._stringify = { text: "" };
    else node.data.docfirstAi = nodes;
  });
  return tree;
}

/**
 * 一个组件按名册换成的机读节点，规则交回的节点里再嵌套的组件也逐个换掉。生成正本渲染用：
 * 那边要的是一串能直接写成 markdown 的节点，不像 stamp 那样留给 fumadocs 顺着树序列化
 */
export function machineNodesOf(node: TreeNode, roster: Roster): TreeNode[] {
  const rule = roster[node.name ?? ""];
  if (rule === undefined) throw new Error(`第 ${lineOf(node)} 行：名册外组件 <${node.name}>`);
  return apply(rule, node, roster).flatMap((out) => withNestedReplaced(out, roster));
}

function withNestedReplaced(node: TreeNode, roster: Roster): TreeNode[] {
  if (isComponent(node)) return machineNodesOf(node, roster);
  if (node.children === undefined) return [node];
  return [{ ...node, children: node.children.flatMap((child) => withNestedReplaced(child, roster)) }];
}

/** 名册检查：树里出现、表里没有的组件，给 check 用，不用等构建才发现 */
export function unknownComponents(tree: TreeNode, roster: Roster): Array<{ name: string; line: number }> {
  const out: Array<{ name: string; line: number }> = [];
  walk(tree, (node) => {
    if (isComponent(node) && roster[node.name ?? ""] === undefined) out.push({ name: node.name ?? "", line: lineOf(node) });
  });
  return out;
}
