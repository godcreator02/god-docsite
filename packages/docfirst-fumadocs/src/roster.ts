/**
 * `@godcreator/docfirst-fumadocs/roster`：fumadocs 自带组件转成机读文本的规则。项目的
 * docfirst.config.mjs 展开它、再加站里自己的组件：`components: { ...fumadocsRoster, Tabs: … }`。
 *
 * **纯数据加纯函数，不许 import fumadocs / react**：命令行读 docfirst.config.mjs 时会加载这个模块，
 * 命令行跑在没有站依赖的环境里（git hook、CI）也得加载得动。规则只经 helpers 读节点、造节点，
 * 类型从 `@godcreator/docfirst-workflow/mdx` 拿，运行时一句 import 都没有。
 */
import type { Roster } from "@godcreator/docfirst-workflow/mdx";

/** 按语义命名的通用组件，规则只看子内容和属性，不知道它在哪个站上长什么样 */
export const fumadocsRoster: Roster = {
  // 块级 <Note> 变引用块；写在句子里的 <Note> 变一段行内文字，别把句子拆断
  Note: (node, h) => (h.inline ? h.text(`[note] ${h.textOf(node).trim()}`) : h.quote(`[note] ${h.textOf(node).trim()}`)),
  // fumadocs 的文件树：作者手写的压成一行一个名字，文件夹带尾斜杠、子项跟在后面。目录树引用注入的那棵不走这儿，标已经打好
  Files: "children",
  Folder: (node, h) => [h.paragraph(`${h.attr(node, "name") ?? ""}/`), ...h.children()],
  File: (node, h) => h.paragraph(h.attr(node, "name") ?? ""),
};
