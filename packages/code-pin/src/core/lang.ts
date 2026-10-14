const LANG: Record<string, string> = {
  ts: "ts", tsx: "tsx", js: "js", jsx: "jsx", mjs: "js", cjs: "js", py: "python", rs: "rust", go: "go",
  json: "json", css: "css", html: "html", md: "md", mdx: "mdx", yml: "yaml", yaml: "yaml", sh: "bash", ps1: "powershell",
};

/** 被钉文件的后缀 → 代码块的语言名；站上的代码块与生成物里的代码块用同一张表。认不出的后缀给空串 */
export const langOf = (file: string): string => LANG[file.split(".").pop() ?? ""] ?? "";
