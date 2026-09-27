/* 星轨舞台——画布层的编排者，照 Obsidian 版 star-view.ts 搬（去掉宿主视图 / 头部控件 / vault 事件）。
 *
 * 分工：node-dom（节点工厂 / 着色 / 筛选判定）+ theme（色板）+ layout.ts（布局引擎，纯计算
 * 不碰 DOM）+ chains.ts（链表分组 + dodge 几何）+ camera（视图变换 / 适配 / 两种缩放补间）
 * + label-arbiter（三池标签仲裁 + 标签宽度缓存）+ settings（手感参数项目表）+ date-rail（日期轨）
 * + layers/（六个视觉层：axis / gaps / milestones / trees / cards / hub，build / place / recolor 三联组，
 * 层间互不 import、互不认识本舞台，契约见 layers/frame.ts）+ 本舞台（画布 DOM 组装 / 层编排调度 /
 * 补间循环 / 视图与交互语义 / 数据刷新）。
 *
 * React 壳只做状态与 HUD：容器、工具条、图例、浮层、搜索、主题监听，经 StageHost 回调
 * 与本舞台对话；舞台不认识 React。
 *
 * 关键结构约定：
 * 一是布局产物住 layout 实例的 places / treeBoxes、每帧显示坐标住本舞台的 framePos 表，
 * 不往共享的 model 卡对象上写（理由见 layout.ts 头注）。
 * 二是画布 svg 直挂 canvasEl（铺满），日期轨挂 railEl；尺寸公式一律吃画布区宽高。 */

import { buildChains, type Chain, computeDodge } from "../chains.ts";
import { advanceFrame, type FrameState, type LayoutPatch, RingsLayout } from "../layout.ts";
import type { Card, Milestone, TrajectoryModel } from "../types.ts";
import { Camera } from "./camera.ts";
import { DateRail } from "./date-rail.ts";
import { LabelArbiter } from "./label-arbiter.ts";
import { AxisLayer } from "./layers/axis.ts";
import { CardsLayer } from "./layers/cards.ts";
import type { BuildCtx, FrameCtx, FramePos, LabelClaim, NodeLabelClaim } from "./layers/frame.ts";
import { GapsLayer } from "./layers/gaps.ts";
import { HubLayer } from "./layers/hub.ts";
import { MilestonesLayer } from "./layers/milestones.ts";
import { TreesLayer } from "./layers/trees.ts";
import { buildFilter, DefsFactory, el, type FilterSel, recolor } from "./node-dom.ts";
import {
  applyStoredSettings,
  SETTING_ITEMS,
  type TrajectorySettings,
} from "./settings.ts";
import { buildThemes, type Theme, type ThemeName } from "./theme.ts";

/** 回到原点钮的三态：camera = 相机动过，下一按归相机回大图；window = 相机已在原点、
 * 时间窗或透镜还在场，下一按归窗顶满；idle = 全归位。 */
export type HomeState = "camera" | "window" | "idle";

/** 壳要给的现场与回调：舞台经这些跟壳对话，不认识 React。 */
export interface StageHost {
  /** 画布区（svg 直挂它，铺满；尺寸观察器盯它） */
  canvasEl: HTMLElement;
  /** 日期轨的容器（DateRail 在里面自建 DOM） */
  railEl: HTMLElement;
  /** 开卡页；inNewTab 对应 Ctrl/Cmd+点 */
  openCard(id: string, inNewTab: boolean): void;
  /** 悬停卡变了（小气泡用）：null = 离开 */
  onHover(card: Card | null): void;
  /** 回到原点钮该换脸了 */
  onHomeState(state: HomeState): void;
  /** 筛选命中统计变了：hit / 上盘卡数 */
  onHits(hit: number, total: number): void;
}

/** 一轮数据：模型 + 里程碑 + type 查表。 */
export interface StageData {
  model: TrajectoryModel;
  milestones: Milestone[];
  typeOf(id: string): string | null;
}

export class StarStage {
  private model: TrajectoryModel | null = null;
  private layout: RingsLayout | null = null;
  private milestones: Milestone[] = [];
  private typeOf: (id: string) => string | null = () => null;

  /* ---------- 主题：跟随 html.dark ---------- */
  private themes = buildThemes([]);
  private themeName: ThemeName = "light";
  private theme: Theme = this.themes.light;

