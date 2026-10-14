/**
 * 星轨盘页的 loader：卡、病卡都从站点的卡集合取，跟卡正文同一个来源，不读盘。
 */

import { assembleCardSet } from "../core/card-set.ts";
import type { CardScan } from "../core/types.ts";
import type { CardCollectionEntry, TrajectorySite } from "./collection-entries.ts";
import type { DiskPageData } from "./page-data.ts";

/** 卡集合汇总成星轨盘的中性输入加病卡清单，跟命令行读同一个卡目录的结果逐位相同 */
export function cardScanOf(entries: readonly CardCollectionEntry[]): CardScan {
  return assembleCardSet(entries.map((entry) => entry.cardFile));
}

/** 星轨盘页的 loader */
export function diskPageLoader(_args: unknown, site: TrajectorySite): DiskPageData {
  return { scan: cardScanOf(site.cards.entries), siteName: site.siteName, hrefBase: site.hrefBase, docsHref: site.docsHref };
}
