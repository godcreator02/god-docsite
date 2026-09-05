/**
 * `./server` 入口：读盘建模 + 渲 `StarDisk` 的服务端组件 `Trajectory`；fumadocs 卡集合要用的
 * frontmatter schema `cardSchema`；正文关系边 / `.md` 链接改写的 remark 插件
 * `remarkTrajectoryLinks`。三样都只在服务端跑（buildTrajectory 读文件，remark 插件挂在
 * fumadocs-mdx 的编译链上），跟 `./react`（客户端组件）放在同一趟 tsdown 构建里，
 * 好让本文件对它的引用落成产物间的相对导入、保住它头一行的 "use client"（见 tsdown.config.ts
 * 的注释）。
 */

import { basename } from "node:path";
import { visit } from "unist-util-visit";
import type { Link, Paragraph, PhrasingContent, Root, Text } from "mdast";
// 类型专用：不引 zod、不引任何校验库，schema 对象仍是手写的字面量——只借这份官方类型
// 声明来确保结构精确匹配协议（Result 判别联合的边角很容易手抄漏一个 `?`），
// devDependency、`import type` 编译期全擦除，dts 打包时会把用到的形状原样内联进
// 产物的 .d.mts（跟 mdast 的类型是同一个道理），消费方不需要另装这个包。
import type { StandardSchemaV1 } from "@standard-schema/spec";

import { buildTrajectory, type Trajectory as TrajectoryData } from "./index.ts";
// 走包名（自引用）而不是相对源路径：`./react` 是单独一趟 tsdown 构建（platform neutral，
// 保着头一行 "use client"）。改成相对源路径会被这一趟构建当普通模块内联/拆共享 chunk，
// "use client" 会被打散到一个没人标记的共享文件上——server 这边看不到边界，Next 会把
// StarDisk 当服务端组件渲染，命中 hooks 就炸。走包名让 tsdown 把它当外部依赖，原样留在
// 产物里；Node 的包自引用（package.json name + exports）在运行时把它解回 dist/react.mjs。
import { StarDisk } from "@godcreator02/live-doc-trajectory/react";

/* ================= 服务端组件：读盘 + 渲盘 + 报病列表 ================= */

export interface TrajectoryProps {
  /** 卡目录，相对 process.cwd()（即站的项目根）。 */
  dir: string;
  /** 卡页路由前缀，透传给 StarDisk。 */
  hrefBase: string;
  /** 初始显示哪张盘，透传给 StarDisk。 */
  initialDisk?: string;
}

