/// <reference types="@godcreator/docsite-kit/site-modules" />
/**
 * 卡页 `/trajectory/<卡身份>`：在整站布局里显示一张卡的正文，标题下一行是出生时间、类型、领域与父卡
 */
import { use } from "react";
import { useLoaderData, type LoaderFunctionArgs } from "react-router";
import { DocsBody, DocsPage, DocsTitle } from "@fumadocs/base-ui/layouts/docs/page";
import { mdxComponents } from "@site/lib/mdx-components";
import { siteName } from "@site/lib/source.server";
import { trajectoryCards, type TrajectoryCardEntry } from "@site/lib/trajectory";
import { cardFieldsOf, type CardFields } from "../card-fields.ts";
import { cardIdOf, trajectoryHrefBase } from "../trajectory-href.ts";

const cardEntryOf = (id: string): TrajectoryCardEntry | undefined => trajectoryCards.entries.find((entry) => cardIdOf(entry.info.path) === id);

export function loader({ params }: LoaderFunctionArgs) {
  const entry = cardEntryOf(params["*"] ?? "");
  if (entry === undefined) throw new Response("没有这张卡", { status: 404 });
  return { card: cardFieldsOf(entry), siteName: siteName() };
}

function CardLine({ card }: { card: CardFields }) {
  const parts = [card.bornAt, card.type, card.domain].filter((part) => part !== null);
  return (
    <div className="docfirst-card-line">
      {parts.join(" · ")}
      {card.parents.length > 0 ? (
        <>
          {" · 父卡："}
          {card.parents.map((id, index) => (
            <span key={id}>
              {index > 0 ? "、" : ""}
              <a href={`${trajectoryHrefBase}/${encodeURIComponent(id)}`}>{id}</a>
            </span>
          ))}
        </>
      ) : null}
    </div>
  );
}

export default function CardPage() {
  const { card, siteName } = useLoaderData<typeof loader>();
  const entry = cardEntryOf(card.id);
  if (entry === undefined) throw new Error(`浏览器端没有这张卡：${card.id}`);
  const { body: Body, toc } = use(entry.load());
  return (
    <DocsPage toc={toc}>
      <title>{`${card.title} · ${siteName}`}</title>
      <DocsTitle>{card.title}</DocsTitle>
      <CardLine card={card} />
      <a className="docfirst-card-back" href={trajectoryHrefBase}>
        ← 回到星轨盘
      </a>
      <DocsBody>
        <Body components={mdxComponents} />
      </DocsBody>
    </DocsPage>
  );
}
