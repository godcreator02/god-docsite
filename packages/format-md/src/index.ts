/**
 * @godcreator02/live-doc-format-md——md 格式包。
 * 识别走 remark：引用标记是一个 html 节点，代码围栏里的同样文字是 code 节点，天然分得开。
 * 记号是一条 html 注释，载荷是核心定的那一截：`<!-- ref file="…" lines="a-b" -->`、`<!-- tree dir="…" depth="1" -->`、
 * `<!-- exists path="…" -->`、`<!-- absent path="…" -->`、`<!-- has file="…" text="…" -->`。
 * 行段、整文件、目录树有展示区（标记下面那段围栏 + `<!-- /ref -->` / `<!-- /tree -->` 收尾）：它是 confirm 时投影
 * 进文档的派生缓存，记忆在记录簿里。存在性、名字没有展示区，只有记号一行。
 */
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkFrontmatter from "remark-frontmatter";
import { visit } from "unist-util-visit";
import { draftOf, formalOf, parseFormal, wordOf } from "@godcreator02/live-doc-core";
import type { Fill, Reference, Target } from "@godcreator02/live-doc-core";
import type { Root } from "mdast";

const OPEN = /^<!--\s*((?:ref|tree|exists|absent|has)\b.*?)\s*-->\s*$/;
const CLOSE = /^<!--\s*\/(?:ref|tree)\s*-->\s*$/;
const FENCE = /^```(\w*)\s*$/;

/** 围栏标签按扩展名认；不认识的留空 */
const LANG: Record<string, string> = {
  ts: "ts", tsx: "tsx", js: "js", jsx: "jsx", mjs: "js", cjs: "js", py: "python", rs: "rust", go: "go",
  json: "json", css: "css", html: "html", md: "md", mdx: "mdx", yml: "yaml", yaml: "yaml", sh: "bash", ps1: "powershell",
};
export const langOf = (file: string): string => LANG[file.split(".").pop() ?? ""] ?? "";

export const name = "md";
export const claims = (doc: string): boolean => doc.endsWith(".md");

/** 记号：一条 html 注释。写回时重写标记行也从这儿出 */
export const marker = (target: Target): string => `<!-- ${formalOf(target)} -->`;

/** 有没有展示区：行段、整文件、目录树有；存在性、名字没有 */
const hasRegion = (target: Target): boolean => target.kind === "span" || target.kind === "file" || target.kind === "tree";
const fenceLang = (target: Target): string => (target.kind === "tree" ? "text" : target.kind === "has" || target.kind === "exists" ? "" : langOf(target.file));

export function parseTree(text: string): Root {
  return unified().use(remarkParse).use(remarkFrontmatter).parse(text) as Root;
}

export function parse(text: string): Reference[] {
  const lines = text.split("\n");
  const refs: Reference[] = [];
  visit(parseTree(text), (node) => {
    const at = (node.position?.start.line ?? 1) - 1;
    if (node.type === "html") {
      const m = OPEN.exec(node.value.trim());
      if (m === null) return;
      const target = parseFormal(m[1]!, `第 ${at + 1} 行`);
      if (target === null) return;
      // 量展示区：标记后可夹一个空行，然后 ```lang … ```，然后尾标记；三样齐全才算有
      let close = -1;
      if (hasRegion(target)) {
        let j = at + 1;
        if (j < lines.length && lines[j]!.trim() === "") j += 1;
        if (j < lines.length && FENCE.test(lines[j]!)) {
          j += 1;
          while (j < lines.length && !FENCE.test(lines[j]!)) j += 1;
          j += 1;
          if (j < lines.length && CLOSE.test(lines[j]!)) close = j;
        }
      }
      refs.push({ target, at, extra: { close, draft: false } });
      return;
    }
    // 草稿记号：单独成段的一行普通文字。围栏里的是 code 节点，认不到——跟正式记号一个道理
    if (node.type === "paragraph") {
      const first = node.children[0];
      const only = node.children.length === 1 && first !== undefined && first.type === "text" ? first.value : "";
      const target = draftOf(only, `第 ${at + 1} 行`);
      if (target !== null) refs.push({ target, at, extra: { close: -1, draft: true } });
    }
  });
  return refs.sort((x, y) => x.at - y.at);
}

/** 确认时写回：有展示区整段覆写，没有就当场长出来；没有展示区的种类只重写记号行。从下往上改，行号不串 */
export function write(text: string, fills: Fill[]): string {
  const lines = text.split("\n");
  const ordered = [...fills].sort((x, y) => y.reference.at - x.reference.at);
  for (const { reference, current } of ordered) {
    const { at, target, extra } = reference;
    lines[at] = marker(target);
    if (!hasRegion(target)) continue;
    const block = [`\`\`\`${fenceLang(target)}`, ...current, "```", `<!-- /${wordOf(target)} -->`];
    const close = Number(extra?.close ?? -1);
    if (close === -1) lines.splice(at + 1, 0, ...block);
    else lines.splice(at + 1, close - at, ...block);
  }
  return lines.join("\n");
}

/** 给 AI 的渲染：剥掉引用标记和尾标记，展示区里的内容留下——它本来就是一份 md */
export function renderAi(text: string): string {
  return text
    .split("\n")
    .filter((line) => !OPEN.test(line) && !CLOSE.test(line))
    .join("\n");
}
