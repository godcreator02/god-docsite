/**
 * fumadocs 卡集合要用的两样东西：frontmatter schema `cardSchema`，与正文关系边 / `.md` 链接改写的
 * remark 插件 `remarkTrajectoryLinks`。站的 `src/lib/source.ts` 在轨迹卡集合的配置里用它们，
 * 都只在构建期的服务端跑。卡格式本身（哪几个字段算卡、链接怎么认出卡身份）从 workflow 的卡格式取；
 * 卡写得对不对由 `docfirst check` 校验，这里不再校验。
 */

import { basename } from "node:path";
import { visit } from "unist-util-visit";
import type { Link, Paragraph, Root } from "mdast";
/**
 * 这几个 mdast 节点类型是本出口公共签名的一部分（`remarkTrajectoryLinks` 接收一棵 `Root`）。
 * **消费方要用的是从这儿再导出的这一份**：dts 打包会把 mdast 的形状原样内联进产物的 `.d.mts`，
 * 那份跟消费方自己 `import type { Root } from "mdast"` 拿到的不是同一个名义类型，直接接会报
 * 「Root 不能赋给 Root」这种看不出原因的错。再导出一次，产物与消费方用的就是同一个类型。
 */
export type { Link, Paragraph, PhrasingContent, Root, Text } from "mdast";
// 类型专用：不引 zod、不引任何校验库，schema 对象仍是手写的字面量——只借这份官方类型
// 声明来确保结构精确匹配协议（Result 判别联合的边角很容易手抄漏一个 `?`），
// devDependency、`import type` 编译期全擦除，dts 打包时会把用到的形状原样内联进
// 产物的 .d.mts（跟 mdast 的类型是同一个道理），消费方不需要另装这个包。
import type { StandardSchemaV1 } from "@standard-schema/spec";
import { CARD_EXT, CARD_KEYS, cardIdFromHref, EDGE_HEAD, ID_DATE_PREFIX } from "@godcreator/docfirst-workflow/cards";

/* ================= cardSchema：fumadocs 卡集合的 frontmatter schema ================= */

/** 卡页渲染需要的字段：label 派生成 title（缺 label 时退到文件名，见下），其余原样透出，
 * born-at 若被 fumadocs 自己的 YAML 解析成 Date（日级写法的已知问题，卡格式自己的
 * `parseFrontmatter` 绕开了它，但 fumadocs 用的是它自己的 gray-matter，避免不了）就转回字符串。
 * 同一集合里不是卡的页（`trajectory/index.mdx` 这种导读页）只有 title / description。 */
export interface CardFrontmatter {
  title: string;
  description?: string;
  label?: string;
  type?: string;
  domain?: string;
  parent?: string[];
  "born-at"?: string;
}

/** 只派生页面要的字段，不校验：卡写得对不对由 `docfirst check` 报。label 缺失时退到文件名，跟星轨盘上的短名一致。
 * 卡体系字段（CARD_KEYS）一个都没有的文件不是卡（跟 parseCardFile 同一条判据）：当普通页处理，
 * title 取 frontmatter 的 title、缺了退到文件名——卡集合里的导读页靠这条渲染成页面。
 * fumadocs-mdx 的 schema 支持传一个 `(ctx) => Schema` 工厂（ctx 带 path），
 * 用工厂形态是为了在缺 label 时能拿到文件名。对象字面量手写、不 new 任何校验库的类。 */
export function cardSchema(ctx: { path: string; source: string }): StandardSchemaV1<unknown, CardFrontmatter> {
  const fallbackTitle = basename(ctx.path).replace(CARD_EXT, "").replace(ID_DATE_PREFIX, "");
  return {
    "~standard": {
      version: 1,
      vendor: "trajectory-disk",
      validate(value: unknown): StandardSchemaV1.Result<CardFrontmatter> {
        const fm = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
        const description = typeof fm["description"] === "string" ? { description: fm["description"] as string } : {};
        if (!CARD_KEYS.some((key) => fm[key] !== undefined)) {
          const plainTitle = typeof fm["title"] === "string" ? (fm["title"] as string).trim() : "";
          return { value: { title: plainTitle || fallbackTitle, ...description } };
        }
        const bornAtRaw = fm["born-at"];
        const bornAt =
          bornAtRaw === undefined || bornAtRaw === null || bornAtRaw === ""
            ? undefined
            : bornAtRaw instanceof Date
              ? bornAtRaw.toISOString().slice(0, 10)
              : String(bornAtRaw);
        const labelRaw = typeof fm["label"] === "string" ? (fm["label"] as string).trim() : "";
        const title = labelRaw || fallbackTitle;
        const parentRaw = fm["parent"];
        const parent = Array.isArray(parentRaw) ? parentRaw.map((v) => String(v)) : undefined;
        const card: CardFrontmatter = {
          title,
          ...(bornAt !== undefined ? { "born-at": bornAt } : {}),
          ...description,
          ...(labelRaw ? { label: labelRaw } : {}),
          ...(typeof fm["type"] === "string" ? { type: fm["type"] as string } : {}),
          ...(typeof fm["domain"] === "string" ? { domain: fm["domain"] as string } : {}),
          ...(parent ? { parent } : {}),
        };
        return { value: card };
      },
    },
  };
}

/* ================= remarkTrajectoryLinks：关系边加标记 + 链接改写 ================= */

export interface RemarkTrajectoryLinksOptions {
  /** 卡页路由前缀：形如卡身份的 `.md` / `.mdx` 链接改写成 `${hrefBase}/<卡身份>`。 */
  hrefBase: string;
}

/** 剥完之后这个主干像不像卡身份：非空、不带路径分隔、不以 `.md` / `.mdx` 结尾、不带 `:`
 * ——值来自正文链接，`https://…` 这类协议头得挡在外面。
 * 卡正文里除了引卡还会引材料（`../assets/x/README.md` 这类带路径的 .md）：那些没有卡身份
 * 语义，改写成卡页路由就会产生失效链接，原样留给站自己解析。 */
function idShapeOk(stem: string): boolean {
  return stem !== "" && !stem.includes("/") && !stem.includes("\\") && !stem.includes(":") && !CARD_EXT.test(stem);
}

/** remark 插件：正文里 `supersedes::` / `pivots-from::` 开头的段落改成
 * `<div class="trajectory-edge" data-kind="...">`；**主干像卡身份的** `.md` / `.mdx` 链接
 * 改写成卡页路由，带路径的 `.md`（引材料）原样不动。
 * 配置在 fumadocs 卡集合的 mdxOptions 里，不用在 docfirst 自己的文档集合上。 */
export function remarkTrajectoryLinks(options: RemarkTrajectoryLinksOptions) {
  const { hrefBase } = options;
  return (tree: Root): void => {
    /* 关系边段落加标记：hName/hProperties 是 mdast-util-to-hast 认的标准字段 */
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

    /* .md / .mdx 链接改写：判「是不是卡文件链接」要先把 # 锚剥掉再看后缀，`a.md#锚` 不然会被
     * 误判成「不以 .md 结尾」漏改；剥出主干后再检查一次像不像卡身份，不像的不改写。 */
    visit(tree, "link", (node: Link) => {
      const withoutHash = node.url.split("#")[0] ?? "";
      if (!CARD_EXT.test(withoutHash)) return;
      const stem = cardIdFromHref(node.url);
      if (!idShapeOk(stem)) return;
      node.url = `${hrefBase}/${stem}`;
    });
  };
}
