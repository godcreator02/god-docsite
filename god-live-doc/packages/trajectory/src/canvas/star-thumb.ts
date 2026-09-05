/* 静态盘画家——启动器卡片盘图：一个项目的全景定妆照（全景初始态，无补间、无交互，一次画完即终态）。
 * 整搬自 Obsidian 版 launcher/star-thumb.ts。
 *
 * 复用 layout.ts 纯函数布局（RingsLayout 直建，灌调用方给的手感设置，缺省 DEFAULT_SETTINGS）、
 * theme 色板与 node-dom 工具；完全不依赖编排者。文档由调用方给（浏览器 document 或
 * svg-doc 的桩，服务端渲静态 markup 走后者），画家只经 el() 建树。
 *
 * 只画形状层：环形骨架（月环 / 年环 / 最新环 + 空窗小行星带，全景语义照抄大图）、
 * 盘心（圆盘 + 正中根节点）、节点（在立 / 被取代淡出、孤星虚线环）、边（取代金黄 / 转向青 + 箭头 marker）、
 * 泳道扇环框（领域分区的形状骨架）。不画：文字标签（日期 / 树名 / 卡名）、里程碑、
 * 焦点带边环（鱼眼专属）、周环（全景态 opacity 恒 0）——盘图纯装饰，文字信息归卡片文字区。
 *
 * 与大图的两点结构差别（布局口径一致：手感设置同灌 hubSize / gapFree / gapWide，
 * 盘心尺寸跟大图同源——同一个 configure 入口、同一个世界锚定 hubWorldR = innerR − HUB_RIM，
 * 布局产物（角度/半径/装箱）与盘心占比逐位一致）：
 * 一是大图节点 / 线宽走「屏幕恒定」（每帧按 view.k 反补偿），定妆照没有视口概念，
 *   节点径 / 线宽按外接框半径 outerR 等比出，缩放到卡片尺寸后形态不变；
 * 二是着色在建构时一次定死，主题切换由调用方整棵重画（服务端按亮暗各渲一份），
 *   不走 recolor 逐帧重刷（没有帧）。CSS 变量项（--hub-fill / --box-stroke / --box-fill）
 *   靠卡片容器的样式作用域跟随宿主主题，切换时这部分不用重画。 */

import { BASE_RADIUS, DEG, polar, RingsLayout, ROOT_RADIUS, ringSkeleton } from "../layout.ts";
import { formOf } from "../model.ts";
import type { TrajectoryModel } from "../types.ts";
import { el, formColor, MarkerFactory, nodeEdge } from "./node-dom.ts";
import { DEFAULT_SETTINGS, type TrajectorySettings } from "./settings.ts";
import type { SvgDocument } from "./svg-doc.ts";
import {
  buildThemes,
  DEFAULT_RING_PALETTE,
  hubStrokeOf,
  mix,
  type RingPalette,
  type Theme,
  type ThemeName,
} from "./theme.ts";

/* ---------- 视觉常量 ---------- */
/** 外接框相对 maxR 的外扩 padding（outerR = maxR + THUMB_PAD）。导出给测试同口径复算。 */
export const THUMB_PAD = 24;

/** 按当前亮暗解一套主题：领域色按出现序分配，盘心描边跟宿主 `--color-fd-primary` 走（同大图）。
 * 只在浏览器运行时调（hubStrokeOf 要探针解 CSS 变量）；服务端与测试直拿 buildThemes 的色板。 */
export function thumbTheme(domains: string[], themeName: ThemeName): Theme {
  const theme = buildThemes(domains)[themeName];
  theme.hubStroke = hubStrokeOf(themeName);
  return theme;
}

/** 定妆照绘制现场：各 draw 层共用的一袋参数，renderStarThumb 组装一次、逐层传递。 */
interface ThumbScene {
  svg: SVGElement;
  layout: RingsLayout;
  model: TrajectoryModel;
  theme: Theme;
  palette: RingPalette;
  markers: MarkerFactory;
  /** 每张卡的落点：角度 = 基准 + 同日串珠角偏（全景态基础档），半径 = 线性半径 */
  coords: Map<string, { x: number; y: number; r: number; ang: number }>;
  /** 节点半径：随外接框等比（带上下钳制，极端盘径不变形） */
  nodeR: number;
  /** 线宽基准：同随外接框等比 */
  edgeW: number;
  /** 外接框半径：maxR 已含 50 尾余量，再加一圈 THUMB_PAD */
  outerR: number;
}

