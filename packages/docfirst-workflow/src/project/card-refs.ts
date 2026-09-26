/**
 * 卡正文里不许钉码：轨迹分区冻结历史，不钉活代码，出现 docfirst 引用记号一律报病。认两种形态：
 *   草稿记号，整行 `@@docfirst … @@`（形状跟 `../marker/` 认草稿的那条正则相同，
 *   那边不导出它，这里照写一份）；
 *   正式记号，行里出现 `{/* ref `、`{/* tree `、`{/* has ` 这类花括号注释（confirm 换出来的就是这一种）。
 * 这是钉码那一侧的规矩，所以在这儿、不在轨迹包：`scanCardDir` 读完卡目录后对每张卡跑一遍，
 * 病并进轨迹包卡校验报的 SickFile。
 */

import { splitLines } from "@godcreator/docfirst-trajectory";
import type { Problem } from "@godcreator/docfirst-trajectory";

/** 核心草稿记号的整行形状：头尾 `@@` 是哨兵，少一头就是普通文字。 */
const DRAFT_LINE = /^\s*@@docfirst\s+\w+\s+.+?\s+@@\s*$/;

/** 正式记号：花括号注释，行内出现即算——不要求整行匹配，围栏内容不影响判定。 */
const FORMAL_MARK = /\{\/\*\s*(ref|tree|has)\s/;

/** 卡正文（已剥 frontmatter）逐行扫，命中任一形态就报一条 docfirst 病。 */
export function checkDocfirstRefs(body: string): Problem[] {
  const problems: Problem[] = [];
  for (const line of splitLines(body)) {
    if (DRAFT_LINE.test(line)) {
      problems.push({
        field: "docfirst",
        value: line.trim(),
        reason: "卡正文里出现 docfirst 草稿记号，轨迹分区冻结、不钉活代码",
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
