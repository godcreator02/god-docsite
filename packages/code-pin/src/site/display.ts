/**
 * 一处钉在站点页面上的样子，写成 mdast 节点，放进 `codePin` 外框里：
 *   行段 / 整文件   一个 `code` 节点，meta 只写 fumadocs 认的 `title="…"` 与 `lineNumbers=N`（行号跟源文件对上）。
 *                   有变动且有对比时，改过的行标上 shiki 的 `[!code --]` / `[!code ++]`，旧行新行在同一块里，
 *                   不带 lineNumbers（块里夹着已经不存在的旧行）；没有行注释的语言退成一块 `diff`。
 *                   缺失摆确认时那段；位置不明不摆代码，只留一句说明。
 *   目录树          fumadocs 的 `<Files>` / `<Folder>` / `<File>`：根是一个展开的文件夹，名字按路径切成嵌套；
 *                   缺失只剩一个禁用的根文件夹说目录不在了。站点要在 MDX 组件里登记这三个组件。
 */
import type { Code, RootContent } from "mdast";
import type { MdxJsxAttribute, MdxJsxFlowElement } from "mdast-util-mdx";
import { diffText, langOf } from "../core/index.ts";
import type { DiffLine, PinCheck, Status } from "../core/index.ts";

export const STATUS_LABEL: Record<Status, string> = { fresh: "新鲜", changed: "有变动", missing: "缺失", unconfirmed: "未确认" };

export const OLD_TITLE = "文档写下时这段是";
export const NO_OLD = "（没有旧内容）";
export const NO_DIR = "（目录不在了）";
export const UNCONFIRMED_SUFFIX = " · 未确认";
export const UNLOCATED_SUFFIX = " · 有变动，位置不明";
/** 取不到旧内容、滑窗也找不到这段：旧行号上现在是什么不知道，摆出来只会误导，只留这一句 */
export const UNLOCATED_NOTE = "（取不到确认时的内容，这段也找不到了，位置不明——重读源码后确认，带上 --accept）";

/** 各语言的行注释：diff 标记得写在真正的注释里 shiki 才认 */
const LINE_COMMENT: Record<string, (tag: string) => string> = Object.fromEntries([
  ...["ts", "tsx", "js", "jsx", "go", "rust", "java", "c", "cpp", "csharp", "swift", "kotlin"].map((lang) => [lang, (tag: string) => `// [!code ${tag}]`]),
  ...["python", "bash", "powershell", "yaml", "toml", "ruby"].map((lang) => [lang, (tag: string) => `# [!code ${tag}]`]),
  ...["css", "scss"].map((lang) => [lang, (tag: string) => `/* [!code ${tag}] */`]),
  ...["html", "md", "mdx", "xml"].map((lang) => [lang, (tag: string) => `<!-- [!code ${tag}] -->`]),
]);

/** 这一处「在哪」：行段 `file:a-b`（今天的位置）、整文件 `file`、目录树 `dir/`（带 glob） */
export function whereOf(check: PinCheck): string {
  const target = check.pin.target;
  switch (target.kind) {
    case "span":
      return `${target.file}:${check.lines[0]}-${check.lines[1]}`;
    case "file":
      return target.file;
    case "tree":
      return `${target.dir}/${target.glob !== undefined ? ` ${target.glob}` : ""}`;
  }
}

/** meta 的值要带引号：fumadocs 的 meta 解析只认 `key="字符串"` / `key=数字` / 裸 `key` */
function codeNode(lang: string, value: string, title: string, start?: number): Code {
  const meta = [`title="${title.replace(/"/g, "'")}"`, ...(start !== undefined ? [`lineNumbers=${start}`] : [])].join(" ");
  return { type: "code", lang, meta, value };
}

function diffNode(lang: string, diff: DiffLine[], title: string): Code {
  const comment = LINE_COMMENT[lang];
  if (comment === undefined) return codeNode("diff", diffText(diff), title);
  const lines = diff.map(({ kind, text }) => (kind === "removed" ? `${text} ${comment("--")}` : kind === "added" ? `${text} ${comment("++")}` : text));
  return codeNode(lang, lines.join("\n"), title);
}

const jsxAttr = (name: string, value: string | null): MdxJsxAttribute => ({ type: "mdxJsxAttribute", name, value });
const jsx = (name: string, attributes: MdxJsxAttribute[], children: MdxJsxFlowElement[] = []): MdxJsxFlowElement => ({ type: "mdxJsxFlowElement", name, attributes, children });

interface NameTrie {
  name: string;
  dir: boolean;
  children: Map<string, NameTrie>;
}

/** 平铺的名字表（相对路径，目录带尾斜杠）→ 嵌套的 Folder / File 节点；有孩子的文件夹展开，到深度尽头没孩子的禁用 */
export function filesOf(names: string[]): MdxJsxFlowElement[] {
  const root: NameTrie = { name: "", dir: true, children: new Map() };
  for (const path of names) {
    const parts = path.replace(/\/$/, "").split("/");
    let cur = root;
    parts.forEach((part, i) => {
      let next = cur.children.get(part);
      if (next === undefined) {
        next = { name: part, dir: i < parts.length - 1 || path.endsWith("/"), children: new Map() };
        cur.children.set(part, next);
      }
      cur = next;
    });
  }
  const render = (node: NameTrie): MdxJsxFlowElement => {
    if (!node.dir) return jsx("File", [jsxAttr("name", node.name)]);
    return jsx("Folder", [jsxAttr("name", node.name), jsxAttr(node.children.size > 0 ? "defaultOpen" : "disabled", null)], [...node.children.values()].map(render));
  };
  return [...root.children.values()].map(render);
}

function treeNodeOf(check: PinCheck): MdxJsxFlowElement {
  const missing = check.status === "missing";
  const inner = missing ? [jsx("File", [jsxAttr("name", NO_DIR)])] : filesOf(check.current ?? []);
  return jsx("Files", [], [jsx("Folder", [jsxAttr("name", whereOf(check)), jsxAttr(missing ? "disabled" : "defaultOpen", null)], inner)]);
}

/** 一处钉在页面上摆什么：一块代码，或一棵文件树 */
export function displayNodeOf(check: PinCheck): RootContent {
  const target = check.pin.target;
  if (target.kind === "tree") return treeNodeOf(check);
  const where = whereOf(check);
  const lang = langOf(target.file);
  if (check.status === "missing") {
    const old = (check.old ?? []).join("\n");
    return codeNode(lang, old || NO_OLD, `${OLD_TITLE}（${where}）`);
  }
  const current = (check.current ?? []).join("\n");
  if (check.status === "changed") {
    if (check.reason === "unlocated") return codeNode("text", UNLOCATED_NOTE, `${where}${UNLOCATED_SUFFIX}`);
    if (check.diff === undefined) return codeNode(lang, current, `${where} · ${STATUS_LABEL.changed}`, check.lines[0]);
    return diffNode(lang, check.diff, where);
  }
  const title = check.status === "unconfirmed" ? `${where}${UNCONFIRMED_SUFFIX}` : where;
  return codeNode(lang, current, title, check.lines[0]);
}
