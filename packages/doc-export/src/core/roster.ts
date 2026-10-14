/**
 * 组件名册：正本里的组件在生成物里写成什么。名册的内容由使用方给（docfirst 的项目在配置里声明），
 * 这里只有「按一张表把组件换成机读节点」的机制与写规则用的几个帮手。
 *
 * 规则三种写法：
 *   函数        (node, helpers) => 一个或一组普通 mdast 节点。纯函数：节点进节点出，不读文件
 *   "children"  只留子内容，去掉外壳
 *   "drop"      整个不进生成物
 *
 * 契约：函数规则只经 helpers 读节点（attr / textOf）、造节点（text / heading / paragraph / quote / children），
 * 节点本身对规则是黑盒——不碰 node.type、node.children 这些字段。
 */
import { lineOf } from "@godcreator/code-pin";
import type { BlockContent, Paragraph, PhrasingContent, Root, RootContent, Text } from "mdast";
import type { MdxJsxFlowElement, MdxJsxTextElement } from "mdast-util-mdx";
import { visit } from "unist-util-visit";

export type Component = MdxJsxFlowElement | MdxJsxTextElement;

export interface Helpers {
  roster: Roster;
  attr(node: Component, name: string): string | undefined;
  textOf(node: RootContent): string;
  text(value: string): Text;
  heading(depth: 1 | 2 | 3 | 4 | 5 | 6, value: string): RootContent;
  paragraph(value: string): Paragraph;
  quote(value: string): RootContent;
  /** 这处是不是写在句子里的行内组件 */
  inline: boolean;
  children(): RootContent[];
}

export type Rule = "children" | "drop" | ((node: Component, helpers: Helpers) => RootContent | RootContent[]);
export type Roster = Record<string, Rule>;

export const isComponent = (node: { type: string }): node is Component => node.type === "mdxJsxFlowElement" || node.type === "mdxJsxTextElement";

/** 节点里的纯文本，嵌套的一律拉平；行内代码带着反引号 */
export function textOf(node: RootContent): string {
  if (node.type === "text") return node.value;
  if (node.type === "inlineCode") return `\`${node.value}\``;
  return "children" in node ? (node.children as RootContent[]).map(textOf).join("") : "";
}

/** 组件的某个属性值；表达式属性拿不到，给 undefined */
export function attr(node: Component, name: string): string | undefined {
  for (const each of node.attributes) {
    if (each.type !== "mdxJsxAttribute" || each.name !== name) continue;
    if (typeof each.value === "string") return each.value;
    return each.value?.value;
  }
  return undefined;
}

export const text = (value: string): Text => ({ type: "text", value });
export const heading = (depth: 1 | 2 | 3 | 4 | 5 | 6, value: string): RootContent => ({ type: "heading", depth, children: [text(value)] });
export const paragraph = (value: string): Paragraph => ({ type: "paragraph", children: [text(value)] });
export const quote = (value: string): RootContent => ({ type: "blockquote", children: [paragraph(value)] });

const PHRASING = new Set([
  "text", "emphasis", "strong", "delete", "inlineCode", "link", "linkReference", "image", "imageReference",
  "break", "footnoteReference", "inlineMath", "mdxTextExpression", "mdxJsxTextElement",
]);

/**
 * 组件的子内容，整理成规则能交回的形状。块级组件写在一行里时，子节点是行内内容，不能直接放到块级位置：
 * 连续的行内节点归成一个段落，块级节点原样保留。行内组件的子内容原样交回。
 */
export function childrenOf(node: Component): RootContent[] {
  if (node.type === "mdxJsxTextElement") return [...node.children];
  const out: RootContent[] = [];
  let run: PhrasingContent[] = [];
  const flush = (): void => {
    if (run.length > 0) out.push({ type: "paragraph", children: run });
    run = [];
  };
  for (const child of node.children as RootContent[]) {
    if (PHRASING.has(child.type)) run.push(child as PhrasingContent);
    else {
      flush();
      out.push(child as BlockContent);
    }
  }
  flush();
  return out;
}

/** 一个名册里的组件按它的规则换成的节点；规则交回的节点里还嵌着组件的，由序列化时各自再换 */
export function machineNodesOf(node: Component, roster: Roster): RootContent[] {
  const rule = roster[node.name ?? ""];
  if (rule === undefined) throw new Error(`名册外组件 <${node.name}>`);
  if (rule === "drop") return [];
  if (rule === "children") return childrenOf(node);
  const helpers: Helpers = { roster, attr, textOf, text, heading, paragraph, quote, inline: node.type === "mdxJsxTextElement", children: () => childrenOf(node) };
  const out = rule(node, helpers);
  return Array.isArray(out) ? out : [out];
}

/** 名册检查：树里出现、表里没有的组件与它的行号 */
export function unknownComponents(tree: Root, roster: Roster): Array<{ name: string; line: number }> {
  const out: Array<{ name: string; line: number }> = [];
  visit(tree, (node) => {
    if (isComponent(node) && roster[node.name ?? ""] === undefined) out.push({ name: node.name ?? "", line: lineOf(node) });
  });
  return out;
}
