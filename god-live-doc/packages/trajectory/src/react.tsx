"use client";

/**
 * 客户端组件 StarDisk——星轨盘的渲染壳。
 *
 * 结构归 React：SVG 树按卡身份 keyed 声明式建（节点、边、周月年环、空窗小行星带、扇环框、
 * 树名、里程碑、盘心）。帧归 rAF：补间循环与每帧 place() 在 useEffect 里起
 * requestAnimationFrame，经 ref 表直接 setAttribute / style，不走 setState——半径标度、
 * 鱼眼映射、装箱、避让全部来自 `.` 入口的纯函数（RingsLayout / ringSkeleton / buildChains /
 * computeDodge），本文件不重算标度、不重复布局数学。
 * 离散变化才走 React 状态：筛选集合、搜索词、设置、浮层开合、当前盘、激活态、主题。
 *
 * 视觉照 trail-rings.html（只读参照，逻辑搬、UI 壳重写，不 import）：内旧外新的环、周月年环
 * 与日期标签、空窗小行星带、扇环框与树名、金色里程碑环、取代金黄虚线／转向青色点线、
 * 图例即筛选器、右上工具条与搜索、设置与帮助浮层。本文件只吃 model.ts / layout.ts / chains.ts
 * 的纯函数，不经过 index.ts 的桶——index.ts 的 buildTrajectory 链到 scan.ts（node:fs/promises），
 * 从这个入口拿类型是安全的（`import type` 全部在编译期擦除，不留运行期 import）。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, ReactNode } from "react";
import { bandFade, lodOf, NODE_RADIUS, polar, ringSkeleton, ROOT_RADIUS, RingsLayout } from "./layout.ts";
import { buildChains, computeDodge } from "./chains.ts";
import { dayNum, formatDay, formOf, inRange, NO_DOMAIN } from "./model.ts";
import type { TrajectoryModel } from "./types.ts";
import type { RouteCard, SerializableModel, Trajectory } from "./index.ts";

/** StarDisk 的 props：data 是 buildTrajectory 的产物（多盘），hrefBase 是卡页路由前缀
 * （节点链接 = `${hrefBase}/${encodeURIComponent(id)}`）——不收函数，服务端组件传不了函数
 * 给客户端组件。size 给了就同步按这个边长渲染（测试靠它，不量尺寸）；不给就挂载后量父元素宽、
 * 跟随 resize。initialDisk 指定初始显示哪张盘（disks 的 rootId），缺省第一张。 */
export interface StarDiskProps {
  data: Trajectory;
  hrefBase: string;
  size?: number;
  initialDisk?: string;
}

/* ================= 视觉词汇表：颜色只编码领域，形状编码卡的 type ================= */

const DOMAIN_HUES: Record<"dark" | "light", string[]> = {
  dark: ["#5ea8ff", "#c78bfa", "#4ade9e", "#ff7ab8", "#c3e35c", "#ffb454", "#7dd3fc", "#f472b6"],
  light: ["#2b6fd4", "#8b47d6", "#0e9e63", "#d6478a", "#6f8f14", "#c2760c", "#0891b2", "#be185d"],
};

const THEME_COLORS: Record<"dark" | "light", Record<string, string>> = {
  dark: {
    sup: "#f5b942",
    piv: "#48c9d8",
    mute: "#4b5261",
    deadMix: "#6b7280",
    noDomain: "#8fa0c8",
    worm: "#e8c766",
    nodeStroke: "rgba(255,255,255,0.75)",
  },
  light: {
    sup: "#c07f10",
    piv: "#0e7c8a",
    mute: "#c6ccd8",
    deadMix: "#aab1bf",
    noDomain: "#5d6a8c",
    worm: "#a9791a",
    nodeStroke: "rgba(22,30,52,0.55)",
  },
};

/** 十六进制颜色按 t 混合，t=0 是 c1、t=1 是 c2——被取代卡与领域色混灰用。 */
function mix(c1: string, c2: string, t: number): string {
  const p = (h: string): number[] => [
    Number.parseInt(h.slice(1, 3), 16),
    Number.parseInt(h.slice(3, 5), 16),
    Number.parseInt(h.slice(5, 7), 16),
  ];
  const a = p(c1);
  const b = p(c2);
  return `rgb(${a.map((v, i) => Math.round(v + ((b[i] as number) - v) * t)).join(",")})`;
}

/** 领域到色相：按 model.domains 的首次出现序分配，未分道哨兵走中性色、不占色板位。 */
function domainColor(domain: string, domains: readonly string[], dark: boolean): string {
  const theme = dark ? "dark" : "light";
  if (domain === NO_DOMAIN) return THEME_COLORS[theme]["noDomain"] as string;
  const real = domains.filter((d) => d !== NO_DOMAIN);
  const i = real.indexOf(domain);
  const hues = DOMAIN_HUES[theme];
  return hues[((i < 0 ? 0 : i) % hues.length) as number] as string;
}

const SHAPE_NAMES: Record<string, string> = {
  choice: "抉择",
  evidence: "证据",
  derivation: "推演",
  reference: "参照",
  snapshot: "快照",
};
const SHAPE_ORDER = ["choice", "evidence", "derivation", "reference", "snapshot", "__default__"];

