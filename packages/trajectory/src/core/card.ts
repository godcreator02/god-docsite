/**
 * 卡格式：frontmatter 的 schema（唯一的格式定义）、标题规则，与一个卡文件 → 一条记录加单文件的病。
 * 跨文件的校验（根卡几张、parent 指不指向根卡、关系指不指向星轨盘上的卡、同一身份两个文件）在 card-set.ts。
 */

import { z } from "zod";
import { FrontmatterError, parseFrontmatter, stripFrontmatter } from "./frontmatter.ts";
import { extractMilestones } from "./milestones.ts";
import { validBornAt } from "./model/build.ts";
import { checkDocfirstRefs } from "./pin-marks.ts";
import { cardIdOfFile } from "./card-files.ts";
import { extractRelations } from "./refs.ts";
import type { CardFileReading, CardRecord, ParsedFile, Problem } from "./types.ts";

/** 卡体系字段：frontmatter 里一个都没有的文件不是卡，校验直接跳过。
 * status 不在其列——它是可以随意写的字段，单凭一个 status 不足以认定这是张卡。 */
export const CARD_KEYS = ["type", "born-at", "parent", "label", "domain"] as const;
type CardKey = (typeof CARD_KEYS)[number];

/** 卡身份的前置日期段：`<YYYY-MM-DD>-<slug>` */
export const ID_DATE_PREFIX = /^\d{4}-\d{2}-\d{2}-/;

/**
 * 标题规则，卡页、星轨盘、卡集合都用这一条：frontmatter 写了就用写的（卡是 label，卡集合里不是卡的页是 title），
 * 没写就用卡身份去掉开头的日期段——日期在卡页标题下那一行、在星轨盘的半径上都已经显示了。
 */
export function titleOf(id: string, declared: unknown): string {
  return (typeof declared === "string" ? declared.trim() : "") || id.replace(ID_DATE_PREFIX, "");
}

const singleValue = (key: CardKey) =>
  z
    .string({ error: (issue) => (Array.isArray(issue.input) ? `${key} 须写成单个值，不是列表` : `${key} 须写成单个值`) })
    .optional();

/** 必填与 born-at 格式。字段写成别的形状时已经报过形状，这里不再报缺 */
function checkRequiredFields(frontmatter: Record<string, unknown>, ctx: z.RefinementCtx): void {
  const report = (key: CardKey, message: string, value: string): void => {
    ctx.addIssue({ code: "custom", path: [key], message, params: { value } });
  };
  const bornAt = frontmatter["born-at"];
  if (bornAt === undefined || bornAt === "") report("born-at", "缺 born-at（全卡必填）", "");
  else if (typeof bornAt === "string" && !validBornAt(bornAt)) report("born-at", "born-at 格式须 YYYY-MM-DD 或 YYYY-MM-DDTHH:mm", bornAt);
  const parent = frontmatter["parent"];
  const parentMissing = parent === undefined || (Array.isArray(parent) && parentIdsOf(parent).length === 0);
  if (frontmatter["type"] !== "root" && parentMissing) report("parent", "缺 parent（非根卡必填，写根卡的身份）", "");
  const label = frontmatter["label"];
  if (label === undefined || (typeof label === "string" && label.trim() === "")) {
    report("label", "缺 label（全卡必填）", typeof label === "string" ? label : "");
  }
}

/**
 * 卡的 frontmatter。形状先查（顺序 parent、born-at、type、domain、label），必填与格式后查（born-at、parent、label），
 * 病按这个顺序报。根卡不写 parent、parent 只能写根卡的身份这类要看整批卡的规则在 card-set.ts。
 * 别的字段（title、description、status……）随便写，不查。
 */
export const cardFrontmatterSchema = z
  .looseObject({
    parent: z
      .array(z.string({ error: "parent 的每一项须是一个卡身份" }), { error: "parent 须写成列表：parent: [根卡身份]" })
      .optional(),
    "born-at": singleValue("born-at"),
    type: singleValue("type"),
    domain: singleValue("domain"),
    label: singleValue("label"),
  })
  .superRefine(checkRequiredFields, { when: () => true });

export type CardFrontmatter = z.output<typeof cardFrontmatterSchema>;

function parentIdsOf(parent: readonly unknown[]): string[] {
  return parent.filter((v): v is string => typeof v === "string").map((v) => v.trim()).filter((v) => v !== "");
}

function textOf(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(textOf).join(",");
  return value === undefined ? "" : JSON.stringify(value);
}

function problemsOf(frontmatter: Record<string, unknown>): Problem[] {
  const checked = cardFrontmatterSchema.safeParse(frontmatter, { reportInput: true });
  if (checked.success) return [];
  return checked.error.issues.map((issue) => ({
    field: issue.path[0] as CardKey,
    value: issue.code === "custom" ? String(issue.params?.["value"] ?? "") : textOf(issue.input),
    reason: issue.message,
  }));
}

/** 单个值的字段：写成别的形状的已经报病，按没写处理，不替它转换 */
const singleValueOf = (value: unknown): string | null => (typeof value === "string" ? value : null);

function recordOf(id: string, path: string, frontmatter: Record<string, unknown>, body: string): { card: CardRecord; problems: Problem[] } {
  const problems: Problem[] = [];
  const type = singleValueOf(frontmatter["type"]);
  const parent = frontmatter["parent"];
  const { relations, broken } = extractRelations(body);
  for (const b of broken) {
    problems.push({ field: "relation", value: b.target, reason: `${b.key}:: 后须是 [文字](卡身份.md) 形态的一行` });
  }
  let milestones = null;
  if (type === "root") {
    const extracted = extractMilestones(body);
    milestones = extracted.milestones;
    for (const line of extracted.broken) {
      problems.push({ field: "milestone", value: line, reason: "里程碑行须是「- 日期｜标题｜说明」，日期以 YYYY-MM-DD 开头" });
    }
  }
  const card: CardRecord = {
    id,
    path,
    type,
    parent: Array.isArray(parent) ? parentIdsOf(parent) : [],
    domain: singleValueOf(frontmatter["domain"]),
    label: titleOf(id, singleValueOf(frontmatter["label"])),
    bornAt: singleValueOf(frontmatter["born-at"]) ?? "",
    relations,
    milestones,
  };
  return { card, problems };
}

/** 把一份卡文件的全文变成一条记录与单文件的病。不查正文里的钉码记号（见 readCardFile）。 */
export function parseCardFile(id: string, path: string, text: string): ParsedFile {
  let frontmatter: Record<string, unknown> | null;
  try {
    frontmatter = parseFrontmatter(text);
  } catch (err) {
    if (!(err instanceof FrontmatterError)) throw err;
    return { title: titleOf(id, null), description: null, card: null, problems: [{ field: "file", value: "", reason: err.message }] };
  }
  const fields = frontmatter ?? {};
  const description = singleValueOf(fields["description"]);
  if (!CARD_KEYS.some((key) => fields[key] !== undefined)) {
    return { title: titleOf(id, fields["title"]), description, card: null, problems: [] };
  }
  const { card, problems } = recordOf(id, path, fields, stripFrontmatter(text));
  return { title: card.label, description, card, problems: [...problemsOf(fields), ...problems] };
}

/** 一个卡文件单独能查出的全部：解析结果，加上卡正文里的钉码记号病（不是卡的文件不查）。 */
export function readCardFile(name: string, text: string): CardFileReading {
  const parsed = parseCardFile(cardIdOfFile(name), name, text);
  const pinMarkProblems = parsed.card === null ? [] : checkDocfirstRefs(stripFrontmatter(text));
  return { name, ...parsed, pinMarkProblems };
}
