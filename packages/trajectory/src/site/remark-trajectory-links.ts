/**
 * 卡集合的 remark 插件：关系行加标记、卡链接改写成卡页地址。
 */

import { visit } from "unist-util-visit";
import type { Link, Paragraph, Root } from "mdast";
import { CARD_EXT } from "../core/card-files.ts";
import { cardIdFromHref, EDGE_HEAD } from "../core/refs.ts";

/**
 * 这几个 mdast 节点类型是本出口公共签名的一部分（`remarkTrajectoryLinks` 接收一棵 `Root`）。
 * dts 打包会把 mdast 的形状原样内联进产物的 `.d.mts`，跟使用方自己 `import type { Root } from "mdast"` 拿到的不是同一个名义类型，
 * 直接接会报「Root 不能赋给 Root」；使用方用从这里再导出的这一份。
 */
export type { Link, Paragraph, PhrasingContent, Root, Text } from "mdast";

export interface RemarkTrajectoryLinksOptions {
  /** 卡页地址前缀：形如卡身份的 `.md` / `.mdx` 链接改写成 `${hrefBase}/<卡身份>`。 */
  hrefBase: string;
}

/** 剥完之后这个主干像不像卡身份：非空、不带路径分隔、不以 `.md` / `.mdx` 结尾、不带 `:`
 * ——值来自正文链接，`https://…` 这类协议头得挡在外面。
 * 卡正文里除了引卡还会引材料（`../assets/x/README.md` 这类带路径的 .md）：那些没有卡身份
 * 语义，改写成卡页地址就会产生失效链接，原样留给站自己解析。 */
function looksLikeCardId(stem: string): boolean {
  return stem !== "" && !stem.includes("/") && !stem.includes("\\") && !stem.includes(":") && !CARD_EXT.test(stem);
}

/** remark 插件：正文里 `supersedes::` / `pivots-from::` 开头的段落改成
 * `<div class="trajectory-edge" data-kind="...">`；主干像卡身份的 `.md` / `.mdx` 链接
 * 改写成卡页地址，带路径的 `.md`（引材料）原样不动。 */
export function remarkTrajectoryLinks(options: RemarkTrajectoryLinksOptions) {
  const { hrefBase } = options;
  return (tree: Root): void => {
    /* hName / hProperties 是 mdast-util-to-hast 认的标准字段 */
    visit(tree, "paragraph", (node: Paragraph) => {
      const first = node.children[0];
      const text = first && first.type === "text" ? first.value : "";
      const m = EDGE_HEAD.exec(text);
      if (!m) return;
      const kind = m[1] === "supersedes" ? "supersede" : "pivot";
      const data = (node.data ??= {}) as Record<string, unknown>;
      data["hName"] = "div";
      data["hProperties"] = { className: "trajectory-edge", "data-kind": kind };
    });

    /* 判「是不是卡文件链接」要先剥掉 # 锚再看后缀，不然 `a.md#锚` 会被当成不以 .md 结尾漏改 */
    visit(tree, "link", (node: Link) => {
      const withoutHash = node.url.split("#")[0] ?? "";
      if (!CARD_EXT.test(withoutHash)) return;
      const stem = cardIdFromHref(node.url);
      if (!looksLikeCardId(stem)) return;
      node.url = `${hrefBase}/${stem}`;
    });
  };
}
