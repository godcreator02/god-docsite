/**
 * 卡正文里不许钉码：轨迹分区冻结历史，不钉活代码，出现 docfirst 引用记号一律报病。认两种形态：
 *   以 `@@docfirst` 开头的一行：已经删掉的草稿写法，形状由 `../marker/` 定；
 *   正式记号，行里出现 `{/* ref `、`{/* tree ` 这类花括号注释。
 * 要认识钉码的记号，所以在 workflow、不在星轨盘：`scanCards` 对每张卡跑一遍，病并进同一份病卡清单。
 */

import { splitLines } from "./parse.ts";
import type { Problem } from "./types.ts";
import { isRemovedDraftLine } from "../marker/index.ts";

/** 正式记号：花括号注释，行内出现即算——不要求整行匹配，围栏内容不影响判定。 */
const FORMAL_MARK = /\{\/\*\s*(ref|tree)\s/;

/** 卡正文（已剥 frontmatter）逐行扫，命中任一形态就报一条 docfirst 病。 */
export function checkDocfirstRefs(body: string): Problem[] {
  const problems: Problem[] = [];
  for (const line of splitLines(body)) {
    if (isRemovedDraftLine(line)) {
      problems.push({
        field: "docfirst",
        value: line.trim(),
        reason: "卡正文里出现以 @@docfirst 开头的一行：草稿写法已经删了，轨迹分区也不钉活代码，删掉这一行",
      });
      continue;
    }
    const formal = FORMAL_MARK.exec(line);
    if (formal) {
      problems.push({
        field: "docfirst",
        value: line.trim(),
        reason: `卡正文里出现 docfirst 正式记号 {/* ${formal[1]} ... */}，轨迹分区冻结、不钉活代码`,
      });
    }
  }
  return problems;
}
