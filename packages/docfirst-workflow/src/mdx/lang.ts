/**
 * 被引文件的后缀 → 代码块的语言名。按原文渲染（render.ts）与站上的代码块节点
 * （`@godcreator/docfirst-fumadocs` 的 blocks）用同一张表，两边的代码块才标同一种语言。
 */

const LANG: Record<string, string> = {
  ts: "ts", tsx: "tsx", js: "js", jsx: "jsx", mjs: "js", cjs: "js", py: "python", rs: "rust", go: "go",
  json: "json", css: "css", html: "html", md: "md", mdx: "mdx", yml: "yaml", yaml: "yaml", sh: "bash", ps1: "powershell",
};

/** 认不出的后缀给空串，调用方自己决定退成什么 */
export const langOf = (file: string): string => LANG[file.split(".").pop() ?? ""] ?? "";
