/**
 * 根卡正文末尾的「## 里程碑」区块：一行一座，画成星轨盘上金黄的环。
 */

import type { Milestone } from "./model/types.ts";
import { splitLines } from "./lines.ts";

/** 根卡正文末尾装里程碑的固定 H2 区块名。 */
export const MILESTONE_HEADING = "里程碑";

/** 里程碑行：`- 日期｜标题｜描述`，竖线是全角 U+FF5C，描述段可缺。 */
const MILESTONE_LINE = /^-\s+([^｜]+)｜([^｜]+)(?:｜([\s\S]*))?\s*$/;

/** 里程碑区块提取的结果：解析成功的里程碑，与以 `- ` 开头却不合 `- 日期｜标题｜说明` 或日期解不出来的行。 */
export interface ExtractedMilestones {
  milestones: Milestone[];
  broken: string[];
}

/** 解析根卡正文的「## 里程碑」固定区块：区块到下一个 H2 或文件尾为止。区块里别的文字（说明、续行）不管；
 * 结果按日期升序。 */
export function extractMilestones(body: string): ExtractedMilestones {
  const items: Milestone[] = [];
  const broken: string[] = [];
  let inBlock = false;
  for (const line of splitLines(body)) {
    const h2 = /^##\s+(.+?)\s*$/.exec(line);
    if (h2) {
      inBlock = h2[1] === MILESTONE_HEADING;
      continue;
    }
    if (!inBlock || !/^-\s/.test(line)) continue;
    const match = MILESTONE_LINE.exec(line);
    const date = match ? (match[1] as string).trim() : "";
    if (!match || Number.isNaN(Date.parse(`${date.slice(0, 10)}T00:00:00Z`))) {
      broken.push(line.trim());
      continue;
    }
    items.push({ date, name: (match[2] as string).trim(), desc: (match[3] ?? "").trim() });
  }
  items.sort((a, b) => a.date.localeCompare(b.date));
  return { milestones: items, broken };
}
