/**
 * 本仓独有的第四层校验：卡正文里出现 livedoc 引用记号——轨迹分区冻结历史，不钉活代码，
 * 出现引用记号一律报病。认三种形态：
 *   核心的草稿记号，整行 `@@livedoc … @@`（正则形状照 livedoc 判定层 `engine/marker.ts` 的
 *   `types.ts` 里的 DRAFT；本包零依赖，不 import core，这里独立复刻同一形状）；
 *   md 正式记号，行里出现 `<!-- ref `、`<!-- tree `、`<!-- exists `、`<!-- absent `、
 *   `<!-- has ` 任一开标签；
 *   mdx 正式记号，行里出现 `{/* ref `、`{/* tree ` 等同样五个词的花括号注释（卡是 `.mdx` 时
 *   confirm 换出来的就是这一种）。
 * 接进 model.ts 的 parseCardFile：扫盘时随三层校验一起跑，报病自然进 SickFile。
 */

import type { Problem } from "./types.ts";
import { splitLines } from "./parse.ts";

/** 核心草稿记号的整行形状：头尾 `@@` 是哨兵，少一头就是普通文字。 */
const DRAFT_LINE = /^\s*@@livedoc\s+\w+\s+.+?\s+@@\s*$/;

/** md 正式记号的开标签，行内出现即算——不要求整行匹配，围栏内容不影响判定。 */
const FORMAL_MARK = /<!--\s*(ref|tree|exists|absent|has)\s/;

/** mdx 正式记号：花括号注释，载荷跟 md 那种是同一截。 */
const FORMAL_MARK_MDX = /\{\/\*\s*(ref|tree|exists|absent|has)\s/;

/** 卡正文（已剥 frontmatter）逐行扫，命中任一形态就报一条 livedoc 病。 */
export function checkLivedocRefs(body: string): Problem[] {
  const problems: Problem[] = [];
  for (const line of splitLines(body)) {
    if (DRAFT_LINE.test(line)) {
      problems.push({
        field: "livedoc",
        value: line.trim(),
        reason: "卡正文里出现 livedoc 草稿记号，轨迹分区冻结、不钉活代码",
      });
      continue;
    }
    const formal = FORMAL_MARK.exec(line);
    if (formal) {
      problems.push({
        field: "livedoc",
        value: line.trim(),
        reason: `卡正文里出现 livedoc 正式记号 <!-- ${formal[1]} ...-->，轨迹分区冻结、不钉活代码`,
      });
      continue;
    }
    const mdx = FORMAL_MARK_MDX.exec(line);
    if (mdx) {
      problems.push({
        field: "livedoc",
        value: line.trim(),
        reason: `卡正文里出现 livedoc 正式记号 {/* ${mdx[1]} ... */}，轨迹分区冻结、不钉活代码`,
      });
    }
  }
  return problems;
}
