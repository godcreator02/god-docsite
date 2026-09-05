/**
 * 星轨布局引擎——纯计算，不碰 DOM。常量与公式全部原样保留，改动只在移动到本仓这件事本身。
 *
 * 模型：内旧外新的星轨，半径 = 有效天数标度（空窗折叠），扇环 = 树的扇环装箱，
 * 同日卡沿圆周串珠，孤星按领域打包成带跟树一起装箱。
 * 缩放律：滚轮 = 焦点环带沿时间穿梭的径向鱼眼 r' = g(r)，解析闭式、零积分误差。
 *
 * 布局产物（places / treeBoxes）由实例自己持有，不挂在共享的 card / tree 对象上：
 * 多张盘要同开（虫洞穿越），共享对象上的布局属性会被后建的盘覆盖。
 * 逻辑出自老仓 `god-flow-panels` 的 `node/star/layout.ts`（只读参考，本仓不 import 它）。
 */

import { dayNum, NO_DOMAIN } from "./model.ts";
import type { Card, TrajectoryModel, Tree, Wormhole } from "./types.ts";

/** 虫洞带的装箱分组哨兵：虫洞不占领域（染色走根卡家族 accent 专属通道），
 * 装箱只需自成一块地、排最末。拿不可能撞名的字符串当 domain 用，装箱链路不加特例。 */
export const WORM_DOMAIN = "__wormhole__";

/* ---------- 定型常量 ---------- */
/** 斜率 smoothstep 过渡半宽（px）。面板要在端上重建同一张鱼眼映射表，随 geometry 透出。 */
export const BLEND_W = 30;
/** 同日紧排基础角偏（度）——视图侧挤开公式同用，单点定义。 */
export const SPREAD_DEG = 4;
const GAP_DEG = 3; // 扇环之间的角向呼吸缝（度）
const DOM_GAP_DEG = 9; // 换领域时额外留的缝：色块之间要看得出分界
const SLOT_ARC = 56; // 组内槽宽（世界单位弧长：一条链一槽）
const PAD_ARC = 18; // 扇环两侧内边距（弧长）
const ISO_ARC = 48; // 孤星带内的槽宽（弧长）
/** 同槽贪心装箱要留的净空（天）：树内支线分道、孤星带、虫洞带三处按日期分槽都用它——
 * 留够这道净空，免得前后两条挨得太近看着像一条。 */
const LANE_GAP_DAYS = 2;
/** 时间轴环带世界深度定死（外锚定）：不管数据深浅、节点多少，day0 到 dayMax 恒拉伸填满
 * 这段半径——盘是固定仪表盘，数据拉伸填满、不撑深度。每天步长 radPerEff 是实例导出量
 * （buildEff 末尾算，= AXIS_SPAN / effTotal）。 */
export const AXIS_SPAN = 960;
/** 弧度转角度——视图侧弧长换算同用，单点定义。 */
export const DEG = 57.2958;

/** 盘心盘边缘到时间轴内界（鱼眼地板）的净空（世界单位）：盘心世界半径 = innerR − HUB_RIM，
 * displayRadius(r) ≥ innerR 恒成立，任何卡任何模式都进不了盘心；第一环（day0 在 innerR + 10）贴盘沿。 */
export const HUB_RIM = 10;

/** 节点基准半径：单档；结论放大档不吃这张表，走视图侧帧乘数 tierMult
 * （符号整组随 scale 放大，命中区与孤星虚线环同比跟随，DOM 不用重建）。
 * 参与间距计算的布局常量，纯数据——键用字面量联合而非渲染层的 NodeForm 类型，
 * 布局层不反向依赖渲染层（两者结构等价，消费处照样按 NodeForm 索引）。 */
export const BASE_RADIUS = 6;

export const NODE_RADIUS: Record<"alive" | "superseded", number> = {
  alive: BASE_RADIUS,
  superseded: BASE_RADIUS,
};

/** 根节点半径：盘心正中的圆点 = 项目根卡。比 BASE_RADIUS(6)与结论档（6 × tierMult 1.4 = 8.4）
 * 都略大，盘心独一档；定妆照按 nodeR × ROOT_RADIUS / BASE_RADIUS 同基准等比。 */
export const ROOT_RADIUS = 10;

/** 压缩区符号缩小下限。 */
export const LOD_MIN = 0.55;
/** 焦点带符号放大上限。 */
export const LOD_MAX = 1.5;

/** 局部放大率 → 符号 LOD 缩放系数：√mag 钳在 [LOD_MIN, LOD_MAX]。 */
export function lodOf(mag: number): number {
  return Math.min(LOD_MAX, Math.max(LOD_MIN, Math.sqrt(mag)));
}

/** 鱼眼态带外压淡：带内全亮、带外按鱼眼强度压淡，weight 定压淡深度。 */
export function bandFade(mag: number, strength: number, weight = 0.45): number {
  return 1 - weight * strength * (1 - smoothstep(1.2, 2.5, mag));
}

/** 折算表的一段：线性段带 k，对数段带 A（neg 为镜像回升的后半）。
 * 建构不变量（buildEff）：无 A 必有 k，有 neg 必有 dEnd / eEnd——使用处按此断言。 */
