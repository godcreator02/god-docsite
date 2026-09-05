/* 星图 DOM 构件——SVG 工具 / 节点视觉词汇表 / 箭头 marker 工厂 / 节点与虫洞工厂 /
 * 着色 / 筛选判定。星轨大图与定妆照共用，不持视图状态。
 *
 * 形态词汇表（对齐 trajectory-viz-style-spec 的通道分工，形状按 `type` 是本仓唯一的偏离）：
 * - 颜色只编码领域——被取代的卡用领域色混灰淡出，不许整成中性灰；
 * - 形状编码卡的 `type`：抉择实心圆、证据三角、推演菱形、参照方形、快照空心方、缺省空心圆；
 * - 虚线外环只编码孤星；
 * - 连线金黄 = 取代、青 = 转向，与领域色错开。
 * 被取代从 supersedes 链读（取代出边），不落字段。
 *
 * marker 序号 / 筛选态一律实例持有，不走模块级单例——多盘同开不撞。
 * 整搬自 Obsidian 版 render/node-dom.ts。 */

import { BASE_RADIUS, NODE_RADIUS } from "../layout.ts";
import type { Card, Wormhole } from "../types.ts";
import { mix, type Theme } from "./theme.ts";

/* ---------- DOM 工具：parent 显式传、缺省建游离节点（由调用方挂载） ---------- */

const NS = "http://www.w3.org/2000/svg";

/** 元素归属的文档：给了父节点就用父节点的（服务端渲定妆照时是 svg-doc 的桩文档），
 * 游离建构走全局 document（浏览器里的大图）。 */
function docOf(parent?: Element): Document {
  return (parent?.ownerDocument as Document | undefined) ?? document;
}

/** 建一个 SVG 元素并按需挂载。 */
export function el(
  tag: string,
  attrs: Record<string, string | number> = {},
  parent?: Element,
): SVGElement {
  const e = docOf(parent).createElementNS(NS, tag) as SVGElement;
  for (const k in attrs) e.setAttribute(k, String(attrs[k]));
  if (parent) parent.appendChild(e);
  return e;
}

/** 建一个 SVG 文本节点。 */
export function text(
  x: number,
  y: number,
  str: string,
  cls: string,
  attrs: Record<string, string | number> = {},
  parent?: Element,
): SVGElement {
  const t = el("text", { x, y, class: cls, ...attrs }, parent);
  t.textContent = str;
  return t;
}

/* ---------- 节点视觉词汇表 ----------
 *
 * 状态两态（颜色通道表达）：
 * - alive：普通卡；
 * - superseded：被取代——颜色混灰淡出。
 * 孤星另加虚线外环（结构语义，不是状态）。根卡不占盘位——盘心正中的根节点就是它。 */
export type NodeForm = "alive" | "superseded";

export const FORM_NAME: Record<NodeForm, string> = {
  alive: "在立",
  superseded: "被取代",
};

/** 尺寸分级与标签分级的同一口径：在立且非孤星 = 每棵树活着的结论。
 * 尺寸档（tierMult 乘谁）、标签全景即显（eff>0.5）都吃这一句判定，改口径只改这里。 */
export function isConclusion(form: NodeForm, isolated: boolean): boolean {
  return form === "alive" && !isolated;
}

/** 颜色只编码领域：被取代不整个变灰，领域色混灰保双语义（淡出）。 */
export function formColor(form: NodeForm, c: Card, theme: Theme): string {
  const base = theme.domain[c.domain] ?? theme.noDomain;
  if (form === "superseded") return mix(base, theme.deadMix, 0.55);
  return base;
}

/** 节点描边：同色加深（领域色混黑）——彩点嵌进盘里；不用白描边，它在宿主中性灰底上
 * 显塑料。被取代也从领域原色出边（填充已混灰淡出，边深一度收住形）。
 * mute 态不归这里，recolor 直接给 theme.mute。 */
export function nodeEdge(c: Card, theme: Theme): string {
  return mix(theme.domain[c.domain] ?? theme.noDomain, "#000000", 0.35);
}

/* ---------- 形状表：卡的 type → 符号几何 ----------
 * 实心一组（抉择 / 证据 / 推演 / 参照）填领域色、描边混黑；空心一组（快照 / 缺省）
 * 只描领域色。同一张表出大图节点、图例符号两种形态，几何只写一处。 */

