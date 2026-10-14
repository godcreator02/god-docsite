/**
 * 站点声明卡集合时用的两样东西：schema `cardSchema` 与 mdx 选项 `cardMdxOptions`。只在构建期由 fumadocs-mdx 在 Node 里调用。
 * 集合本身由站点声明（fumadocs-mdx 要求集合宏的 dir 是字符串字面量）：
 *
 *   export const trajectoryCards = defineCollections({
 *     type: 'doc', dir: 'trajectory', async: true,
 *     schema: cardSchema,
 *     mdxOptions: cardMdxOptions({ hrefBase: '/trajectory' }),
 *   })
 */

import type { StandardSchemaV1 } from "@standard-schema/spec";
import { applyMdxPreset } from "fumadocs-mdx/config";
import { readCardFile } from "../core/card.ts";
import type { CardFileReading } from "../core/types.ts";
import { remarkTrajectoryLinks } from "./remark-trajectory-links.ts";

/** 卡集合里每一页的数据：页面标题与说明，加上这个文件单独读出的全部（卡记录与它自己的病）。
 * 卡页、星轨盘页都只从这里取，不再读盘 */
export interface CardEntryData {
  title: string;
  description?: string;
  cardFile: CardFileReading;
}

/** fumadocs-mdx 调 schema 工厂时给的上下文：path 是文件的绝对路径，source 是文件全文 */
export interface CardSchemaContext {
  path: string;
  source: string;
}

const fileNameOf = (path: string): string => path.split(/[\\/]/).at(-1) as string;

/** 卡集合每一页的数据从文件全文读出：用的是 core 的同一种 frontmatter 读法，不用 fumadocs 解析好的值
 * （它把只写到日的 born-at 读成 Date）。不校验：卡写得对不对由命令行检查报，病跟着数据走，星轨盘页数得出病卡 */
export function cardEntryDataOf(name: string, source: string): CardEntryData {
  const cardFile = readCardFile(name, source);
  return { title: cardFile.title, ...(cardFile.description === null ? {} : { description: cardFile.description }), cardFile };
}

/** 卡集合的 schema：fumadocs-mdx 支持 `(ctx) => Schema` 工厂，拿 ctx.source 读全文 */
export function cardSchema(ctx: CardSchemaContext): StandardSchemaV1<unknown, CardEntryData> {
  const data = cardEntryDataOf(fileNameOf(ctx.path), ctx.source);
  return {
    "~standard": {
      version: 1,
      vendor: "@godcreator/trajectory",
      validate: () => ({ value: data }),
    },
  };
}

export interface CardMdxOptions {
  /** 卡页地址前缀，正文里指向别的卡的链接改写成 `${hrefBase}/<卡身份>` */
  hrefBase: string;
}

/** 卡集合的 mdx 选项：fumadocs 的默认预设（GFM、标题锚点、代码高亮）之后接上卡链接改写。
 * 集合级 mdxOptions 写成普通对象时 fumadocs-mdx 不套默认预设，所以一定经 applyMdxPreset */
export function cardMdxOptions({ hrefBase }: CardMdxOptions): ReturnType<typeof applyMdxPreset> {
  return applyMdxPreset({ remarkPlugins: (defaults) => [...defaults, [remarkTrajectoryLinks, { hrefBase }]] });
}
