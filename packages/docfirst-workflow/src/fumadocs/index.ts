/**
 * 格式实现加站接线：fumadocs 口味的 mdx。**包外的出口 `@godcreator/docfirst-workflow/fumadocs` 就是它**
 * ——站的 `source.config.ts` import 的正是这一份。
 *   ① 识别与写回：parse / write，判定层会调的；名册检查 lintComponents 给 check 用
 *   ② 渲染：renderAi 让 fumadocs 的 loader 出 md；人看那份就是站本身，命令行没有 human 渲染
 *   ③ 接线：docfirstMdxOptions 挂进 source.config，docfirstMarkdownOptions 挂进集合的 postprocess
 * 名册：这里只有机制（stamp）和默认表（defaultRoster），项目在 docfirst.config.mjs 里声明自己的表。
 *
 * **fumadocs 这个名字只出现在这一层**：engine / host / site / cli 一个不碰它。`Format` 这条
 * 接缝留着不是为了「将来换个宿主」——它分离的是「怎么认记号」与「怎么判新鲜」两种变化原因，
 * 而且真有两个适配器：生产是这一份，测试是 `tests/fake-format.ts`。
 *
 * 术语标注是可选的一层：`docfirstMdxOptions({ root, glossary })` 给了词表才开，
 * 匹配逻辑在 glossary.ts（纯的）、挂树在 glossary-plugin.ts、画成什么样在侧出口 /fumadocs/term。
 *
 * 侧出口四个，不混进主出口（含 React 的和样式）：
 *   @godcreator/docfirst-workflow/fumadocs/pre         状态点的 pre 组件（"use client"）
 *   @godcreator/docfirst-workflow/fumadocs/light.css   状态点的样式
 *   @godcreator/docfirst-workflow/fumadocs/term        术语组件（服务端组件，没有 JS）
 *   @godcreator/docfirst-workflow/fumadocs/term.css    术语标注的样式
 */
import { formalOf } from "../engine/index.ts";
import type { MemoRecord, Reference, Target } from "../engine/index.ts";
import { recognize } from "./recognize.ts";
import { parseTree } from "./render.ts";
import { defaultRoster, unknownComponents } from "./roster.ts";
import type { Roster } from "./roster.ts";

export const name = "fumadocs-mdx";
export const claims = (doc: string): boolean => doc.endsWith(".mdx");

/** 记号：mdx 的花括号注释表达式，载荷是记号语法（engine/marker.ts）定的那一截，确认过的带着记录属性 */
export const marker = (target: Target, record: MemoRecord | null): string => `{/* ${formalOf(target, record)} */}`;

export function parse(text: string): Reference[] {
  return recognize(parseTree(text));
}

/** 写回只重写记号那一行（行号与记录可能都换了）。草稿记号也在这一下换成正式记号；行尾的 \r 留着 */
export function write(text: string, references: Reference[]): string {
  const lines = text.split("\n");
  for (const { target, record, at } of references) lines[at] = marker(target, record) + (lines[at]!.endsWith("\r") ? "\r" : "");
  return lines.join("\n");
}

/** 名册检查：文档里出现、表里没有的组件。命令行 check 调它，不用等构建才发现 */
export function lintComponents(text: string, roster: unknown = defaultRoster): Array<{ name: string; line: number }> {
  return unknownComponents(parseTree(text), (roster ?? defaultRoster) as Roster);
}

export { collectionOf, parseTree, renderAi } from "./render.ts";
export { remarkDocfirst } from "./remark-plugin.ts";
export type { PluginFile, RemarkOptions } from "./remark-plugin.ts";
export { draftIn, markerOf, recognize } from "./recognize.ts";
export { applyListing } from "./transform.ts";
export {
  chipNode,
  codeNode,
  diffBlock,
  DOT_COLOR,
  filesOf,
  LABEL,
  langOf,
  metaOf,
  NO_DIR,
  NO_OLD,
  nodeFor,
  OLD_TITLE,
  TREE_SUFFIX,
  treeNode,
  UNCONFIRMED_SUFFIX,
  UNLOCATED_NOTE,
  UNLOCATED_SUFFIX,
  whereOf,
} from "./blocks.ts";
export type { Dot, DocfirstMark } from "./blocks.ts";
export { docfirstMarkdownOptions } from "./markdown.ts";
export type { MarkdownOptions } from "./markdown.ts";
export { docfirstMdxOptions, parseMetaString, remarkDocfirstHost } from "./host.ts";
export { buildTermIndex, findTerms } from "./glossary.ts";
export type { TermEntry, TermIndex, TermSpan } from "./glossary.ts";
export { remarkGlossary } from "./glossary-plugin.ts";
export type { GlossaryFile, GlossaryOptions } from "./glossary-plugin.ts";
export { attr, childrenOf, defaultRoster, heading, paragraph, quote, stamp, text, textOf, unknownComponents } from "./roster.ts";
export type { Helpers, Roster, Rule } from "./roster.ts";
export { lineOf, walk } from "./tree.ts";
export type { TreeNode } from "./tree.ts";