  /* ---------- 画布 DOM 句柄 ---------- */
  private svg: SVGElement | null = null;
  private world!: SVGElement;
  private defs!: DefsFactory;
  private readonly axisLayer = new AxisLayer();
  private readonly cardsLayer = new CardsLayer();
  private readonly gapsLayer = new GapsLayer();
  private readonly hubLayer = new HubLayer();
  private readonly milestonesLayer = new MilestonesLayer();
  private readonly treesLayer = new TreesLayer();

  /** 本帧的显示坐标表：节点先摆、边与树名随后取用。 */
  private readonly framePos = new Map<string, FramePos>();

  /** 链表（跨日弧向避让用）：只依赖模型与站位，rebake 保序重建、身份稳定，buildAll 建一次够用。 */
  private chains: Chain[] = [];

  /** 本帧的跨日避让角偏（度）：computeDodge 填、placeNodes 取用。 */
  private dodge = new Map<string, number>();

  /** 标签仲裁器：三池拥挤裁决 + 标签宽度缓存，缓存生命周期与本舞台同长。 */
  private readonly labelArbiter = new LabelArbiter();

  /* ---------- 时间窗 = 引力透镜：窗即焦点带，收窄聚焦、顶满全景，恒为软聚焦零重建。
   * 锚点 + 窗宽归顶部日期轨（DateRail）持有，本舞台只消费：窗口变更回调驱动 syncLens。 */
  private readonly dateRail: DateRail;

  /* ---------- 交互态 ---------- */
  private hoveredCard: Card | null = null;
  /** 侧栏正在看的卡的身份 */
  private selectedId: string | null = null;
  private showAllLabels = false;
  /** 三维筛选态：图例点选（形态 / 领域）+ 搜索串 */
  private filterSel: FilterSel = buildFilter();

  /* ---------- 视图 ---------- */
  private readonly camera: Camera;
  private resizeObserver: ResizeObserver | null = null;

  /* ---------- 补间循环与拖拽 ---------- */
  private rafId: number | null = null;
  /** 焦点日 / 强度补间走 advanceFrame：它要一份 FrameState，视图与悬停补间不归它
   * （相机归 Camera、悬停归各层的 stepTweens），故这份只当引擎补间的搭子。 */
  private readonly frameState: FrameState = {
    view: { k: 1, tx: 0, ty: 0 },
    vT: null,
    hv: new Map(),
    hover: null,
    raf: null,
  };
  private docListeners: [string, EventListener][] = [];
  private isDragging = false;
  private hasMoved = false;
  private lastX = 0;
  private lastY = 0;
  /** 回到原点钮当前形态：只在翻转时通知壳，不每帧发 */
  private homeState: HomeState | "" = "";
  private destroyed = false;

  private readonly host: StageHost;
  private settings: TrajectorySettings;

  constructor(host: StageHost, settings: TrajectorySettings) {
    this.host = host;
    this.settings = settings;
    /* layout 首开时还没建成，getMaxR 是懒回调——只在 fitK 真正被调时才读 */
    this.camera = new Camera({
      getCanvasEl: () => host.canvasEl,
      getMaxR: () => this.layout?.maxR ?? 0,
    });
    this.dateRail = new DateRail(host.railEl, {
      layout: () => this.layout as RingsLayout,
      onWindowChange: () => this.syncLens(),
    });
    this.bindDocEvents();
  }

  /* ================= 数据 ================= */

  /** 一轮数据（首开 / 数据变了）：建模产物灌进来，建构类全跑一遍。
   * 日期窗跟着数据走，换一份数据复位「全部」（两柄回撑满）。 */
  setData(data: StageData): void {
    this.model = data.model;
    this.milestones = data.milestones;
    this.typeOf = data.typeOf;
    this.dateRail.reset();
    this.buildAll();
  }