/** 画家本体：模型 + 解好的主题 + 手感设置 → 全景静态盘 SVG 子树。
 * 布局与大图同口径：configure 同灌 gapFree / gapWide / hubBase 一次落参重烘焙
 * （全景初始态：s=0，displayRadius(r)=r、mag(r)=1，线性半径直接用）——布局产物逐位一致；
 * 定妆照只吃 rLin，configure 附带建的鱼眼映射闲置无害。
 * 绘制层叠序 = drawXxx 调用序（与大图的层建构序对称）。 */
export function renderStarThumb(
  model: TrajectoryModel,
  theme: Theme,
  settings: Pick<TrajectorySettings, "hubSize" | "gapFree" | "gapWide"> = DEFAULT_SETTINGS,
  palette: RingPalette = DEFAULT_RING_PALETTE,
  doc: SvgDocument = document,
): SVGElement {
  const layout = new RingsLayout(model);
  layout.configure({
    gapFree: settings.gapFree,
    gapWide: settings.gapWide,
    hubBase: settings.hubSize,
  });
  const outerR = layout.maxR + THUMB_PAD;
  const nodeR = Math.min(18, Math.max(4, outerR * 0.02));
  const edgeW = Math.min(6, Math.max(1.2, outerR * 0.004));

  const svg = doc.createElementNS("http://www.w3.org/2000/svg", "svg") as SVGElement;
  svg.setAttribute("viewBox", `${-outerR} ${-outerR} ${2 * outerR} ${2 * outerR}`);
  svg.setAttribute("class", "trajectory-thumb");

  const coords = new Map<string, { x: number; y: number; r: number; ang: number }>();
  for (const c of model.cards) {
    const place = layout.places.get(c.id);
    if (!place) continue;
    const ang = place.angBase + place.spreadOff;
    coords.set(c.id, { ...polar(ang, place.rLin), r: place.rLin, ang });
  }

  const scene: ThumbScene = {
    svg,
    layout,
    model,
    theme,
    palette,
    markers: new MarkerFactory(svg),
    coords,
    nodeR,
    edgeW,
    outerR,
  };
  drawRingSkeleton(scene);
  drawBoxes(scene);
  drawEdges(scene);
  drawHub(scene);
  drawNodes(scene);
  drawWormholes(scene);
  return svg;
}

/** 环形骨架（最底层，对齐大图全景态）：空窗雾带铺底 → 碎石 → 月 / 年 / 最新环。 */
function drawRingSkeleton(scene: ThumbScene): void {
  const { svg, layout, palette, markers, nodeR } = scene;
  const skeleton = ringSkeleton(layout);
  for (const gap of skeleton.gaps) {
    /* 暗底雾带：比盘面背景再暗一档，高斯羽化软边（与大图同律，dev 随带宽） */
    el(
      "circle",
      {
        cx: 0,
        cy: 0,
        r: gap.bgR,
        fill: "none",
        stroke: palette.gapBg,
        "stroke-width": gap.bgW,
        filter: `url(#${markers.blur(Math.max(3, gap.bgW * 0.3))})`,
      },
      svg,
    );
    /* 碎石：大图屏幕恒定（尺寸吃鱼眼局部放大率），定妆照随 outerR 等比——
     * 3.9 = 大图节点屏径 6 × symbolPx 0.65，等比口径与 nodeR 同源；
     * 纹理缩到卡片上变淡是缩放诚实，雾带 + 碎石仍保住带的身份 */
    for (const d of gap.dots) {
      const p = polar(d.ang, d.rLin);
      el(
        "circle",
        { cx: p.x, cy: p.y, r: (d.size * nodeR) / 3.9, fill: palette.month, opacity: d.op },
        svg,
      );
    }
  }
  /* 月环 opacity 用骨架给的（effRate 折算，空窗内渐隐）；年 / 最新环恒显 */
  for (const month of skeleton.months) {
    el(
      "circle",
      {
        cx: 0,
        cy: 0,
        r: month.rLin,
        fill: "none",
        stroke: palette.month,
        "stroke-width": 1,
        "vector-effect": "non-scaling-stroke",
        opacity: month.opacity,
      },
      svg,
    );
  }
  for (const y of skeleton.years) {
    el(
      "circle",
      {
        cx: 0,
        cy: 0,
        r: y.rLin,
        fill: "none",
        stroke: palette.year,
        "stroke-width": 1.2,
        "vector-effect": "non-scaling-stroke",
      },
      svg,
    );
  }
  if (skeleton.latest) {
    el(
      "circle",
      {
        cx: 0,
        cy: 0,
        r: skeleton.latest.rLin,
        fill: "none",
        stroke: palette.latest,
        "stroke-width": 1.2,
        "vector-effect": "non-scaling-stroke",
      },
      svg,
    );
  }
}

