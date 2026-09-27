/**
 * mdx 格式：`@godcreator/docfirst-workflow/mdx` 出口就是它。认领 .mdx 页面，钉码编排、命令行与站用的是同一份。
 *   ① 识别与写回：mdxFormat（claims / parse / write，实现 `../reference/` 的格式接口）与 marker，钉码编排会调的；
 *      名册检查 lintComponents 给 check 用
 *   ② 渲染：renderAi 把生成正本按原文渲染成 md（记号换成代码块）；人看那份就是站本身，命令行没有 human 渲染
 *   ③ 语法树零件：parseTree / recognize / stamp / walk 等，给 `@godcreator/docfirst-fumadocs` 在站构建时用
 * 名册：这里只有机制（stamp / unknownComponents）和写规则用的帮手，没有默认表——哪些组件、怎么压平
 * 由项目在 docfirst.config.mjs 里声明；fumadocs 自带那几个组件的规则在 `@godcreator/docfirst-fumadocs/roster`。
 *
 * 这个目录不认识钉码编排、project 与 cli，也不认识任何站的宿主（由 `tests/boundary.test.ts` 检查）。
 */
import type { MemoRecord, Target } from "@godcreator/code-pin";
import type { Format, Reference, WrittenReference } from "../reference/index.ts";
import { formalOf } from "../marker/index.ts";
import { braceComment, recognize } from "./recognize.ts";
import { parseTree } from "./render.ts";
import { unknownComponents } from "./roster.ts";
import type { Roster } from "./roster.ts";

/** 记号：mdx 的花括号注释表达式，载荷是记号写法（`../marker/`）定的那一截；还没确认的 record 是 null，不带记录属性 */
export const marker = (target: Target, record: MemoRecord | null): string => braceComment(formalOf(target, record));

/** 认出全部记号，记号上的记录属性一并读出（还没确认的是 null） */
export function parse(text: string): Reference[] {
  return recognize(parseTree(text));
}

/** 写回只重写记号那一行（行号与记录可能都换了），写上记录；行尾的 \r 留着 */
export function write(text: string, references: WrittenReference[]): string {
  const lines = text.split("\n");
  for (const { target, record, at } of references) lines[at] = marker(target, record) + (lines[at]!.endsWith("\r") ? "\r" : "");
  return lines.join("\n");
}

/** mdx 格式：认领全部 .mdx；哪些 .mdx 进现状区由项目装配按分区挑 */
export const mdxFormat: Format = { name: "mdx 格式", claims: (file) => file.endsWith(".mdx"), parse, write };

/** 名册检查：文档里出现、表里没有的组件。命令行 check 调它，不用等构建才发现；项目没声明名册就按空表查 */
export function lintComponents(text: string, roster: Roster = {}): Array<{ name: string; line: number }> {
  return unknownComponents(parseTree(text), roster);
}

export { isRenderRefusal, parseTree, RenderRefusal, renderAi } from "./render.ts";
export { markerOf, recognize } from "./recognize.ts";
export { attr, childrenOf, heading, paragraph, quote, stamp, text, textOf, unknownComponents } from "./roster.ts";
export type { Helpers, Roster, Rule } from "./roster.ts";
export { lineOf, walk } from "./tree.ts";
export type { JsxAttribute, TreeNode } from "./tree.ts";
export { langOf } from "./lang.ts";
