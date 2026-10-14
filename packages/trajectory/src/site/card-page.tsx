/**
 * 卡页：在整站布局里显示一张卡的正文，标题下一行是出生时间、类型、领域与父卡。
 */

import { use, type ComponentProps } from "react";
import type { MDXComponents, MDXContent } from "mdx/types";
import { DocsBody, DocsPage, DocsTitle } from "@fumadocs/base-ui/layouts/docs/page";
import type { CardPageData, CardPageFields } from "./page-data.ts";
import type { CardCollectionEntry } from "./collection-entries.ts";
import { cardHrefOf, entriesByCardId } from "./collection-entries.ts";

/** 卡集合里的一页在浏览器端要用的部分：正文按需加载 */
export interface CardBodyEntry extends CardCollectionEntry {
  load: () => Promise<{ body: MDXContent; toc: ComponentProps<typeof DocsPage>["toc"] }>;
}

export interface CardPageProps {
  /** 卡页 loader 交回的数据 */
  data: CardPageData;
  /** 站点声明的卡集合 */
  cards: { entries: readonly CardBodyEntry[] };
  /** 站点的 MDX 组件表 */
  components: MDXComponents;
}

function CardLine({ card, hrefBase }: { card: CardPageFields; hrefBase: string }) {
  const parts = [card.bornAt, card.type, card.domain].filter((part) => part !== null);
  return (
    <div className="trajectory-card-line">
      {parts.join(" · ")}
      {card.parents.length > 0 ? (
        <>
          {" · 父卡："}
          {card.parents.map((id, index) => (
            <span key={id}>
              {index > 0 ? "、" : ""}
              <a href={cardHrefOf(hrefBase, id)}>{id}</a>
            </span>
          ))}
        </>
      ) : null}
    </div>
  );
}

export function CardPage({ data, cards, components }: CardPageProps) {
  const { card, siteName, hrefBase } = data;
  const entry = entriesByCardId(cards.entries).get(card.id);
  if (entry === undefined) throw new Error(`浏览器端的卡集合里没有这张卡：${card.id}`);
  const { body: Body, toc } = use(entry.load());
  return (
    <DocsPage toc={toc}>
      <title>{`${card.title} · ${siteName}`}</title>
      <DocsTitle>{card.title}</DocsTitle>
      <CardLine card={card} hrefBase={hrefBase} />
      <a className="trajectory-card-back" href={hrefBase}>
        ← 回到星轨盘
      </a>
      <DocsBody>
        <Body components={components} />
      </DocsBody>
    </DocsPage>
  );
}
