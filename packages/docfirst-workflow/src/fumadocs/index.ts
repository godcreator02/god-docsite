/**
 * `@godcreator/docfirst-workflow/fumadocs`：把 docfirst 接到 fumadocs 站上。这个出口就是站的 `src/lib/source.ts` 要的那些：
 *   现状集合：docfirstMdxOptions 经 applyMdxPreset 放进 mdxOptions（remark 链末尾认引用、换状态点代码块、按名册打标），
 *            docfirstMarkdownOptions 放进 postprocess（站上各页的机读版）
 *   轨迹卡集合：cardSchema 当 frontmatter schema，remarkTrajectoryLinks 改写正文里的卡链接
 *   术语标注：docfirstMdxOptions({ root, glossary }) 给了词表才开；匹配逻辑在 glossary.ts（纯函数），改语法树在 glossary-plugin.ts
 *
 * 认记号、打标记这些格式的事不在这儿：它们在 `@godcreator/docfirst-workflow/mdx`，命令行与站用同一份；
 * 这个目录只管 fumadocs 那一侧——代码块长什么样、meta 白名单、组件、样式。它只按包名用本包的 `.`、`./mdx`、`./cards`，
 * 不用相对路径进别的目录，站构建时加载的产物才不会带上命令行代码。
 *
 * 另开的出口，不混进这个出口（含 React 的、样式、要给命令行加载的）：
 *   ./fumadocs/roster      fumadocs 自带组件的名册规则，docfirst.config.mjs 展开它（纯数据，不 import 宿主）
 *   ./fumadocs/pre         状态点的 pre 组件（"use client"）
 *   ./fumadocs/term        术语组件（服务端组件，没有 JS）
 *   ./fumadocs/trajectory  星轨盘：loadTrajectory 读卡目录，转出客户端组件 StarDisk
 *   ./fumadocs/light.css   状态点的样式；./fumadocs/term.css 术语标注的样式；./fumadocs/trajectory.css 星轨盘的样式
 */
export { remarkDocfirst } from "./remark-plugin.ts";
export type { PluginFile, RemarkOptions } from "./remark-plugin.ts";
export { applyListing } from "./transform.ts";
export {
  codeNode,
  diffBlock,
  DOT_COLOR,
  filesOf,
  LABEL,
  metaOf,
  NO_DIR,
  NO_OLD,
  nodeFor,
  OLD_TITLE,
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
export type { DocfirstMdxOptions } from "./host.ts";
export { buildTermIndex, findTerms } from "./glossary.ts";
export type { TermEntry, TermIndex, TermSpan } from "./glossary.ts";
export { remarkGlossary } from "./glossary-plugin.ts";
export type { GlossaryOptions } from "./glossary-plugin.ts";
export { cardSchema, remarkTrajectoryLinks } from "./card-collection.ts";
export type { CardFrontmatter, Link, Paragraph, PhrasingContent, RemarkTrajectoryLinksOptions, Root, Text } from "./card-collection.ts";
