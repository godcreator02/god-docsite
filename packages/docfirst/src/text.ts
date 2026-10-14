/**
 * 命令行打印的每一行：状态符号、状态的中文说法、每种结果写成哪一行。只拼字符串，不打印。
 */
import { REASON_TEXT, targetKey } from "@godcreator/code-pin";
import type { ConfirmStep, DocPin, PinCheck } from "@godcreator/code-pin";
import type { OutputCheck, OutputWrite } from "@godcreator/doc-export/node";
import type { OutputReport } from "./report.ts";

const MARK: Record<PinCheck["status"], string> = { fresh: "🟢", changed: "🟡", missing: "🔴", unconfirmed: "⚪" };
const LABEL: Record<PinCheck["status"], string> = {
  fresh: "新鲜",
  changed: "有变动，等作者复核",
  missing: "缺失",
  unconfirmed: "未确认，等作者确认",
};

/** 一行说明后面的括号：状态的细分理由（`changed` 就是状态本身，不另说），或目录树的项数 */
function detailOf(check: PinCheck<DocPin>): string {
  if (check.reason !== undefined && check.reason !== "changed") return `（${REASON_TEXT[check.reason]}）`;
  if (check.pin.target.kind !== "tree" || check.current === null) return "";
  return `（${check.current.length} 项）`;
}

/** check 时一处钉的那一行；拦提交的黄单独一种说法，打印成红 */
export function pinCheckLine(doc: string, check: PinCheck<DocPin>, blocking: boolean): string {
  const key = targetKey(check.pin.target);
  if (blocking) {
    return `🔴 ${doc}  ${key}  有变动，是本仓还没提交的改动引起的${detailOf(check)}——在同一个提交里复核，再 docfirst confirm ${doc} --accept`;
  }
  return `${MARK[check.status]} ${doc}  ${key}  ${LABEL[check.status]}${detailOf(check)}`;
}

/** confirm 时一处钉的那一行；原地没动的绿不打印 */
export function confirmStepLine(doc: string, { check, action, written, problem }: ConfirmStep<DocPin>): string | null {
  const key = targetKey(check.pin.target);
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
      return `🟡 ${doc}  ${key}  ${LABEL.changed}${detailOf(check)}——复核后 docfirst confirm ${doc} --accept`;
    case "refused":
      return `🔴 ${doc}  第 ${check.pin.line} 行 ${key}  ${problem ?? `${LABEL.missing}${detailOf(check)}`}，这处没动`;
    case "unchanged":
      return null;
  }
}

export function unknownComponentLine(doc: string, name: string, line: number): string {
  return `🔴 ${doc}  第 ${line} 行 <${name}>  名册外组件，这篇是生成正本，docfirst.config.mjs 里要给它机读规则`;
}

/** 一个落点没生成成功的那一行：源头部缺点名的字段，或源里有渲染不了的东西；again 是改好之后再运行哪条命令 */
export function unwrittenOutputLine(doc: string, { to, status, missing, reason }: OutputWrite | OutputReport, again: string): string {
  const head = `🔴 ${doc} → ${to}`;
  if (status === "no-frontmatter") return `${head}  mdx 源的 frontmatter 里没有 ${(missing ?? []).join("、")}——补上再 ${again}`;
  return `${head}  正本渲染不了：${reason}——改好再 ${again}`;
}

/** check 时一个落点的那一行：不新鲜的都红 */
export function outputCheckLine(doc: string, output: OutputCheck | OutputReport): string {
  const head = `${output.fresh ? "🟢" : "🔴"} ${doc} → ${output.to}`;
  switch (output.status) {
    case "no-frontmatter":
    case "unrenderable":
      return unwrittenOutputLine(doc, output, "render");
    case "missing":
      return `${head}  生成物还不存在——运行 render 生成`;
    case "stale":
      return `${head}  生成物跟 mdx 源不一致（源改了没重新生成，或有人直接改了生成物）——重新运行 render`;
    case "fresh":
      return `${head}  生成物跟 mdx 源一致`;
  }
}
