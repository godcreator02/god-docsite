/**
 * 组件名册的机制。名册的内容不在这里：项目在 livedoc.config.mjs 里声明自己的表，
 * 这里只提供「按一张表打标」的能力、写规则用的几个帮手、一小组默认规则。
 *
 * 打标不动树：同一棵树还要出页面。每个组件节点挂上「AI 那份里它长什么样」，
 * 真正序列化是 fumadocs 的事（见 markdown.ts 的回调）。
 *
 * 规则三种写法：
 *   函数        (node, helpers) => 一个或一组普通 markdown 节点。纯函数：节点进节点出，不读文件
 *   "children"  只留子内容，去掉外壳
 *   "drop"      整个不进 AI 那份
 * 嵌套的组件不用规则操心：子节点还在树上，各自有各自的标。名册外的组件硬失败，报到行。
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
 * 组件的子内容，摆成规则能交回的形状。
 * 块级组件写在一行里时，子节点是行内内容（文字、行内组件），不能直接摆到块级位置：
 * 连续的行内节点归成一个段落，块级节点原样放行。行内组件的子内容原样交回。
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

/** 默认表：按语义命名的通用组件，规则只看子内容和属性，不知道它在哪个站上长什么样 */
export const defaultRoster: Roster = {
  // 块级 <Note> 变引用块；写在句子里的 <Note> 变一段行内文字，别把句子拆断
  Note: (node, h) => (h.inline ? h.text(`[note] ${h.textOf(node).trim()}`) : h.quote(`[note] ${h.textOf(node).trim()}`)),
  // fumadocs 的文件树：作者手写的压成一行一个名字，文件夹带尾斜杠、子项跟在后面。目录树引用注入的那棵不走这儿，标已经打好
  Files: "children",
  Folder: (node, h) => [h.paragraph(`${h.attr(node, "name") ?? ""}/`), ...h.children()],
  File: (node, h) => h.paragraph(h.attr(node, "name") ?? ""),
};

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
 * 给树上每个组件打标。挂两种标，都是 fumadocs 序列化时认的：
 *   data.livedocAi     一组替换节点，回调里用 fumadocs 的 state 序列化（嵌套组件顺着走）
 *   data._stringify    fumadocs 自家的标；{ text: "" } 表示整个不要
 * 已经带 livedocAi 的节点（目录树引用注入的 Files）跳过、不往里走。import 语句不用管：fumadocs 自己会把 mdxjsEsm 滤掉。
 */
export function stamp(tree: TreeNode, roster: Roster = defaultRoster): TreeNode {
  walk(tree, (node, index) => {
    // 机制注入的节点（目录树那棵 Files）标已经打好，不在名册里找它，也不往它里面走
    if (node.data?.livedocAi !== undefined) return index === null ? undefined : index + 1;
    if (!isComponent(node)) return;
    const rule = roster[node.name ?? ""];
    if (rule === undefined) throw new Error(`第 ${lineOf(node)} 行：名册外组件 <${node.name}>`);
    const nodes = apply(rule, node, roster);
    node.data ??= {};
    if (nodes.length === 0) node.data._stringify = { text: "" };
    else node.data.livedocAi = nodes;
  });
  return tree;
}

/** 名册检查：树里出现、表里没有的组件，给 check 用，不用等构建才发现 */
export function unknownComponents(tree: TreeNode, roster: Roster = defaultRoster): Array<{ name: string; line: number }> {
  const out: Array<{ name: string; line: number }> = [];
  walk(tree, (node) => {
    if (isComponent(node) && roster[node.name ?? ""] === undefined) out.push({ name: node.name ?? "", line: lineOf(node) });
  });
  return out;
}