/** 缺省形态（type 缺失或不在表里）的键。 */
export const DEFAULT_SHAPE = "__default__";

export const SHAPE_ORDER = ["choice", "evidence", "derivation", "reference", "snapshot", DEFAULT_SHAPE] as const;

export const SHAPE_NAMES: Record<string, string> = {
  choice: "抉择",
  evidence: "证据",
  derivation: "推演",
  reference: "参照",
  snapshot: "快照",
  [DEFAULT_SHAPE]: "缺省",
};

/** 一个形状的几何描述：标签名 + 属性（不含颜色）+ 是否空心。 */
export interface ShapeGeometry {
  tag: string;
  attrs: Record<string, string | number>;
  hollow: boolean;
}

/** type 归一成形状键：不认识的 type 走缺省形态。 */
export function shapeKeyOf(type: string | null | undefined): string {
  return type && Object.hasOwn(SHAPE_NAMES, type) && type !== DEFAULT_SHAPE ? type : DEFAULT_SHAPE;
}

/** 按 type 出符号几何，r 是基准半径（与圆形节点的半径同口径，别的形状按面积感对齐）。 */
export function shapeGeometry(type: string | null | undefined, r: number): ShapeGeometry {
  switch (shapeKeyOf(type)) {
    case "choice":
      return { tag: "circle", attrs: { cx: 0, cy: 0, r }, hollow: false };
    case "evidence": {
      const t = r * 1.25;
      return {
        tag: "path",
        attrs: { d: `M0,${-t} L${t * 0.866},${t * 0.5} L${-t * 0.866},${t * 0.5} Z` },
        hollow: false,
      };
    }
    case "derivation": {
      const t = r * 1.2;
      return { tag: "path", attrs: { d: `M0,${-t} L${t},0 L0,${t} L${-t},0 Z` }, hollow: false };
    }
    case "reference": {
      const a = r * 1.05;
      return { tag: "rect", attrs: { x: -a, y: -a, width: a * 2, height: a * 2 }, hollow: false };
    }
    case "snapshot": {
      const a = r * 1.05;
      return { tag: "rect", attrs: { x: -a, y: -a, width: a * 2, height: a * 2 }, hollow: true };
    }
    default:
      return { tag: "circle", attrs: { cx: 0, cy: 0, r }, hollow: true };
  }
}

/** 图例用的符号 markup：与大图节点同一张几何表，颜色由调用方给。 */
export function shapeMarkup(type: string | null | undefined, r: number, color: string): string {
  const g = shapeGeometry(type, r);
  const attrs = Object.entries(g.attrs)
    .map(([k, v]) => `${k}="${v}"`)
    .join(" ");
  const paint = g.hollow ? `fill="none" stroke="${color}" stroke-width="1.4"` : `fill="${color}"`;
  return `<${g.tag} ${attrs} ${paint}/>`;
}

/* ---------- 箭头 marker 工厂 ---------- */

/** 一支箭头：marker 本体（壳按局部放大率改尺寸）+ 里面那条 V 形路径（着色用）。 */
export interface Marker {
  node: SVGElement;
  path: SVGElement;
}

/** 工厂实例序号：进 marker id 当前缀，多张盘同开不撞 id。 */
let factorySeq = 0;

/** 每张盘一个工厂：自持 defs 与序号，发出的 marker id 形如 mk-<实例序>-<序号>。 */
export class MarkerFactory {
  private readonly defs: SVGElement;
  private readonly prefix: string;
  private seq = 0;

  constructor(parent: Element) {
    this.defs = el("defs", {}, parent);
    this.prefix = `mk-${factorySeq++}`;
  }

  /** 空窗雾带的羽化滤镜：高斯模糊把暗带硬边晕开，dev 由调用方按带宽定。
   * 每带一个 filter（带宽不同 dev 不同），region 放宽防模糊被 bbox 裁剪。 */
  blur(dev: number): string {
    const id = `${this.prefix}-blur-${this.seq++}`;
    const f = el("filter", { id, x: "-60%", y: "-60%", width: "220%", height: "220%" }, this.defs);
    el("feGaussianBlur", { stdDeviation: dev }, f);
    return id;
  }

