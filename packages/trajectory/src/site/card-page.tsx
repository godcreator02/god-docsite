/**
 * 卡页：在整站布局里显示一张卡的正文，标题下一行是出生时间、类型、领域与父卡。
 * 数据用 useLoaderData 从卡页 loader 取，正文从站点传入的浏览器端加载表取。
 */

import { use } from "react";
import type { MDXComponents } from "mdx/types";
import { Link, useLoaderData } from "react-router";
import { DocsBody, DocsPage, DocsTitle } from "@fumadocs/base-ui/layouts/docs/page";
import type { CardPageData, CardPageFields } from "./page-data.ts";
import { cardHrefOf } from "./collection-entries.ts";
import { cardBodyLoadersById, cardBodyPromise, type CardBodies } from "./card-bodies.tsx";

export interface CardPageProps {
  /** 站点卡集合在浏览器端的正文加载表（`.source/browser` 里卡集合的 raw） */
  bodies: CardBodies;
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
              <Link to={cardHrefOf(hrefBase, id)}>{id}</Link>
            </span>
          ))}
        </>
      ) : null}
    </div>
  );
}

export function CardPage({ bodies, components }: CardPageProps) {
  const { card, siteName, hrefBase } = useLoaderData<CardPageData>();
  const load = cardBodyLoadersById(bodies).get(card.id);
  if (load === undefined) throw new Error(`浏览器端的卡集合里没有这张卡：${card.id}`);
  const { default: Body, toc } = use(cardBodyPromise(load));
  return (
    <DocsPage toc={toc}>
      <title>{`${card.title} · ${siteName}`}</title>
      <DocsTitle>{card.title}</DocsTitle>
      <CardLine card={card} hrefBase={hrefBase} />
      <Link className="trajectory-card-back" to={hrefBase}>
        ← 回到星轨盘
      </Link>
      <DocsBody>
        <Body components={components} />
      </DocsBody>
    </DocsPage>
  );
}
