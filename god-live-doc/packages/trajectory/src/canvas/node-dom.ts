/* 星图 DOM 构件——SVG 工具 / 节点视觉词汇表 / defs 工厂（珠光渐变与羽化滤镜）/
 * 节点与虫洞工厂 / 着色 / 筛选判定。星轨大图与定妆照共用，不持视图状态。
 *
 * 形态词汇表（节点珠光那版）：
 * - 颜色只编码领域——被取代的卡用领域色混灰淡出，不许整成中性灰；
 * - 在立卡填径向渐变（中心向白混 22%，焦点偏左上），外圈一圈底色描边把密集处缝开；
 * - 形状编码卡的 `type`：抉择实心圆、证据三角、推演菱形、参照方形、缺省实心圆，
 *   快照是唯一的空心方（底色缝垫在领域色边下面）；
 * - 被取代：实心无渐变、半径小一档、领域色混灰；孤星不套外环（没有专属形态）；
 * - 连线取旧卡领域色 = 取代、铜绿点线 = 转向，都不带箭头（半径即时间，方向天然给定）。
 * 被取代从 supersedes 链读（取代出边），不落字段。
 *
 * defs 序号 / 筛选态一律实例持有，不走模块级单例——多盘同开不撞。
 * 整搬自 Obsidian 版 render/node-dom.ts。 */

import { BASE_RADIUS, NODE_RADIUS } from "../layout.ts";
import type { Card, Tree, Wormhole } from "../types.ts";
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
 * - superseded：被取代——颜色混灰淡出、半径小一档、不吃渐变。
 * 根卡不占盘位——盘心正中的根节点就是它。 */
export type NodeForm = "alive" | "superseded";

export const FORM_NAME: Record<NodeForm, string> = {
  alive: "在立",
  superseded: "被取代",
};

/** 结论卡集：每棵树主干末端那张（`tree.spine` 最后一张）——尺寸放大档吃它，
 * 在立与否另判（见 isConclusion）。 */
export function spineTipIds(trees: Tree[]): Set<string> {
  const out = new Set<string>();
  for (const t of trees) {
    const tip = t.spine.at(-1);
    if (tip) out.add(tip);
  }
  return out;
}

/** 尺寸放大档口径：主干末端那张在立卡 = 这棵树当前的结论，半径吃 tierMult。 */
export function isConclusion(form: NodeForm, isTip: boolean): boolean {
  return form === "alive" && isTip;
}

/** 标签分级口径：在立且非孤星的卡全景即显（eff>0.5），孤星与被取代进透镜才显（eff>1.8）。 */
export function isPanoramaLabel(form: NodeForm, isolated: boolean): boolean {
  return form === "alive" && !isolated;
}

/** 颜色只编码领域：被取代不整个变灰，领域色混灰保双语义（淡出）。 */
export function formColor(form: NodeForm, c: Card, theme: Theme): string {
  const base = theme.domain[c.domain] ?? theme.noDomain;
  if (form === "superseded") return mix(base, theme.deadMix, 0.4);
  return base;
}

/* ---------- 形状表：卡的 type → 符号几何 ----------
 * 实心一组（抉择 / 证据 / 推演 / 参照 / 缺省）填领域色（在立吃珠光渐变）、外圈底色缝；
 * 快照是唯一的空心，底色缝垫在领域色边下面。同一张表出大图节点、图例符号两种形态，
 * 几何只写一处。 */

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
      return { tag: "circle", attrs: { cx: 0, cy: 0, r }, hollow: false };
  }
}

/** 图例用的符号 markup：与大图节点同一张几何表，颜色由调用方给
 * （`fill` 可以是渐变引用 `url(#…)`，图例自带一份 defs）。 */
export function shapeMarkup(
  type: string | null | undefined,
  r: number,
  color: string,
  seam?: string,
): string {
  const g = shapeGeometry(type, r);
  const attrs = Object.entries(g.attrs)
    .map(([k, v]) => `${k}="${v}"`)
    .join(" ");
  const paint = g.hollow ? `fill="none" stroke="${color}" stroke-width="1.4"` : `fill="${color}"`;
  const ring = seam && !g.hollow ? ` stroke="${seam}" stroke-width="1.1"` : "";
  return `<${g.tag} ${attrs} ${paint}${ring}/>`;
}

/* ---------- defs 工厂：珠光渐变 + 空窗雾带羽化滤镜 ---------- */

/** 工厂实例序号：进 defs id 当前缀，多张盘同开不撞 id。 */
let factorySeq = 0;

/** 每张盘一个工厂：自持 defs 与序号，发出的 id 形如 mk-<实例序>-<用途>-<序号>。 */
export class DefsFactory {
  private readonly defs: SVGElement;
  private readonly prefix: string;
  private seq = 0;
  /** 珠光渐变按颜色去重：一个领域一支，切主题时新色现建（两套色板共十来支，有界）。 */
  private readonly pearls = new Map<string, string>();

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

