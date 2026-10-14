/**
 * 站点卡集合里的页：只用到 cardSchema 给每一页存下的 cardFile，所以按结构写类型，不依赖 fumadocs 的集合类型。
 */

import { cardIdOfFile, pickCardFiles } from "../core/card-files.ts";
import type { CardFileReading } from "../core/types.ts";

/** 卡集合里的一页（fumadocs-mdx 把 schema 的输出摊在页上） */
export interface CardCollectionEntry {
  cardFile: CardFileReading;
}

/** 站点交给卡页、星轨盘页的站点信息，全部经参数传入 */
export interface TrajectorySite<Entry extends CardCollectionEntry = CardCollectionEntry> {
  /** 站点声明的卡集合 */
  cards: { entries: readonly Entry[] };
  siteName: string;
  /** 星轨盘的地址；卡页是 `${hrefBase}/<卡身份>` */
  hrefBase: string;
  /** 星轨盘顶栏「← 文档」回到的地址 */
  docsHref: string;
}

/** 卡身份 → 那一页。同一身份 .md 与 .mdx 都在时取 .mdx，跟汇总病卡时同一条规则 */
export function entriesByCardId<Entry extends CardCollectionEntry>(entries: readonly Entry[]): Map<string, Entry> {
  const kept = new Set(pickCardFiles(entries.map((entry) => entry.cardFile.name)));
  return new Map(entries.filter((entry) => kept.has(entry.cardFile.name)).map((entry) => [cardIdOfFile(entry.cardFile.name), entry]));
}

/** 卡页地址 */
export const cardHrefOf = (hrefBase: string, id: string): string => `${hrefBase}/${encodeURIComponent(id)}`;
