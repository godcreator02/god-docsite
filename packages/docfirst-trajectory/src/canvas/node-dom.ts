/* 星图 DOM 构件——SVG 工具 / 节点视觉词汇表 / defs 工厂（箭头与羽化滤镜）/
 * 节点工厂 / 着色 / 筛选判定。不持视图状态。
 *
 * 形态词汇表（照 trail 星盘）：
 * - 颜色只编码领域——被取代的卡用领域色混灰淡出，不许整成中性灰；
 * - 实心节点平涂领域色，外圈一道细描边（nodeStroke）把密集处分开；
 * - 所有卡一样大；在立卡外套一圈同色细环（◉），再往外一圈：实线 = 结论（主干末端那张在立卡）、
 *   虚线 = 孤星（两者不会同时成立）；被取代的卡没有环、颜色混灰更重；
 * - 形状编码卡的 `type`：抉择实心圆、证据三角、推演菱形、参照方形、缺省实心圆，
 *   快照是唯一的空心方；两圈环跟着同一个形状；
 * - 连线细实线，金黄 = 取代、青 = 转向，从旧卡到新卡由淡变亮（方向靠渐变读，不画箭头）。
 * 被取代从 supersedes 链读（取代出边），不落字段。
 *
 * defs 序号 / 筛选态一律实例持有，不走模块级单例。 */

import { NODE_RADIUS } from "../layout.ts";
import type { Card, Tree } from "../types.ts";
import { mix, type Theme } from "./theme.ts";

/* ---------- DOM 工具：parent 显式传、缺省建游离节点（由调用方挂载） ---------- */

const NS = "http://www.w3.org/2000/svg";

/** 元素归属的文档：给了父节点就用父节点的（测试里是桩文档），
 * 游离建构走全局 document。 */
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

/** 标签分级口径：在立的卡全景即显（eff>0.5），被取代的进透镜才显（eff>1.8）。 */
export function isPanoramaLabel(form: NodeForm): boolean {
  return form === "alive";
}

/** 被取代卡的领域色混灰比例：跟在立卡一样大，只靠没有环和这层灰分开，灰得要看得出来。 */
const SUPERSEDED_GRAY = 0.6;

/** 被取代卡的颜色：领域色混灰，不整个变灰，保住领域这层意思。 */
export function supersededColor(domainColor: string, theme: Theme): string {
  return mix(domainColor, theme.deadMix, SUPERSEDED_GRAY);
}

/** 颜色只编码领域：被取代的卡淡出成混灰的领域色。 */
export function formColor(form: NodeForm, c: Card, theme: Theme): string {
  const base = theme.domain[c.domain] ?? theme.noDomain;
  return form === "superseded" ? supersededColor(base, theme) : base;
}

/* ---------- 形状表：卡的 type → 符号几何 ----------
 * 实心一组（抉择 / 证据 / 推演 / 参照 / 缺省）平涂领域色、外圈细描边；快照是唯一的空心。
 * 同一张表出大图节点、节点外的两圈环、图例符号三种形态，几何只写一处。 */

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

/* 节点各部分的尺寸（节点局部单位，随符号整组缩放 = 屏幕恒定） */
/** 实心本体的细描边宽 */
const CORE_W = 1.2;
/** 空心本体（快照）的领域色边宽 */
const HOLLOW_W = 2;
/** 在立细环：离本体的距离与线宽 */
const CROWN_GAP = 3;
const CROWN_W = 1.3;
/** 最外一圈（结论实线 / 孤星虚线）：离本体的距离与线宽 */
const OUTER_GAP = 5.5;
const OUTER_W = 1.4;

/** 形状几何的属性串（图例 markup 用）。 */
function attrString(g: ShapeGeometry): string {
  return Object.entries(g.attrs)
    .map(([k, v]) => `${k}="${v}"`)
    .join(" ");
}

/** 最外一圈的两种画法：结论实线、孤星虚线。 */
export type OuterRing = "conclusion" | "isolated" | null;

/** 图例用的符号 markup：与大图节点同一张几何表与同一套画法，颜色由调用方给。
 * r 是图例里的半径，环距与线宽按 r 与节点半径之比同比缩；
 * crown = 外套同色细环（在立），outer = 最外一圈（结论实线 / 孤星虚线）。 */
