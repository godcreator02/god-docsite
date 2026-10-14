/**
 * fumadocs 自带组件在生成物里写成什么：可选的现成名册，使用方决定要不要并进自己的名册。
 * 纯数据加纯函数，只经 helpers 读节点、造节点，不 import fumadocs 与 react：只用命令行的环境（git hook、CI）也加载得动。
 */
import type { Roster } from "./roster.ts";

export const fumadocsRoster: Roster = {
  // 块级 <Note> 变引用块；写在句子里的 <Note> 变一段行内文字，不把句子拆断
  Note: (node, h) => (h.inline ? h.text(`[note] ${h.textOf(node).trim()}`) : h.quote(`[note] ${h.textOf(node).trim()}`)),
  // 文件树：一行一个名字，文件夹带尾斜杠，子项跟在后面
  Files: "children",
  Folder: (node, h) => [h.paragraph(`${h.attr(node, "name") ?? ""}/`), ...h.children()],
  File: (node, h) => h.paragraph(h.attr(node, "name") ?? ""),
};