interface EffSeg {
  d0: number;
  e0: number;
  k?: number;
  A?: number;
  neg?: boolean;
  dEnd?: number;
  eEnd?: number;
}

/** 被折的空窗中段：壳画逐日点云与起止边界环用。 */
export interface GapBand {
  d0: number;
  d1: number;
  days: number;
}

/** 一张卡的布局落点：角度基准 + 同日串珠角偏 + 线性态半径。 */
export interface CardPlace {
  angBase: number;
  spreadOff: number;
  rLin: number;
}

/** 参与角向装箱的一块地：树的扇环或孤星带。 */
export interface Box {
  domain: string;
  dMin: number;
  dMax: number;
  rMin: number;
  rMax: number;
  width: number;
  padDeg: number;
  slotDeg: number;
  th0: number;
  th1: number;
  /** 角段中线（树名锚定用） */
  angMid: number;
}

/** 树的扇环：额外带槽归属与树名。 */
export interface TreeBox extends Box {
  tree: Tree;
  /** 成员身份到槽号：0 = 主干，i = 第 i 条支线 */
  pos: Record<string, number>;
  slots: number;
  name: string;
}

/** 孤星带：一个领域的孤星打包成一条。 */
export interface IsoBox extends Box {
  iso: Card[];
}

/** 虫洞带：全盘虫洞打包成一条参与装箱（机制类孤星带，但不占领域、不算孤星） */
export interface WormBox extends Box {
  holes: Wormhole[];
}

/** 极坐标转直角：0 度指 12 点、顺时针增。 */
export function polar(a: number, r: number): { x: number; y: number } {
  return { x: r * Math.sin((a * Math.PI) / 180), y: -r * Math.cos((a * Math.PI) / 180) };
}