  /** 建构类全跑一遍：布局 → 主题 → 画布 DOM → 着色 → 视图适配。 */
  private buildAll(): void {
    const model = this.model;
    if (!model) return;
    /* 建模恒全量，完整跨度直接捕获（日期轨的边界） */
    if (model.cards.length) {
      this.dateRail.setSpan({ d0: model.day0, d1: model.dayMax });
    }
    this.layout = new RingsLayout(model);
    /* 持久化的手感参数灌进新布局 */
    applyStoredSettings(this.layout, this.settings);
    this.chains = buildChains(model, this.layout);
    this.themes = buildThemes(model.domains);
    this.readTheme();

    /* 画布整棵重建：旧节点上的监听器随 DOM 一起走（svg 直挂容器，只换它、不动 HUD） */
    this.svg?.remove();
    this.framePos.clear();
    /* 悬停卡与视图补间都指着旧一轮的对象，一并清掉（根节点悬停态同清见 hubLayer.build） */
    this.setHoveredCard(null);
    this.camera.viewTarget = null;
    this.camera.zoomTarget = null;
    this.camera.isViewDirty = false;
    this.build();

    /* 建构 / 切主题 / 切筛选共用同一条重刷链 */
    this.repaint();
    this.fit();
    /* 日期轨空档暗纹：模型恒全量，每轮直刷 */
    this.dateRail.setGaps(this.layout.gapBands().map((b) => ({ d0: b.d0, d1: b.d1 })));
    this.dateRail.syncUi();
    this.dateRail.renderGaps();
    this.dateRail.renderScale();
    this.syncLens(true);
  }

  /* ================= DOM 组装（建一次，place 每帧只改属性；层叠序 = 建构序） ================= */

  /** DOM 建构总调度：层叠序 = 调用序，各层建一次，place 每帧只改属性。 */
  private build(): void {
    const svg = el("svg", { class: "star-svg" }, this.host.canvasEl);
    this.svg = svg;
    this.world = el("g", {}, svg);
    this.defs = new DefsFactory(this.world);
    /* 数据重建整棵换掉 svg/world：相机重挂新句柄，view 状态原样留着 */
    this.camera.setElements(svg, this.world);

    // 焦点带高亮（最底层）+ 空窗小行星带垫底，其余各层按层叠序依次上
    const ctx = this.buildCtx();
    this.axisLayer.build(ctx);
    this.gapsLayer.build(ctx);
    this.axisLayer.buildRest();
    this.milestonesLayer.build(ctx);
    this.treesLayer.build(ctx);
    this.hubLayer.build(ctx);
    this.treesLayer.buildNamesLayer();
    this.cardsLayer.build(ctx);

    /* 画布内交互跟着这一轮的 svg 走 */
    this.bindCanvasEvents(svg);
    svg.style.cursor = "grab";
  }

  /** 层建构期上下文：世界句柄 / 建构期只读数据引用 / 宿主动作回调，层不认识舞台、
   * 交互只走这些回调；六层共用同一份（每轮数据重建现取一次）。 */
  private buildCtx(): BuildCtx {
    return {
      world: this.world,
      defs: this.defs,
      layout: this.layout as RingsLayout,
      model: this.model as TrajectoryModel,
      theme: this.theme,
      milestones: this.milestones,
      typeOf: (id) => this.typeOf(id),
      openCard: (id, inNewTab) => this.host.openCard(id, inNewTab),
      goHome: () => this.goHome(),
      getHoveredCard: () => this.hoveredCard,
      setHoveredCard: (c) => this.setHoveredCard(c),
      hasMoved: () => this.hasMoved,
      kick: () => this.kick(),
    };
  }

  private setHoveredCard(c: Card | null): void {
    this.hoveredCard = c;
    this.host.onHover(c);
  }

  /* ================= 日期窗：时间窗聚焦 ================= */

  /** 透镜跟窗：窗收窄 = 焦点带对准窗（零重建，f/s 补间白送）；
   * 顶满 / 全部退回全景。snap 用于数据重建后的恢复，f 与 s 直落位不走补间。 */
  private syncLens(snap = false): void {
    const layout = this.layout;
    if (!layout) return;
    const rail = this.dateRail;
    const span = rail.span;
    const anchor = rail.anchorDay;
    if (
      !span ||
      anchor === null ||
      (anchor >= span.d1 && anchor - (rail.intervalDays - 1) <= span.d0)
    ) {
      layout.unfocus();
    } else {
      layout.focusDays = rail.intervalDays;
      layout.focusOn(anchor - (rail.intervalDays - 1) / 2, snap);
    }
    if (snap) layout.strength = layout.strengthTarget;
    this.kick();
  }

  /** 世界尺度级参数变更：configure 落参重烘焙，再刷视图侧全部半径依赖的 DOM + 重适配。 */
  private rebake(patch: LayoutPatch): void {
    const layout = this.layout;
    if (!layout || !this.svg) return;
    layout.configure(patch);
    this.axisLayer.rebake();
    this.milestonesLayer.rebake();
    this.treesLayer.rebake();
    this.gapsLayer.rebuild();
    /* 折算表变了，日期轨整套标度跟着变：暗纹区段、刻度、双柄位一并重演 */
    this.dateRail.setGaps(layout.gapBands().map((b) => ({ d0: b.d0, d1: b.d1 })));
    this.dateRail.syncUi();
    this.dateRail.renderGaps();
    this.dateRail.renderScale();
    this.camera.viewTarget = null;
    this.fit();
  }

