/**
 * `@godcreator/explainer`：讲解组件的机读文字规则与接缝图的定义。站点的组件名册（doc-export 生成机读版时用）在 Node 里加载它，
 * 所以这里不 import react，也不 import 任何运行时依赖。
 */

export type { Role, Tone } from "./colors.ts";
export { casesText, chaptersText, stepsText } from "./text.ts";
export { defineSeamGraph, seamGraphText } from "./seam-graph.ts";
export type { Seam, SeamCapability, SeamEntry, SeamGraph, SeamGraphInput, SeamInput, SeamModule } from "./seam-graph.ts";
