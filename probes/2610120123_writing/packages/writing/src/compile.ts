/**
 * 构建期那一半写作能力：术语标注的 remark 插件与匹配逻辑。
 * 只在 Node 里走（fumadocs-mdx 编译每一份 MDX 时由集合的 mdxOptions 接进来），
 * 浏览器端的组件表不引入这个出口，插件与词表都进不了客户端包。
 *
 * 站点接法（集合各自的配置，fumadocs-mdx 的 Config API）：source.config.ts 里命名导出集合，
 * 集合的 docs.mdxOptions 用 applyMdxPreset 配 remarkPlugins: [remarkMath, remarkGlossary({ terms })]。
 * remarkMath 必须在前——先让公式变成 math 节点，标注才打不坏它。
 */
export { remarkGlossary } from "./glossary-remark.js";
export type { GlossaryOptions } from "./glossary-remark.js";
export { buildTermIndex, findTerms } from "./glossary.js";
export type { TermEntry, TermIndex, TermSpan } from "./glossary.js";