export function shapeMarkup(
  type: string | null | undefined,
  r: number,
  color: string,
  outline: string,
  opts: { crown?: boolean; outer?: OuterRing } = {},
): string {
  const k = r / NODE_RADIUS.alive;
  const g = shapeGeometry(type, r);
  const ring = (gap: number, extra: string): string =>
    `<${g.tag} ${attrString(shapeGeometry(type, r + gap * k))} fill="none" stroke="${color}" ${extra}/>`;
  const paint = g.hollow
    ? `fill="none" stroke="${color}" stroke-width="${HOLLOW_W * k}"`
    : `fill="${color}" stroke="${outline}" stroke-width="${CORE_W * k}"`;
  const outerAttrs =
    opts.outer === "isolated"
      ? `stroke-width="${OUTER_W * k}" stroke-dasharray="${3 * k} ${4 * k}" opacity="0.8"`
      : `stroke-width="${OUTER_W * k}"`;
  return (
    (opts.outer ? ring(OUTER_GAP, outerAttrs) : "") +
    (opts.crown ? ring(CROWN_GAP, `stroke-width="${CROWN_W * k}"`) : "") +
    `<${g.tag} ${attrString(g)} ${paint}/>`
  );
}

/* ---------- defs 工厂：连线与扇环的渐变 + 空窗雾带羽化滤镜 ---------- */

/** 工厂实例序号：进 defs id 当前缀，同一页面里的几个工厂不撞 id。 */
let factorySeq = 0;

/** 每轮建画布一个工厂：自持 defs 与序号，发出的 id 形如 mk-<实例序>-<用途>-<序号>。 */
export class DefsFactory {
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

  /** 给沿弧文字走的路径（不画出来，只给 textPath 引用）：几何每帧由调用方改 d。 */
  textArc(): { id: string; path: SVGElement } {
    const id = `${this.prefix}-ta-${this.seq++}`;
    return { id, path: el("path", { id, fill: "none", stroke: "none" }, this.defs) };
  }

  /** 一条边专属的线性渐变（世界坐标）：起点每帧对准旧卡、终点对准新卡，颜色由着色时改两个 stop。 */
  edgeGradient(): EdgeGradient {
    const id = `${this.prefix}-eg-${this.seq++}`;
    const gradient = el("linearGradient", { id, gradientUnits: "userSpaceOnUse" }, this.defs);
    const from = el("stop", { offset: 0 }, gradient);
    const to = el("stop", { offset: 1 }, gradient);
    return { id, gradient, from, to };
  }

  /** 一个扇环专属的径向渐变（世界坐标、圆心在盘心）：外弧处最亮、内弧处透明，
   * 半径与透明起点每帧跟着扇环的显示半径改，颜色由着色时改两个 stop。 */
  boxGradient(): BoxGradient {
    const id = `${this.prefix}-bg-${this.seq++}`;
    const gradient = el("radialGradient", { id, gradientUnits: "userSpaceOnUse", cx: 0, cy: 0 }, this.defs);
    const inner = el("stop", { offset: 0, "stop-opacity": 0 }, gradient);
    const outer = el("stop", { offset: 1 }, gradient);
    return { id, gradient, inner, outer };
  }
}

/** 边的渐变句柄：gradient 每帧改 x1/y1/x2/y2，from/to 着色时改颜色。 */
export interface EdgeGradient {
  id: string;
  gradient: SVGElement;
  from: SVGElement;
  to: SVGElement;
}

/** 扇环的渐变句柄：gradient 每帧改 r，inner 每帧改透明起点，inner/outer 着色时改颜色。 */
export interface BoxGradient {
  id: string;
  gradient: SVGElement;
  inner: SVGElement;
  outer: SVGElement;
}

/* ---------- 节点工厂 ---------- */