  /** 手感参数改一项：手感级改完重建鱼眼映射重摆；世界尺度级走 rebake。语义值原样记住，
   * 下一轮数据重建照这份灌。 */
  applySetting(key: keyof TrajectorySettings, value: number): void {
    this.settings = { ...this.settings, [key]: value };
    const item = SETTING_ITEMS.find((s) => s.key === key);
    const layout = this.layout;
    if (!item || !layout) return;
    if (item.kind === "tune") {
      item.apply(layout, value);
      layout.buildMap();
      this.place();
    } else {
      this.rebake(item.patch(value));
    }
  }

  /* ================= 筛选 / 搜索 / 重刷链 ================= */

  /** 搜索命中：只匹配 label 与卡身份（正文不进模型）。 */
  private readonly searchHit = (c: Card): boolean => {
    const q = this.filterSel.search;
    if (!q) return true;
    return c.label.toLowerCase().includes(q) || c.id.toLowerCase().includes(q);
  };

  /** 换一份筛选态（图例点选 / 搜索输入），走重刷链。 */
  setFilter(sel: FilterSel): void {
    this.filterSel = sel;
    if (this.svg) this.repaint();
  }

  /** 侧栏正在看的卡：盘上给它加选中标记、标签常显；null = 侧栏关了。身份不在盘上就没有节点可标。 */
  setSelected(id: string | null): void {
    this.selectedId = id;
    this.place();
  }

  /** 全部标签开关：无视 LOD 与仲裁全显。 */
  setShowAllLabels(on: boolean): void {
    this.showAllLabels = on;
    this.place();
  }

  /** 重刷链：着色 + 命中统计 + 重建映射重摆。切主题、切筛选、搜索输入共用这一条。 */
  private repaint(): void {
    const layout = this.layout;
    if (!layout) return;
    const hit = recolor(
      this.cardsLayer.getNodeEls(),
      this.treesLayer.getEdgeEls(),
      this.theme,
      this.filterSel,
      this.searchHit,
    );
    this.hubLayer.recolor(this.theme);
    this.treesLayer.recolor(this.theme);
    this.milestonesLayer.recolor(this.theme);
    this.host.onHits(hit, this.cardsLayer.getNodeEls().length);
    layout.buildMap();
    /* buildAll 里首次走到这儿时视图还没适配（宽恒 0），重摆交给紧跟着的 fit */
    if (this.camera.width > 0) this.place();
  }

  /* ================= 主题 ================= */

  /** 亮暗切换：重判色板 + 走跟建构同一条重刷链。 */
  setTheme(name: ThemeName): void {
    this.themeName = name;
    if (!this.model) return;
    this.readTheme();
    if (this.svg) this.repaint();
  }

  /** 当前主题的色板（图例用）。 */
  get currentTheme(): Theme {
    return this.theme;
  }

  /** 按主题名落到色板：整套色值都在色板里（盘心描边走泥金，不再探宿主变量）。 */
  private readTheme(): void {
    this.theme = this.themes[this.themeName];
  }

  /* ================= 视图：画布铺满容器 ================= */

  /** 按容器尺寸重定画布宽高并重摆（首帧与容器尺寸变化共用）：相机侧量尺寸、定变换，
   * place 是视图侧动作，相机不认识，包装在这层调。日期轨的刻度由日期轨自己跟着轨宽重排。 */
  fit(): void {
    if (!this.svg) return;
    /* 容器还没布局出来（尺寸 0）：camera.fit 已跳过重定，等 ResizeObserver 下一拍 */
    if (!this.camera.fit()) return;
    this.place();
  }

  /* ================= 补间循环 ================= */

  /** 请一帧：已排队就不重复请（续帧由 tick 自己决定）。 */
  private kick(): void {
    if (this.destroyed || this.rafId !== null) return;
    this.rafId = requestAnimationFrame(() => this.tick());
  }