/** 节点本体：形状按 type，fill/stroke 由调用方按领域与取代态算好传入。 */
function shapeInner(type: string | null, r: number, fill: string, stroke: string): ReactNode {
  switch (type) {
    case "choice":
      return <circle r={r} fill={fill} stroke={stroke} strokeWidth={1.2} />;
    case "evidence": {
      const t = r * 1.25;
      return (
        <path
          d={`M0,${-t} L${t * 0.866},${t * 0.5} L${-t * 0.866},${t * 0.5} Z`}
          fill={fill}
          stroke={stroke}
          strokeWidth={1.2}
        />
      );
    }
    case "derivation": {
      const t = r * 1.2;
      return <path d={`M0,${-t} L${t},0 L0,${t} L${-t},0 Z`} fill={fill} stroke={stroke} strokeWidth={1.2} />;
    }
    case "reference": {
      const a = r * 1.05;
      return <rect x={-a} y={-a} width={a * 2} height={a * 2} fill={fill} stroke={stroke} strokeWidth={1.2} />;
    }
    case "snapshot": {
      const a = r * 1.05;
      return <rect x={-a} y={-a} width={a * 2} height={a * 2} fill="none" stroke={fill} strokeWidth={1.6} />;
    }
    default:
      return <circle r={r} fill="none" stroke={fill} strokeWidth={1.6} />;
  }
}

/** 图例符号：跟画布节点同模的内联 SVG。 */
function legendSymbol(type: string | null): ReactNode {
  return (
    <svg viewBox="-9 -9 18 18" className="star-lgs" aria-hidden="true">
      {shapeInner(type, 6, "currentColor", "currentColor")}
    </svg>
  );
}

/* ================= 联接后的运行期节点：卡 / 虫洞统一记录 ================= */

interface RuntimeNode {
  id: string;
  kind: "card" | "wormhole";
  label: string;
  domain: string;
  bornAt: string;
  type: string | null;
  superseded: boolean;
  path: string;
}

/** 卡与虫洞都进这张表——图上按同一套摆放 / hover / 点击语义处理，卡是 type 卡片形态，
 * 虫洞是穿盘入口，点击行为在渲染处分流（卡开新标签页，虫洞切当前盘）。 */
function buildRuntimeNodes(
  model: TrajectoryModel,
  routeById: Map<string, RouteCard>,
): Map<string, RuntimeNode> {
  const out = new Map<string, RuntimeNode>();
  for (const c of model.cards) {
    const route = routeById.get(c.id);
    out.set(c.id, {
      id: c.id,
      kind: "card",
      label: c.label,
      domain: c.domain,
      bornAt: c.bornAt,
      type: route?.type ?? null,
      superseded: formOf(model, c.id) === "superseded",
      path: c.path,
    });
  }
  for (const w of model.wormholes) {
    out.set(w.id, {
      id: w.id,
      kind: "wormhole",
      label: w.label,
      domain: NO_DOMAIN,
      bornAt: w.bornAt,
      type: null,
      superseded: false,
      path: w.path,
    });
  }
  return out;
}

/** 空盘兜底模型：一张卡都没有的项目（or 整个轨迹目录还没有任何卡）时喂给 RingsLayout，
 * 盘心画得出、其余环照常画，只是没有任何节点。 */
function emptyModel(): TrajectoryModel {
  const today = dayNum(new Date().toISOString());
  return {
    root: null,
    cards: [],
    wormholes: [],
    edges: [],
    broken: [],
    dupes: [],
    supersededIds: new Set(),
    domains: [],
    byId: {},
    trees: [],
    isolated: [],
    compOf: {},
    day0: today,
    dayMax: today,
  };
}

function toRuntimeModel(serialized: SerializableModel | undefined): TrajectoryModel {
  if (!serialized) return emptyModel();
  return { ...serialized, supersededIds: new Set(serialized.supersededIds) };
}

/* ================= 帧态：补间与视图，全部塞进一个 ref，不走 setState ================= */

interface FrameState {
  f: number;
  fT: number;
  s: number;
  sT: number;
  view: { k: number; tx: number; ty: number };
  vT: { k: number; tx: number; ty: number } | null;
  hv: Map<string, number>;
  hover: string | null;
  raf: number | null;
}

const LAYOUT_SLIDERS: Array<{
  key: "focusDays" | "oldShare" | "newShare" | "hubBase" | "gapFree" | "gapWide" | "symbolPx" | "ease";
  label: string;
  min: number;
  max: number;
  step: number;
  fmt: (v: number) => string;
}> = [
  { key: "focusDays", label: "焦点带天数", min: 3, max: 15, step: 1, fmt: (v) => `${v} 天` },
  { key: "oldShare", label: "内环（旧压缩）", min: 0, max: 0.3, step: 0.01, fmt: (v) => `${Math.round(v * 100)}%` },
  { key: "newShare", label: "外环（新压缩）", min: 0, max: 0.3, step: 0.01, fmt: (v) => `${Math.round(v * 100)}%` },
  { key: "hubBase", label: "盘心大小", min: 60, max: 300, step: 10, fmt: (v) => `${v}` },
  { key: "gapFree", label: "空窗阈值", min: 7, max: 60, step: 1, fmt: (v) => `${v} 天` },
  { key: "gapWide", label: "超长空档宽", min: 30, max: 90, step: 1, fmt: (v) => `十年≈${v} 天` },
  { key: "symbolPx", label: "节点大小", min: 0.4, max: 1.2, step: 0.05, fmt: (v) => v.toFixed(2) },
  { key: "ease", label: "动画速度", min: 0.06, max: 0.4, step: 0.02, fmt: (v) => v.toFixed(2) },
];

