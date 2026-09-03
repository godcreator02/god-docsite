/**
 * 解析与 AI 渲染。
 *   parseTree   自己起 remark 认树：parse / write / 名册检查用，不碰 fumadocs
 *   renderAi    不自己序列化：让 fumadocs 的 loader 编译这篇 mdx，读它导出的 _markdown。
 *               站的 getText("processed") 读的是同一个导出，所以两边逐字节相同是同一条管线的结果。
 * fumadocs 从消费方项目根解析：这个包只声明 peer，不带自己的一份。
 */
import { createRequire } from "node:module";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkFrontmatter from "remark-frontmatter";
import remarkMdx from "remark-mdx";
import type { Listing, RenderContext } from "@god-live-doc/core";
import type { TreeNode } from "./tree.ts";

export function parseTree(text: string): TreeNode {
  return unified().use(remarkParse).use(remarkFrontmatter).use(remarkMdx).parse(text) as unknown as TreeNode;
}

let registered = false;

/**
 * @param _text     不用：fumadocs 自己读文件
 * @param _listing  不用：清单在 remark 插件里现算
 * 集合名默认 docs，项目在 livedoc.config.mjs 的 fumadocs.collection 里改——fumadocs 的 loader
 * 靠 `?collection=` 才知道这篇属于哪个集合、该跑哪份 postprocess。
 */
export async function renderAi(_text: string, _listing: Listing, ctx: RenderContext): Promise<string> {
  const req = createRequire(join(ctx.root, "package.json"));
  if (!registered) {
    const { register } = (await import(pathToFileURL(req.resolve("fumadocs-mdx/node")).href)) as { register: () => void };
    register();
    registered = true;
  }
  const collection = (ctx.config as { fumadocs?: { collection?: string } } | undefined)?.fumadocs?.collection ?? "docs";
  const mod = (await import(`${pathToFileURL(join(ctx.root, ctx.doc)).href}?collection=${collection}`)) as { _markdown?: unknown };
  if (typeof mod._markdown !== "string") {
    throw new Error(
      `${ctx.doc}：编译产物里没有 _markdown——source.config 里集合 ${collection} 的 postprocess.includeProcessedMarkdown 要给 livedocMarkdownOptions()`,
    );
  }
  return mod._markdown;
}
