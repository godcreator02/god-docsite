/**
 * 卡正文在浏览器里按需加载：站点把卡集合的浏览器端加载表（fumadocs-mdx `.source/browser` 里卡集合的 raw）传进来，
 * 键是相对卡目录的文件路径（带 `./` 前缀），值加载出编译好的正文模块。
 */

import { use, type ComponentProps, type FC, type ReactNode } from "react";
import type { MDXComponents } from "mdx/types";
import type { DocsPage } from "@fumadocs/base-ui/layouts/docs/page";
import { cardIdOfFile, pickCardFiles } from "../core/card-files.ts";

/** 一张卡编译好的正文模块里卡页、星轨盘页用到的部分（fumadocs-mdx 编译出的 default 是返回 ReactNode 的组件，比 mdx/types 的 MDXContent 宽） */
export interface CardBodyModule {
  default: FC<{ components?: MDXComponents }>;
  toc?: ComponentProps<typeof DocsPage>["toc"];
}

export type CardBodyLoader = () => Promise<CardBodyModule>;

/** 卡集合在浏览器端的正文加载表：文件路径（带 `./`）→ 加载函数 */
export type CardBodies = Readonly<Record<string, CardBodyLoader>>;

/** 卡身份 → 加载正文的函数。同一身份 .md 与 .mdx 都在时取 .mdx，跟服务端按身份找页同一条规则 */
export function cardBodyLoadersById(bodies: CardBodies): Map<string, CardBodyLoader> {
  const loaderOfName = new Map(Object.entries(bodies).map(([key, load]) => [key.replace(/^\.\//, ""), load]));
  return new Map(pickCardFiles([...loaderOfName.keys()]).map((name) => [cardIdOfFile(name), loaderOfName.get(name) as CardBodyLoader]));
}

const loadingBodies = new WeakMap<CardBodyLoader, Promise<CardBodyModule>>();

/** use() 每次渲染要拿到同一个 promise：同一个加载函数只调一次 */
export function cardBodyPromise(load: CardBodyLoader): Promise<CardBodyModule> {
  const loading = loadingBodies.get(load) ?? load();
  loadingBodies.set(load, loading);
  return loading;
}

/** 一张卡的正文：加载完之前挂起 */
export function CardBody({ load, components }: { load: CardBodyLoader; components: MDXComponents }): ReactNode {
  const { default: Body } = use(cardBodyPromise(load));
  return <Body components={components} />;
}