  /** 一帧：焦点日 / 鱼眼强度 / 节点 hover / 视图各自趋近目标，重建映射后重摆。 */
  private tick(): void {
    this.rafId = null;
    const layout = this.layout;
    if (!layout || !this.svg) return;
    const ease = layout.ease;
    /* 焦点日与强度在 layout 自己的四个字段上趋近目标（advanceFrame 末尾重建鱼眼映射） */
    const lensAnimating = advanceFrame(layout, this.frameState, ease);
    /* 节点 / 根节点 hover 放大补间：两层各自步进、都要跑（不能短路） */
    const cardsAnimating = this.cardsLayer.stepTweens();
    const hubAnimating = this.hubLayer.stepTweens();
    const hoverAnimating = cardsAnimating || hubAnimating;
    /* 视图补间（回到原点）与自由缩放补间（滚轮）互斥，步进都归相机管 */
    const viewAnimating = this.camera.viewTarget
      ? this.camera.stepViewTarget(ease)
      : this.camera.zoomTarget
        ? this.camera.stepZoomTarget(ease)
        : false;
    this.place();
    if (lensAnimating || viewAnimating || hoverAnimating) this.kick();
  }

  /* ================= 交互：滚轮 / 拖拽 / 键盘 ================= */

  /** 画布内的交互：挂在每轮重建都会换掉的 svg 上，随 build 走（监听器跟着旧 DOM 一起销毁）。 */
  private bindCanvasEvents(svg: SVGElement): void {
    svg.addEventListener("wheel", (e) => this.onWheel(e), { passive: false });
    // 拖拽漫游：起手挂画布，移动与松手挂 document（拖出画布也不断）
    svg.addEventListener("mousedown", (e) => {
      /* 先清：盘心单击靠它排除拖拽尾梢 */
      this.hasMoved = false;
      this.isDragging = true;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      svg.style.cursor = "grabbing";
    });
  }

  /** 文档级注册：拖拽的移动与松手、可见性复活；尺寸观察器盯画布区。建一次、随舞台销毁。 */
  private bindDocEvents(): void {
    const doc = this.host.canvasEl.ownerDocument;
    const add = <K extends keyof DocumentEventMap>(
      type: K,
      fn: (ev: DocumentEventMap[K]) => void,
    ): void => {
      doc.addEventListener(type, fn);
      this.docListeners.push([type, fn as EventListener]);
    };
    add("mousemove", (e) => {
      if (!this.isDragging) return;
      const dx = e.clientX - this.lastX;
      const dy = e.clientY - this.lastY;
      if (Math.abs(dx) + Math.abs(dy) > 3) this.hasMoved = true;
      if (this.hasMoved) {
        this.camera.view.tx += dx;
        this.camera.view.ty += dy;
        this.camera.isViewDirty = true;
        this.camera.apply();
        /* 回到原点钮的形态跟着翻（拖拽不经 tick，得单独摆一帧） */
        this.place();
      }
      this.lastX = e.clientX;
      this.lastY = e.clientY;
    });
    add("mouseup", () => {
      this.isDragging = false;
      if (this.svg) this.svg.style.cursor = "grab";
    });
    // 页面隐藏期排队的 rAF 帧可能被浏览器静默吞掉——句柄悬空，kick() 的「已排队就不重排」
    // 守卫从此永久挡路。回可见时无条件清句柄重踢一帧
    add("visibilitychange", () => {
      if (doc.hidden) return;
      this.restartRaf();
    });
    /* 尺寸观察器：容器尺寸变了就重算画布宽高、按需重适配；observe 必发一次初始回调 */
    if (typeof ResizeObserver !== "undefined") {
      this.resizeObserver = new ResizeObserver(() => this.fit());
      this.resizeObserver.observe(this.host.canvasEl);
    }
  }

  /** 丢弃可能悬空的排队帧，重新起循环。 */
  private restartRaf(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.kick();
  }

  /** 滚轮：指哪缩哪（相机层，符号层屏幕恒定），锚点保持的补间——目标 k 从当前目标累乘，
   * 连发滚轮不断累积目标而不是每次从当前值起跳，手感跟手不迟滞。
   * ctrl+滚轮（触控板捏合同一通道）分流给透镜：空间缩放与时间缩放一柄滚轮两个修饰态。
   * 真正的缩放位移在 tick() 里逐帧趋近。 */
  private onWheel(e: WheelEvent): void {
    if (!this.svg) return;
    e.preventDefault();
    if (e.ctrlKey) {
      this.dateRail.wheelPan(e);
      return;
    }
    const bounds = this.svg.getBoundingClientRect(); // 页面坐标转画布局部
    const anchorX = e.clientX - bounds.left;
    const anchorY = e.clientY - bounds.top;
    const baseK = this.camera.zoomTarget?.k ?? this.camera.view.k;
    const nk = Math.min(
      this.camera.fitK() * 8,
      Math.max(this.camera.fitK() * 0.5, baseK * 1.0015 ** -e.deltaY),
    );
    this.camera.zoomTarget = { k: nk, anchorX, anchorY };
    this.camera.isViewDirty = true;
    this.camera.viewTarget = null;
    this.kick();
  }