  /** 每边专属 marker：尺寸由布局壳随局部放大率连续插值。 */
  build(): Marker {
    const node = el(
      "marker",
      {
        id: `${this.prefix}-${this.seq++}`,
        viewBox: "0 0 10 10",
        refX: 9,
        refY: 5,
        markerUnits: "userSpaceOnUse",
        markerWidth: 10,
        markerHeight: 10,
        orient: "auto-start-reverse",
      },
      this.defs,
    );
    /* 开口 V 形：重量配细虚线 */
    const path = el(
      "path",
      {
        d: "M1,1 L9,5 L1,9",
        fill: "none",
        "stroke-width": 2,
        "stroke-linecap": "round",
        "stroke-linejoin": "round",
      },
      node,
    );
    return { node, path };
  }
}

/* ---------- 节点工厂 ---------- */

/** 一个节点的全部句柄：g 与 label 游离建出、由壳挂载定层叠。 */
export interface NodeEl {
  card: Card;
  form: NodeForm;
  /** 形状键（type 归一后的值）：筛选按它分组 */
  shape: string;
  /** 空心形态（快照 / 缺省）：着色只描边不填 */
  hollow: boolean;
  /** 孤星（不属于任何树）：虚线外环的结构语义 + 标签分级门槛（tier 判定用） */
  isolated: boolean;
  group: SVGElement;
  label: SVGElement;
  ring: SVGElement | null;
  core: SVGElement | null;
  /** hover 放大补间量（静态版恒 0） */
  hoverTween: number;
}

/** 一条边的全部句柄：两端卡引用给着色与几何用。 */
export interface EdgeEl {
  kind: "arc" | "line";
  source: Card;
  target: Card;
  node: SVGElement;
  marker: Marker;
  isPivot: boolean;
  baseOpacity: number;
}

/** 节点建构：只建 DOM 返回句柄，交互（click / hover）由布局壳注入。
 * type 定形状（本仓唯一的形态偏离），其余（命中圆、孤星虚线环、title）照旧。 */
export function buildNode(
  card: Card,
  form: NodeForm,
  isolated: boolean,
  type: string | null | undefined,
): NodeEl {
  const r = NODE_RADIUS[form];
  const group = el("g", {});
  /* 命中区：符号外圈点得着 */
  el("circle", { cx: 0, cy: 0, r: r + 7, fill: "transparent" }, group);
  /* 孤星虚线外框：不属于任何树的普通卡 */
  const ring = isolated
    ? el(
        "circle",
        {
          cx: 0,
          cy: 0,
          r: r + 5,
          fill: "none",
          "stroke-width": 1.6,
          "stroke-dasharray": "3 4",
          opacity: 0.8,
        },
        group,
      )
    : null;
  const geometry = shapeGeometry(type, r);
  const core = el(geometry.tag, { ...geometry.attrs, "stroke-width": geometry.hollow ? 1.6 : 1.2 }, group);
  el("title", {}, group).textContent =
    `${card.label} · ${card.bornAt.slice(0, 10)} · ${FORM_NAME[form]} · ${card.domain}`;
  group.style.cursor = "pointer";
  const label = text(0, 0, card.label, "lb");
  return {
    card,
    form,
    shape: shapeKeyOf(type),
    hollow: geometry.hollow,
    isolated,
    group,
    label,
    ring,
    core,
    hoverTween: 0,
  };
}

/* ---------- 虫洞节点工厂 ---------- */

/** 一个虫洞节点的全部句柄。 */
export interface WormEl {
  worm: Wormhole;
  group: SVGElement;
  label: SVGElement;
  outer: SVGElement;
  inner: SVGElement;
  /** hover 放大补间量（与 NodeEl 同律） */
  hoverTween: number;
}

/** 虫洞建构：同心双环、中空透盘底色——子项目根卡在本盘的投影，点击穿越到子项目的盘。
 * 这是第三种节点形态，编码卡种而非状态（不占在立/被取代两态，也不加孤星虚线环）；
 * 染色走宿主 `--color-fd-primary`（与盘心描边同源，根卡家族签名），不占领域色板、不进筛选。 */
