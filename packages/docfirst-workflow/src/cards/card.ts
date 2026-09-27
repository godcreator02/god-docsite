/**
 * 一张卡文件 → 一条记录，顺带跑单文件的校验（字段的形状、必填字段、born-at 形状、关系行与里程碑行）。
 * 跨文件的校验（根卡几张、parent 指不指向根卡、关系指不指向星轨盘上的卡、同一身份两个文件）在 scan.ts。
 */

import { validBornAt } from "@godcreator/trajectory-disk";
import {
  CARD_KEYS,
  extractMilestones,
  extractRelations,
  type Frontmatter,
  parseFrontmatter,
  stripFrontmatter,
} from "./parse.ts";
import type { CardRecord, Problem } from "./types.ts";

/** 卡身份的前置日期段：`<YYYY-MM-DD>-<slug>`，剥掉它剩下的就是 title。 */
const ID_DATE_PREFIX = /^\d{4}-\d{2}-\d{2}-/;

/** 该写单个值的字段，与它报病时用的字段名 */
const SCALAR_FIELDS = { "born-at": "born-at", type: "type", label: "label", domain: "domain" } as const;

/** 身份去掉前置日期段就是 title（label 读不到时用它）；没有日期段的身份原样当 title。 */
function titleOf(id: string): string {
  return id.replace(ID_DATE_PREFIX, "");
}

/** 一个文件解析出的卡与它自己的病。不是卡（卡体系字段一个都没有）时 card 为 null。 */
export interface ParsedFile {
  card: CardRecord | null;
  problems: Problem[];
}

/** 把一份卡文件的全文变成一条记录。卡体系字段（CARD_KEYS）一个都没有的文件不是卡：card 与 problems 都返回空。
 * 字段写成了别的形状（单个值写成列表、列表写成单个值）报病，按没写处理，不替它转换。 */
export function parseCardFile(id: string, path: string, text: string): ParsedFile {
  const fm: Frontmatter | null = parseFrontmatter(text);
  if (!fm || !CARD_KEYS.some((k) => fm[k] !== undefined)) return { card: null, problems: [] };

  const problems: Problem[] = [];
  const bad = (field: Problem["field"], value: string, reason: string): void => {
    problems.push({ field, value, reason });
  };
  const scalar = (key: keyof typeof SCALAR_FIELDS): string | null => {
    const raw = fm[key];
    if (raw === undefined) return null;
    if (Array.isArray(raw)) {
      bad(SCALAR_FIELDS[key], raw.join(","), `${key} 须写成单个值，不是列表`);
      return null;
    }
    return raw;
  };
  const parentRaw = fm["parent"];
  const parentIsScalar = typeof parentRaw === "string";
  if (parentIsScalar) bad("parent", parentRaw, "parent 须写成列表：parent: [根卡身份]");

  const title = titleOf(id);
  const bornAt = scalar("born-at") ?? "";
  const type = scalar("type");
  const domain = scalar("domain");
  const rawLabel = scalar("label");
  const parent = Array.isArray(parentRaw) ? parentRaw.map((v) => v.trim()).filter((v) => v !== "") : [];
  const isRoot = type === "root";

  /* 存在性校验：born-at / label 全卡必填；parent 非根卡必填（根卡不写 parent 由 scan.ts 查）。
   * 写成了别的形状的字段已经报过，不再报缺 */
  if (fm["born-at"] === undefined || fm["born-at"] === "") bad("born-at", "", "缺 born-at（全卡必填）");
  else if (bornAt !== "" && !validBornAt(bornAt)) {
    bad("born-at", bornAt, "born-at 格式须 YYYY-MM-DD 或 YYYY-MM-DDTHH:mm");
  }
  if (!isRoot && !parentIsScalar && !parent.length) {
    bad("parent", "", "缺 parent（非根卡必填，写根卡的身份）");
  }
  if (fm["label"] === undefined || (typeof fm["label"] === "string" && fm["label"].trim() === "")) {
    bad("label", rawLabel ?? "", "缺 label（全卡必填）");
  }

  const body = stripFrontmatter(text);
  const { relations, broken } = extractRelations(body);
  /* 行头是关系字段、整行格式却不对：文件级病，要报出来——以前出过这种行被静默丢掉的问题 */
  for (const b of broken) {
    bad("relation", b.target, `${b.key}:: 后须是 [文字](卡身份.md) 形态的一行`);
  }
  let milestones = null;
  if (isRoot) {
    const extracted = extractMilestones(body);
    milestones = extracted.milestones;
    for (const line of extracted.broken) {
      bad("milestone", line, "里程碑行须是「- 日期｜标题｜说明」，日期以 YYYY-MM-DD 开头");
    }
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
      milestones,
    },
    problems,
  };
}