/** 泳道扇环框：装箱地盘视觉化，内外径向各放余量包住节点。 */
function drawBoxes(scene: ThumbScene): void {
  const { svg, layout, theme, nodeR, edgeW } = scene;
  const boxPad = nodeR * 1.6;
  for (const box of layout.treeBoxes) {
    const r0 = Math.max(layout.innerR, box.rMin - boxPad);
    const r1 = box.rMax + boxPad;
    const large = box.th1 - box.th0 > 180 ? 1 : 0;
    const p0 = polar(box.th0, r0);
    const p1 = polar(box.th1, r0);
    const p2 = polar(box.th1, r1);
    const p3 = polar(box.th0, r1);
    el(
      "path",
      {
        d:
          `M${p0.x},${p0.y} A${r0},${r0} 0 ${large} 1 ${p1.x},${p1.y} ` +
          `L${p2.x},${p2.y} A${r1},${r1} 0 ${large} 0 ${p3.x},${p3.y} Z`,
        fill: theme.boxFill,
        stroke: theme.boxStroke,
        "stroke-width": edgeW * 0.7,
      },
      svg,
    );
  }
}

/** 边：同日沿环走弧、跨日沿弦缩进；箭头与线段同色，取代金黄虚线 / 转向青点线。 */
function drawEdges(scene: ThumbScene): void {
  const { svg, model, theme, markers, coords, nodeR, edgeW, outerR } = scene;
  for (const e of model.edges) {
    const a = coords.get(e.from);
    const b = coords.get(e.to);
    if (!a || !b) continue;
    const marker = markers.build();
    const isPivot = e.kind === "pivot";
    const col = isPivot ? theme.pivot : theme.supersede;
    marker.path.setAttribute("stroke", col);
    marker.node.setAttribute("markerWidth", String(nodeR * 1.8));
    marker.node.setAttribute("markerHeight", String(nodeR * 1.8));
    /* 端点退距：起止于节点边缘外，箭头尖不扎进节点 */
    const ia = nodeR + outerR * 0.006;
    const ib = nodeR + outerR * 0.004;
    const attrs: Record<string, string | number> = {
      fill: "none",
      stroke: col,
      "stroke-width": edgeW,
      "stroke-dasharray": isPivot ? `${edgeW} ${edgeW * 2}` : `${edgeW * 3} ${edgeW * 2.5}`,
      "marker-end": `url(#${marker.node.id})`,
      opacity: 0.85,
    };
    if (a.r === b.r) {
      /* 同日边：沿环走弧，退距换算成角度；角差不足按比例收缩防反转 */
      const da = (ia / a.r) * DEG;
      const db = (ib / b.r) * DEG;
      const sq = Math.min(1, Math.max(0, ((b.ang - a.ang) * 0.8) / Math.max(1e-6, da + db)));
      const pa = polar(a.ang + da * sq, a.r);
      const pb = polar(b.ang - db * sq, b.r);
      el("path", { d: `M${pa.x},${pa.y} A${a.r},${a.r} 0 0 1 ${pb.x},${pb.y}`, ...attrs }, svg);
    } else {
      /* 跨日边：沿弦缩进 */
      const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      const ux = (b.x - a.x) / len;
      const uy = (b.y - a.y) / len;
      el(
        "line",
        {
          x1: a.x + ux * ia,
          y1: a.y + uy * ia,
          x2: b.x - ux * ib,
          y2: b.y - uy * ib,
          ...attrs,
        },
        svg,
      );
    }
  }
}