  /** 回到原点，两段式：相机动过就先只归相机（时间窗与透镜原样留着），相机已在原点
   * 再按才归窗（顶满 + 透镜退场）。连按两下 = 全归。Esc 与工具条钮共用一条链。
   * 判段只看 isViewDirty：归相机的补间在途时它已翻 false，此时再按落到第二段，不吞击。 */
  goHome(): void {
    if (!this.layout || !this.svg) return;
    /* 先重测画布，兼手动刷新保险丝：渲染区域跟窗口错位时按房子键（或 Esc）就地对齐 */
    this.fit();
    if (this.camera.isViewDirty) {
      this.camera.isViewDirty = false;
      this.camera.zoomTarget = null;
      this.camera.viewTarget = this.camera.fitView();
      this.kick();
      return;
    }
    this.dateRail.clearWindow();
    this.layout.unfocus();
    this.kick();
  }

  /* ================= place：按当前 (f, s) 重摆全部半径依赖元素 ================= */

  /** 每帧重摆总调度：节点先摆（填 framePos），边与树名随后取用；标签报名沿途投递、最后统一仲裁。 */
  private place(): void {
    const layout = this.layout;
    if (!layout || !this.svg || this.camera.width <= 0) return;
    /* 回到原点钮的形态随「下一按干什么」换脸——判定放每帧翻，任何交互路径
     * （滚轮 / 拖拽 / 补间）改变状态都自然跟上；只在状态翻转时通知壳 */
    const nextHome: HomeState = this.camera.isViewDirty
      ? "camera"
      : this.dateRail.anchorDay !== null || layout.strength > 0.003 || layout.strengthTarget > 0
        ? "window"
        : "idle";
    if (nextHome !== this.homeState) {
      this.homeState = nextHome;
      this.host.onHomeState(nextHome);
    }
    // 符号层统一按 1/view.k 反补偿到屏幕像素
    const pxToWorld = 1 / this.camera.view.k;
    /* 缩放深度：LOD 显隐 = 局部放大率 × 缩放深度 */
    const kRatio = this.camera.view.k / this.camera.fitK();
    /* 12 点标签拥挤仲裁报名处（空窗起止 / 周月环 / 年环 / 里程碑各块沿途投递） */
    const labelClaims: LabelClaim[] = [];
    /* 节点标签仲裁报名处（全景密度兜底，与注记仲裁分池） */
    const nodeLabelClaims: NodeLabelClaim[] = [];
    this.dodge = computeDodge(this.chains, layout, this.camera.view.k);
    /* 每帧上下文：层间数据只走它，层不许回头引用舞台（见 layers/frame.ts 头注）。 */
    const f: FrameCtx = {
      pxToWorld,
      kRatio,
      framePos: this.framePos,
      dodge: this.dodge,
      hoveredCard: this.hoveredCard,
      selectedId: this.selectedId,
      showAllLabels: this.showAllLabels,
      theme: this.theme,
      labelClaims,
      nodeLabelClaims,
    };
    this.cardsLayer.place(f);
    this.treesLayer.place(f);
    this.gapsLayer.place(f);
    this.axisLayer.place(f);
    this.milestonesLayer.place(f);
    this.treesLayer.placeRest(f);
    this.hubLayer.place(f);
    /* 12 点按优先级排队，低位让隐 */
    labelClaims.sort((a, b) => b.prio - a.prio);
    this.labelArbiter.arbitrate(labelClaims, pxToWorld);
    this.labelArbiter.arbitrateNodeLabels(nodeLabelClaims);
  }

  /* ================= 销毁 ================= */

  /** 壳卸载：补间循环、文档级监听、尺寸观察器、画布与日期轨 DOM 全撤。 */
  destroy(): void {
    this.destroyed = true;
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
    const doc = this.host.canvasEl.ownerDocument;
    for (const [type, fn] of this.docListeners) doc.removeEventListener(type, fn);
    this.docListeners = [];
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.svg?.remove();
    this.svg = null;
    this.dateRail.destroy();
  }
}
