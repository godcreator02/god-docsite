/**
 * 一张卡文件 → 一条记录，顺带跑单文件的校验（born-at 形状、必填字段、关系行形）。
 * 跨文件的校验（根卡几张、parent 指不指向根卡）在 scan.ts。
 */

import { validBornAt } from "@godcreator/docfirst-trajectory";
import {
  CARD_KEYS,
  extractMilestones,
  extractRelations,
  type Frontmatter,
  listOf,
  parseFrontmatter,
  scalarOf,
  stripFrontmatter,
} from "./parse.ts";
import type { CardRecord, Problem } from "./types.ts";

/** 卡身份的前置日期段：`<YYYY-MM-DD>-<slug>`，剥掉它剩下的就是 title。 */
const ID_DATE_PREFIX = /^\d{4}-\d{2}-\d{2}-/;

/** 身份去掉前置日期段就是 title（label 读不到时用它）；没有日期段的身份原样当 title。 */
function titleOf(id: string): string {
  return id.replace(ID_DATE_PREFIX, "");
}

/** 一个文件解析出的卡与它自己的病。不是卡（卡体系字段一个都不沾）时 card 为 null。 */
export interface ParsedFile {
  card: CardRecord | null;
  problems: Problem[];
}

/** 把一份卡文件的全文变成一条记录。卡体系字段（CARD_KEYS）一个都不沾的文件不是卡：card 与 problems 都回空。 */
export function parseCardFile(id: string, path: string, text: string): ParsedFile {
  const fm: Frontmatter | null = parseFrontmatter(text);
  if (!fm || !CARD_KEYS.some((k) => fm[k] !== undefined)) return { card: null, problems: [] };

  const title = titleOf(id);
  const bornAt = scalarOf(fm, "born-at") ?? "";
  const type = scalarOf(fm, "type");
  const parent = listOf(fm, "parent");
  const domain = scalarOf(fm, "domain");
  const rawLabel = scalarOf(fm, "label");
  const isRoot = type === "root";

  const problems: Problem[] = [];
  const bad = (field: Problem["field"], value: string, reason: string): void => {
    problems.push({ field, value, reason });
  };

  /* 存在性校验：born-at / label 全卡必填；parent 非根卡必填（根卡不写 parent 由 scan.ts 查） */
  if (!bornAt) bad("born-at", "", "缺 born-at（全卡必填）");
  else if (!validBornAt(bornAt)) {
    bad("born-at", bornAt, "born-at 格式须 YYYY-MM-DD 或 YYYY-MM-DDTHH:mm");
  }
  if (!isRoot && !parent.length) bad("parent", "", "缺 parent（非根卡必填，写根卡的身份）");
  if (rawLabel === null || rawLabel.trim() === "") {
    bad("label", rawLabel ?? "", "缺 label（全卡必填）");
  }

  const body = stripFrontmatter(text);
  const { relations, broken } = extractRelations(body);
  /* 行头是关系字段却写歪了：文件级病，报出来——静默吞行有过前科 */
  for (const b of broken) {
    bad("relation", b.target, `${b.key}:: 后须是 [文字](卡身份.md) 形态的一行`);
  }

  return {
    card: {
      id,
      title,
      path,
      type,
      parent,
      domain,
      label: rawLabel?.trim() || title,
      bornAt,
      relations,
      milestones: isRoot ? extractMilestones(body) : null,
    },
    problems,
  };
}
