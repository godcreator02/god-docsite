/**
 * 一处引用的状态 → 树上的一个节点。
 *
 * 四种目标三种长相：
 *   行段 / 整文件   一个 mdast `code` 节点，写法按 fumadocs 认的那套来：meta 里 `title="…"` 出标题栏、`lineNumbers=N`
 *                   让行号跟源文件对得上、`data-dot="…"` 带状态点的颜色。黄「有变动」把改过的行标上 shiki 原生的
 *                   `[!code --]` / `[!code ++]`，旧行新行渲在同一块里（有行注释的语言才行，没有的退成 `diff` 块），
 *                   所以不再另起一块「当前段」，也**不带 lineNumbers**——块里夹着已经不存在的旧行，行号一定对不上源文件。
 *                   红「缺失」显示的是确认时那段（取得到旧内容时的 old）。黄「位置不明」（取不到旧内容、滑窗也找不到这段）不摆代码。
 *   目录树          fumadocs 自己的 `<Files>` / `<Folder>` / `<File>`：根是一个展开的文件夹，名字按路径切成嵌套；
 *                   容器带 `data-dot` 和 `data-docfirst="tree"`，站的样式表在右上角画状态点。黄的时候摆当前的名字表
 *                   （记录只有名字表的哈希，多了少了哪些不知道）；红只剩一个禁用的根文件夹说目录不在了。
 *                   AI 那份的标（来源行 + text 清单）在这儿直接打好，stamp 看到就跳过，不去名册里找它。
 *   名字            一行芯片：`code` 节点的 meta 里多一个 `data-chip`，站的 pre 组件看到它就不画代码块，画一行带点的小标签。
 *
 * 灯长什么样、怎么渲染，全归站点侧的 pre 组件和样式表；这一层只把颜色塞进 meta / 属性。
 */
import type { Status } from "@godcreator/docfirst-pin";
import type { Item } from "@godcreator/docfirst-workflow";
import { langOf } from "@godcreator/docfirst-workflow/mdx";
import type { JsxAttribute, TreeNode } from "@godcreator/docfirst-workflow/mdx";

export { langOf };

export const LABEL: Record<Status, string> = { fresh: "新鲜", changed: "有变动", missing: "缺失", unconfirmed: "未确认" };

/** 状态点的四种颜色。有变动和未确认同是黄，站上靠实心 / 空心区分 */
export type Dot = "green" | "yellow" | "unpinned" | "red";
export const DOT_COLOR: Record<Status, Dot> = { fresh: "green", changed: "yellow", unconfirmed: "unpinned", missing: "red" };

export const OLD_TITLE = "文档写下时这段是";
export const NO_OLD = "（没有旧内容）";
export const NO_DIR = "（目录不在了）";
export const UNCONFIRMED_SUFFIX = " · 未确认";
export const UNLOCATED_SUFFIX = " · 有变动，位置不明";
/** 取不到旧内容、滑窗也找不到这段：旧行号上现在是什么不知道，摆出来只会误导，只留这一句 */
export const UNLOCATED_NOTE = "（取不到确认时的内容，这段也找不到了，位置不明——重读源码后 docfirst confirm <页> --accept）";
export const TREE_SUFFIX = " · 目录树";

/** 各语言的行注释——diff 标记得写在真正的注释里 shiki 才认；没有行注释的语言退成 `diff` 块 */
const LINE_COMMENT: Record<string, string> = {
  ts: "//", tsx: "//", js: "//", jsx: "//", go: "//", rust: "//", java: "//", c: "//", cpp: "//", csharp: "//", swift: "//", kotlin: "//",
  python: "#", bash: "#", powershell: "#", yaml: "#", toml: "#", ruby: "#",
  css: "/* */", scss: "/* */",
  html: "<!-- -->", md: "<!-- -->", mdx: "<!-- -->", xml: "<!-- -->",
};

/**
 * 这一处「在哪」，给标题和 AI 那份的来源行用，两边同一个字符串：
 *   行段 `file:a-b`（今天的位置）、整文件 `file`、目录树 `dir/`（带 glob）、名字 `file · 有 text`
 */
