/** 站点骨架里由本包模板写进去的模块（template/skeleton/app/lib/trajectory.ts），路由模块经别名 @site 读它 */
declare module "@site/lib/trajectory" {
  import type { MDXContent } from "mdx/types";
  import type { TOCItemType } from "fumadocs-core/toc";

  /** 一张卡：frontmatter 的字段原样在上面 */
  export interface TrajectoryCardEntry {
    [frontmatterKey: string]: unknown;
    /** path 相对轨迹卡目录 */
    info: { path: string; fullPath: string };
    /** 按需加载正文的组件，加载时挂起 */
    body: MDXContent;
    load(): Promise<{ body: MDXContent; toc: TOCItemType[] }>;
  }

  export const trajectoryCards: {
    entries: TrajectoryCardEntry[];
    get(path: string): TrajectoryCardEntry | undefined;
  };
}
