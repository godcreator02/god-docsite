/**
 * loader 交给页面组件的数据：loader 在 *.server.ts，组件只认这里的形状。
 */

import type { CardScan } from "../core/types.ts";

/** 卡页标题下那一行要的字段；不是卡的页（卡集合里的导读页）只有标题 */
export interface CardPageFields {
  id: string;
  title: string;
  bornAt: string | null;
  type: string | null;
  domain: string | null;
  parents: string[];
}

export interface CardPageData {
  card: CardPageFields;
  siteName: string;
  hrefBase: string;
}

export interface DiskPageData {
  scan: CardScan;
  siteName: string;
  hrefBase: string;
  docsHref: string;
}
