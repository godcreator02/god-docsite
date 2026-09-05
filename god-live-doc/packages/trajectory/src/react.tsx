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
import {
  advanceFrame,
  bandFade,
  DEG,
  LOD_MIN,
  lodOf,
  NODE_RADIUS,
  polar,
  ringSkeleton,
  ROOT_RADIUS,
  RingsLayout,
  smoothstep,
  SPREAD_DEG,
} from "./layout.ts";
import type { FrameState } from "./layout.ts";
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

/** hubStroke 是盘心圆的静息描边，跟 star.css 的 `.star-hub-circle` 同值：贴时间轴端点时
 * place() 拿它跟 warn 混色、直接写 stroke 属性盖住 CSS，退出警示区再把属性摘掉交还 CSS。 */
const THEME_COLORS: Record<"dark" | "light", Record<string, string>> = {
  dark: {
    sup: "#f5b942",
    piv: "#48c9d8",
    mute: "#4b5261",
    deadMix: "#6b7280",
    noDomain: "#8fa0c8",
    worm: "#e8c766",
    nodeStroke: "rgba(255,255,255,0.75)",
    hubStroke: "#5a6a94",
    warn: "#f5b942",
  },
  light: {
    sup: "#c07f10",
    piv: "#0e7c8a",
    mute: "#c6ccd8",
    deadMix: "#aab1bf",
    noDomain: "#5d6a8c",
    worm: "#a9791a",
    nodeStroke: "rgba(22,30,52,0.55)",
    hubStroke: "#b6c0d8",
    warn: "#d97706",
  },
};

/** 盘面模式字样：盘心全景态显示，切模式即见反馈。 */
const MODE_NAME: Record<"fisheye" | "zoom", string> = { fisheye: "鱼眼穿梭", zoom: "自由缩放" };

/** 扇环框路径：内弧 → 径线 → 外弧 → 径线闭合。半径由调用方按当前显示半径给，
 * 鱼眼变形时框跟着节点一起走。 */
function sectorPath(th0: number, th1: number, r0: number, r1: number): string {
  const large = th1 - th0 > 180 ? 1 : 0;
  const p0 = polar(th0, r0);
  const p1 = polar(th1, r0);
  const p2 = polar(th1, r1);
  const p3 = polar(th0, r1);
  return (
    `M${p0.x},${p0.y} A${r0},${r0} 0 ${large} 1 ${p1.x},${p1.y} ` +
    `L${p2.x},${p2.y} A${r1},${r1} 0 ${large} 0 ${p3.x},${p3.y} Z`
  );
}

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

