/* 相机——世界坐标到屏幕坐标的仿射变换。整搬自 Obsidian 版 star/camera.ts。
 * 只认识 svg/world 两个 DOM 句柄与两个回调注入（画布尺寸、世界最大半径），
 * 不认识 RingsLayout / DateRail / place——那些是编排者的事。 */

/** 盘心右移量（px）：左缘日期竖轨（40px 覆盖层）贴着画布左缘，盘取正中会跟它抢地——
 * 适配态盘心从正中往右让这么多，横向适配预算同步扣两倍，左右边距保持对称；
 * 宽度是松的那维（盘径吃短边、短边通常是高度），这笔扣款不伤盘径。 */
const RAIL_CLEAR = 16;

/** Camera 的两处外部依赖：画布尺寸源（canvasEl 的量法）与世界最大半径（RingsLayout.maxR），
 * 都以回调注入——Camera 不持有 canvasEl 句柄、不 import RingsLayout，保持最小耦合。 */
export interface CameraDeps {
  getCanvasEl(): HTMLElement;
  getMaxR(): number;
}

export class Camera {
  /** 当前渲染变换（世界 → 屏幕的缩放 + 平移）。 */
  view = { k: 0, tx: 0, ty: 0 };
  /** 用户动过视图（自由漫游的缩放 / 平移）：容器尺寸变化时保住视图不重置 */
  isViewDirty = false;
  /** 视图补间目标（回到原点时用） */
  viewTarget: { k: number; tx: number; ty: number } | null = null;
  /** 自由缩放补间目标：锚点保持的滚轮缩放（k = 目标缩放，anchorX/anchorY = 鼠标锚点的画布局部坐标）。
   * 与 viewTarget 互斥（回到原点会清它，反之亦然——两者都是"缩放要往哪走"的目标态，不能同时存在）。 */
  zoomTarget: { k: number; anchorX: number; anchorY: number } | null = null;
  /** 画布宽高：铺满容器（不是 1:1 方形），适配盘径吃短边 */
  width = 0;
  height = 0;

  private svg!: SVGElement;
  private world!: SVGElement;
  private readonly deps: CameraDeps;

  constructor(deps: CameraDeps) {
    this.deps = deps;
  }

  /** 画布 DOM 整棵重建后重挂句柄（数据重建换 svg/world，view 状态原样留着）。 */
  setElements(svg: SVGElement, world: SVGElement): void {
    this.svg = svg;
    this.world = world;
  }

  /** 画布内容盒宽高：画布区铺满容器，盘径吃短边。
   * 拿内容盒尺寸（getBoundingClientRect 的 border-box 剥掉 computed padding）再向下取整：
   * padding 若回流，画布只是略小，绝不顶出滚动条。 */
  canvasSize(): { w: number; h: number } {
    const canvasEl = this.deps.getCanvasEl();
    const cs = getComputedStyle(canvasEl);
    const r = canvasEl.getBoundingClientRect();
    const w = r.width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const h = r.height - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    return { w: Math.floor(w), h: Math.floor(h) };
  }

  /** 适配盘径仍吃短边：全盘可见的最低缩放。横向预算扣掉竖轨让位（见 RAIL_CLEAR）。 */
  fitK(): number {
    return (
      (Math.min(this.width - 2 * RAIL_CLEAR, this.height) / (2 * (this.deps.getMaxR() + 60))) * 0.95
    );
  }

  /** 适配态视图目标：盘心竖直居中、横向右移给左缘竖轨让位。fit / 回到原点共用。 */
  fitView(): { k: number; tx: number; ty: number } {
    return { k: this.fitK(), tx: this.width / 2 + RAIL_CLEAR, ty: this.height / 2 };
  }

  apply(): void {
    this.world.setAttribute(
      "transform",
      `translate(${this.view.tx},${this.view.ty}) scale(${this.view.k})`,
    );
  }

  /** 按容器尺寸重定画布宽高并重摆（首帧与容器尺寸变化共用）。
   * 视图没动过（含鱼眼态，视图恒为适配态）按新尺寸重适配；动过就不重置——
   * k 保持，画布中心平移多少视图跟着平移多少，正在看的那块原地不动。
   * 返回高度变化量 dh（调用方据此判断要不要重算日期竖轨密度档位）；容器尺寸还没布局出来
   * （尺寸 0）时返回 null，调用方应跳过本轮重摆、等 ResizeObserver 下一拍。 */
  fit(): number | null {
    const { w, h } = this.canvasSize();
    if (w <= 0 || h <= 0) return null;
    const dw = w - this.width;
    const dh = h - this.height;
    this.width = w;
    this.height = h;
    this.svg.setAttribute("width", String(w));
    this.svg.setAttribute("height", String(h));
    if (this.isViewDirty) {
      this.view.tx += dw / 2;
      this.view.ty += dh / 2;
    } else if (!this.viewTarget) {
      this.view = this.fitView();
    }
    /* 回到原点的补间目标恒为适配态：跟着新尺寸走，免得补回旧中心 */
    if (this.viewTarget) this.viewTarget = this.fitView();
    /* view.k 变了，符号层反补偿因子要重算 */
    this.apply();
    return dh;
  }

  /** 视图补间步进（回到原点用）：趋近 viewTarget，足够近即吸附清空。
   * 返回补间是否仍在进行（供 tick 判定要不要续帧）。 */
  stepViewTarget(ease: number): boolean {
    const t = this.viewTarget;
    if (!t) return false;
    this.view.k += (t.k - this.view.k) * ease;
    this.view.tx += (t.tx - this.view.tx) * ease;
    this.view.ty += (t.ty - this.view.ty) * ease;
    if (
      Math.abs(this.view.k - t.k) < 0.001 &&
      Math.abs(this.view.tx - t.tx) < 0.5 &&
      Math.abs(this.view.ty - t.ty) < 0.5
    ) {
      this.view = { ...t };
      this.viewTarget = null;
    }
    this.apply();
    return this.viewTarget !== null;
  }

  /** 自由缩放补间步进（滚轮用）：锚点保持——按本帧比值围绕锚点（anchorX/anchorY）重解 tx/ty，
   * 再赋回缩放。补间系数比 layout.ease 快一档，滚轮连发不能有拖泥带水的迟滞感。
   * 拖拽平移与它并存时锚点跟着平移会有微漂，可接受、不必特殊处理。
   * 返回补间是否仍在进行（供 tick 判定要不要续帧）。 */
  stepZoomTarget(ease: number): boolean {
    const t = this.zoomTarget;
    if (!t) return false;
    const zoomEase = Math.min(1, ease * 2);
    const k = this.view.k;
    const nk = k + (t.k - k) * zoomEase;
    const ratio = nk / k;
    this.view.tx = t.anchorX - (t.anchorX - this.view.tx) * ratio;
    this.view.ty = t.anchorY - (t.anchorY - this.view.ty) * ratio;
    this.view.k = nk;
    if (Math.abs(t.k - nk) / nk < 0.001) {
      this.view.k = t.k;
      this.zoomTarget = null;
    }
    this.apply();
    return this.zoomTarget !== null;
  }
}