/** 一个节点的全部句柄：g 与 label 游离建出、由壳挂载定层叠。 */
export interface NodeEl {
  card: Card;
  form: NodeForm;
  /** 形状键（type 归一后的值）：筛选按它分组 */
  shape: string;
  /** 空心形态（快照）：着色只描边不填 */
  hollow: boolean;
  /** 孤星（不属于任何树）：最外一圈是虚线 */
  isolated: boolean;
  /** 主干末端（tree.spine 最后一张）：在立时最外一圈是实线，吃结论放大档 */
  isTip: boolean;
  group: SVGElement;
  label: SVGElement;
  /** 在立卡外套的同色细环；被取代的卡没有 */
  crown: SVGElement | null;
  /** 最外一圈：结论实线、孤星虚线，其余的卡没有 */
  outerRing: SVGElement | null;
  core: SVGElement;
  /** hover 放大补间量（静态版恒 0） */
  hoverTween: number;
}

/** 一条边的全部句柄：两端卡引用给着色与几何用。 */
export interface EdgeEl {
  kind: "arc" | "line";
  source: Card;
  target: Card;
  node: SVGElement;
  /** 由旧卡到新卡由淡变亮的渐变 */
  gradient: EdgeGradient;
  isPivot: boolean;
  baseOpacity: number;
}

/** 最外一圈画哪种：孤星一定在立、结论一定在树里，两者不会同时成立。 */
export function outerRingOf(form: NodeForm, isolated: boolean, isTip: boolean): OuterRing {
  if (isolated) return "isolated";
  return isConclusion(form, isTip) ? "conclusion" : null;
}

/** 节点建构：只建 DOM 返回句柄，交互（click / hover）由布局壳注入。
 * type 定形状；由外向里依次是最外一圈、在立细环、本体，两圈环都跟本体同一个形状。 */
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
  const ring = (gap: number, attrs: Record<string, string | number>): SVGElement => {
    const g = shapeGeometry(type, r + gap);
    return el(g.tag, { ...g.attrs, fill: "none", ...attrs }, group);
  };
  const outer = outerRingOf(form, isolated, isTip);
  const outerRing =
    outer === "isolated"
      ? ring(OUTER_GAP, { "stroke-width": OUTER_W, "stroke-dasharray": "3 4", opacity: 0.8 })
      : outer === "conclusion"
        ? ring(OUTER_GAP, { "stroke-width": OUTER_W })
        : null;
  const crown = form === "alive" ? ring(CROWN_GAP, { "stroke-width": CROWN_W }) : null;
  const core = el(
    geometry.tag,
    { ...geometry.attrs, class: "core", "stroke-width": geometry.hollow ? HOLLOW_W : CORE_W },
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
    crown,
    outerRing,
    core,
    hoverTween: 0,
  };
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

/** 空筛选态：三维都不筛。 */
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

/** 连线渐变旧卡那端的不透明度：新卡那端全亮，方向靠这一段由淡变亮读出来。 */
const EDGE_TAIL_OPACITY = 0.12;

/** 建构 / 切主题 / 切筛选时各刷一遍，返回命中数（三维交集后未 mute 的卡数，命中统计用）。
 * edgeEls 元素带两端卡引用，两端任一被滤该边即灰。 */
export function recolor(
  nodeEls: NodeEl[],
  edgeEls: EdgeEl[],
  theme: Theme,
  sel: FilterSel,
  searchHit: SearchHit,
): number {
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
    e.gradient.from.setAttribute("stop-color", col);
    e.gradient.from.setAttribute("stop-opacity", String(EDGE_TAIL_OPACITY));
    e.gradient.to.setAttribute("stop-color", col);
    e.node.setAttribute("stroke", `url(#${e.gradient.id})`);
  }
  let hit = 0;
  for (const n of nodeEls) {
    const isMuted = muted(n, sel, searchHit);
    if (!isMuted) hit++;
    const col = isMuted ? theme.mute : formColor(n.form, n.card, theme);
    /* 悬停描边换领域色走 CSS（star.css 的 .nd:hover .core），色值经这个自定义属性递进去 */
    n.group.style.setProperty("--dc", col);
    n.crown?.setAttribute("stroke", col);
    n.outerRing?.setAttribute("stroke", col);
    if (n.hollow) {
      n.core.setAttribute("fill", "none");
      n.core.setAttribute("stroke", col);
    } else {
      n.core.setAttribute("fill", col);
      n.core.setAttribute("stroke", isMuted ? theme.mute : theme.nodeStroke);
    }
    n.label.setAttribute("fill", col);
  }
  /* 图例与命中统计是筛选器的皮，由视图拿这个数去刷 */
  return hit;
}
