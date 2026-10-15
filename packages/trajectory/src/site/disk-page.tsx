/**
 * 星轨盘页：整个窗口就是盘，不在整站布局里。顶栏由这一页画（回文档、病卡数、主题切换），
 * 搜索、图例、日期轨是星轨盘组件自己的浮层。每张卡的正文交给盘，点节点在盘右侧看，不跳页。
 * 数据用 useLoaderData 从星轨盘页 loader 取，正文从站点传入的浏览器端加载表取，点到哪张才加载哪张。
 */

import { Suspense, type ReactNode } from "react";
import type { MDXComponents } from "mdx/types";
import { Link, useLoaderData } from "react-router";
import { DocsBody } from "@fumadocs/base-ui/layouts/docs/page";
import { ThemeSwitch } from "@fumadocs/base-ui/layouts/shared/slots/theme-switch";
import type { DiskPageData } from "./page-data.ts";
import { CardBody, cardBodyLoadersById, type CardBodies } from "./card-bodies.tsx";
import { StarDisk } from "./disk/disk.tsx";

export interface DiskPageProps {
  /** 站点卡集合在浏览器端的正文加载表（`.source/browser` 里卡集合的 raw） */
  bodies: CardBodies;
  /** 站点的 MDX 组件表 */
  components: MDXComponents;
}

/** 卡身份 → 正文 */
function cardBodiesOf(bodies: CardBodies, components: MDXComponents): Record<string, ReactNode> {
  return Object.fromEntries(
    [...cardBodyLoadersById(bodies)].map(([id, load]) => [
      id,
      <Suspense key={id} fallback={null}>
        <DocsBody>
          <CardBody load={load} components={components} />
        </DocsBody>
      </Suspense>,
    ]),
  );
}

export function DiskPage({ bodies, components }: DiskPageProps) {
  const { scan, siteName, hrefBase, docsHref } = useLoaderData<DiskPageData>();
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
        <StarDisk data={scan} hrefBase={hrefBase} bodies={cardBodiesOf(bodies, components)} />
      </div>
    </div>
  );
}
