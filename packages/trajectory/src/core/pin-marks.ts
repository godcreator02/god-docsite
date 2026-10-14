/**
 * 卡正文里不许钉码：轨迹卡记的是当时的结论，不跟着代码变，出现钉码记号一律报病。认两种形态：
 *   以 `@@docfirst` 开头的一行：钉码已经删掉的草稿写法；
 *   正式记号：行里出现 `{/* ref `、`{/* tree ` 这类花括号注释。
 */

import { splitLines } from "./lines.ts";
import type { Problem } from "./types.ts";

/** 正式记号：花括号注释，行内出现即算——不要求整行匹配，围栏内容不影响判定。 */
const FORMAL_MARK = /\{\/\*\s*(ref|tree)\s/;

const REMOVED_DRAFT_LINE = /^\s*@@docfirst\b/;

/** 卡正文（已剥 frontmatter）逐行扫，命中任一形态就报一条 docfirst 病。 */
export function checkDocfirstRefs(body: string): Problem[] {
  const problems: Problem[] = [];
  for (const line of splitLines(body)) {
    if (REMOVED_DRAFT_LINE.test(line)) {
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