/* ================= 帧态：视图补间与悬停补间，塞进一个 ref，不走 setState =================
 * FrameState 与 advanceFrame 住 layout.ts——鱼眼的两对补间量（焦点日 / 强度）本来就是
 * RingsLayout 的字段，补间跟它们同住才不会再分家。 */

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
  const edgeRefs = useRef(new Map<number, SVGPathElement | SVGLineElement>());
  /* 环类元素统一进这两张表，键带类别前缀：周环 w、月环 m、年环 y、最新环 latest、
   * 空窗雾带 gb、空窗起止边界环 gr、里程碑 ms。半径全由 place() 逐帧写，鱼眼一变形
   * 环得跟着节点走——静态钉死的环会在鱼眼态跟卡整片脱节。 */
  const ringCircleRefs = useRef(new Map<string, SVGCircleElement>());
  const ringLabelRefs = useRef(new Map<string, SVGTextElement>());
  const gapDotRefs = useRef(new Map<string, SVGCircleElement>());
  /** 扇环框路径：树扇环在前、孤星带与虫洞带接在后面，索引跟 allBoxes 一致 */
  const boxPathRefs = useRef(new Map<number, SVGPathElement>());

  const ringCircleRef = (key: string) => (el: SVGCircleElement | null) => {
    if (el) ringCircleRefs.current.set(key, el);
    else ringCircleRefs.current.delete(key);
  };
  const ringLabelRef = (key: string) => (el: SVGTextElement | null) => {
    if (el) ringLabelRefs.current.set(key, el);
    else ringLabelRefs.current.delete(key);
  };
  const gapDotRef = (key: string) => (el: SVGCircleElement | null) => {
    if (el) gapDotRefs.current.set(key, el);
    else gapDotRefs.current.delete(key);
  };
  const boxPathRef = (i: number) => (el: SVGPathElement | null) => {
    if (el) boxPathRefs.current.set(i, el);
    else boxPathRefs.current.delete(i);
  };

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
  const isEmpty = model.cards.length === 0 && model.wormholes.length === 0;
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
  /** 全部扇环框按 place() 的更新序摊平：树在前、孤星带与虫洞带在后 */
  const allBoxes = useMemo(
    () => [...treeBoxes, ...isoBoxes, ...(wormBox ? [wormBox] : [])],
    [treeBoxes, isoBoxes, wormBox],
  );
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
      /* 虫洞两道筛选都豁免：它不是一张卡，没有形态、也不属于任何领域（domain 是哨兵值），
       * 按卡的口径一筛就整片灭掉，穿盘的入口跟着没了 */
      if (shapeFilter.size > 0 && n.kind === "card" && !shapeFilter.has(shapeKey)) return true;
      if (domainFilter.size > 0 && n.kind !== "wormhole" && !domainFilter.has(n.domain)) return true;
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
    layoutRef.current.unfocus();
    fr.view = { k: fitK(effectiveSize), tx: effectiveSize / 2, ty: effectiveSize / 2 };
    fr.vT = null;
    kick();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveSize, fitK]);

  /* 换盘 / 换尺寸：鱼眼四个字段直接复位到全景（焦点钉最新、强度归零、不走补间） */
  useEffect(() => {
    const l = layoutRef.current;
    l.focusDay = model.dayMax;
    l.focusDayTarget = model.dayMax;
    l.strength = 0;
    l.strengthTarget = 0;
    l.buildMap();
    if (effectiveSize) frame.current.view = { k: fitK(effectiveSize), tx: effectiveSize / 2, ty: effectiveSize / 2 };
    /* 上一张盘的悬停态一并撤掉：节点按卡身份 keyed，新盘没有这些身份，
     * 气泡、hover 高亮与逐节点补间表留着就是一份永远褪不掉的残影 */
    frame.current.hover = null;
    frame.current.hv.clear();
    setTooltip(null);
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
    const f = layout.focusDay;
    const s = layout.strength;
    const ik = 1 / fr.view.k;
    const kRatio = fr.view.k / (effectiveSize ? fitK(effectiveSize) : 1);
    const dodge = computeDodge(chains, layout, fr.view.k);
    /* 12 点竖线（周环 / 月环 / 空窗起止 / 年环）与 6 点竖线（里程碑）各一个报名处：
     * 沿途只报名不定显隐，末尾各自贪心裁决——同线上挤在一起的标签叠成一团比少几个更难读 */
    const labelClaims: Array<{ r: number; prio: number; label: SVGTextElement }> = [];
    const msClaims: Array<{ r: number; label: SVGTextElement }> = [];

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

    /* 背景环：周环随缩放展开（全景只留月环，放大 / 进鱼眼后渐显），月环渐隐保底不归零；
     * 两者都乘当地折算率给空窗让位（荒年密环糊成灰带，信号交给小行星带） */
    const putRing = (key: string, d: number, rLin: number, isMonth: boolean): void => {
      const r2 = layout.displayRadius(rLin);
      const m = layout.mag(rLin);
      const t = Math.min(1, Math.max(0, (m - 0.3) / 0.4));
      const tWeek = smoothstep(1.2, 2.2, m * kRatio);
      const gapMute = layout.effRate(d);
      const circle = ringCircleRefs.current.get(key);
      if (circle) {
        circle.setAttribute("r", String(r2));
        circle.setAttribute("opacity", String((isMonth ? 0.27 + 0.73 * t : t * tWeek) * gapMute));
      }
      const label = ringLabelRefs.current.get(key);
      if (!label) return;
      label.setAttribute("transform", `translate(0,${-r2 - 5 * ik}) scale(${ik})`);
      const reff = m * kRatio;
      const want = gapMute > 0.5 && ((!isMonth && reff > 1.6) || (isMonth && reff > 0.25));
      if (want) labelClaims.push({ r: r2, prio: isMonth ? 2 : 1, label });
      else label.style.display = "none";
    };
    skeleton.weeks.forEach((w, i) => putRing(`w${i}`, w.d, w.rLin, false));
    skeleton.months.forEach((mo, i) => putRing(`m${i}`, mo.d, mo.rLin, true));

    /* 年环：跨年主结构线，恒显不吃 LOD 门、空窗内不让位，标签优先级最高 */
    skeleton.years.forEach((ye, i) => {
      const r2 = layout.displayRadius(ye.rLin);
      ringCircleRefs.current.get(`y${i}`)?.setAttribute("r", String(r2));
      const label = ringLabelRefs.current.get(`y${i}`);
      if (!label) return;
      label.setAttribute("transform", `translate(0,${-r2 - 6 * ik}) scale(${ik})`);
      labelClaims.push({ r: r2, prio: 4, label });
    });
    if (skeleton.latest) {
      ringCircleRefs.current
        .get("latest")
        ?.setAttribute("r", String(layout.displayRadius(skeleton.latest.rLin)));
    }

    /* 空窗小行星带：雾带与碎石随鱼眼变形，碎石尺寸吃局部放大率（上限比节点松）；
     * 起止边界环挂 12 点短日期标签，优先级排在年环之后、月周环之前 */
    skeleton.gaps.forEach((gb, gi) => {
      const ra = layout.displayRadius(layout.radiusDay(gb.d0));
      const rb = layout.displayRadius(layout.radiusDay(gb.d1));
      const bg = ringCircleRefs.current.get(`gb${gi}`);
      if (bg) {
        bg.setAttribute("r", String((ra + rb) / 2));
        bg.setAttribute("stroke-width", String(Math.max(0, rb - ra)));
      }
      gb.dots.forEach((gd, di) => {
        const node = gapDotRefs.current.get(`${gi}-${di}`);
        if (!node) return;
        const m = layout.mag(gd.rLin);
        const p = polar(gd.ang, layout.displayRadius(gd.rLin));
        node.setAttribute("cx", String(p.x));
        node.setAttribute("cy", String(p.y));
        node.setAttribute("r", String(gd.size * Math.min(3, Math.max(LOD_MIN, Math.sqrt(m))) * ik));
        node.setAttribute(
          "opacity",
          String(Math.min(1, gd.op + 0.3 * smoothstep(1.5, 3, m)) * bandFade(m, s)),
        );
      });
      [gb.d0, gb.d1].forEach((d, k) => {
        const r2 = layout.displayRadius(layout.radiusDay(d));
        ringCircleRefs.current.get(`gr${gi}-${k}`)?.setAttribute("r", String(r2));
        const label = ringLabelRefs.current.get(`gr${gi}-${k}`);
        if (!label) return;
        label.setAttribute("transform", `translate(0,${-r2 - 5 * ik}) scale(${ik})`);
        labelClaims.push({ r: r2, prio: 3, label });
      });
    });

    /* 里程碑环：随鱼眼变形，标签恒在 6 点方向（正上让给日期标签），仲裁按日期先后先到先得 */
    milestones.forEach((ms, i) => {
      const r2 = layout.displayRadius(layout.radius(ms.date));
      ringCircleRefs.current.get(`ms${i}`)?.setAttribute("r", String(r2));
      const label = ringLabelRefs.current.get(`ms${i}`);
      if (!label) return;
      const p = polar(180, r2);
      label.setAttribute("transform", `translate(${p.x},${p.y + 12 * ik}) scale(${ik})`);
      msClaims.push({ r: r2, label });
    });

    /* 扇环框：内外弧走显示半径，径向两端各放 16 世界单位余量包住节点 */
    allBoxes.forEach((b, i) => {
      const node = boxPathRefs.current.get(i);
      if (!node) return;
      const r0 = Math.max(layout.innerR, layout.displayRadius(b.rMin) - 16);
      const r1 = layout.displayRadius(b.rMax) + 16;
      node.setAttribute("d", sectorPath(b.th0, b.th1, r0, r1));
    });

    /* 节点：先摆完存下角度 / 半径 / 缩放，边随后照抄同一份，两头绝不各算各的 */
    const geom = new Map<string, { ang: number; r: number; sc: number }>();
    for (const [id, n] of runtimeNodes) {
      const p = layout.places.get(id);
      if (!p) continue;
      const m = layout.mag(p.rLin);
      const lod = lodOf(m);
      if (!fr.hv.has(id)) fr.hv.set(id, 0);
      const hv = fr.hv.get(id) as number;
      const r2 = layout.displayRadius(p.rLin);
      const sc = layout.symbolPx * lod * ik * (1 + 0.4 * hv);
      /* 同日串珠动态展开：基础角偏是烘焙期定的固定档，这里按当前屏幕弧长现算所需角距——
       * 进了焦点带（gate 开）才把挤在一起的同日卡撑开，带外收回基础档，串珠不满屏乱飞。
       * 所需直径不吃 hover 放大：hover 不该抖布局。 */
      const diamPx = 2 * NODE_RADIUS[n.superseded ? "superseded" : "alive"] * layout.symbolPx * lod;
      const needDeg = ((diamPx + 14) / (r2 * fr.view.k)) * DEG;
      const spreadDeg = SPREAD_DEG + Math.max(0, needDeg - SPREAD_DEG) * smoothstep(1.5, 3, m);
      const ang = p.angBase + (p.spreadOff / SPREAD_DEG) * spreadDeg + (dodge.get(id) ?? 0);
      geom.set(id, { ang, r: r2, sc });
      const g = nodeRefs.current.get(id);
      if (!g) continue;
      const pos = polar(ang, r2);
      g.setAttribute("transform", `translate(${pos.x},${pos.y}) scale(${sc})`);
      g.style.opacity = String(bandFade(m, s) * (n.superseded ? 0.55 : 1));
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
        const lp = polar(ang, r2 - NODE_RADIUS.alive * sc - 6 * ik);
        label.style.textAnchor = anchor;
        label.setAttribute("transform", `translate(${lp.x},${lp.y + dy * ik}) scale(${ik})`);
        const eff = m * kRatio;
        const show = showAllLabels || fr.hover === id || eff > 0.6;
        label.style.display = show ? "" : "none";
      }
    }

    // 边：端点抄节点那份 geom（角度含动态串珠展开与避让），随鱼眼实时变形——退距按端点当前的
    // 屏幕直径算（跟节点缩放同一份 sc 口径），箭头尖不扎进节点。
    for (const [i, e] of edgeList.entries()) {
      const ga = geom.get(e.from);
      const gbEnd = geom.get(e.to);
      const node = edgeRefs.current.get(i);
      if (!ga || !gbEnd || !node) continue;
      const iaR = NODE_RADIUS.alive * ga.sc + 3 * ik;
      const ibR = NODE_RADIUS.alive * gbEnd.sc + 2 * ik;
      if (e.sameDay) {
        const da = (iaR / ga.r) * DEG;
        const db = (ibR / gbEnd.r) * DEG;
        const sq = Math.min(1, Math.max(0, ((gbEnd.ang - ga.ang) * 0.8) / Math.max(1e-6, da + db)));
        const pA = polar(ga.ang + da * sq, ga.r);
        const pB = polar(gbEnd.ang - db * sq, gbEnd.r);
        node.setAttribute("d", `M${pA.x},${pA.y} A${ga.r},${ga.r} 0 0 1 ${pB.x},${pB.y}`);
      } else {
        const posA = polar(ga.ang, ga.r);
        const posB = polar(gbEnd.ang, gbEnd.r);
        const len = Math.hypot(posB.x - posA.x, posB.y - posA.y) || 1;
        const ux = (posB.x - posA.x) / len;
        const uy = (posB.y - posA.y) / len;
        node.setAttribute("x1", String(posA.x + ux * iaR));
        node.setAttribute("y1", String(posA.y + uy * iaR));
        node.setAttribute("x2", String(posB.x - ux * ibR));
        node.setAttribute("y2", String(posB.y - uy * ibR));
      }
      const pa = layout.places.get(e.from);
      const pb = layout.places.get(e.to);
      const em = Math.max(layout.mag(pa?.rLin ?? 0), layout.mag(pb?.rLin ?? 0));
      node.setAttribute("opacity", String(0.85 * (1 - 0.5 * s * (1 - smoothstep(1.2, 2.5, em)))));
    }

    // 盘心与树名是静态文字（不像节点标签走逐帧 ref 更新），但同样躺在被缩放的世界坐标系里：
    // 不反向抵消 view.k 的话，字号会跟着整盘的缩放比例一起缩水——世界大（盘深）时几乎看不见。
    if (hubTitleRef.current) hubTitleRef.current.setAttribute("transform", `translate(0,${-6 * ik}) scale(${ik})`);
    /* 盘心状态文字整块由 place() 写：JSX 里那个 <text> 故意不带任何子节点——React 不碰
     * 它没渲染过的子树，逐帧改文本才不会跟重渲染打架。贴时间轴端点时盘心圈渐变警示色，
     * 退出警示区把 stroke 属性摘掉、颜色交还 star.css。 */
    const hubStatus = hubStatusRef.current;
    if (hubStatus) {
      hubStatus.setAttribute("transform", `translate(0,${16 * ik}) scale(${ik})`);
      if (s < 0.01) {
        hubStatus.textContent = isEmpty
          ? "还没有记录"
          : `${formatDay(model.day0)} → ${formatDay(model.dayMax)} · ${MODE_NAME[mode]}`;
        hubStatus.style.fill = "";
      } else {
        /* 鱼眼态：内外圈日期从焦点带的线性域边界经引擎逆映射反解，换行显示（单行小圆装不下） */
        const clampDay = (n: number): number => Math.max(model.day0, Math.min(model.dayMax, n));
        const dA = formatDay(Math.round(clampDay(layout.dayOfRadius(layout.bandLinear[0]))));
        const dB = formatDay(Math.round(clampDay(layout.dayOfRadius(layout.bandLinear[1]))));
        const early = layout.focusDayTarget <= model.day0 + 1e-9 && f <= model.day0 + 0.6;
        const late = !early && layout.focusDayTarget >= model.dayMax - 1e-9 && f >= model.dayMax - 0.6;
        hubStatus.innerHTML =
          `<tspan x="0" dy="0">内圈 ${dA}${early ? " · 已到最早" : ""}</tspan>` +
          `<tspan x="0" dy="13">外圈 ${dB}${late ? " · 已到最新" : ""}</tspan>`;
        hubStatus.style.fill = early || late ? (THEME_COLORS[themeName]["warn"] as string) : "";
      }
    }
    const hubCircle = hubCircleRef.current;
    if (hubCircle) {
      const distEnd = Math.min(f - model.day0, model.dayMax - f);
      const warnT = s * (1 - smoothstep(0, 2, distEnd));
      if (warnT > 0.01) {
        hubCircle.setAttribute(
          "stroke",
          mix(THEME_COLORS[themeName]["hubStroke"] as string, THEME_COLORS[themeName]["warn"] as string, warnT),
        );
      } else hubCircle.removeAttribute("stroke");
    }
    for (const [i, b] of treeBoxes.entries()) {
      const ref = treeNameRefs.current.get(i);
      if (!ref) continue;
      const rT = Math.max(...b.tree.ids.map((id) => layout.displayRadius(layout.places.get(id)?.rLin ?? 0))) + 22 * ik;
      const p = polar(b.angMid, rT);
      ref.setAttribute("transform", `translate(${p.x},${p.y}) scale(${ik})`);
    }

    /* 拥挤仲裁收尾：同一条竖线上贪心占位，屏幕间距不足 14px 的后来者让隐 */
    const arbitrate = (claims: Array<{ r: number; label: SVGTextElement }>): void => {
      const taken: number[] = [];
      const minGap = 14 * ik;
      for (const c of claims) {
        const ok = !taken.some((y) => Math.abs(y - c.r) < minGap);
        c.label.style.display = ok ? "" : "none";
        if (ok) taken.push(c.r);
      }
    };
    labelClaims.sort((a, b) => b.prio - a.prio);
    arbitrate(labelClaims);
    arbitrate(msClaims);
    applyView();
  }, [
    layout,
    skeleton,
    runtimeNodes,
    chains,
    edgeList,
    effectiveSize,
    fitK,
    applyView,
    showAllLabels,
    treeBoxes,
    allBoxes,
    milestones,
    mode,
    isEmpty,
    themeName,
    model.day0,
    model.dayMax,
  ]);

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
    const live = advanceFrame(layoutRef.current, fr, settings["ease"] ?? 0.16);
    place();
    if (live) kick();
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
      // 滚轮方向对齐自由缩放的手感：前滚 = 放大 = 进鱼眼并深入历史，后滚 = 缩小 = 走向最新
      // 直至退回全景。三个分支只经 focusOn / unfocus 两个门，不直捅补间裸字段。
      const l = layoutRef.current;
      if (l.strengthTarget === 0) {
        // 全景态：前滚从最新展开进鱼眼（snap，焦点不从上一次的位置飘过来），后滚无操作
        if (dy < 0) {
          l.focusOn(model.dayMax, true);
          kick();
        }
        return;
      }
      if (dy > 0 && l.focusDayTarget >= model.dayMax - 1e-9 && l.focusDay >= model.dayMax - 0.5) {
        l.unfocus();
        kick();
        return;
      }
      // 步进走显示域折算表（正折算 → 加步长 → 逆折算，段边界精确积分不过冲）。参照物 trail
      // 另有一张幅度减半的「穿梭域」（travEff / travOfEff）专供滚轮，本仓不设第二张标度——
      // 位置模型只此一张表，输入设备只是驱动方式不同（见 layout.ts effSegs 的注释）。
      // 代价是穿长空窗时一格走的日历天数比 trail 多，手感由「滚轮灵敏度」滑杆兜。
      const step = dy * (wheelSensitivity / 120);
      l.focusOn(l.dayOfEff(l.dayEff(l.focusDayTarget) + step));
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
      layoutRef.current.unfocus();
      if (effectiveSize) frame.current.vT = { k: fitK(effectiveSize), tx: effectiveSize / 2, ty: effectiveSize / 2 };
      kick();
    }, 250);
  }, [effectiveSize, fitK, kick]);
  const onHubDoubleClick = useCallback(() => {
    if (hubTimer.current) clearTimeout(hubTimer.current);
    goHome();
  }, [goHome]);

  /* 卸载收尾：排着的那一帧与盘心单双击的判定窗都撤掉——组件都没了，回调再回来碰
   * ref 表就是白跑一趟（页面切走时 rAF 挂起、切回来才触发，更容易撞上） */
  useEffect(() => {
    const fr = frame.current;
    const timer = hubTimer;
    return () => {
      if (fr.raf !== null) {
        cancelAnimationFrame(fr.raf);
        fr.raf = null;
      }
      if (timer.current !== null) {
        clearTimeout(timer.current);
        timer.current = null;
      }
    };
  }, []);

  /* 激活后把焦点收到容器上：遮罩按钮一卸载焦点就掉回 body，onKeyDown 挂在容器上，
   * 焦点不在这儿 Esc 一下也收不到（容器已有 tabIndex={-1}，收得住） */
  useEffect(() => {
    if (activated) containerRef.current?.focus();
  }, [activated]);

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

          {/* 空窗小行星带：雾带 + 碎石 + 起止边界环与 12 点日期标签（几何全由 place() 逐帧写，
              这里给的是全景态初值，静态渲染那一趟看到的就是它） */}
          <g className="star-gap-layer">
            {skeleton?.gaps.map((gb, gi) => (
              <g key={`gap-${gi}`}>
                <circle
                  ref={ringCircleRef(`gb${gi}`)}
                  className="star-gap-bg"
                  cx={0}
                  cy={0}
                  r={gb.bgR}
                  fill="none"
                  strokeWidth={gb.bgW}
                />
                {gb.dots.map((gd, di) => {
                  const p = polar(gd.ang, gd.rLin);
                  return (
                    <circle
                      key={`dot-${gi}-${di}`}
                      ref={gapDotRef(`${gi}-${di}`)}
                      cx={p.x}
                      cy={p.y}
                      r={gd.size}
                      className="star-gap-dot"
                      opacity={gd.op}
                    />
                  );
                })}
                {[gb.d0, gb.d1].map((d, k) => (
                  <g key={`rim-${gi}-${k}`}>
                    <circle
                      ref={ringCircleRef(`gr${gi}-${k}`)}
                      className="star-gap-rim"
                      cx={0}
                      cy={0}
                      r={layout ? layout.radiusDay(d) : 0}
                    />
                    <text ref={ringLabelRef(`gr${gi}-${k}`)} className="star-daylabel">
                      {formatDay(d)}
                    </text>
                  </g>
                ))}
              </g>
            ))}
          </g>

          {/* 周环 / 月环 / 年环 / 最新环：半径与显隐都归 place()，标签走 12 点拥挤仲裁 */}
          {skeleton?.weeks.map((w, i) => (
            <g key={`week-${i}`}>
              <circle ref={ringCircleRef(`w${i}`)} cx={0} cy={0} r={w.rLin} className="star-ring-week" opacity={0} />
              <text ref={ringLabelRef(`w${i}`)} className="star-daylabel">
                {formatDay(w.d)}
              </text>
            </g>
          ))}
          {skeleton?.months.map((rg, i) => (
            <g key={`month-${i}`}>
              <circle
                ref={ringCircleRef(`m${i}`)}
                cx={0}
                cy={0}
                r={rg.rLin}
                className="star-ring-month"
                opacity={rg.opacity}
              />
              <text ref={ringLabelRef(`m${i}`)} className="star-daylabel">
                {formatDay(rg.d)}
              </text>
            </g>
          ))}
          {skeleton?.years.map((ye, i) => (
            <g key={`year-${i}`}>
              <circle ref={ringCircleRef(`y${i}`)} cx={0} cy={0} r={ye.rLin} className="star-ring-year" />
              <text ref={ringLabelRef(`y${i}`)} className="star-yl">
                {new Date(ye.d * 86400000).getUTCFullYear()}
              </text>
            </g>
          ))}
          {skeleton?.latest ? (
            <circle ref={ringCircleRef("latest")} cx={0} cy={0} r={skeleton.latest.rLin} className="star-ring-latest" />
          ) : null}

          {/* 里程碑：金色环 + 6 点标签（标签走 6 点那条竖线的仲裁） */}
          {milestones.map((m, i) => (
            <g key={`ms-${i}`}>
              <circle
                ref={ringCircleRef(`ms${i}`)}
                cx={0}
                cy={0}
                r={layout ? layout.radius(m.date) : 0}
                className="star-ring-milestone"
                opacity={0.35}
              />
              <text ref={ringLabelRef(`ms${i}`)} className="star-ms-label" opacity={0.85}>
                {formatDay(dayNum(m.date))} {m.name}
              </text>
            </g>
          ))}

          {/* 扇环框 + 树名：框的内外弧也吃 displayRadius，鱼眼变形时不跟节点脱节 */}
          {treeBoxes.map((b, i) => (
            <g key={`box-${i}`}>
              <path
                ref={boxPathRef(i)}
                className="star-treebox"
                d={sectorPath(b.th0, b.th1, Math.max(layout?.innerR ?? 0, b.rMin - 16), b.rMax + 16)}
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
          ))}
          {[...isoBoxes, ...(wormBox ? [wormBox] : [])].map((b, i) => (
            <path
              key={`isobox-${i}`}
              ref={boxPathRef(treeBoxes.length + i)}
              className="star-treebox star-isobox"
              d={sectorPath(b.th0, b.th1, Math.max(layout?.innerR ?? 0, b.rMin - 16), b.rMax + 16)}
            />
          ))}

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
            // 端点与几何（弧 / 弦）跟节点一样吃 displayRadius，随鱼眼实时变形——place() 每帧
            // 用 ref 直接改 d / x1..y2，这里只建元素、不算初始坐标（否则全景态会跟第一帧的
            // place() 结果短暂对不上）。
            const refCb = (el: SVGPathElement | SVGLineElement | null) => {
              if (el) edgeRefs.current.set(i, el);
              else edgeRefs.current.delete(i);
            };
            return e.sameDay ? (
              <path
                key={`edge-${i}`}
                ref={refCb}
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
                ref={refCb}
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
            {/* 状态行故意不给子节点：全景一行、鱼眼两行 tspan，整块由 place() 逐帧写，
                React 不碰它没渲染过的子树，重渲染不会把当前帧的文字抹掉 */}
            <text ref={hubStatusRef} className="star-hub-status" />
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
            <div>虫洞不受形态与领域筛选影响，点它切盘。</div>
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

      {/* 激活遮罩：整片可点，但提示文字贴盘面下沿一条细带——压在盘心正中会跟项目名叠一起 */}
      {!activated ? (
        <button
          type="button"
          className="star-activate-overlay"
          onClick={() => setActivated(true)}
        >
          <span className="star-activate-hint">点击进入盘面</span>
        </button>
      ) : null}
    </div>
  );
}
