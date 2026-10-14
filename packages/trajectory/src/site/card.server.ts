/**
 * 卡页 `${hrefBase}/<卡身份>` 的 loader：数据只从站点的卡集合取。
 */

import type { CardCollectionEntry, TrajectorySite } from "./collection-entries.ts";
import { entriesByCardId } from "./collection-entries.ts";
import type { CardPageData, CardPageFields } from "./page-data.ts";

/** 卡集合里身份为 id 的那一页的字段；没有这一页回 null */
export function cardPageFieldsOf(entries: readonly CardCollectionEntry[], id: string): CardPageFields | null {
  const entry = entriesByCardId(entries).get(id);
  if (entry === undefined) return null;
  const { title, card } = entry.cardFile;
  return {
    id,
    title,
    bornAt: card === null || card.bornAt === "" ? null : card.bornAt,
    type: card?.type ?? null,
    domain: card?.domain ?? null,
    parents: card?.parent ?? [],
  };
}

/** 卡页的 loader：路由写成 `${hrefBase}/*`，卡身份是 `*` 那一段；没有这张卡回 404 */
export function cardPageLoader({ params }: { params: Readonly<Record<string, string | undefined>> }, site: TrajectorySite): CardPageData {
  const card = cardPageFieldsOf(site.cards.entries, params["*"] ?? "");
  if (card === null) throw new Response("没有这张卡", { status: 404 });
  return { card, siteName: site.siteName, hrefBase: site.hrefBase };
}