export function buildWormhole(worm: Wormhole): WormEl {
  const group = el("g", {});
  /* 命中区：符号外圈点得着（与节点同律） */
  el("circle", { cx: 0, cy: 0, r: BASE_RADIUS + 7, fill: "transparent" }, group);
  const outer = el(
    "circle",
    { cx: 0, cy: 0, r: BASE_RADIUS, fill: "none", "stroke-width": 1.6 },
    group,
  );
  const inner = el(
    "circle",
    { cx: 0, cy: 0, r: BASE_RADIUS * 0.45, fill: "none", "stroke-width": 1.2 },
    group,
  );
  el("title", {}, group).textContent =
    `${worm.label} · ${worm.bornAt.slice(0, 10)} · 虫洞 —— 点击穿越到子项目盘`;
  group.style.cursor = "pointer";
  const label = text(0, 0, worm.label, "lb");
  return { worm, group, label, outer, inner, hoverTween: 0 };
}

/* ---------- 筛选：图例即筛选器（形态 / 领域两维多选、取交集，选中集空 = 本维不筛）
 * 搜索是第三维：非空字符串对 label 与卡身份做包含匹配，跟前两维一起取交集；
 * 非命中卡整体退成 mute 灰 = 暂时退出颜色通道（规范「筛选例外」）；交互不禁用、灰卡照常点 ---------- */

/** 三维筛选态：两个多选集（形态集装形状键）+ 一个已转小写的搜索串。 */
export interface FilterSel {
  form: Set<string>;
  domain: Set<string>;
  search: string;
}

/** 一张盘一份筛选态（多盘同开各筛各的）。 */
export function buildFilter(): FilterSel {
  return { form: new Set(), domain: new Set(), search: "" };
}

/** 搜索命中判定由视图给：正文不进模型，视图侧按 label 与卡身份匹配。 */
export type SearchHit = (c: Card) => boolean;

/** 三维取交集：任一维把这张卡挡在外面，它就退成灰。 */
export function muted(n: NodeEl, sel: FilterSel, searchHit: SearchHit): boolean {
  return (
    (sel.form.size > 0 && !sel.form.has(n.shape)) ||
    (sel.domain.size > 0 && !sel.domain.has(n.card.domain)) ||
    !searchHit(n.card)
  );
}

/* ---------- recolor：按当前主题 + 筛选态刷全部 JS 着色元素 ---------- */

/** 建构 / 切主题 / 切筛选时各刷一遍，返回命中数（三维交集后未 mute 的卡数，命中统计用）。
 * edgeEls 元素带两端卡引用，两端任一被滤该边即灰。 */
export function recolor(
  nodeEls: NodeEl[],
  edgeEls: EdgeEl[],
  theme: Theme,
  sel: FilterSel,
  searchHit: SearchHit,
): number {
  /* 箭头与所在线段同色 */
  const nodeById = new Map(nodeEls.map((n) => [n.card.id, n]));
  for (const e of edgeEls) {
    const nodeA = nodeById.get(e.source.id);
    const nodeB = nodeById.get(e.target.id);
    const col =
      (nodeA && muted(nodeA, sel, searchHit)) || (nodeB && muted(nodeB, sel, searchHit))
        ? theme.mute
        : e.isPivot
          ? theme.pivot
          : theme.supersede;
    e.node.setAttribute("stroke", col);
    e.marker.path.setAttribute("stroke", col);
  }
  let hit = 0;
  for (const n of nodeEls) {
    const isMuted = muted(n, sel, searchHit);
    if (!isMuted) hit++;
    const col = isMuted ? theme.mute : formColor(n.form, n.card, theme);
    if (n.ring) n.ring.setAttribute("stroke", col);
    if (n.core) {
      if (n.hollow) {
        /* 空心形态：只描领域色，不填 */
        n.core.setAttribute("fill", "none");
        n.core.setAttribute("stroke", col);
      } else {
        n.core.setAttribute("fill", col);
        n.core.setAttribute("stroke", isMuted ? theme.mute : nodeEdge(n.card, theme));
      }
    }
    n.label.setAttribute("fill", col);
  }
  /* 图例与命中统计是筛选器的皮，由视图拿这个数去刷 */
  return hit;
}
