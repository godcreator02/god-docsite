/**
 * 浏览器端也安全的那一半写作能力：纯展示组件，不依赖任何 Node 模块、不带词表。
 * 编译期的东西（术语 remark 插件）在 `./compile` 出口，只由站点的 source.config.ts 在构建期引入。
 */
export { Term } from "./term.js";
export type { TermProps } from "./term.js";
export { Tex } from "./tex.js";
export type { TexProps } from "./tex.js";