export function whereOf(item: Item): string {
  const target = item.reference.target;
  switch (target.kind) {
    case "span":
      return `${target.file}:${item.lines[0]}-${item.lines[1]}`;
    case "file":
      return target.file;
    case "tree":
      return `${target.dir}/${target.glob !== undefined ? ` ${target.glob}` : ""}`;
    case "has":
      return `${target.file} · 有 ${target.text}`;
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
export interface DocfirstMark {
  source: string;
  label: string;
  value: string;
  chip?: boolean;
}

export function codeNode(lang: string, value: string, title: string, dot: Dot, mark: DocfirstMark, start?: number): TreeNode {
  return { type: "code", lang, meta: metaOf(title, dot, start), value, data: { docfirst: mark } };
}

/** 芯片：一行带点的小标签。meta 里的 data-chip 让站的 pre 组件认出来 */
export function chipNode(title: string, dot: Dot, mark: DocfirstMark): TreeNode {
  return { type: "code", lang: "text", meta: `${metaOf(title, dot)} data-chip`, value: title, data: { docfirst: { ...mark, chip: true } } };
}

/**
 * 把钉码（`@godcreator/docfirst-pin`）出的 unified 文本（` ` 不变 / `-` 删 / `+` 增）换成 shiki 的 diff 标记，渲在同一块里；
 * 语言没有注释语法就原样给一块 `diff`。
 */
export function diffBlock(lang: string, unified: string, title: string, dot: Dot, mark: DocfirstMark): TreeNode {
  const comment = LINE_COMMENT[lang];
  if (comment === undefined) return { type: "code", lang: "diff", meta: metaOf(title, dot), value: unified, data: { docfirst: mark } };
  const commentTag = (tag: string): string =>
    comment === "/* */" ? `/* [!code ${tag}] */` : comment === "<!-- -->" ? `<!-- [!code ${tag}] -->` : `${comment} [!code ${tag}]`;
  const lines = unified.split("\n").map((line) => {
    const head = line.slice(0, 2);
    const body = line.slice(2);
    if (head === "- ") return `${body} ${commentTag("--")}`;
    if (head === "+ ") return `${body} ${commentTag("++")}`;
    return body;
  });
  return { type: "code", lang, meta: metaOf(title, dot), value: lines.join("\n"), data: { docfirst: mark } };
}

/* ---------- 目录树：fumadocs 的 Files / Folder / File ---------- */

const jsxAttr = (name: string, value: string | null): JsxAttribute => ({ type: "mdxJsxAttribute", name, value });
const jsx = (name: string, attributes: JsxAttribute[], children: TreeNode[] = []): TreeNode => ({ type: "mdxJsxFlowElement", name, attributes, children });

interface Trie {
  name: string;
  dir: boolean;
  children: Map<string, Trie>;
}

/** 平铺的名字表（相对路径，目录带尾斜杠）→ 嵌套的 Folder / File 节点 */
export function filesOf(names: string[]): TreeNode[] {
  const root: Trie = { name: "", dir: true, children: new Map() };
  for (const path of names) {
    const dir = path.endsWith("/");
    const parts = path.replace(/\/$/, "").split("/");
    let cur = root;
    parts.forEach((part, i) => {
      const last = i === parts.length - 1;
      let next = cur.children.get(part);
      if (next === undefined) {
        next = { name: part, dir: !last || dir, children: new Map() };
        cur.children.set(part, next);
      }
      cur = next;
    });
  }
  const render = (node: Trie): TreeNode => {
    const attrs: JsxAttribute[] = [jsxAttr("name", node.name)];
    if (!node.dir) return jsx("File", attrs);
    // 有孩子的文件夹默认展开；到深度尽头、没孩子的禁用，点开也是空的
    attrs.push(jsxAttr(node.children.size > 0 ? "defaultOpen" : "disabled", null));
    return jsx("Folder", attrs, [...node.children.values()].map(render));
  };
  return [...root.children.values()].map(render);
}

/** 目录树 → 一棵 `<Files>`：根文件夹叫这处的来源，容器带状态点的颜色；AI 那份的标直接打好 */
export function treeNode(item: Item): TreeNode {
  const where = whereOf(item);
  const dot = DOT_COLOR[item.status];
  const label = LABEL[item.status];
  const names = item.current ?? [];
  const missing = item.status === "missing";
  const rootAttrs: JsxAttribute[] = [jsxAttr("name", where), jsxAttr(missing ? "disabled" : "defaultOpen", null)];
  const inner = missing ? [jsx("File", [jsxAttr("name", NO_DIR)])] : filesOf(names);
  const aiText = missing ? NO_DIR : names.join("\n");
  const mark: DocfirstMark = { source: where, label, value: aiText };
  return {
    ...jsx("Files", [jsxAttr("className", "docfirst-files"), jsxAttr("data-docfirst", "tree"), jsxAttr("data-dot", dot)], [jsx("Folder", rootAttrs, inner)]),
    data: { docfirst: mark, docfirstAi: [{ type: "code", lang: "text", value: aiText }] },
  };
}

/** 一处引用 → 一块代码、一棵文件树或一行芯片 */
export function nodeFor(item: Item): TreeNode {
  const target = item.reference.target;
  // 标题写今天的位置：行段跟随之后，记号上那几行可能已经不是这段了
  const where = whereOf(item);
  const dot = DOT_COLOR[item.status];
  const label = LABEL[item.status];

  if (target.kind === "has") {
    return chipNode(item.status === "fresh" ? where : `${where} · ${label}`, dot, { source: where, label, value: "" });
  }
  if (target.kind === "tree") return treeNode(item);

  const lang = langOf(target.file);
  if (item.status === "missing") {
    const old = (item.old ?? []).join("\n");
    const mark: DocfirstMark = { source: where, label: LABEL.missing, value: old || NO_OLD };
    return codeNode(lang, old || NO_OLD, `${OLD_TITLE}（${where}）`, dot, mark);
  }
  const current = (item.current ?? []).join("\n");
  const mark: DocfirstMark = { source: where, label, value: current };
  if (item.status === "changed") {
    // 取不到旧内容、滑窗也找不到这段：行号停在旧位置，那儿现在是什么不知道，不摆代码
    if (item.reason === "unlocated") {
      return codeNode("text", UNLOCATED_NOTE, `${where}${UNLOCATED_SUFFIX}`, dot, { ...mark, value: UNLOCATED_NOTE });
    }
    // 取不到旧内容就没有 diff：退成一块普通的当前段，标题里说清楚
    if (item.diff === undefined || item.diff === "") return codeNode(lang, current, `${where} · ${LABEL.changed}`, dot, mark, item.lines[0]);
    return diffBlock(lang, item.diff, where, dot, mark);
  }
  const title = item.status === "unconfirmed" ? `${where}${UNCONFIRMED_SUFFIX}` : where;
  return codeNode(lang, current, title, dot, mark, item.lines[0]);
}
