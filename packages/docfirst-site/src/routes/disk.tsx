/// <reference types="@godcreator/docsite-kit/site-modules" />
/**
 * 星轨盘 `/trajectory`：整个窗口就是盘，不在整站布局里。顶栏由这一页画（回文档、病卡数、主题切换），
 * 搜索、图例、日期轨是星轨盘组件自己的浮层。每张卡的正文交给盘，点节点在盘右侧看，不跳页
 */
import { Suspense, type ReactNode } from "react";
import { Link, useLoaderData } from "react-router";
import { DocsBody } from "@fumadocs/base-ui/layouts/docs/page";
import { ThemeSwitch } from "@fumadocs/base-ui/layouts/shared/slots/theme-switch";
import { StarDisk } from "@godcreator/trajectory-disk/disk";
import { loadProject } from "@godcreator/docfirst-workflow";
import { scanCardDir } from "@godcreator/docfirst-workflow/cards";
import { mdxComponents } from "@site/lib/mdx-components";
import { siteName, sitePageRefs } from "@site/lib/source.server";
import { trajectoryCards } from "@site/lib/trajectory";
import { cardIdOf, trajectoryHrefBase } from "../trajectory-href.ts";

/** 顶栏「← 文档」回到的页：现状区 /docs 的第一页，没有就回站里第一页 */
function docsHomeOf(pages: ReadonlyArray<{ url: string }>): string {
  return (pages.find((page) => page.url === "/docs" || page.url.startsWith("/docs/")) ?? pages[0])?.url ?? "/";
}

export async function loader() {
  const project = await loadProject(process.cwd());
  return { scan: await scanCardDir(project.trajectoryDir), siteName: siteName(), docsHome: docsHomeOf(sitePageRefs()) };
}

/** 卡身份 → 正文：正文按需加载，点到哪张才加载哪张 */
function cardBodies(): Record<string, ReactNode> {
  return Object.fromEntries(
    trajectoryCards.entries.map((entry) => {
      const Body = entry.body;
      return [
        cardIdOf(entry.info.path),
        <Suspense key={entry.info.path} fallback={null}>
          <DocsBody>
            <Body components={mdxComponents} />
          </DocsBody>
        </Suspense>,
      ];
    }),
  );
}

export default function TrajectoryDiskPage() {
  const { scan, siteName, docsHome } = useLoaderData<typeof loader>();
  return (
    <div className="trajectory-page star-surface">
      <title>{`轨迹 · ${siteName}`}</title>
      <header className="trajectory-topbar">
        <Link to={docsHome}>← 文档</Link>
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
        <StarDisk data={scan} hrefBase={trajectoryHrefBase} bodies={cardBodies()} />
      </div>
    </div>
  );
}
