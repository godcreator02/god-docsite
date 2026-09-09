/**
 * 解析与 AI 渲染。
 *   parseTree   自己起 remark 认树：parse / write / 名册检查用，不碰 fumadocs
 *   renderAi    不自己序列化：让 fumadocs 的 loader 编译这篇 mdx，读它导出的 _markdown。
 *               站的 getText("processed") 读的是同一个导出，所以两边逐字节相同是同一条管线的结果。
 * fumadocs 从消费方项目根解析：本包只声明 peer，不带自己的一份。
 */
import { createRequire } from "node:module";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkFrontmatter from "remark-frontmatter";
import remarkMdx from "remark-mdx";
import type { Listing, RenderContext } from "../engine/index.ts";
import type { TreeNode } from "./tree.ts";

export function parseTree(text: string): TreeNode {
  return unified().use(remarkParse).use(remarkFrontmatter).use(remarkMdx).parse(text) as unknown as TreeNode;
}

let registered = false;

/** renderAi 从项目配置里只看这两项：文档目录表和 fumadocs 的集合名 */
interface CollectionConfig {
  docs?: string | string[];
  fumadocs?: { collection?: string | Record<string, string> };
}

/**
 * 这篇文档该按哪个集合编译。fumadocs 的 loader 靠 `?collection=` 才知道该跑哪份 postprocess，
 * 而集合是按目录分的（六区站一区一个）。规则依次是：
 *   `fumadocs.collection` 给了字符串——全部文档同一个集合，照旧；
 *   给了表——按文档所在的文档目录查（`content/outputs` → `outputs`）；
 *   都没给——集合名就是文档目录的最后一截（`content/docs` → `docs`，`docs` → `docs`），
 *   跟 `defineDocs` 的变量名按目录起的习惯对上。文档不在任何文档目录下退 `docs`。
 */
export function collectionOf(config: CollectionConfig | undefined, doc: string): string {
  const want = config?.fumadocs?.collection;
  if (typeof want === "string") return want;
  const raw = config?.docs ?? "docs";
  const dirs = (Array.isArray(raw) ? raw : [raw]).map((dir) => dir.replace(/\\/g, "/").replace(/\/+$/, ""));
  // 目录套目录时取最长的那个：`content` 与 `content/outputs` 同时配着，outputs 下的页归后者
  const home = dirs.filter((dir) => doc.startsWith(`${dir}/`)).sort((a, b) => b.length - a.length)[0];
  if (home === undefined) return "docs";
  const named = want?.[home];
  if (typeof named === "string") return named;
  return home.split("/").pop() ?? "docs";
}

/**
 * @param _text     不用：fumadocs 自己读文件
 * @param _listing  不用：清单在 remark 插件里现算
 * 集合名按 collectionOf 定：默认跟文档目录的最后一截同名，项目在 livedoc.config.mjs 的 fumadocs.collection 里改。
 */
export async function renderAi(_text: string, _listing: Listing, ctx: RenderContext): Promise<string> {
  const req = createRequire(join(ctx.root, "package.json"));
  if (!registered) {
    const { register } = (await import(pathToFileURL(req.resolve("fumadocs-mdx/node")).href)) as { register: () => void };
    register();
    registered = true;
  }
  const collection = collectionOf(ctx.config as CollectionConfig | undefined, ctx.doc);
  const mod = (await import(`${pathToFileURL(join(ctx.root, ctx.doc)).href}?collection=${collection}`)) as { _markdown?: unknown };
  if (typeof mod._markdown !== "string") {
    throw new Error(
      `${ctx.doc}：编译产物里没有 _markdown——source.config 里集合 ${collection} 的 postprocess.includeProcessedMarkdown 要给 livedocMarkdownOptions()`,
    );
  }
  return mod._markdown;
}