/** 盘心：压在连线之上；填色 / 扇环框色走 CSS 变量，主题切换这部分不用重画。
 * 盘心与大图同源：世界锚定 hubWorldR = innerR − HUB_RIM，大图画的也是这个值——
 * 「定妆照 = 大图世界几何的整体缩放」这条成立到盘心，逐位一致。占比 =
 * (hubSize − HUB_RIM) / (maxR + 60)——maxR 只随 hubR 变、不随数据深浅变（环带世界深度
 * 定死 AXIS_SPAN），跨项目恒定；「盘心不压卡」自动成立（盘心恒在内界之内）。 */
function drawHub(scene: ThumbScene): void {
  const { svg, layout, theme, nodeR, edgeW } = scene;
  el(
    "circle",
    {
      cx: 0,
      cy: 0,
      r: layout.hubWorldR,
      fill: theme.hubFill,
      stroke: theme.hubStroke,
      "stroke-width": edgeW,
    },
    svg,
  );
  /* 根节点：盘心正中的圆点 = 项目根卡（与大图同形态）。根卡家族色实心（与虫洞同源）、
   * 描边混黑收边；半径与节点同基准等比（ROOT_RADIUS / BASE_RADIUS） */
  el(
    "circle",
    {
      cx: 0,
      cy: 0,
      r: (nodeR * ROOT_RADIUS) / BASE_RADIUS,
      fill: theme.hubStroke,
      stroke: mix(theme.hubStroke, "#000000", 0.35),
      "stroke-width": edgeW,
    },
    svg,
  );
}

/** 节点（最上层）：被取代的领域色混灰淡出，孤星加虚线外环。 */
function drawNodes(scene: ThumbScene): void {
  const { svg, model, theme, coords, nodeR, edgeW } = scene;
  const isolatedSet = new Set(model.isolated.map((c) => c.id));
  for (const c of model.cards) {
    const p = coords.get(c.id);
    if (!p) continue;
    const form = formOf(model, c.id);
    const col = formColor(form, c, theme);
    const group = el("g", { transform: `translate(${p.x},${p.y})` }, svg);
    if (isolatedSet.has(c.id)) {
      el(
        "circle",
        {
          cx: 0,
          cy: 0,
          r: nodeR * 1.8,
          fill: "none",
          stroke: col,
          "stroke-width": edgeW,
          "stroke-dasharray": `${nodeR * 0.5} ${nodeR * 0.6}`,
          opacity: 0.8,
        },
        group,
      );
    }
    el(
      "circle",
      {
        cx: 0,
        cy: 0,
        r: nodeR,
        fill: col,
        stroke: nodeEdge(c, theme),
        "stroke-width": edgeW * 0.8,
      },
      group,
    );
  }
}

/** 虫洞（最上层）：同心双环中空，根卡家族色（与盘心描边同源）。 */
function drawWormholes(scene: ThumbScene): void {
  const { svg, layout, model, theme, nodeR, edgeW } = scene;
  for (const w of model.wormholes) {
    const place = layout.places.get(w.id);
    if (!place) continue;
    const p = polar(place.angBase, place.rLin);
    const group = el("g", { transform: `translate(${p.x},${p.y})` }, svg);
    el(
      "circle",
      { cx: 0, cy: 0, r: nodeR, fill: "none", stroke: theme.hubStroke, "stroke-width": edgeW },
      group,
    );
    el(
      "circle",
      {
        cx: 0,
        cy: 0,
        r: nodeR * 0.45,
        fill: "none",
        stroke: theme.hubStroke,
        "stroke-width": edgeW * 0.75,
      },
      group,
    );
  }
}
