/**
 * @god-live-doc/format-fumadocs——fumadocs 口味的 mdx，一个格式一个包。
 *   ① 识别与写回：parse / write，核心会调的；名册检查 lintComponents 给 check 用
 *   ② 渲染：renderAi 让 fumadocs 的 loader 出 md；人看那份就是站本身，命令行没有 human 渲染
 *   ③ 接线：livedocMdxOptions 挂进 source.config，livedocMarkdownOptions 挂进集合的 postprocess
 * 名册：这里只有机制（stamp）和默认表（defaultRoster），项目在 livedoc.config.mjs 里声明自己的表。
 * 换宿主就是换这一个包：核心、project、cli、别的格式包一个不碰 fumadocs。
 *
 * 侧出口两个，不混进主出口（一个含 React，一个是样式）：
 *   @god-live-doc/format-fumadocs/pre         状态点的 pre 组件（"use client"）
 *   @god-live-doc/format-fumadocs/light.css   状态点的样式
 */
import type { Fill, Reference, Target } from "@god-live-doc/core";
import { recognize } from "./recognize.ts";
import { parseTree } from "./render.ts";
import { defaultRoster, unknownComponents } from "./roster.ts";
import type { Roster } from "./roster.ts";

export const name = "fumadocs-mdx";
export const claims = (doc: string): boolean => doc.endsWith(".mdx");

/** 记号：mdx 的花括号注释表达式 */
export const marker = ({ file, a, b }: Target): string => `{/* ref file="${file}" lines="${a}-${b}" */}`;

export function parse(text: string): Reference[] {
  return recognize(parseTree(text));
}

/** mdx 没有展示区，写回只重写标记行（行号可能跟过 diff）。草稿记号也在这一下换成正式记号 */
export function write(text: string, fills: Fill[]): string {
  const lines = text.split("\n");
  for (const { reference } of fills) lines[reference.at] = marker(reference.target);
  return lines.join("\n");
}

/** 名册检查：文档里出现、表里没有的组件。命令行 check 调它，不用等构建才发现 */
export function lintComponents(text: string, roster: unknown = defaultRoster): Array<{ name: string; line: number }> {
  return unknownComponents(parseTree(text), (roster ?? defaultRoster) as Roster);
}

export { parseTree, renderAi } from "./render.ts";
export { remarkLivedoc } from "./remark-plugin.ts";
export type { PluginFile, RemarkOptions } from "./remark-plugin.ts";
export { draftIn, markerOf, recognize } from "./recognize.ts";
export { applyListing } from "./transform.ts";
export { codeNode, diffBlock, DOT_COLOR, LABEL, langOf, metaOf, nodeFor, NO_OLD, OLD_TITLE, UNCONFIRMED_SUFFIX } from "./blocks.ts";
export type { Dot, LivedocMark } from "./blocks.ts";
export { livedocMarkdownOptions } from "./markdown.ts";
export type { MarkdownOptions } from "./markdown.ts";
export { livedocMdxOptions, parseMetaString, remarkLivedocHost } from "./host.ts";
export { attr, childrenOf, defaultRoster, heading, paragraph, quote, stamp, text, textOf, unknownComponents } from "./roster.ts";
export type { Helpers, Roster, Rule } from "./roster.ts";
export { lineOf, walk } from "./tree.ts";
export type { TreeNode } from "./tree.ts";