  /** 珠光渐变：中心 = 领域色向白混 22%、边缘 = 领域色本色、焦点偏左上，
   * 返回可直接填进 `fill` 的 `url(#…)`。渐变坐标走对象包围盒，同一支给全部尺寸复用。 */
  pearl(color: string): string {
    const hit = this.pearls.get(color);
    if (hit) return hit;
    const id = `${this.prefix}-pl-${this.seq++}`;
    const g = el(
      "radialGradient",
      { id, cx: 0.5, cy: 0.5, r: 0.5, fx: 0.4, fy: 0.38 },
      this.defs,
    );
    el("stop", { offset: 0, "stop-color": mix(color, "#ffffff", 0.22) }, g);
    el("stop", { offset: 1, "stop-color": color }, g);
    const url = `url(#${id})`;
    this.pearls.set(color, url);
    return url;
  }
}

/* ---------- 节点工厂 ---------- */

/** 底色缝宽（节点局部单位，随符号整组缩放 = 屏幕恒定）：在立 / 被取代两档，
 * 与「在立 5px 半径配 1.5px 缝、被取代配 1px」同比（局部半径基准 BASE_RADIUS 6）。 */
const SEAM_W: Record<NodeForm, number> = { alive: 1.8, superseded: 1.2 };

/** 空心形状（快照）的领域色边宽（局部单位）：底色缝垫在它下面，两层同几何。 */
const HOLLOW_W = 1.6;

/** 一个节点的全部句柄：g 与 label 游离建出、由壳挂载定层叠。 */
export interface NodeEl {
  card: Card;
  form: NodeForm;
  /** 形状键（type 归一后的值）：筛选按它分组 */
  shape: string;
  /** 空心形态（快照）：着色只描边不填，底色缝走 seam */
  hollow: boolean;
  /** 孤星（不属于任何树）：标签分级门槛用，形态上没有专属记号 */
  isolated: boolean;
  /** 主干末端（tree.spine 最后一张）：在立时吃结论放大档 */
  isTip: boolean;
  group: SVGElement;
  label: SVGElement;
  /** 空心形状垫在底下的底色缝（实心形状的缝直接是 core 的描边） */
  seam: SVGElement | null;
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
  isPivot: boolean;
  baseOpacity: number;
}

/** 节点建构：只建 DOM 返回句柄，交互（click / hover）由布局壳注入。
 * type 定形状，实心形状的外圈底色缝直接是 core 的描边（recolor 给色），
 * 空心形状（快照）另垫一层同几何的缝。 */
export function buildNode(
  card: Card,
  form: NodeForm,
  isolated: boolean,
  isTip: boolean,
  type: string | null | undefined,
): NodeEl {
  const r = NODE_RADIUS[form];
  const group = el("g", { class: "nd" });
  /* 命中区：符号外圈点得着 */
  el("circle", { cx: 0, cy: 0, r: r + 7, fill: "transparent" }, group);
  const geometry = shapeGeometry(type, r);
  const seamW = SEAM_W[form];
  const seam = geometry.hollow
    ? el(
        geometry.tag,
        { ...geometry.attrs, fill: "none", "stroke-width": seamW + HOLLOW_W },
        group,
      )
    : null;
  const core = el(
    geometry.tag,
    { ...geometry.attrs, class: "core", "stroke-width": geometry.hollow ? HOLLOW_W : seamW },
    group,
  );
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
    isTip,
    group,
    label,
    seam,
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
 * 这是第三种节点形态，编码卡种而非状态（不占在立/被取代两态）；
 * 染色走泥金（与盘心描边同源，根卡家族签名），不占领域色板、不进筛选。 */
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
 * edgeEls 元素带两端卡引用，两端任一被滤该边即灰；珠光渐变现取现建，走 defs 工厂去重。 */
export function recolor(
  nodeEls: NodeEl[],
  edgeEls: EdgeEl[],
  theme: Theme,
  sel: FilterSel,
  searchHit: SearchHit,
  defs: DefsFactory,
): number {
  /* 取代边取旧卡（source）的领域色，转向边铜绿——半径即时间，方向不用箭头也读得出 */
  const nodeById = new Map(nodeEls.map((n) => [n.card.id, n]));
  for (const e of edgeEls) {
    const nodeA = nodeById.get(e.source.id);
    const nodeB = nodeById.get(e.target.id);
    const col =
      (nodeA && muted(nodeA, sel, searchHit)) || (nodeB && muted(nodeB, sel, searchHit))
        ? theme.mute
        : e.isPivot
          ? theme.pivot
          : (theme.domain[e.source.domain] ?? theme.noDomain);
    e.node.setAttribute("stroke", col);
  }
  let hit = 0;
  for (const n of nodeEls) {
    const isMuted = muted(n, sel, searchHit);
    if (!isMuted) hit++;
    const col = isMuted ? theme.mute : formColor(n.form, n.card, theme);
    /* 悬停描边换领域色走 CSS（star.css 的 .nd:hover .core），色值经这个自定义属性递进去 */
    n.group.style.setProperty("--dc", col);
    if (n.seam) n.seam.setAttribute("stroke", theme.bg);
    if (n.core) {
      if (n.hollow) {
        /* 空心形态：只描领域色，不填（底色缝在 seam 那层） */
        n.core.setAttribute("fill", "none");
        n.core.setAttribute("stroke", col);
      } else {
        /* 在立实心：珠光渐变；被取代与 mute 态实色无渐变 */
        n.core.setAttribute("fill", n.form === "alive" && !isMuted ? defs.pearl(col) : col);
        n.core.setAttribute("stroke", theme.bg);
      }
    }
    n.label.setAttribute("fill", col);
  }
  /* 图例与命中统计是筛选器的皮，由视图拿这个数去刷 */
  return hit;
}
