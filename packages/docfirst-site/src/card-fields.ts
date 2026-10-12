import type { TrajectoryCardEntry } from "@site/lib/trajectory";
import { cardIdOf } from "./trajectory-href.ts";

/** 卡页标题下那一行要的字段 */
export interface CardFields {
  id: string;
  title: string;
  bornAt: string | null;
  type: string | null;
  domain: string | null;
  parents: string[];
}

const textOf = (value: unknown): string | null => (typeof value === "string" && value.trim() !== "" ? value.trim() : null);

/**
 * 只取字段，不校验：卡写得对不对由 docfirst check 报。标题是 label，没有就用卡身份；
 * 只写到日的 born-at 被 YAML 读成 Date，换回 YYYY-MM-DD
 */
export function cardFieldsOf(entry: TrajectoryCardEntry): CardFields {
  const id = cardIdOf(entry.info.path);
  const bornAt = entry["born-at"];
  const parent = entry["parent"];
  return {
    id,
    title: textOf(entry["label"]) ?? textOf(entry["title"]) ?? id,
    bornAt: bornAt instanceof Date ? bornAt.toISOString().slice(0, 10) : textOf(bornAt),
    type: textOf(entry["type"]),
    domain: textOf(entry["domain"]),
    parents: Array.isArray(parent) ? parent.map(String) : [],
  };
}
