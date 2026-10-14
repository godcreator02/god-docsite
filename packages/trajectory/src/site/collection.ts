/**
 * `@godcreator/trajectory/site/collection`：站点声明卡集合时用的 schema、mdx 选项与 remark 插件，只在构建期由 fumadocs-mdx 加载。
 */

export { cardEntryDataOf, cardMdxOptions, cardSchema } from "./card-collection.ts";
export type { CardEntryData, CardMdxOptions, CardSchemaContext } from "./card-collection.ts";
export { remarkTrajectoryLinks } from "./remark-trajectory-links.ts";
export type { Link, Paragraph, PhrasingContent, RemarkTrajectoryLinksOptions, Root, Text } from "./remark-trajectory-links.ts";
