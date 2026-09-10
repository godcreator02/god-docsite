/**
 * Tabs 在 AI 那份里怎么压平：站上是标签页，md 里是一串三级标题。
 * 规则是纯函数：拿组件的语法树节点，交回普通 markdown 节点。嵌套的子组件不用管，它们各有各的规则。
 * 这个文件不 import React，docfirst.config.mjs 引它，命令行也能跑。
 */

/** 外壳只留子内容，每个 Tab 自己出标题 */
export const Tabs = "children";

/** 标题来自 title 属性，内容就是子节点 */
export function Tab(node, { attr, heading, children }) {
  return [heading(3, attr(node, "title") ?? "标签"), ...children()];
}
