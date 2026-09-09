/**
 * 轨迹测试共用的最小积木：时间轴、合法卡的默认 frontmatter、内存造卡。
 * 内存造卡不绕开解析器：把 frontmatter 渲染回 markdown 文本、再走真实的 parseCardFile。
 */
import { parseCardFile } from "@godcreator02/livedoc-trajectory";
import type { Problem, RawCard, SickFile } from "@godcreator02/livedoc-trajectory";

/** 一月内的分钟级 born-at，合成 fixture 铺时间轴用。 */
export const D = (day: number): string => `2026-01-${String(day).padStart(2, "0")}T08:00`;

/** 一月内某日的天序数，跟 D() 的日期部分对齐。 */
export const DN = (day: number): string => `2026-01-${String(day).padStart(2, "0")}`;

export interface CardSpec {
  /** 文件名主干，即卡身份 */
  name: string;
  fm: Record<string, string | string[]>;
  body?: string;
}

/** 合法内卡的默认 frontmatter（fm 可覆盖造病卡）；关系边走 body inline field。 */
export const card = (
  name: string,
  fm: Record<string, string | string[]>,
  extra?: { body?: string },
): CardSpec => ({
  name,
  fm: { "born-at": D(1), label: "卡", parent: ["pj01"], ...fm },
  ...(extra?.body !== undefined ? { body: extra.body } : {}),
});

/** 项目根卡：顶级根卡不写 parent（不是「有个空列表」，是真没这个字段）。 */
export const root = (
  id: string,
  bornAt: string,
  extra?: { body?: string; fm?: Record<string, string | string[]> },
): CardSpec => ({
  name: id,
  fm: { type: "root", label: "测试项目", "born-at": bornAt, ...(extra?.fm ?? {}) },
  ...(extra?.body !== undefined ? { body: extra.body } : {}),
});

/** frontmatter 渲染回文本：列表走块式（带引号，与真实卡同形），空列表走流式 `[]`。 */
function renderFrontmatter(fm: Record<string, string | string[]>): string {
  const lines: string[] = [];
  for (const [key, value] of Object.entries(fm)) {
    if (Array.isArray(value)) {
      if (!value.length) lines.push(`${key}: []`);
      else {
        lines.push(`${key}:`);
        for (const item of value) lines.push(`  - "${item}"`);
      }
    } else lines.push(value === "" ? `${key}: ""` : `${key}: ${value}`);
  }
  return lines.join("\n");
}

function renderCard(spec: CardSpec): string {
  return `---\n${renderFrontmatter(spec.fm)}\n---\n\n${spec.body ?? ""}\n`;
}

/** 内存造一批卡：走真实解析器，mtime 一律 0。 */
export function memCards(specs: CardSpec[]): RawCard[] {
  const cards: RawCard[] = [];
  for (const spec of specs) {
    const parsed = parseCardFile(spec.name, `${spec.name}.md`, 0, renderCard(spec));
    if (parsed.card) cards.push(parsed.card);
  }
  return cards;
}

/** 内存造卡的报病清单（按文件归拢，与 scanDir 同口径）。 */
export function memSick(specs: CardSpec[]): SickFile[] {
  const sick: SickFile[] = [];
  for (const spec of specs) {
    const parsed = parseCardFile(spec.name, `${spec.name}.md`, 0, renderCard(spec));
    if (parsed.card && parsed.problems.length) {
      sick.push({ path: parsed.card.path, problems: parsed.problems });
    }
  }
  return sick;
}

/** 摊平成一张病清单：断言里不关心分在哪个文件时用。 */
export function flatProblems(sick: SickFile[]): Array<Problem & { path: string }> {
  return sick.flatMap((f) => f.problems.map((p) => ({ path: f.path, ...p })));
}
