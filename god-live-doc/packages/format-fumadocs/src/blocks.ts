/**
 * 一处引用的状态 → 一个 mdast `code` 节点。里面是**一块**代码，写法按 fumadocs 认的那套来：
 * meta 里 `title="…"` 出标题栏、`lineNumbers=N` 让行号跟源文件对得上、`data-dot="…"` 带状态点的颜色。
 *
 * 黄「有变动」那块把改过的行标上 shiki 原生的 `[!code --]` / `[!code ++]`，旧行新行渲在同一块里
 * （有行注释的语言才行，没有的退成 `diff` 块），所以它不再另起一块「当前段」，也**不带 lineNumbers**
 * ——块里夹着已经不存在的旧行，行号一定对不上源文件，与其错不如不给。
 * 红「缺失」那块显示的是文档写下时那段（从记忆里取回的 old）。
 *
 * 灯长什么样、怎么渲染，全归站点侧的 pre 组件；这一层只把颜色塞进 meta。
 */
import { targetKey } from "@god-live-doc/core";
import type { Item, Status } from "@god-live-doc/core";
import type { TreeNode } from "./tree.ts";

export const LABEL: Record<Status, string> = { fresh: "新鲜", changed: "有变动", missing: "缺失", unconfirmed: "未确认" };

/** 状态点的四种颜色。有变动和未确认同是黄，站上靠实心 / 空心区分 */
export type Dot = "green" | "yellow" | "unpinned" | "red";
export const DOT_COLOR: Record<Status, Dot> = { fresh: "green", changed: "yellow", unconfirmed: "unpinned", missing: "red" };

export const OLD_TITLE = "文档写下时这段是";
export const NO_OLD = "（没有旧内容）";
export const UNCONFIRMED_SUFFIX = " · 未确认";

const LANG: Record<string, string> = {
  ts: "ts", tsx: "tsx", js: "js", jsx: "jsx", mjs: "js", cjs: "js", py: "python", rs: "rust", go: "go",
  json: "json", css: "css", html: "html", md: "md", mdx: "mdx", yml: "yaml", yaml: "yaml", sh: "bash", ps1: "powershell",
};
export const langOf = (file: string): string => LANG[file.split(".").pop() ?? ""] ?? "";

/** 各语言的行注释——diff 标记得写在真正的注释里 shiki 才认；没有行注释的语言退成 `diff` 块 */
const LINE_COMMENT: Record<string, string> = {
  ts: "//", tsx: "//", js: "//", jsx: "//", go: "//", rust: "//", java: "//", c: "//", cpp: "//", csharp: "//", swift: "//", kotlin: "//",
  python: "#", bash: "#", powershell: "#", yaml: "#", toml: "#", ruby: "#",
  css: "/* */", scss: "/* */",
  html: "<!-- -->", md: "<!-- -->", mdx: "<!-- -->", xml: "<!-- -->",
};

/**
 * meta：标题 + 行号 + 状态点颜色。值要带引号——fumadocs 的 meta 解析器只认
 * `key="字符串"` / `key=数字` / 裸 `key` 三种，裸单词会被解析成 null。
 */
export function metaOf(title: string, dot: Dot, start?: number): string {
  return [`title="${title.replace(/"/g, "'")}"`, ...(start !== undefined ? [`lineNumbers=${start}`] : []), `data-dot="${dot}"`].join(" ");
}

/** 给 md 那头的标：来源、状态、AI 那份里该放的内容（不带 diff 标记） */
export interface LivedocMark {
  source: string;
  label: string;
  value: string;
}

export function codeNode(lang: string, value: string, title: string, dot: Dot, mark: LivedocMark, start?: number): TreeNode {
  return { type: "code", lang, meta: metaOf(title, dot, start), value, data: { livedoc: mark } };
}

/**
 * 把核心出的 unified 文本（` ` 不变 / `-` 删 / `+` 增）换成 shiki 的 diff 标记，渲在同一块里；
 * 语言没有注释语法就原样给一块 `diff`。
 */
export function diffBlock(lang: string, unified: string, title: string, dot: Dot, mark: LivedocMark): TreeNode {
  const comment = LINE_COMMENT[lang];
  if (comment === undefined) return { type: "code", lang: "diff", meta: metaOf(title, dot), value: unified, data: { livedoc: mark } };
  const mark2 = (tag: string): string =>
    comment === "/* */" ? `/* [!code ${tag}] */` : comment === "<!-- -->" ? `<!-- [!code ${tag}] -->` : `${comment} [!code ${tag}]`;
  const lines = unified.split("\n").map((line) => {
    const head = line.slice(0, 2);
    const body = line.slice(2);
    if (head === "- ") return `${body} ${mark2("--")}`;
    if (head === "+ ") return `${body} ${mark2("++")}`;
    return body;
  });
  return { type: "code", lang, meta: metaOf(title, dot), value: lines.join("\n"), data: { livedoc: mark } };
}

/** 一处引用 → 一块代码。四种状态各一种长相 */
export function nodeFor(item: Item): TreeNode {
  const target = item.reference.target;
  // 标题写今天的位置：行段跟随之后，记号上那几行可能已经不是这段了
  const where = targetKey({ file: target.file, a: item.lines[0], b: item.lines[1] });
  const lang = langOf(target.file);
  const dot = DOT_COLOR[item.status];

  if (item.status === "missing") {
    const old = (item.old ?? []).join("\n");
    const mark: LivedocMark = { source: where, label: LABEL.missing, value: old || NO_OLD };
    return codeNode(lang, old || NO_OLD, `${OLD_TITLE}（${where}）`, dot, mark);
  }
  const current = (item.current ?? []).join("\n");
  const mark: LivedocMark = { source: where, label: LABEL[item.status], value: current };
  if (item.status === "changed") {
    // 没有 diff 的比较器（hash 版记不下旧内容）退成一块普通的当前段，标题里说清楚
    if (item.diff === undefined || item.diff === "") return codeNode(lang, current, `${where} · ${LABEL.changed}`, dot, mark, item.lines[0]);
    return diffBlock(lang, item.diff, where, dot, mark);
  }
  const title = item.status === "unconfirmed" ? `${where}${UNCONFIRMED_SUFFIX}` : where;
  return codeNode(lang, current, title, dot, mark, item.lines[0]);
}
