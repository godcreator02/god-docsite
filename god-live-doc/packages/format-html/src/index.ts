/**
 * @god-live-doc/format-html——html 格式包。零依赖只吃核心。
 *
 * 正式记号是 html 自己的东西：一个带 data-file / data-lines 的元素，既是标记又是展示区，
 * 没有尾标记，元素的闭合就是边界：
 *   <pre data-file="src/greet.ts" data-lines="2-3"></pre>
 * 确认时把代码投影进元素里（转义过的 <code>）。容器是作者的，内容归格式包：每次确认整个重写，
 * 作者的外壳写在元素外面。容器不是 <pre>（比如 <div>）就往里放 <pre><code>，空白才保得住。
 * 草稿记号（核心定的 @@livedoc ref … @@，独立一行）也认：确认时整行换成上面那个元素并投影，缩进保留。
 *
 * html 没有构建管线，文件本身就是终态：人看它，AI 也直接读它——所以不出 renderAi / renderHuman，
 * final 标着「产物就是文档」。
 * 认法：逐行扫，开标签带 data-file 的算引用，开标签要写在一行里；<script> / <style> 里的跳过；
 * 写成 &lt;pre 的转义文本天然不匹配。
 */
import { draftOf, toTarget } from "@god-live-doc/core";
import type { Fill, Reference, Target } from "@god-live-doc/core";

export const name = "html";
export const claims = (doc: string): boolean => doc.endsWith(".html") || doc.endsWith(".htm");
export const final = true;

const LANG: Record<string, string> = {
  ts: "ts", tsx: "tsx", js: "js", jsx: "jsx", mjs: "js", cjs: "js", py: "python", rs: "rust", go: "go",
  json: "json", css: "css", html: "html", md: "md", mdx: "mdx", yml: "yaml", yaml: "yaml", sh: "bash", ps1: "powershell",
};
export const langOf = (file: string): string => LANG[file.split(".").pop() ?? ""] ?? "";
const esc = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** 正式记号：一个空的 <pre>。parse(marker(t)) 认回的就是 t */
export const marker = ({ file, a, b }: Target): string => `<pre data-file="${file}" data-lines="${a}-${b}"></pre>`;

const OPEN = /<([a-zA-Z][\w-]*)\b[^>]*?\bdata-file="[^"]*"[^>]*>/;
const UNCLOSED_TAG = /<[a-zA-Z][\w-]*(\s[^>]*)?$/;

function attrsOf(tag: string): Record<string, string> {
  const table: Record<string, string> = {};
  for (const m of tag.matchAll(/data-(file|lines)="([^"]*)"/g)) table[m[1]!] = m[2]!;
  return table;
}

/** 从开标签结束处起，按标签名数嵌套找闭合。交回闭标签在整段文本里的偏移；找不到 null */
function closeOf(text: string, tag: string, from: number): number | null {
  const re = new RegExp(`<(/?)${tag}\\b[^>]*>`, "gi");
  re.lastIndex = from;
  let depth = 1;
  for (let m = re.exec(text); m !== null; m = re.exec(text)) {
    if (m[0].endsWith("/>")) continue;
    depth += m[1] === "/" ? -1 : 1;
    if (depth === 0) return m.index;
  }
  return null;
}

/**
 * 引用的 extra 里带着写回要改的那一段的起止偏移：正式记号是元素内容（from = 开标签末，to = 闭标签头），
 * 草稿记号是整行去掉缩进的部分，外加 tag 和 draft。
 */
export function parse(text: string): Reference[] {
  const refs: Reference[] = [];
  const lines = text.split("\n");
  let offset = 0;
  let skip: string | null = null;
  lines.forEach((line, i) => {
    const start = offset;
    offset += line.length + 1;
    if (skip !== null) {
      if (line.includes(`</${skip}>`)) skip = null;
      return;
    }
    const s = /<(script|style)\b/i.exec(line);
    if (s !== null) {
      if (!line.includes(`</${s[1]}>`)) skip = s[1]!;
      return;
    }
    const draft = draftOf(line, `第 ${i + 1} 行`);
    if (draft !== null) {
      const indent = line.length - line.trimStart().length;
      refs.push({ target: draft, at: i, extra: { draft: true, from: start + indent, to: start + line.trimEnd().length } });
      return;
    }
    const o = OPEN.exec(line);
    if (o === null) {
      // 开标签没在本行收口：把它到 > 为止的几行拼起来看，带 data-file 就是拆行写了，报到开标签那一行
      if (UNCLOSED_TAG.test(line)) {
        let chunk = line;
        for (let j = i + 1; j < lines.length && !chunk.includes(">"); j += 1) chunk += `\n${lines[j]}`;
        if (/\bdata-file=/.test(chunk)) throw new Error(`第 ${i + 1} 行：带 data-file 的开标签要写在一行里`);
      }
      return;
    }
    const target = toTarget(attrsOf(o[0]), `第 ${i + 1} 行`);
    const from = start + o.index + o[0].length;
    const to = closeOf(text, o[1]!, from);
    if (to === null) throw new Error(`第 ${i + 1} 行：<${o[1]} data-file> 没有闭合`);
    refs.push({ target, at: i, extra: { draft: false, tag: o[1]!.toLowerCase(), from, to } });
  });
  return refs;
}

/** 确认时写回：元素内容整个换成投影；草稿行换成带投影的元素。从后往前改，前面的偏移不受影响 */
export function write(text: string, fills: Fill[]): string {
  const ordered = [...fills].sort((x, y) => Number(y.reference.extra?.from) - Number(x.reference.extra?.from));
  let out = text;
  for (const { reference, current } of ordered) {
    const extra = reference.extra ?? {};
    const draft = extra.draft === true;
    const tag = String(extra.tag ?? "");
    const from = Number(extra.from);
    const to = Number(extra.to);
    const { file, a, b } = reference.target;
    const code = `<code class="language-${langOf(file)}">${esc(current.join("\n"))}</code>`;
    const inner = draft ? `<pre data-file="${file}" data-lines="${a}-${b}">${code}</pre>` : tag === "pre" ? code : `<pre>${code}</pre>`;
    out = out.slice(0, from) + inner + out.slice(to);
  }
  return out;
}
