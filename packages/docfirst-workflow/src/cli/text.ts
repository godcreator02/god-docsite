/**
 * 命令行打印的文字：状态符号、状态的中文说法，以及每种结果打印成哪一行。只拼字符串，不打印、不读写文件。
 */
import { REASON_TEXT } from "@godcreator/code-pin";
import type { Item } from "../reference/index.ts";
import { targetKey } from "../marker/index.ts";
import type { ConfirmStep } from "../pinning/index.ts";
import type { PlacedWrite } from "../project/index.ts";
import type { OutputReport } from "./report.ts";

const MARK: Record<string, string> = { fresh: "🟢", changed: "🟡", missing: "🔴", unconfirmed: "⚪" };
const LABEL: Record<string, string> = {
  fresh: "新鲜",
  changed: "有变动，等作者复核",
  missing: "缺失",
  unconfirmed: "未确认，等作者确认",
};

/** 确认时一处引用打印的那一行；位置没变的绿灯不打印 */
export function confirmLine(doc: string, { item, action, written, problem }: ConfirmStep): string | null {
  const key = targetKey(item.reference.target);
  switch (action) {
    case "recorded":
      return `✅ ${doc}  ${key}  已确认，写上了记录`;
    case "moved": {
      const target = written!.target;
      return `✅ ${doc}  ${key}  内容没变、挪到了 ${target.kind === "span" ? `${target.a}-${target.b}` : "新位置"}，已写回新行号`;
    }
    case "accepted":
      return `✅ ${doc}  ${key}  已按今天的内容重新记下`;
    case "needs-accept":
      return `🟡 ${doc}  ${key}  ${LABEL.changed}${detailOf(item)}——复核后 docfirst confirm ${doc} --accept`;
    case "refused":
      return `🔴 ${doc}  第 ${item.reference.at + 1} 行 ${key}  ${problem ?? `${LABEL.missing}${detailOf(item)}`}，这处没动`;
    case "unchanged":
      return null;
  }
}

/** 一个落点没摆放成功时打印的那一行：源头部缺点名的字段，或源里有渲染不了的东西；again 是改好之后再运行哪条命令 */
export function unplacedLine(doc: string, { to, status, missing, reason }: PlacedWrite | OutputReport, again: string): string {
  const head = `🔴 ${doc} → ${to}`;
  if (status === "no-frontmatter") return `${head}  mdx 源的 frontmatter 里没有 ${(missing ?? []).join("、")}——补上再 ${again}`;
  return `${head}  正本渲染不了：${reason}——改好再 ${again}`;
}

/** 一行说明后面的括号：状态的细分理由（`changed` 就是状态本身，不另说），或目录树的项数 */
function detailOf(item: Item): string {
  if (item.reason !== undefined && item.reason !== "changed") return `（${REASON_TEXT[item.reason]}）`;
  if (item.reference.target.kind !== "tree" || item.current === null) return "";
  return `（${item.current.length} 项）`;
}

/** 一处引用在人读报告里的那一行；拦提交的黄色引用单独一种说法，打印成红 */
export function itemLine(doc: string, item: Item, blocking: boolean): string {
  const key = targetKey(item.reference.target);
  if (blocking) {
    return `🔴 ${doc}  ${key}  有变动，是本仓还没提交的改动引起的${detailOf(item)}——在同一个提交里复核，再 docfirst confirm ${doc} --accept`;
  }
  return `${MARK[item.status]} ${doc}  ${key}  ${LABEL[item.status]}${detailOf(item)}`;
}

/** 一个落点核对完打印的那一行：每种状态各一句说明，不新鲜的都红 */
export function placedLine(doc: string, output: OutputReport): string {
  const head = `${output.fresh ? "🟢" : "🔴"} ${doc} → ${output.to}`;
  if (output.status === "no-frontmatter" || output.status === "unrenderable") return unplacedLine(doc, output, "render");
  if (output.status === "missing") return `${head}  生成物还不存在——运行 render 生成`;
  if (output.status === "stale") return `${head}  生成物跟 mdx 源不一致（源改了没重新生成，或有人直接改了生成物）——重新运行 render`;
  return `${head}  生成物跟 mdx 源一致`;
}