export function StarDisk({ data, hrefBase, size, initialDisk }: StarDiskProps): ReactNode {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const worldRef = useRef<SVGGElement | null>(null);
  const hubRef = useRef<SVGGElement | null>(null);
  const hubCircleRef = useRef<SVGCircleElement | null>(null);
  const hubTitleRef = useRef<SVGTextElement | null>(null);
  const hubStatusRef = useRef<SVGTextElement | null>(null);
  const treeNameRefs = useRef(new Map<number, SVGTextElement>());
  const bandRef = useRef<SVGCircleElement | null>(null);

  const nodeRefs = useRef(new Map<string, SVGGElement>());
  const labelRefs = useRef(new Map<string, SVGTextElement>());

  const [measuredSize, setMeasuredSize] = useState<number | null>(size ?? null);
  const [dark, setDark] = useState(false);
  const [currentDisk, setCurrentDisk] = useState<string | null>(
    initialDisk ?? data.disks[0]?.rootId ?? null,
  );
  const [shapeFilter, setShapeFilter] = useState<ReadonlySet<string>>(new Set());
  const [domainFilter, setDomainFilter] = useState<ReadonlySet<string>>(new Set());
  const [search, setSearch] = useState("");
  const [activated, setActivated] = useState(false);
  const [mode, setMode] = useState<"fisheye" | "zoom">("fisheye");
  const [showAllLabels, setShowAllLabels] = useState(false);
  const [popOpen, setPopOpen] = useState<"settings" | "help" | null>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; node: RuntimeNode } | null>(null);
  const [wheelSensitivity, setWheelSensitivity] = useState(1.8);
  /** 只为驱动 UI（滑杆当前值 + 图纸重绘），真正落地在 layout 实例上；改一项即整批复制一份新对象。 */
  const [settings, setSettings] = useState<Record<string, number>>({
    focusDays: 7,
    oldShare: 0.03,
    newShare: 0.03,
    hubBase: 180,
    gapFree: 14,
    gapWide: 53,
    symbolPx: 0.65,
    ease: 0.16,
  });

  /* ---------- 尺寸：给了 size 就同步用它（SSR / 测试安全，不碰 window）；没给就量父宽 ---------- */
  useEffect(() => {
    if (size !== undefined) return;
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setMeasuredSize(Math.round(w));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [size]);
  const effectiveSize = size ?? measuredSize;

  /* ---------- 主题：挂载时读一次 html.dark，之后靠 MutationObserver 跟随 ---------- */
  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    setDark(root.classList.contains("dark"));
    const mo = new MutationObserver(() => setDark(root.classList.contains("dark")));
    mo.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => mo.disconnect();
  }, []);

  /* ---------- 数据联接：路由卡表（拿 type / milestones），当前盘的运行期模型 ---------- */
  const routeById = useMemo(() => new Map(data.cards.map((c) => [c.id, c])), [data.cards]);
  const serialized = currentDisk ? data.models[currentDisk] : undefined;
  const model = useMemo(() => toRuntimeModel(serialized), [serialized]);
  const runtimeNodes = useMemo(() => buildRuntimeNodes(model, routeById), [model, routeById]);
  const rootRoute = model.root ? routeById.get(model.root.id) : undefined;
  const milestones = useMemo(
    () => (rootRoute?.milestones ? inRange(rootRoute.milestones, model.day0, model.dayMax) : []),
    [rootRoute, model.day0, model.dayMax],
  );

  /* ---------- 布局实例：per 盘持久化的可变对象；settings 变化调 configure() 原地重烘焙 ----------
   * 用 useMemo（不是 useEffect）建它：SSR / renderToStaticMarkup 不跑 effect，静态渲染那一趟
   * 也得看得到扇环框、环骨架这些——建构本身是纯的（同一个 model 建一份新实例），后续设置改动
   * 不重建实例、只调 configure() 原地重烘焙（否则每次调个滑杆盘就整个换了个新对象，
   * 帧状态、hover 都得跟着重置）。configure() 的调用方（tick / applySetting）读 layoutRef，
   * 不读这个变量本身——ref 每次渲染都同步刷新，rAF 循环里的旧闭包也能拿到最新实例。 */
  const layout = useMemo(() => {
    const l = new RingsLayout(model);
    l.configure(settings);
    return l;
    // settings 只在这个 model 第一次建实例时落一遍；之后的改动全走 configure()，
    // 不把 settings 放进依赖——放进去会导致每次调滑杆都新建实例。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model]);
  const layoutRef = useRef(layout);
  layoutRef.current = layout;

  const [geometryVersion, setGeometryVersion] = useState(0);

  const applySetting = useCallback((key: string, value: number) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    layoutRef.current.configure({ [key]: value });
    setGeometryVersion((v) => v + 1);
  }, []);

  /* ---------- 静态几何：环骨架 / 扇环框 / 孤星带 / 虫洞带 / 链表——settings 变了要重算 ---------- */
  const skeleton = useMemo(() => (layout ? ringSkeleton(layout) : null), [layout, geometryVersion]);
  const treeBoxes = useMemo(() => layout?.treeBoxes ?? [], [layout, geometryVersion]);
  const isoBoxes = useMemo(() => layout?.isoBoxes ?? [], [layout, geometryVersion]);
  const wormBox = layout?.wormBox ?? null;
  const chains = useMemo(() => (layout ? buildChains(model, layout) : []), [layout, model, geometryVersion]);
  const edgeList = useMemo(
    () =>
      layout
        ? model.edges.map((e) => ({
            ...e,
            sameDay: layout.places.get(e.from)?.rLin === layout.places.get(e.to)?.rLin,
          }))
        : [],
    [layout, model, geometryVersion],
  );

  /* ---------- 筛选：形态 + 领域取交集，搜索只匹配 label 与卡身份 ---------- */
  const searchLower = search.trim().toLowerCase();
  const isMuted = useCallback(
    (n: RuntimeNode): boolean => {
      const shapeKey = n.type ?? "__default__";
      if (shapeFilter.size > 0 && n.kind === "card" && !shapeFilter.has(shapeKey)) return true;
      if (domainFilter.size > 0 && n.domain !== undefined && !domainFilter.has(n.domain)) return true;
      if (searchLower && !(n.label.toLowerCase().includes(searchLower) || n.id.toLowerCase().includes(searchLower))) {
        return true;
      }
      return false;
    },
    [shapeFilter, domainFilter, searchLower],
  );

  const themeName = dark ? "dark" : "light";
  const colorOf = useCallback(
    (n: RuntimeNode): string => {
      if (isMuted(n)) return THEME_COLORS[themeName]["mute"] as string;
      if (n.kind === "wormhole") return THEME_COLORS[themeName]["worm"] as string;
      const base = domainColor(n.domain, model.domains, dark);
      return n.superseded ? mix(base, THEME_COLORS[themeName]["deadMix"] as string, 0.55) : base;
    },
    [isMuted, themeName, model.domains, dark],
  );

  /* ================= rAF 补间循环：place() 每帧直接改 DOM 属性 ================= */
  const frame = useRef<FrameState>({
    f: model.dayMax,
    fT: model.dayMax,
    s: 0,
    sT: 0,
    view: { k: 1, tx: 0, ty: 0 },
    vT: null,
    hv: new Map(),
    hover: null,
    raf: null,
  });

  const fitK = useCallback(
    (sizePx: number): number => {
      if (!layout) return 1;
      return (sizePx / (2 * (layout.maxR + 60))) * 0.95;
    },
    [layout],
  );

  /* 视图归位：全景、居中——盘每次换（切盘 / 首次建）与激活态复位都回这里 */
  const goHome = useCallback(() => {
    if (!effectiveSize) return;
    const fr = frame.current;
    fr.sT = 0;
    fr.view = { k: fitK(effectiveSize), tx: effectiveSize / 2, ty: effectiveSize / 2 };
    fr.vT = null;
    kick();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveSize, fitK]);

  useEffect(() => {
    frame.current.f = model.dayMax;
    frame.current.fT = model.dayMax;
    frame.current.s = 0;
    frame.current.sT = 0;
    if (effectiveSize) frame.current.view = { k: fitK(effectiveSize), tx: effectiveSize / 2, ty: effectiveSize / 2 };
    setMode("fisheye");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDisk, effectiveSize]);

  const applyView = useCallback(() => {
    const w = worldRef.current;
    if (!w) return;
    const { k, tx, ty } = frame.current.view;
    w.setAttribute("transform", `translate(${tx},${ty}) scale(${k})`);
  }, []);

  const place = useCallback(() => {
    if (!layout || !skeleton) return;
    const fr = frame.current;
    const { f, s } = fr;
    const ik = 1 / fr.view.k;
    const kRatio = fr.view.k / (effectiveSize ? fitK(effectiveSize) : 1);
    const dodge = computeDodge(chains, layout, fr.view.k);

    if (bandRef.current) {
      if (s > 0.003) {
        const [ra0, rb0] = layout.bandLinear;
        const ra = layout.displayRadius(ra0);
        const rb = layout.displayRadius(rb0);
        bandRef.current.setAttribute("r", String((ra + rb) / 2));
        bandRef.current.setAttribute("stroke-width", String(Math.max(0, rb - ra)));
        bandRef.current.setAttribute("stroke", `rgba(140,170,255,${0.05 * s})`);
      } else {
        bandRef.current.setAttribute("stroke-width", "0");
      }
    }

    for (const [id, n] of runtimeNodes) {
      const p = layout.places.get(id);
      const g = nodeRefs.current.get(id);
      if (!p || !g) continue;
      const m = layout.mag(p.rLin);
      const lod = lodOf(m);
      const hv = fr.hv.get(id) ?? 0;
      const t = fr.hover === id ? 1 : 0;
      const nextHv = hv + (t - hv) * 0.25;
      fr.hv.set(id, Math.abs(t - nextHv) < 0.01 ? t : nextHv);
      const r2 = layout.displayRadius(p.rLin);
      const sc = 0.65 * lod * ik * (1 + 0.4 * nextHv);
      const ang = p.angBase + p.spreadOff + (dodge.get(id) ?? 0);
      const pos = polar(ang, r2);
      g.setAttribute("transform", `translate(${pos.x},${pos.y}) scale(${sc})`);
      g.style.opacity = String(bandFade(m, s) * (runtimeNodes.get(id)?.superseded ? 0.55 : 1));
      const label = labelRefs.current.get(id);
      if (label) {
        const na = ((ang % 360) + 360) % 360;
        let anchor = "middle";
        let dy = 0;
        if (na < 45 || na >= 315) dy = 9;
        else if (na < 135) {
          anchor = "end";
          dy = 3.5;
        } else if (na < 225) dy = -2;
        else {
          anchor = "start";
          dy = 3.5;
        }
        const lp = polar(ang, r2 - 6 * sc - 6 * ik);
        label.style.textAnchor = anchor;
        label.setAttribute("transform", `translate(${lp.x},${lp.y + dy * ik}) scale(${ik})`);
        const eff = m * kRatio;
        const show = showAllLabels || fr.hover === id || eff > 0.6;
        label.style.display = show ? "" : "none";
      }
    }

    // 盘心与树名是静态文字（不像节点标签走逐帧 ref 更新），但同样躺在被缩放的世界坐标系里：
    // 不反向抵消 view.k 的话，字号会跟着整盘的缩放比例一起缩水——世界大（盘深）时几乎看不见。
    if (hubTitleRef.current) hubTitleRef.current.setAttribute("transform", `translate(0,${-6 * ik}) scale(${ik})`);
    if (hubStatusRef.current) hubStatusRef.current.setAttribute("transform", `translate(0,${16 * ik}) scale(${ik})`);
    for (const [i, b] of treeBoxes.entries()) {
      const ref = treeNameRefs.current.get(i);
      if (!ref) continue;
      const rT = Math.max(...b.tree.ids.map((id) => layout.displayRadius(layout.places.get(id)?.rLin ?? 0))) + 22 * ik;
      const p = polar(b.angMid, rT);
      ref.setAttribute("transform", `translate(${p.x},${p.y}) scale(${ik})`);
    }
    applyView();
  }, [layout, skeleton, runtimeNodes, chains, effectiveSize, fitK, applyView, showAllLabels, treeBoxes]);

  // kick 是稳定引用（[] 依赖，给 wheel / 点击等回调直接用），但每帧要跑的 tick 得看到
  // 当前渲染里最新的 place / settings / layout——tick 本身照常每次渲染重新声明，
  // 经 tickRef 转一手，kick 永远调的是最新那份，不会冻结在第一次渲染的闭包上。
  const kick = useCallback(() => {
    if (frame.current.raf !== null) return;
    frame.current.raf = requestAnimationFrame(() => tickRef.current());
  }, []);

  function tick(): void {
    const fr = frame.current;
    fr.raf = null;
    const ease = settings["ease"] ?? 0.16;
    fr.f += (fr.fT - fr.f) * ease;
    fr.s += (fr.sT - fr.s) * ease;
    if (Math.abs(fr.fT - fr.f) < 0.02) fr.f = fr.fT;
    if (Math.abs(fr.sT - fr.s) < 0.003) fr.s = fr.sT;
    let hovLive = false;
    for (const [id, hv] of fr.hv) {
      const t = fr.hover === id ? 1 : 0;
      if (Math.abs(t - hv) > 0.01) hovLive = true;
    }
    if (fr.vT) {
      fr.view.k += (fr.vT.k - fr.view.k) * ease;
      fr.view.tx += (fr.vT.tx - fr.view.tx) * ease;
      fr.view.ty += (fr.vT.ty - fr.view.ty) * ease;
      if (
        Math.abs(fr.view.k - fr.vT.k) < 0.001 &&
        Math.abs(fr.view.tx - fr.vT.tx) < 0.5 &&
        Math.abs(fr.view.ty - fr.vT.ty) < 0.5
      ) {
        fr.view = { ...fr.vT };
        fr.vT = null;
      }
    }
    layoutRef.current.buildMap();
    place();
    if (fr.f !== fr.fT || fr.s !== fr.sT || fr.vT || hovLive) kick();
  }
  const tickRef = useRef(tick);
  tickRef.current = tick;

  /* 首帧与几何变化后都要摆一次（哪怕暂停在原地），否则改设置后画面不刷新 */
  useEffect(() => {
    layoutRef.current?.buildMap();
    place();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geometryVersion, effectiveSize, place]);

  /* ---------- 交互：滚轮鱼眼穿梭 / 自由缩放，未激活时穿透给页面 ---------- */
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !layout) return;
    const onWheel = (e: WheelEvent): void => {
      if (!activated) return; // 未激活：不拦截，滚轮照常滚页面
      e.preventDefault();
      const fr = frame.current;
      const dy = e.deltaY;
      if (mode === "zoom") {
        const bb = el.getBoundingClientRect();
        const mx = e.clientX - bb.left;
        const my = e.clientY - bb.top;
        const base = effectiveSize ? fitK(effectiveSize) : 1;
        const nk = Math.min(base * 8, Math.max(base * 0.5, fr.view.k * Math.pow(1.0015, -dy)));
        const ratio = nk / fr.view.k;
        fr.view.tx = mx - (mx - fr.view.tx) * ratio;
        fr.view.ty = my - (my - fr.view.ty) * ratio;
        fr.view.k = nk;
        fr.vT = null;
        applyView();
        place();
        return;
      }
      if (fr.sT === 0) {
        if (dy < 0) {
          fr.f = model.dayMax;
          fr.fT = model.dayMax;
          fr.sT = 1;
          kick();
        }
        return;
      }
      if (dy > 0 && fr.fT >= model.dayMax - 1e-9 && fr.f >= model.dayMax - 0.5) {
        fr.sT = 0;
        kick();
        return;
      }
      const step = dy * (wheelSensitivity / 120);
      fr.fT = Math.min(model.dayMax, Math.max(model.day0, layout.dayOfEff(layout.dayEff(fr.fT) + step)));
      kick();
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [activated, mode, layout, model.day0, model.dayMax, effectiveSize, fitK, applyView, place, kick, wheelSensitivity]);

  /* 自由缩放下的拖拽漫游 */
  useEffect(() => {
    if (mode !== "zoom" || !activated) return;
    const svg = svgRef.current;
    if (!svg) return;
    let dragging = false;
    let lx = 0;
    let ly = 0;
    const down = (e: PointerEvent): void => {
      dragging = true;
      lx = e.clientX;
      ly = e.clientY;
    };
    const move = (e: PointerEvent): void => {
      if (!dragging) return;
      const dx = e.clientX - lx;
      const dyv = e.clientY - ly;
      frame.current.view.tx += dx;
      frame.current.view.ty += dyv;
      lx = e.clientX;
      ly = e.clientY;
      applyView();
    };
    const up = (): void => {
      dragging = false;
    };
    svg.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      svg.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [mode, activated, applyView]);

  /* 盘心单击切模式（250ms 判定窗，双击回全景） */
  const hubTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onHubClick = useCallback(() => {
    if (hubTimer.current) clearTimeout(hubTimer.current);
    hubTimer.current = setTimeout(() => {
      setMode((m) => (m === "fisheye" ? "zoom" : "fisheye"));
      frame.current.sT = 0;
      if (effectiveSize) frame.current.vT = { k: fitK(effectiveSize), tx: effectiveSize / 2, ty: effectiveSize / 2 };
      kick();
    }, 250);
  }, [effectiveSize, fitK, kick]);
  const onHubDoubleClick = useCallback(() => {
    if (hubTimer.current) clearTimeout(hubTimer.current);
    goHome();
  }, [goHome]);

  /* 点击容器激活 / Esc 分层释放 / 点外部释放 */
  useEffect(() => {
    if (!activated) return;
    const onPointerDown = (e: PointerEvent): void => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setActivated(false);
    };
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [activated]);

  const onKeyDown = useCallback(
    (e: ReactKeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (popOpen) {
        setPopOpen(null);
        return;
      }
      if (activated) {
        setActivated(false);
        return;
      }
      goHome();
    },
    [popOpen, activated, goHome],
  );

  const toggleFullscreen = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void el.requestFullscreen?.();
  }, []);

  const toggleSet = (set: ReadonlySet<string>, v: string): Set<string> => {
    const next = new Set(set);
    if (next.has(v)) next.delete(v);
    else next.add(v);
    return next;
  };

  const onNodeClick = useCallback(
    (n: RuntimeNode) => {
      if (n.kind === "wormhole" && data.disks.some((d) => d.rootId === n.id)) {
        setCurrentDisk(n.id);
      }
    },
    [data.disks],
  );

  const hitCount = useMemo(() => [...runtimeNodes.values()].filter((n) => !isMuted(n)).length, [runtimeNodes, isMuted]);
  const filterActive = shapeFilter.size > 0 || domainFilter.size > 0 || searchLower.length > 0;

  const rootDiskId = model.root?.id ?? currentDisk;
  const diskLabel = (rootId: string): string => routeById.get(rootId)?.label ?? rootId;

  const style: CSSProperties = {
    position: "relative",
    width: "100%",
    aspectRatio: "1 / 1",
    overflow: "hidden",
    borderRadius: 12,
  };

  if (!effectiveSize) {
    return (
      <div ref={containerRef} className="star-disk" style={style} data-star-disk-placeholder="true" />
    );
  }

  const isEmpty = model.cards.length === 0 && model.wormholes.length === 0;

  return (
    <div
      ref={containerRef}
      className={`star-disk${dark ? " star-dark" : ""}`}
      style={style}
      tabIndex={-1}
      onKeyDown={onKeyDown}
    >
      {data.disks.length > 1 ? (
        <div className="star-tabs">
          {data.disks.map((d) => (
            <button
              key={d.rootId}
              type="button"
              className={`star-tab${d.rootId === currentDisk ? " star-tab-active" : ""}`}
              onClick={() => setCurrentDisk(d.rootId)}
            >
              {diskLabel(d.rootId)}
            </button>
          ))}
        </div>
      ) : null}

      <svg
        ref={svgRef}
        width={effectiveSize}
        height={effectiveSize}
        viewBox={`0 0 ${effectiveSize} ${effectiveSize}`}
        className="star-svg"
      >
        <g ref={worldRef}>
          <circle ref={bandRef} cx={0} cy={0} r={0} fill="none" strokeWidth={0} />

          {/* 空窗小行星带 */}
          <g className="star-gap-layer">
            {skeleton?.gaps.map((gb, gi) => (
              <g key={`gap-${gi}`}>
                <circle className="star-gap-bg" cx={0} cy={0} r={gb.bgR} fill="none" strokeWidth={gb.bgW} />
                {gb.dots.map((gd, di) => {
                  const p = polar(gd.ang, gd.rLin);
                  return (
                    <circle
                      key={`dot-${gi}-${di}`}
                      cx={p.x}
                      cy={p.y}
                      r={gd.size}
                      className="star-gap-dot"
                      opacity={gd.op}
                    />
                  );
                })}
              </g>
            ))}
          </g>

          {/* 周月环 */}
          {skeleton?.months.map((rg, i) => {
            const p0 = polar(0, rg.rLin);
            return (
              <g key={`month-${i}`}>
                <circle cx={0} cy={0} r={rg.rLin} className="star-ring-month" opacity={rg.opacity} />
                <text x={p0.x} y={-rg.rLin - 5} className="star-daylabel">
                  {formatDay(0)}
                </text>
              </g>
            );
          })}
          {skeleton?.years.map((ye, i) => (
            <circle key={`year-${i}`} cx={0} cy={0} r={ye.rLin} className="star-ring-year" />
          ))}
          {skeleton?.latest ? (
            <circle cx={0} cy={0} r={skeleton.latest.rLin} className="star-ring-latest" />
          ) : null}

          {/* 里程碑：金色环 + 6 点标签 */}
          {milestones.map((m, i) => {
            const rLin = layout ? layout.radius(m.date) : 0;
            const p = polar(180, rLin);
            return (
              <g key={`ms-${i}`}>
                <circle cx={0} cy={0} r={rLin} className="star-ring-milestone" opacity={0.35} />
                <text x={p.x} y={p.y + 12} className="star-ms-label" opacity={0.85}>
                  {formatDay(dayNum(m.date))} {m.name}
                </text>
              </g>
            );
          })}

          {/* 扇环框 + 树名 */}
          {treeBoxes.map((b, i) => {
            const r0 = Math.max(layout?.innerR ?? 0, b.rMin - 16);
            const r1 = b.rMax + 16;
            const large = b.th1 - b.th0 > 180 ? 1 : 0;
            const p0 = polar(b.th0, r0);
            const p1 = polar(b.th1, r0);
            const p2 = polar(b.th1, r1);
            const p3 = polar(b.th0, r1);
            return (
              <g key={`box-${i}`}>
                <path
                  className="star-treebox"
                  d={`M${p0.x},${p0.y} A${r0},${r0} 0 ${large} 1 ${p1.x},${p1.y} L${p2.x},${p2.y} A${r1},${r1} 0 ${large} 0 ${p3.x},${p3.y} Z`}
                />
                <text
                  ref={(el) => {
                    if (el) treeNameRefs.current.set(i, el);
                    else treeNameRefs.current.delete(i);
                  }}
                  className="star-treename"
                >
                  {b.name}
                </text>
              </g>
            );
          })}
          {[...isoBoxes, ...(wormBox ? [wormBox] : [])].map((b, i) => {
            const r0 = Math.max(layout?.innerR ?? 0, b.rMin - 16);
            const r1 = b.rMax + 16;
            const large = b.th1 - b.th0 > 180 ? 1 : 0;
            const p0 = polar(b.th0, r0);
            const p1 = polar(b.th1, r0);
            const p2 = polar(b.th1, r1);
            const p3 = polar(b.th0, r1);
            return (
              <path
                key={`isobox-${i}`}
                className="star-treebox star-isobox"
                d={`M${p0.x},${p0.y} A${r0},${r0} 0 ${large} 1 ${p1.x},${p1.y} L${p2.x},${p2.y} A${r1},${r1} 0 ${large} 0 ${p3.x},${p3.y} Z`}
              />
            );
          })}

          {/* 边：取代金黄虚线，转向青色点线 */}
          <defs>
            <marker id="star-mk-sup" viewBox="0 0 10 10" refX={9} refY={5} markerWidth={7} markerHeight={7} orient="auto-start-reverse">
              <path d="M1,1 L9,5 L1,9" fill="none" stroke={THEME_COLORS[themeName]["sup"]} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </marker>
            <marker id="star-mk-piv" viewBox="0 0 10 10" refX={9} refY={5} markerWidth={7} markerHeight={7} orient="auto-start-reverse">
              <path d="M1,1 L9,5 L1,9" fill="none" stroke={THEME_COLORS[themeName]["piv"]} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </marker>
          </defs>
          {edgeList.map((e, i) => {
            if (!layout) return null;
            const pa = layout.places.get(e.from);
            const pb = layout.places.get(e.to);
            if (!pa || !pb) return null;
            const piv = e.kind === "pivot";
            const color = piv ? THEME_COLORS[themeName]["piv"] : THEME_COLORS[themeName]["sup"];
            const a = polar(pa.angBase + pa.spreadOff, pa.rLin);
            const b = polar(pb.angBase + pb.spreadOff, pb.rLin);
            return e.sameDay ? (
              <path
                key={`edge-${i}`}
                d={`M${a.x},${a.y} A${pa.rLin},${pa.rLin} 0 0 1 ${b.x},${b.y}`}
                fill="none"
                stroke={color}
                strokeWidth={1.2}
                strokeDasharray={piv ? "1.5 3" : "5 4"}
                markerEnd={`url(#star-mk-${piv ? "piv" : "sup"})`}
                opacity={0.85}
              />
            ) : (
              <line
                key={`edge-${i}`}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke={color}
                strokeWidth={1.2}
                strokeDasharray={piv ? "1.5 3" : "5 4"}
                markerEnd={`url(#star-mk-${piv ? "piv" : "sup"})`}
                opacity={0.85}
              />
            );
          })}

          {/* 盘心：项目根卡，或空盘占位 */}
          <g
            ref={hubRef}
            className="star-hub"
            onClick={onHubClick}
            onDoubleClick={onHubDoubleClick}
          >
            <circle ref={hubCircleRef} cx={0} cy={0} r={layout?.hubWorldR ?? ROOT_RADIUS} className="star-hub-circle" />
            <text ref={hubTitleRef} className="star-hub-title">
              {isEmpty ? "还没有记录" : (model.root?.label ?? diskLabel(rootDiskId ?? ""))}
            </text>
            <text ref={hubStatusRef} className="star-hub-status">
              {`${formatDay(model.day0)} → ${formatDay(model.dayMax)}`}
            </text>
          </g>

          {/* 节点：卡 + 虫洞 */}
          {[...runtimeNodes.values()].map((n) => {
            const color = colorOf(n);
            const href = n.kind === "card" ? `${hrefBase}/${encodeURIComponent(n.id)}` : undefined;
            const content = (
              <g
                ref={(el) => {
                  if (el) nodeRefs.current.set(n.id, el);
                  else nodeRefs.current.delete(n.id);
                }}
                key={n.id}
                className="star-node"
                onPointerEnter={(ev) => {
                  frame.current.hover = n.id;
                  const rect = containerRef.current?.getBoundingClientRect();
                  if (rect) setTooltip({ x: ev.clientX - rect.left, y: ev.clientY - rect.top, node: n });
                  kick();
                }}
                onPointerMove={(ev) => {
                  const rect = containerRef.current?.getBoundingClientRect();
                  if (rect) setTooltip({ x: ev.clientX - rect.left, y: ev.clientY - rect.top, node: n });
                }}
                onPointerLeave={() => {
                  if (frame.current.hover === n.id) frame.current.hover = null;
                  setTooltip(null);
                  kick();
                }}
                onClick={() => onNodeClick(n)}
              >
                <circle r={9} fill="transparent" />
                {n.kind === "wormhole" ? (
                  <>
                    <circle r={7} fill="none" stroke={color} strokeWidth={1.4} />
                    <circle r={3.5} fill="none" stroke={color} strokeWidth={1.2} />
                  </>
                ) : (
                  shapeInner(n.type, NODE_RADIUS[n.superseded ? "superseded" : "alive"], color, THEME_COLORS[themeName]["nodeStroke"] as string)
                )}
                <title>
                  {`${n.label} · ${n.bornAt.slice(0, 10)} · ${n.kind === "wormhole" ? "穿盘" : n.superseded ? "被取代" : "在立"} · ${n.domain}`}
                </title>
              </g>
            );
            return href ? (
              <a key={n.id} href={href} target="_blank" rel="noopener">
                {content}
              </a>
            ) : (
              content
            );
          })}

          {/* 标签（独立层，place() 每帧改 transform，故不与节点同组，避免同一 transform 冲突） */}
          {[...runtimeNodes.values()].map((n) => (
            <text
              key={`label-${n.id}`}
              ref={(el) => {
                if (el) labelRefs.current.set(n.id, el);
                else labelRefs.current.delete(n.id);
              }}
              className="star-label"
              fill={colorOf(n)}
            >
              {n.label}
            </text>
          ))}
        </g>
      </svg>

      {/* 悬停小气泡 */}
      {tooltip ? (
        <div className="star-tooltip" style={{ left: tooltip.x + 12, top: tooltip.y + 12 }}>
          <div className="star-tooltip-title">{tooltip.node.label}</div>
          <div className="star-tooltip-meta">
            {tooltip.node.bornAt.slice(0, 10)} · {tooltip.node.domain} ·{" "}
            {tooltip.node.kind === "wormhole" ? "穿盘" : tooltip.node.superseded ? "被取代" : "在立"}
          </div>
        </div>
      ) : null}

      {/* 右上工具条 */}
      <div className="star-hud-top">
        <button
          type="button"
          className={`star-mbtn${showAllLabels ? " star-active" : ""}`}
          title="全部标签"
          onClick={() => setShowAllLabels((v) => !v)}
        >
          全
        </button>
        <button
          type="button"
          className={`star-mbtn${popOpen === "settings" ? " star-active" : ""}`}
          title="设置"
          onClick={() => setPopOpen((v) => (v === "settings" ? null : "settings"))}
        >
          设
        </button>
        <button
          type="button"
          className={`star-mbtn${popOpen === "help" ? " star-active" : ""}`}
          title="帮助"
          onClick={() => setPopOpen((v) => (v === "help" ? null : "help"))}
        >
          ？
        </button>
        <button type="button" className="star-mbtn" title="全屏" onClick={toggleFullscreen}>
          ⛶
        </button>
        <div className="star-search">
          <input
            type="text"
            placeholder="搜索卡片…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {filterActive ? (
            <span className="star-hits">
              命中 {hitCount} / {runtimeNodes.size} ·{" "}
              <button
                type="button"
                className="star-clear"
                onClick={() => {
                  setShapeFilter(new Set());
                  setDomainFilter(new Set());
                  setSearch("");
                }}
              >
                清除
              </button>
            </span>
          ) : null}
        </div>
        {popOpen === "settings" ? (
          <div className="star-panel">
            {LAYOUT_SLIDERS.map((s) => (
              <label key={s.key}>
                {s.label}
                <span>{s.fmt(settings[s.key] ?? 0)}</span>
                <input
                  type="range"
                  min={s.min}
                  max={s.max}
                  step={s.step}
                  value={settings[s.key] ?? 0}
                  onChange={(e) => applySetting(s.key, Number(e.target.value))}
                />
              </label>
            ))}
            <label>
              滚轮灵敏度
              <span>{wheelSensitivity.toFixed(1)} 天/格</span>
              <input
                type="range"
                min={0.6}
                max={4.8}
                step={0.2}
                value={wheelSensitivity}
                onChange={(e) => setWheelSensitivity(Number(e.target.value))}
              />
            </label>
          </div>
        ) : null}
        {popOpen === "help" ? (
          <div className="star-help">
            <div className="star-hh">怎么看</div>
            <div>环是真实日期，内圈旧、外圈新；金色环是人工钉的里程碑。</div>
            <div>颜色分领域，形状分卡的类型；淡出的是被取代的卡。</div>
            <div className="star-hh">怎么动</div>
            <div>先点一下盘进入交互态；未进入时滚轮照常滚页面。</div>
            <div>进入后默认鱼眼穿梭：前滚放大进鱼眼、沿时间穿梭，滚到最新再后滚缩小回全景。</div>
            <div>盘心单击切自由缩放：滚轮指哪缩哪，拖拽漫游；盘心双击或 Esc 回全景。</div>
            <div>点节点在新标签页打开卡页；点虫洞节点切到对应盘。</div>
            <div>Esc：先收起浮层，再退出交互态。点盘外也会退出交互态。</div>
            <div className="star-hh">怎么筛</div>
            <div>右下图例可点：形态、领域多选取交集；搜索匹配卡的标题与身份。</div>
          </div>
        ) : null}
      </div>

      {/* 右下图例即筛选器 */}
      <div className="star-hud-legend">
        <div className="star-legend-row">
          {SHAPE_ORDER.map((s) => (
            <span
              key={s}
              className={`star-lgi${shapeFilter.has(s) ? " star-on" : shapeFilter.size > 0 ? " star-off" : ""}`}
              onClick={() => setShapeFilter((prev) => toggleSet(prev, s))}
            >
              {legendSymbol(s === "__default__" ? null : s)}
              {s === "__default__" ? "缺省" : SHAPE_NAMES[s]}
            </span>
          ))}
        </div>
        <div className="star-legend-row">
          <span className="star-lgp">
            <svg viewBox="0 -9 26 18" className="star-lgs star-lgs-w" aria-hidden="true">
              <line x1={1} y1={0} x2={17} y2={0} stroke={THEME_COLORS[themeName]["sup"]} strokeWidth={1.2} strokeDasharray="3 2.5" />
            </svg>
            取代
          </span>
          <span className="star-lgp">
            <svg viewBox="0 -9 26 18" className="star-lgs star-lgs-w" aria-hidden="true">
              <line x1={1} y1={0} x2={17} y2={0} stroke={THEME_COLORS[themeName]["piv"]} strokeWidth={1.2} strokeDasharray="1 2.2" />
            </svg>
            转向
          </span>
          <span className="star-lgp">
            <svg viewBox="-9 -9 18 18" className="star-lgs" aria-hidden="true">
              <circle r={6.2} fill="none" stroke={THEME_COLORS[themeName]["sup"]} strokeWidth={1.3} />
            </svg>
            里程碑
          </span>
        </div>
        <div className="star-legend-row">
          {model.domains.map((d) => (
            <span
              key={d}
              className={`star-lgi${domainFilter.has(d) ? " star-on" : domainFilter.size > 0 ? " star-off" : ""}`}
              onClick={() => setDomainFilter((prev) => toggleSet(prev, d))}
            >
              <svg viewBox="-9 -9 18 18" className="star-lgs" aria-hidden="true">
                <circle r={4} fill={domainColor(d, model.domains, dark)} />
              </svg>
              {d}
            </span>
          ))}
        </div>
      </div>

      {!activated ? (
        <button
          type="button"
          className="star-activate-overlay"
          onClick={() => setActivated(true)}
        >
          点击进入盘面
        </button>
      ) : null}
    </div>
  );
}
