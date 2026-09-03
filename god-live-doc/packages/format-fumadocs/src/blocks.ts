/**
 * 一处引用的状态 → 一个 mdast `code` 节点。里面是**一块**代码，写法按 fumadocs 认的那套来：
 * meta 里 `title="…"` 出标题栏、`lineNumbers=N` 让行号跟源文件对得上、`data-dot="…"` 带状态点的颜色。
 *
 * 五种目标四种长相：
 *   行段 / 整文件   代码块。黄「有变动」把改过的行标上 shiki 原生的 `[!code --]` / `[!code ++]`，旧行新行渲在同一块里
 *                   （有行注释的语言才行，没有的退成 `diff` 块），所以不再另起一块「当前段」，也**不带 lineNumbers**
 *                   ——块里夹着已经不存在的旧行，行号一定对不上源文件，与其错不如不给。
 *                   红「缺失」显示的是文档写下时那段（从记忆里取回的 old）。
 *                   黄「位置不明」（hash 记忆找不到这段了）不摆代码，只留一句提示。
 *   目录树          一块 text 清单，标题写几项；黄退成 diff 块（text 没有行注释语法，正合适）；红说目录不在了。
 *   存在性 / 名字   一行芯片：meta 里多一个 `data-chip`，站的 pre 组件看到它就不画代码块，画一行带点的小标签。
 *
 * 灯长什么样、怎么渲染，全归站点侧的 pre 组件；这一层只把颜色塞进 meta。
 */
import type { Item, Status } from "@god-live-doc/core";
import type { TreeNode } from "./tree.ts";

export const LABEL: Record<Status, string> = { fresh: "新鲜", changed: "有变动", missing: "缺失", unconfirmed: "未确认" };

/** 状态点的四种颜色。有变动和未确认同是黄，站上靠实心 / 空心区分 */
export type Dot = "green" | "yellow" | "unpinned" | "red";
export const DOT_COLOR: Record<Status, Dot> = { fresh: "green", changed: "yellow", unconfirmed: "unpinned", missing: "red" };

export const OLD_TITLE = "文档写下时这段是";
export const NO_OLD = "（没有旧内容）";
export const NO_DIR = "（目录不在了）";
export const UNCONFIRMED_SUFFIX = " · 未确认";
export const UNLOCATED_SUFFIX = " · 有变动，位置不明";
/** hash 记忆找不到这段了：旧行号上现在是什么不知道，摆出来只会误导，只留这一句 */
export const UNLOCATED_NOTE = "（hash 记忆找不到这段了，位置不明——重读源码、重钉）";
export const TREE_SUFFIX = " · 目录树";

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
 * 这一处「在哪」，给标题和 AI 那份的来源行用，两边同一个字符串：
 *   行段 `file:a-b`（今天的位置）、整文件 `file`、目录树 `dir/`（带 glob）、存在性 `path · 存在 / 不存在`、名字 `file · 有 text`
 */
export function whereOf(item: Item): string {
  const t = item.reference.target;
  switch (t.kind) {
    case "span":
      return `${t.file}:${item.lines[0]}-${item.lines[1]}`;
    case "file":
      return t.file;
    case "tree":
      return `${t.dir}/${t.glob !== undefined ? ` ${t.glob}` : ""}`;
    case "exists":
      return `${t.path} · ${t.absent ? "不存在" : "存在"}`;
    case "has":
      return `${t.file} · 有 ${t.text}`;
  }
}

/**
 * meta：标题 + 行号 + 状态点颜色。值要带引号——fumadocs 的 meta 解析器只认
 * `key="字符串"` / `key=数字` / 裸 `key` 三种，裸单词会被解析成 null。
 */
export function metaOf(title: string, dot: Dot, start?: number): string {
  return [`title="${title.replace(/"/g, "'")}"`, ...(start !== undefined ? [`lineNumbers=${start}`] : []), `data-dot="${dot}"`].join(" ");
}

/** 给 md 那头的标：来源、状态、AI 那份里该放的内容（不带 diff 标记）；chip 为真就只出来源行 */
export interface LivedocMark {
  source: string;
  label: string;
  value: string;
  chip?: boolean;
}

export function codeNode(lang: string, value: string, title: string, dot: Dot, mark: LivedocMark, start?: number): TreeNode {
  return { type: "code", lang, meta: metaOf(title, dot, start), value, data: { livedoc: mark } };
}

/** 芯片：一行带点的小标签。meta 里的 data-chip 让站的 pre 组件认出来 */
export function chipNode(title: string, dot: Dot, mark: LivedocMark): TreeNode {
  return { type: "code", lang: "text", meta: `${metaOf(title, dot)} data-chip`, value: title, data: { livedoc: { ...mark, chip: true } } };
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

/** 一处引用 → 一块代码或一行芯片 */
export function nodeFor(item: Item): TreeNode {
  const target = item.reference.target;
  // 标题写今天的位置：行段跟随之后，记号上那几行可能已经不是这段了
  const where = whereOf(item);
  const dot = DOT_COLOR[item.status];
  const label = LABEL[item.status];

  if (target.kind === "exists" || target.kind === "has") {
    return chipNode(item.status === "fresh" ? where : `${where} · ${label}`, dot, { source: where, label, value: "" });
  }

  if (target.kind === "tree") {
    const names = item.current ?? [];
    if (item.status === "missing") return codeNode("text", NO_DIR, `${where}${TREE_SUFFIX} · ${label}`, dot, { source: where, label, value: NO_DIR });
    const mark: LivedocMark = { source: where, label, value: names.join("\n") };
    if (item.status === "changed" && item.diff !== undefined && item.diff !== "") return diffBlock("text", item.diff, `${where}${TREE_SUFFIX}`, dot, mark);
    const suffix = item.status === "unconfirmed" ? UNCONFIRMED_SUFFIX : "";
    return codeNode("text", names.join("\n"), `${where}${TREE_SUFFIX} · ${names.length} 项${suffix}`, dot, mark);
  }

  const lang = langOf(target.file);
  if (item.status === "missing") {
    const old = (item.old ?? []).join("\n");
    const mark: LivedocMark = { source: where, label: LABEL.missing, value: old || NO_OLD };
    return codeNode(lang, old || NO_OLD, `${OLD_TITLE}（${where}）`, dot, mark);
  }
  const current = (item.current ?? []).join("\n");
  const mark: LivedocMark = { source: where, label, value: current };
  if (item.status === "changed") {
    // hash 记忆找不到这段了：行号停在旧位置，那儿现在是什么不知道，不摆代码
    if (item.reason === "unlocated") {
      return codeNode("text", UNLOCATED_NOTE, `${where}${UNLOCATED_SUFFIX}`, dot, { ...mark, value: UNLOCATED_NOTE });
    }
    // 没有 diff 的比较器退成一块普通的当前段，标题里说清楚
    if (item.diff === undefined || item.diff === "") return codeNode(lang, current, `${where} · ${LABEL.changed}`, dot, mark, item.lines[0]);
    return diffBlock(lang, item.diff, where, dot, mark);
  }
  const title = item.status === "unconfirmed" ? `${where}${UNCONFIRMED_SUFFIX}` : where;
  return codeNode(lang, current, title, dot, mark, item.lines[0]);
}