export async function Trajectory({ dir, hrefBase, initialDisk }: TrajectoryProps) {
  const data: TrajectoryData = await buildTrajectory(dir);
  return (
    <div className="star-trajectory">
      <StarDisk data={data} hrefBase={hrefBase} initialDisk={initialDisk} />
      {data.sick.length > 0 ? (
        <div className="star-sick">
          <div className="star-sick-title">报病（{data.sick.length} 个文件）</div>
          <ul>
            {data.sick.map((f) => (
              <li key={f.path}>
                <code>{f.path}</code>
                <ul>
                  {f.problems.map((p, i) => (
                    <li key={i}>
                      {p.reason}
                      {p.value ? `：${p.value}` : ""}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

/* ================= cardSchema：fumadocs 卡集合的 frontmatter schema ================= */

/** 卡页渲染需要的字段：label 派生成 title（缺 label 时退到文件名，见下），其余原样透出，
 * born-at 若被 fumadocs 自己的 YAML 解析成 Date（日级写法的老毛病，本仓自家的
 * `parseFrontmatter` 绕开了它，但 fumadocs 走的是它自己的 gray-matter，躲不掉）就转回字符串。 */
export interface CardFrontmatter {
  title: string;
  label?: string;
  type?: string;
  domain?: string;
  parent?: string[];
  "born-at": string;
}

/** born-at 缺失没有任何合理兜底（半径标度全下游要靠它），报 issues 硬失败；
 * label 缺失时按方案原话「缺 label 用文件名」退到文件名兜底、照样出 value——
 * 两者不能都走硬失败分支，不然「缺 label 用文件名」这句话就没有落地的地方。
 * fumadocs-mdx 的 schema 支持传一个 `(ctx) => Schema` 工厂（ctx 带 path），
 * 用工厂形态是为了在缺 label 时能拿到文件名。对象字面量手写、不 new 任何校验库的类。 */
export function cardSchema(ctx: { path: string; source: string }): StandardSchemaV1<unknown, CardFrontmatter> {
  const fallbackTitle = basename(ctx.path)
    .replace(/\.mdx?$/, "")
    .replace(/^\d{4}-\d{2}-\d{2}-/, "");
  return {
    "~standard": {
      version: 1,
      vendor: "live-doc-trajectory",
      validate(value: unknown): StandardSchemaV1.Result<CardFrontmatter> {
        const fm = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
        const bornAtRaw = fm["born-at"];
        if (bornAtRaw === undefined || bornAtRaw === null || bornAtRaw === "") {
          return { issues: [{ message: "缺 born-at（全卡必填，没有可用的兜底）", path: ["born-at"] }] };
        }
        const bornAt = bornAtRaw instanceof Date ? (bornAtRaw.toISOString().slice(0, 10) as string) : String(bornAtRaw);
        const labelRaw = typeof fm["label"] === "string" ? (fm["label"] as string).trim() : "";
        const title = labelRaw || fallbackTitle;
        const parentRaw = fm["parent"];
        const parent = Array.isArray(parentRaw) ? parentRaw.map((v) => String(v)) : undefined;
        const value_: CardFrontmatter = {
          title,
          "born-at": bornAt,
          ...(labelRaw ? { label: labelRaw } : {}),
          ...(typeof fm["type"] === "string" ? { type: fm["type"] as string } : {}),
          ...(typeof fm["domain"] === "string" ? { domain: fm["domain"] as string } : {}),
          ...(parent ? { parent } : {}),
        };
        return { value: value_ };
      },
    },
  };
}

/* ================= remarkTrajectoryLinks：关系边打标 + 链接改写 ================= */

export interface RemarkTrajectoryLinksOptions {
  /** 卡页路由前缀：形如卡身份的 `.md` 链接与 wikilink 改写成 `${hrefBase}/<卡身份>`。 */
  hrefBase: string;
}

const EDGE_HEAD = /^(supersedes|pivots-from)::/;
/** wikilink：`[[身份]]`、`[[身份#锚]]`、`[[身份|别名]]`，锚与别名都可省。 */
const WIKILINK_RE = /\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|([^\]]+))?\]\]/g;

/** md link 目标还原成卡身份：解码 → 剥 `./` 前缀 → 剥 `#` 锚 → 剥 `.md` 后缀。
 * 跟 parse.ts 的 idFromHref 同一形状——两处独立实现，因为 remark 插件不吃卡解析器的私有函数，
 * 而这条转换本身只有几行，不值得为了共享单开一个内部模块。 */
function stemFromHref(href: string): string {
  let v = href.trim();
  try {
    v = decodeURIComponent(v);
  } catch {
    /* 不是合法百分号序列：原样用 */
  }
  v = v.replace(/^\.\//, "");
  const hash = v.indexOf("#");
  if (hash >= 0) v = v.slice(0, hash);
  return v.endsWith(".md") ? v.slice(0, -3) : v;
}

/** 剥完之后这个主干像不像卡身份：非空、不带路径分隔、不以 `.md` 结尾（跟 model.ts 的
 * idShapeOk 同一条），再多一条不带 `:`——那边的值来自 frontmatter，这边来自正文链接，
 * `https://…` 这类协议头得挡在外面。
 * 卡正文里除了引卡还会引材料（`../assets/x/README.md` 这类带路径的 .md）：那些没有卡身份
 * 语义，改写成卡页路由就是造死链，原样留给站自己解析。 */
function idShapeOk(stem: string): boolean {
  return stem !== "" && !stem.includes("/") && !stem.includes("\\") && !stem.includes(":") && !stem.endsWith(".md");
}

/** remark 插件：正文里 `supersedes::` / `pivots-from::` 起头的段落打成
 * `<div class="trajectory-edge" data-kind="...">`；**主干像卡身份的** `.md` 链接与 wikilink
 * 改写成卡页路由，带路径的 `.md`（引材料）原样不动。
 * 挂在 fumadocs 卡集合的 mdxOptions 上，不跑在 livedoc 自己的文档集合上。 */
export function remarkTrajectoryLinks(options: RemarkTrajectoryLinksOptions) {
  const { hrefBase } = options;
  return (tree: Root): void => {
    /* 关系边段落打标：hName/hProperties 是 mdast-util-to-hast 认的标准打标位 */
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

    /* .md 链接改写：判「是不是 .md 链接」要先把 # 锚剥掉再看后缀，`a.md#锚` 不然会被
     * 误判成「不以 .md 结尾」漏改；剥出主干后再过一道卡身份形状，不像卡身份的放行。 */
    visit(tree, "link", (node: Link) => {
      const withoutHash = node.url.split("#")[0] ?? "";
      if (!withoutHash.endsWith(".md")) return;
      const stem = stemFromHref(node.url);
      if (!idShapeOk(stem)) return;
      node.url = `${hrefBase}/${stem}`;
    });

    /* wikilink 转真链接：文本节点里找 [[...]]，切成 文本/链接/文本... 的序列 */
    visit(tree, "paragraph", (node: Paragraph) => {
      let changed = false;
      const next: PhrasingContent[] = [];
      for (const child of node.children) {
        if (child.type !== "text" || !WIKILINK_RE.test(child.value)) {
          next.push(child);
          continue;
        }
        changed = true;
        WIKILINK_RE.lastIndex = 0;
        let last = 0;
        let match: RegExpExecArray | null = WIKILINK_RE.exec(child.value);
        while (match !== null) {
          if (match.index > last) {
            next.push({ type: "text", value: child.value.slice(last, match.index) } satisfies Text);
          }
          const id = (match[1] as string).trim();
          const alias = match[2]?.trim() || id;
          next.push({
            type: "link",
            url: `${hrefBase}/${id}`,
            children: [{ type: "text", value: alias }],
          } satisfies Link);
          last = match.index + match[0].length;
          match = WIKILINK_RE.exec(child.value);
        }
        if (last < child.value.length) {
          next.push({ type: "text", value: child.value.slice(last) } satisfies Text);
        }
      }
      if (changed) node.children = next;
    });
  };
}