export function smoothstep(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/** 弧长换角度：取内外半径的几何平均——按最内半径换算等于拿主干独占内圈的那一段
 * 给整条带定宽，一棵横跨全年的树能吃掉小半个盘。树扇环 / 孤星带 / 虫洞带三处共用。 */
function arcToDeg(arc: number, rMin: number, rMax: number): number {
  return (arc / Math.sqrt(rMin * rMax)) * DEG;
}

/* 月环密度门：世界单位间距阈值。环带世界深度定死后，密盘的月环间距
 * （30 × radPerEff × 当地折算率）无下限，靠这道门渐隐防糊成同心圆纹；
 * 普通盘间距远高于门上限，不受影响。 */
const GATE_LO = 12;
const GATE_HI = 24;

/** 月环密度门：spacingWorld（世界单位，乘 m·kRatio 等视图倍率由调用方定）过 smoothstep
 * 出展示强度——密盘月环糊成同心圆纹时渐隐，乘视图倍率后放大 / 进鱼眼能让月环重新现身
 * （与周环缩放门同思路）。大图（乘 m·kRatio）与 ringSkeleton（全景态 m=kRatio=1）
 * 共用同一函数，别抄两份 smoothstep 参数。 */
export function monthGate(spacingWorld: number): number {
  return smoothstep(GATE_LO, GATE_HI, spacingWorld);
}

/** 确定性伪随机（按粒序哈希）：重建折算表时点云形态不跳。星轨大图与定妆照共用。 */
export const pseudoRandom = (i: number, salt: number): number => {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

/** 哪些字段算「手感参数」——类型与运行期遍历同吃这一份。
 *
 * 单独立成数组而不是只写进 Pick<>：数据变更重建时要把这批值整批搬进新实例，
 * 类型里列一遍、搬运处再手抄一遍的话，加第十一个可调字段时漏抄不会有任何信号——
 * 表现是那个参数每次重建就悄悄弹回默认值。 */
export const LAYOUT_PATCH_KEYS = [
  "focusDays",
  "ease",
  "oldShare",
  "newShare",
  "symbolPx",
  "spreadMult",
  "tierMult",
  "gapFree",
  "gapWide",
  "hubBase",
] as const;

/** configure 的入参形态：一次可整批落的手感参数。 */
export type LayoutPatch = Partial<Pick<RingsLayout, (typeof LAYOUT_PATCH_KEYS)[number]>>;

/** 从一份布局里摘出全部手感参数——重建时搬运用，字段清单不在这里第二次出现。 */
export function layoutPatchOf(layout: RingsLayout): LayoutPatch {
  const patch: LayoutPatch = {};
  for (const key of LAYOUT_PATCH_KEYS) patch[key] = layout[key];
  return patch;
}

export class RingsLayout {
  /* ---------- 手感参数（设置面板改的是实例的） ----------
   * 这里的初始值是直建 RingsLayout 时的兜底；应用侧建完 layout 可立刻用持久化设置
   * 覆盖一遍（configure）。 */
  focusDays = 7; // 焦点带覆盖天数
  ease = 0.16; // 补间趋近系数
  oldShare = 0.03; // 内环（旧压缩显示区）占比
  newShare = 0.03; // 外环（新压缩显示区）占比
  symbolPx = 0.65; // 节点屏幕尺寸系数
  spreadMult = 1; // 同日串珠散开乘数（纯角度口径，进扇环宽度——散得开树带拿得宽）
  tierMult = 1.4; // 结论放大乘数（在立非孤星吃放大档，纯屏幕尺寸口径——帧变量，不进装箱）
  hubR = 190; // 线性态时间零点半径：day0 的环从这里起步
  /** 有效时间轴内界 = 鱼眼恒等区边界，恒等于 hubBase（setHub 直赋值）。 */
  innerR = 180;
  /** 盘心设置值：直接定内界（innerR = hubBase），盘心占比天然 = (hubBase − HUB_RIM) /
   * (maxR + 60)——maxR 只随 hub 设置变、不随数据深浅变，同一 hubBase 下跨项目恒等。 */
  hubBase = 180;
  gapFree = 14; // 空窗阈值（天）
  gapWide = 53; // 超长空档折算后的总显示宽（天）

  /** 每有效天到半径的世界单位步长：AXIS_SPAN / effTotal（buildEff 末尾算），
   * 环带世界深度定死、每天占宽随数据深浅反出——effTotal = 0（单日盘/空盘）时钉 0，
   * radiusDay 走外锚定形式自然把所有环坍缩到 R_LATEST，不用特例。 */
  radPerEff = 0;
  /** 显示域总有效天数（dayEff(dayMax)），radPerEff 的分母，dayOfRadius 零守卫也靠它判空。 */
  effTotal = 0;

  /* ---------- 折算表 ---------- */
  /** 显示域（呼吸带 1:1 + 对称对数中段）：半径由它出，一切时间输入（拖轨 / 滚轮 /
   * 边环）也由它出——位置模型只此一张表，输入设备只是驱动方式不同；不另设幅度
   * 减半的「穿梭域」，与显示轴脱钩的第二张标度会让滚轮过空窗一格飞几十天。 */
  private effSegs: EffSeg[] = [];

  /* ---------- 布局产物 ---------- */
  maxR = 0;
  places = new Map<string, CardPlace>();
  treeBoxes: TreeBox[] = [];
  isoBoxes: IsoBox[] = [];
  /** 虫洞带：无虫洞为 null */
  wormBox: WormBox | null = null;

  /* ---------- 鱼眼状态 ---------- */
  /** 焦点日：补间中 / 目标 */
  focusDay = 0;
  focusDayTarget = 0;
  /** 鱼眼强度：0 = 线性全景，1 = 全鱼眼 */
  strength = 0;
  strengthTarget = 0;
  /** 焦点带在线性域的半径区间 */
  bandLinear: [number, number] = [0, 0];
  /** 鱼眼映射系数表：构造器里 buildMap 必建，definite assignment 免去全下游判空。 */
  private fisheye!: {
    kO: number;
    kF: number;
    kN: number;
    aA: number;
    wA: number;
    aB: number;
    wB: number;
    C: number;
  };

  /** 本盘模型。拆成显式字段 + 赋值——参数属性不是可擦除语法，本仓 TS 源码零构建直跑
   * （erasableSyntaxOnly）容不下它。 */
  readonly model: TrajectoryModel;

  constructor(model: TrajectoryModel) {
    this.model = model;
    this.focusDay = model.dayMax;
    this.focusDayTarget = model.dayMax;
    this.bake();
    this.buildMap();
  }

  /** 盘心世界半径：恒在时间轴内界内、留 HUB_RIM 净空——第一环（day0）贴盘沿，
   * 「盘心不压卡」随 displayRadius(r) ≥ innerR 自动成立。 */
  get hubWorldR(): number {
    return this.innerR - HUB_RIM;
  }

  /** 改盘心大小：hubBase 落设置，直赋内界与线性态零点半径——环带世界深度定死
   * （AXIS_SPAN），内界直接跟设置值走：innerR = hubBase，hubR = hubBase + 10。
   * 盘心占比 = (hubBase − HUB_RIM) / (maxR + 60)，maxR 只随 hubR 变、不随数据深浅变，
   * 同一 hubBase 下跨项目、跨窗格恒等。重烘焙义务由 configure 统一兜。 */
  setHub(hubBase: number): void {
    this.hubBase = hubBase;
    this.innerR = hubBase;
    this.hubR = hubBase + 10;
  }

  /** 手感参数统一入口：落参数后自动重烘焙 + 重建鱼眼映射——
   * 「改完必须记得 bake / buildMap」的顺序义务收进结构，调用方不背协议。 */
  configure(patch: LayoutPatch): void {
    Object.assign(this, patch);
    if (patch.hubBase !== undefined) this.setHub(patch.hubBase);
    this.bake();
    this.buildMap();
  }

  /* ================= 有效天数标度：空窗折叠 ================= */

  /** 十年空档（中段对称双半）总显示宽反解出的对数幅度。 */
  private logAmp(): number {
    return Math.max(
      0.1,
      (this.gapWide - this.gapFree) / (2 * Math.log1p((3650 - this.gapFree) / 2 / this.gapFree)),
    );
  }

  /** 建折算表：相邻卡空档超过阈值的中段走对称双半段对数，两端各留呼吸带。 */
  private buildEff(): void {
    const days = [...new Set(this.model.cards.map((c) => dayNum(c.bornAt)))].sort((a, b) => a - b);
    const amp = this.logAmp();
    const segs: EffSeg[] = [];
    let e = 0;
    const lin = (d0: number, len: number): void => {
      segs.push({ d0, e0: e, k: 1 });
      e += len;
    };
    for (let i = 1; i < days.length; i++) {
      const cur = days[i] as number;
      const prev = days[i - 1] as number;
      const gap = cur - prev;
      if (gap <= this.gapFree) {
        lin(prev, gap);
        continue;
      }
      const h = this.gapFree / 2;
      const mid = (gap - 2 * h) / 2; // 对称劈半：前半正向衰减、后半镜像回升
      const halfEff = amp * Math.log1p(mid / this.gapFree);
      const b0 = prev + h;
      lin(prev, h);
      segs.push({ d0: b0, e0: e, A: amp });
      e += halfEff;
      segs.push({
        d0: b0 + mid,
        e0: e,
        A: amp,
        neg: true,
        dEnd: b0 + 2 * mid,
        eEnd: e + halfEff,
      });
      e += halfEff;
      lin(cur - h, h);
    }
    /* 尾段开放 1:1（空态恒等） */
    segs.push({ d0: days.length ? (days[days.length - 1] as number) : this.model.day0, e0: e, k: 1 });
    this.effSegs = segs;
    /* 环带世界深度定死后，每天步长反出：effTotal = 0（单日盘 / 空盘）时 radPerEff 钉 0，
     * radiusDay 的外锚定形式自然把所有环坍缩到 R_LATEST，不用特例判空。 */
    this.effTotal = this.dayEff(this.model.dayMax);
    this.radPerEff = this.effTotal > 0 ? AXIS_SPAN / this.effTotal : 0;
  }

  /** 所在折算段：按 d0 升序倒扫，取首个不超过 n 的段。 */
  private segAt(segs: EffSeg[], n: number): EffSeg {
    for (let i = segs.length - 1; i >= 0; i--) {
      const seg = segs[i] as EffSeg;
      if (seg.d0 <= n) return seg;
    }
    return segs[0] as EffSeg;
  }

  /** 正折算：日历日到有效天数。 */
  private evalSeg(segs: EffSeg[], n: number): number {
    const seg = this.segAt(segs, n);
    if (!seg.A) return seg.e0 + (n - seg.d0) * (seg.k as number);
    return seg.neg
      ? (seg.eEnd as number) - seg.A * Math.log1p(((seg.dEnd as number) - n) / this.gapFree)
      : seg.e0 + seg.A * Math.log1p((n - seg.d0) / this.gapFree);
  }

  /** 逆折算：有效天数反解日历日。 */
  private invSeg(segs: EffSeg[], e: number): number {
    let found = segs[0] as EffSeg;
    for (const seg of segs) {
      if (seg.e0 <= e) found = seg;
      else break;
    }
    if (!found.A) return found.d0 + (e - found.e0) / (found.k as number);
    return found.neg
      ? (found.dEnd as number) - this.gapFree * Math.expm1(((found.eEnd as number) - e) / found.A)
      : found.d0 + this.gapFree * Math.expm1((e - found.e0) / found.A);
  }

  dayEff(n: number): number {
    return this.evalSeg(this.effSegs, n);
  }

  dayOfEff(e: number): number {
    return this.invSeg(this.effSegs, e);
  }

  /* ---------- 交互语义：视图走这两个门，不直捅补间裸字段 ---------- */

  /** 聚焦某天并进鱼眼：焦点目标钳在盘的时间范围内；snap 立即到位、不走补间。 */
  focusOn(d: number, snap = false): void {
    this.focusDayTarget = Math.min(this.model.dayMax, Math.max(this.model.day0, d));
    if (snap) this.focusDay = this.focusDayTarget;
    this.strengthTarget = 1;
  }

  /** 退回全景。 */
  unfocus(): void {
    this.strengthTarget = 0;
  }

  /** 显示域当地折算率（点云 / 环让位等视觉门控用）。 */
  effRate(n: number): number {
    const seg = this.segAt(this.effSegs, n);
    if (!seg.A) return seg.k as number;
    return seg.A / (this.gapFree + (seg.neg ? (seg.dEnd as number) - n : n - seg.d0));
  }

  /** 月环理论世界间距（30 天基准折算）：环带世界深度定死后，间距 = 30 × radPerEff ×
   * 当地折算率——密盘（月数摊进固定深度）间距无下限，monthGate 拿它算展示强度。 */
  monthSpacingWorld(n: number): number {
    return 30 * this.radPerEff * this.effRate(n);
  }

  /** 被折的空窗中段清单。 */
  gapBands(): GapBand[] {
    const out: GapBand[] = [];
    for (const s of this.effSegs) {
      if (!s.A) continue;
      if (!s.neg) out.push({ d0: s.d0, d1: 0, days: 0 });
      else {
        const b = out[out.length - 1] as GapBand;
        b.d1 = s.dEnd as number;
        b.days = b.d1 - b.d0;
      }
    }
    return out;
  }

  /** 外锚定映射：最新环恒落 hubR + AXIS_SPAN（R_LATEST），day0 方向按有效天数差往回退——
   * effTotal = 0（单日盘 / 空盘）时退量为 0，全部环自然坍缩到 R_LATEST，不用特例分支。 */
  radiusDay(n: number): number {
    return this.hubR + AXIS_SPAN - (this.effTotal - this.dayEff(n)) * this.radPerEff;
  }

  /** radiusDay 的逆：radPerEff = 0（单日盘 / 空盘）时直接返回 dayMax 短路，防 NaN 灌进
   * 焦点带边环日期标签的反解。 */
  dayOfRadius(r: number): number {
    if (this.radPerEff === 0) return this.model.dayMax;
    return this.dayOfEff(this.effTotal - (this.hubR + AXIS_SPAN - r) / this.radPerEff);
  }

  radius(d: string): number {
    return this.radiusDay(dayNum(d));
  }

  /* ================= 布局烘焙 ================= */

  /** 按日期贪心分槽：同槽内前后两项相隔 < LANE_GAP_DAYS 天就换槽。孤星带 / 虫洞带
   * 都是「一串卡按日期分槽」的同一件事，只是取的对象不同（卡 / 虫洞），抽成一个泛型入口；
   * 顺带把该组的半径跨度（rMin/rMax）一起算出，laneBox 的角度换算靠它。
   * 树内支线分道走的是区间（每条支线占一个 [d0,d1]），不是单点，形状不同，不复用这个。 */
  private packDateSlots<T>(
    list: readonly T[],
    dayOf: (item: T) => number,
    keyOf: (item: T) => string,
  ): {
    slot: Map<string, number>;
    laneCount: number;
    dMin: number;
    dMax: number;
    rMin: number;
    rMax: number;
  } {
    const days = list.map(dayOf);
    const dMin = Math.min(...days);
    const dMax = Math.max(...days);
    const rMin = this.radiusDay(dMin);
    const rMax = this.radiusDay(dMax);
    const laneEnd: number[] = [];
    const slot = new Map<string, number>();
    for (const item of list) {
      const d = dayOf(item);
      let k = laneEnd.findIndex((end) => end + LANE_GAP_DAYS < d);
      if (k < 0) k = laneEnd.length;
      laneEnd[k] = d;
      slot.set(keyOf(item), k);
    }
    return { slot, laneCount: laneEnd.length, dMin, dMax, rMin, rMax };
  }

  /** 一条带的 Box 形状组装：pad / slot 角宽由几何平均半径换算（arcToDeg），
   * width 按槽数摊开。孤星带与虫洞带装箱形状完全一致，只是归属的 domain 不同。 */
  private laneBox(
    domain: string,
    packed: { laneCount: number; dMin: number; dMax: number; rMin: number; rMax: number },
    arcWidth: number,
  ): Box {
    const { laneCount, dMin, dMax, rMin, rMax } = packed;
    const slotDeg = arcToDeg(arcWidth, rMin, rMax);
    const padDeg = arcToDeg(PAD_ARC, rMin, rMax);
    return {
      domain,
      dMin,
      dMax,
      rMin,
      rMax,
      slotDeg,
      padDeg,
      width: 2 * padDeg + laneCount * slotDeg,
      th0: 0,
      th1: 0,
      angMid: 0,
    };
  }

  /** 半径链 + 角度装箱全量重算。改 hubR / gapFree / gapWide 后重跑，幂等。 */
  bake(): void {
    this.buildEff(); // 折算表先行：radiusDay 全下游都吃有效标度
    const { byId, isolated, dayMax } = this.model;
    this.places.clear();

    /* 同日同槽卡的串珠角偏：先记下，实际角偏在绘制时随局部放大率走 */
    const spread = new Map<string, number>();

    this.treeBoxes = this.model.trees.map((t) => {
      const days = t.ids.map((i) => dayNum((byId[i] as Card).bornAt));
      const dMin = Math.min(...days);
      const dMax = Math.max(...days);
      const rMin = this.radiusDay(dMin);
      const rMax = this.radiusDay(dMax);
      const pos: Record<string, number> = {};
      for (const i of t.spine) pos[i] = 0;

      /* 支线进槽也走装箱：时间不搭界的两条支线共用一条槽，槽数 = 最大并发支线数。
       * 一棵长命树上早年那条走死的岔路，不该让今年的岔路各自另开一道。 */
      const laneEnd: number[] = [];
      t.sublines
        .map((sl) => {
          const ds = sl.map((i) => dayNum((byId[i] as Card).bornAt));
          return { sl, d0: Math.min(...ds), d1: Math.max(...ds) };
        })
        .sort((a, b) => a.d0 - b.d0)
        .forEach((s) => {
          let k = laneEnd.findIndex((end) => end + LANE_GAP_DAYS < s.d0);
          if (k < 0) k = laneEnd.length;
          laneEnd[k] = s.d1;
          for (const i of s.sl) pos[i] = k + 1;
        });
      const slots = 1 + laneEnd.length;

      let beadMax = 1;
      const byDate: Record<string, string[]> = {};
      for (const i of t.ids) {
        const key = `${(byId[i] as Card).bornAt.slice(0, 10)}|${pos[i]}`;
        if (!byDate[key]) byDate[key] = [];
        byDate[key]?.push(i);
      }
      const flatSub = t.sublines.flat();
      const order = (i: string): number =>
        t.spine.includes(i) ? t.spine.indexOf(i) : 99 + flatSub.indexOf(i);
      for (const key in byDate) {
        const arr = byDate[key] as string[];
        arr.sort((a, b) => order(a) - order(b) || a.localeCompare(b));
        arr.forEach((i, k) => {
          spread.set(i, (k - (arr.length - 1) / 2) * SPREAD_DEG * this.spreadMult);
        });
        beadMax = Math.max(beadMax, arr.length);
      }

      const slotDeg = arcToDeg(SLOT_ARC, rMin, rMax);
      const padDeg = arcToDeg(PAD_ARC, rMin, rMax);
      const earliest = t.ids
        .slice()
        .sort((a, b) =>
          (byId[a] as Card).bornAt.localeCompare((byId[b] as Card).bornAt),
        )[0] as string;
      return {
        tree: t,
        pos,
        slots,
        dMin,
        dMax,
        rMin,
        rMax,
        slotDeg,
        padDeg,
        width: 2 * padDeg + slots * slotDeg + (beadMax - 1) * SPREAD_DEG * this.spreadMult,
        name: (byId[earliest] as Card).label,
        /* 同树不跨领域，取任一张即可 */
        domain: (byId[t.ids[0] as string] as Card).domain,
        th0: 0,
        th1: 0,
        angMid: 0,
      };
    });

    /* 孤星伪组：每个领域的孤星打包成一条带，跟树一起参与装箱（未分道孤星按哨兵 domain 自成一组）。
     * 孤星同样带着领域色，全盘黄金角撒下去必然落进别人的色块——那等于把分域抹了。
     * 带内按日期分槽：日期挨着的各占一槽横排，隔开的共用一槽、沿半径自然错开。 */
    const isoSlot = new Map<string, number>();
    this.isoBoxes = [...new Set(isolated.map((c) => c.domain))].map((dom) => {
      const list = isolated
        .filter((c) => c.domain === dom)
        .sort((a, b) => a.bornAt.localeCompare(b.bornAt));
      const packed = this.packDateSlots(
        list,
        (c) => dayNum(c.bornAt),
        (c) => c.id,
      );
      for (const [id, k] of packed.slot) isoSlot.set(id, k);
      return { iso: list, ...this.laneBox(dom, packed, ISO_ARC) };
    });

    /* 虫洞带：全盘虫洞打包一条，机制与孤星带同款（日期分槽），但不染领域色、不进泳道体系——
     * 装箱只为给它一块不撞的地，排各泳道与未分道之后。 */
    const wormSlot = new Map<string, number>();
    this.wormBox = null;
    if (this.model.wormholes.length) {
      const list = this.model.wormholes;
      const packed = this.packDateSlots(
        list,
        (w) => dayNum(w.bornAt),
        (w) => w.id,
      );
      for (const [id, k] of packed.slot) wormSlot.set(id, k);
      this.wormBox = { holes: list, ...this.laneBox(WORM_DOMAIN, packed, ISO_ARC) };
    }

    /* 装箱：先按领域聚块，同域的树排进相邻角度、域内按诞生序从 12 点顺时针先到先得。
     * 领域是颜色通道，盘上同色不挨着就等于没分域——所以跨域一律角向互斥、
     * 只有同域内时间不搭界的两棵树才复用同一段角度；换域时多留一档缝把色块分开。 */
    const all: Box[] = [...this.treeBoxes, ...this.isoBoxes];
    if (this.wormBox) all.push(this.wormBox);
    const doms = [...new Set(all.map((b) => b.domain))];
    /* 未分道隐式组排各泳道之后：哨兵从出现序里摘出来压尾 */
    const noDomainIdx = doms.indexOf(NO_DOMAIN);
    if (noDomainIdx >= 0) {
      doms.splice(noDomainIdx, 1);
      doms.push(NO_DOMAIN);
    }
    /* 虫洞带再压最末：不占领域，最后给块地即可 */
    const wormIdx = doms.indexOf(WORM_DOMAIN);
    if (wormIdx >= 0) {
      doms.splice(wormIdx, 1);
      doms.push(WORM_DOMAIN);
    }
    /* 域内保持诞生序，孤星带排在本域末尾 */
    const order = doms.flatMap((d) => all.filter((b) => b.domain === d));
    const placed: Box[] = [];
    let cursor = -90;
    let lastDom: string | null = null;
    for (const b of order) {
      if (lastDom !== null && b.domain !== lastDom) cursor += DOM_GAP_DEG;
      lastDom = b.domain;
      const occupied: Array<[number, number]> = [];
      for (const p of placed) {
        /* 同域时间不搭界：同角可复用 */
        if (p.domain === b.domain && (p.dMin > b.dMax || b.dMin > p.dMax)) continue;
        const a0 = (((p.th0 - GAP_DEG) % 360) + 360) % 360;
        const span = p.th1 - p.th0 + 2 * GAP_DEG;
        occupied.push([a0, a0 + span], [a0 - 360, a0 + span - 360], [a0 + 360, a0 + span + 360]);
      }
      occupied.sort((x, y) => x[0] - y[0]);
      let th = ((cursor % 360) + 360) % 360;
      /* 逐冲突段右移；全占满时兜底原位重叠（真实规模到不了） */
      for (let g = 0; g <= occupied.length; g++) {
        const hit = occupied.find(([a, bb]) => th < bb && a < th + b.width);
        if (!hit) break;
        th = hit[1];
      }
      b.th0 = th;
      b.th1 = th + b.width;
      b.angMid = th + b.width / 2;
      cursor = b.th1 + GAP_DEG;
      placed.push(b);
    }

    /* 树内定角与孤星带内定角：槽在各自的角段里居中排布，半径一律由日期定 */
    for (const b of this.treeBoxes) {
      for (const i of b.tree.ids) {
        this.places.set(i, {
          angBase: b.th0 + b.padDeg + ((b.pos[i] as number) + 0.5) * b.slotDeg,
          spreadOff: spread.get(i) ?? 0,
          rLin: this.radius((byId[i] as Card).bornAt),
        });
      }
    }
    for (const b of this.isoBoxes) {
      for (const c of b.iso) {
        this.places.set(c.id, {
          angBase: b.th0 + b.padDeg + ((isoSlot.get(c.id) ?? 0) + 0.5) * b.slotDeg,
          spreadOff: 0,
          rLin: this.radius(c.bornAt),
        });
      }
    }
    /* 虫洞落点：带内槽居中，半径由 born-at 定（时间轴原位） */
    if (this.wormBox) {
      const b = this.wormBox;
      for (const w of b.holes) {
        this.places.set(w.id, {
          angBase: b.th0 + b.padDeg + ((wormSlot.get(w.id) ?? 0) + 0.5) * b.slotDeg,
          spreadOff: 0,
          rLin: this.radius(w.bornAt),
        });
      }
    }
    this.maxR = this.radiusDay(dayMax) + 50;
  }

  /* ================= 鱼眼映射：r' = g(r) 解析闭式 ================= */

  /** smoothstep 段的积分原函数：w·P(t)，P = t³(1 - t/2)。 */
  private smoothIntegral(r: number, a: number, w: number): number {
    const t = (r - a) / w;
    return w * (t <= 0 ? 0 : t >= 1 ? t - 0.5 : t * t * t * (1 - t / 2));
  }

  /** smoothstep 段本体（斜率场用）。 */
  private smoothWindow(r: number, a: number, w: number): number {
    const t = Math.min(1, Math.max(0, (r - a) / w));
    return t * t * (3 - 2 * t);
  }

  private warpIntegral(r: number): number {
    const fisheye = this.fisheye;
    return (
      fisheye.kO * r +
      (fisheye.kF - fisheye.kO) * this.smoothIntegral(r, fisheye.aA, fisheye.wA) +
      (fisheye.kN - fisheye.kF) * this.smoothIntegral(r, fisheye.aB, fisheye.wB)
    );
  }

  /** 鱼眼作用于 [innerR, maxR]，内盘恒等。改焦点日 / 强度 / 压缩占比后重跑。 */
  buildMap(): void {
    const span = this.maxR - this.innerR;
    const rA = Math.max(
      this.innerR,
      Math.min(this.maxR, this.radiusDay(this.focusDay - this.focusDays / 2)),
    );
    const rB = Math.max(
      rA,
      Math.min(this.maxR, this.radiusDay(this.focusDay + this.focusDays / 2)),
    );
    /* 三段显示宽全固定：带永远落在同一段黄金半径 */
    const oldShow = span * this.oldShare;
    const newShow = span * this.newShare;
    const bandShow = span - oldShow - newShow;
    const rA2 = this.innerR + oldShow;
    const oldW = rA - this.innerR;
    const newW = this.maxR - rB;
    const kF = bandShow / Math.max(1e-6, rB - rA);
    /* 压缩区只压不拉：内容不足留空环（到头信号） */
    const kO = Math.min(1, oldShow / Math.max(1e-6, oldW));
    const kN = Math.min(1, newShow / Math.max(1e-6, newW));
    /* 过渡窗随压缩区收窄；0.5px 下限防归零除零 */
    const bwA = Math.max(0.5, Math.min(BLEND_W, oldShow / 8));
    const bwB = Math.max(0.5, Math.min(BLEND_W, newShow / 8));
    this.fisheye = { kO, kF, kN, aA: rA - bwA, wA: 2 * bwA, aB: rB - bwB, wB: 2 * bwB, C: 0 };
    /* 锚定 g(rA) = rA2（端点空环靠 displayRadius 里的 clamp） */
    this.fisheye.C = rA2 - this.innerR - this.warpIntegral(rA);
    this.bandLinear = [rA, rB];
  }

  /** 强度混合后的显示半径：内盘恒等，时间区解析映射、clamp 保证不出盘。 */
  displayRadius(r: number): number {
    if (r < this.innerR) return r;
    const gv =
      this.innerR +
      Math.min(this.maxR - this.innerR, Math.max(0, this.warpIntegral(r) + this.fisheye.C));
    return r + (gv - r) * this.strength;
  }

  /** 强度混合后的局部放大率（解析斜率，无查表量化）。 */
  mag(r: number): number {
    if (r < this.innerR) return 1;
    const fisheye = this.fisheye;
    const m =
      fisheye.kO +
      (fisheye.kF - fisheye.kO) * this.smoothWindow(r, fisheye.aA, fisheye.wA) +
      (fisheye.kN - fisheye.kF) * this.smoothWindow(r, fisheye.aB, fisheye.wB);
    return 1 + (m - 1) * this.strength;
  }
}

/* ================= 全景环形骨架（定妆照与大图共用语义） ================= */

/** 一颗碎石的确定性形态——不含 DOM，骨架（定妆照）与渲染（大图）同吃这一份。 */
export interface GapDot {
  rLin: number;
  ang: number;
  size: number;
  op: number;
}

/** 枚举一条空窗带里的碎石。
 *
 * idxStart 是**跨带连续累加**的粒序，它直接进 pseudoRandom 的哈希——两处调用传的
 * 序号不一致，画出来的碎石就落在不同位置。定妆照与大图必须逐位相等，所以这段公式
 * 只能有一处：抖动幅度、尺寸曲线、透明度区间任何一个改了，两边同时变。 */
export function gapDots(layout: RingsLayout, band: GapBand, idxStart: number): GapDot[] {
  const dots: GapDot[] = [];
  for (let i = 0; i < Math.floor(band.days); i++) {
    const idx = idxStart + i;
    const d = Math.min(band.d1 - 0.3, band.d0 + i + 0.5 + (pseudoRandom(idx, 1) - 0.5) * 0.9);
    dots.push({
      rLin: layout.radiusDay(d),
      ang: pseudoRandom(idx, 2) * 360,
      size: 0.7 + 2.6 * pseudoRandom(idx, 3) ** 2,
      op: 0.3 + 0.5 * pseudoRandom(idx, 4),
    });
  }
  return dots;
}

/** 空窗小行星带的一条：暗底雾带几何 + 碎石清单。 */
export interface GapSkeleton {
  /** 暗底雾带：(ra+rb)/2 与 rb−ra，ra/rb = radiusDay(d0/d1)（全景态 displayRadius 恒等） */
  bgR: number;
  bgW: number;
  dots: GapDot[];
}

/** 全景环形骨架：月环 / 年环 / 最新环 / 空窗小行星带。 */
export interface RingSkeleton {
  /** 月环：opacity = effRate(d) × monthGate(monthSpacingWorld(d)) */
  months: Array<{ rLin: number; opacity: number }>;
  /** 年环：恒显 opacity 1 */
  years: Array<{ rLin: number }>;
  /** 最新环：全景恒显 opacity 1；空盘（无卡）为 null */
  latest: { rLin: number } | null;
  gaps: GapSkeleton[];
}

/** 出全景环形骨架：纯函数，同模型同设置两次调用逐位相等（碎石走 pseudoRandom 确定性哈希）。
 * 枚举规则：d 从 day0 步进 7，isMonth = UTCDate(d) ≤ 7；年环 = day0 次年到 dayMax 年的元旦；
 * 碎石 idx 跨带连续累加。 */
export function ringSkeleton(layout: RingsLayout): RingSkeleton {
  const { day0, dayMax, cards } = layout.model;
  const months: RingSkeleton["months"] = [];
  for (let d = day0; d <= dayMax; d += 7) {
    if (new Date(d * 86400000).getUTCDate() <= 7) {
      months.push({
        rLin: layout.radiusDay(d),
        opacity: layout.effRate(d) * monthGate(layout.monthSpacingWorld(d)),
      });
    }
  }
  const years: RingSkeleton["years"] = [];
  const y0 = new Date(day0 * 86400000).getUTCFullYear() + 1;
  const y1 = new Date(dayMax * 86400000).getUTCFullYear();
  for (let y = y0; y <= y1; y++) {
    years.push({ rLin: layout.radiusDay(Date.parse(`${y}-01-01T00:00:00Z`) / 86400000) });
  }
  const latest = cards.length ? { rLin: layout.radiusDay(dayMax) } : null;

  let idx = 0;
  const gaps = layout.gapBands().map((b) => {
    const ra = layout.radiusDay(b.d0);
    const rb = layout.radiusDay(b.d1);
    const dots = gapDots(layout, b, idx);
    idx += dots.length;
    return { bgR: (ra + rb) / 2, bgW: Math.max(0, rb - ra), dots };
  });
  return { months, years, latest, gaps };
}
