/**
 * 星轨盘页：整个窗口就是盘，不在整站布局里。顶栏由这一页画（回文档、病卡数、主题切换），
 * 搜索、图例、日期轨是星轨盘组件自己的浮层。每张卡的正文交给盘，点节点在盘右侧看，不跳页。
 */

import { Suspense, type ReactNode } from "react";
import type { MDXComponents, MDXContent } from "mdx/types";
import { Link } from "react-router";
import { DocsBody } from "@fumadocs/base-ui/layouts/docs/page";
import { ThemeSwitch } from "@fumadocs/base-ui/layouts/shared/slots/theme-switch";
import type { CardCollectionEntry } from "./collection-entries.ts";
import { entriesByCardId } from "./collection-entries.ts";
import type { DiskPageData } from "./page-data.ts";
import { StarDisk } from "./disk/disk.tsx";

/** 卡集合里的一页在浏览器端要用的部分：正文组件，点到哪张才加载哪张 */
export interface DiskBodyEntry extends CardCollectionEntry {
  body: MDXContent;
}

export interface DiskPageProps {
  /** 星轨盘页 loader 交回的数据 */
  data: DiskPageData;
  /** 站点声明的卡集合 */
  cards: { entries: readonly DiskBodyEntry[] };
  /** 站点的 MDX 组件表 */
  components: MDXComponents;
}

/** 卡身份 → 正文 */
function cardBodiesOf(entries: readonly DiskBodyEntry[], components: MDXComponents): Record<string, ReactNode> {
  return Object.fromEntries(
    [...entriesByCardId(entries)].map(([id, entry]) => {
      const Body = entry.body;
      return [
        id,
        <Suspense key={id} fallback={null}>
          <DocsBody>
            <Body components={components} />
          </DocsBody>
        </Suspense>,
      ];
    }),
  );
}

export function DiskPage({ data, cards, components }: DiskPageProps) {
  const { scan, siteName, hrefBase, docsHref } = data;
  return (
    <div className="trajectory-page star-surface">
      <title>{`轨迹 · ${siteName}`}</title>
      <header className="trajectory-topbar">
        <Link to={docsHref}>← 文档</Link>
        <div className="trajectory-topbar-right">
          {scan.sick.length > 0 ? (
            <span className="trajectory-sick" title={scan.sick.map((file) => file.path).join("\n")}>
              报病 {scan.sick.length}
            </span>
          ) : null}
          <ThemeSwitch mode="light-dark" />
        </div>
      </header>
      <div className="trajectory-stage">
        <StarDisk data={scan} hrefBase={hrefBase} bodies={cardBodiesOf(cards.entries, components)} />
      </div>
    </div>
  );
}
