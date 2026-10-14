/* 日期竖轨——画布右侧、竖排工具条下方常驻的自绘双柄区间滑块，时间窗（锚点 + 窗宽）的唯一持有者。
 * 原生 range 做不了双柄与中段整窗拖动，故自绘。**顶 = 最旧（d0）、底 = 最新（d1）**，
 * 时间随阅读方向走；轨位与像素反解都走折算标度
 * （railT / dayAtY 一正一逆）——拖拽保持纯屏幕线性，密集区每天等高、空窗只占折痕高，
 * 指针划过折痕那几像素窗就跳过整段空窗（折跃），不做任何分段特判。
 *
 * 时间窗语义：锚点 + 窗宽构成窗口 [锚点-(窗宽-1), 锚点]；没选日期 = 全部；
 * 全跨度窗与全部等价、归一回未选中态。状态跟人走不持久化：换设置重烘焙保留、换一份数据复位。
 *
 * 与宿主（编排者）的接口收窄成两条：layout() 现取当前布局实例（每轮数据重建换新，
 * 竖轨不持引用）、onWindowChange() 通知窗口变更（宿主拿去驱动透镜 syncLens）。
 * 轨的长度变了（窗口缩放）自己重排刻度。监听器直挂自建 DOM、随容器整棵销毁。 */

import type { RingsLayout } from "../layout.ts";
import { formatDay } from "../../../core/model/build.ts";

/** 滚轮一格的 deltaY 阈值（鼠标一格恰一步，触控板平滑累积）。 */
const WHEEL_NOTCH = 120;

/** 滚轮格数结算：余额累进 delta，每满一格出一步；方向反转先清余额——
 * 不清的话反向第一格先还旧方向的账，手感是「滚了没反应」。 */
export function consumeWheelNotches(
  remainder: number,
  delta: number,
): { notches: number; remainder: number } {
  const acc = (delta * remainder < 0 ? 0 : remainder) + delta;
  const notches = Math.trunc(acc / WHEEL_NOTCH);
  return { notches, remainder: acc - notches * WHEEL_NOTCH };
}

/** 天序数闭区间（项目完整跨度 / 空档区段共用形态）。 */
export interface DaySpan {
  d0: number;
  d1: number;
}

/** 轨上折算标度：日 → [0,1] 轨位。与盘面半径同一张折算表（effSegs）——密集区每天
 * 等宽（k=1），空窗中段只占折痕宽；贴手/窗宽恒定/空窗压缩三难的逃逸口就在这：
 * 把「穿越空窗」从连续过程变成折痕上的近似一跳，牺牲的只是空窗内（无卡无信息）的
 * 定位精度。单日盘折算跨度为 0 时恒 0。 */
export function railTOf(layout: RingsLayout, span: DaySpan, d: number): number {
  const e0 = layout.dayEff(span.d0);
  const es = layout.dayEff(span.d1) - e0;
  return es > 0 ? Math.max(0, Math.min(1, (layout.dayEff(d) - e0) / es)) : 0;
}

/** 轨位 → 天序数：轨位占比进折算表逆解（与回显 railTOf 同一标度），0 = d0、1 = d1；
 * 单日盘折算跨度为 0 时恒取 d0。 */
export function dayAtT(layout: RingsLayout, span: DaySpan, t: number): number {
  const tt = Math.max(0, Math.min(1, t));
  const e0 = layout.dayEff(span.d0);
  const es = layout.dayEff(span.d1) - e0;
  if (es <= 0) return span.d0;
  return Math.max(span.d0, Math.min(span.d1, Math.round(layout.dayOfEff(e0 + tt * es))));
}

/** 宿主要给的现场。 */
export interface DateRailHost {
  /** 当前布局实例：折算标度（dayEff / dayOfEff）全从它取 */
  layout(): RingsLayout;
  /** 窗口（锚点 / 窗宽 / 全部态）变了：宿主拿去同步透镜 */
  onWindowChange(): void;
}

/** 建一个带类名的 div 并挂到父节点。 */
function div(parent: HTMLElement, cls: string): HTMLDivElement {
  const e = parent.ownerDocument.createElement("div");
  e.className = cls;
  parent.appendChild(e);
  return e;
}

export class DateRail {
  /** 选中日期的天序数（= 双柄滑块底柄）；null = 全部 */
  private anchor: number | null = null;
  /** 窗宽天数（全部态显示与激活都按全跨度算） */
  private interval = 14;
  /** 项目完整日期跨度（滑块边界）：建模轮由宿主灌入；项目没卡为 null（竖轨禁用） */
  private projectSpan: DaySpan | null = null;
  /** 空档暗纹的日区段缓存：建模轮直刷（模型恒全量，空档恒为真） */
  private gaps: DaySpan[] = [];
  /** 整窗平移滚轮的 deltaY 累积器（画布 ctrl+滚轮与竖轨悬停滚轮共用 wheelPan，
   * 同一时刻只有一处在滚，共享一个余额即可） */
  private panWheelRemainder = 0;
  /** 进行中的滑块拖拽：柄动各自端点、mid 按位移差整窗平移 */
  private drag: {
    kind: "t" | "b" | "mid";
    grabDay: number;
    startAnchor: number;
    startInterval: number;
  } | null = null;

  /* 轨 DOM：trackEl 既是轨容器也是指针命中面（rect.top/height 即可用行程）；
   * thumbBottomEl = 底柄 = 终点（锚点）、thumbTopEl = 顶柄 = 起点（拖拽 kind 同名 "t"/"b"） */
  private readonly trackEl: HTMLElement;
  private readonly rangeEl: HTMLElement;
  private readonly thumbTopEl: HTMLElement;
  private readonly thumbBottomEl: HTMLElement;
  /** 窗宽输入 pill（轨底让位处）：数字直改窗宽、悬停滚轮 ±1 天；全景态显示全跨度天数 */
  private readonly widthEl: HTMLElement;
  private readonly widthInput: HTMLInputElement;
  /** 空档暗纹层（pointer-events:none，只做底纹不吃手势） */
  private readonly gapEl: HTMLElement;
  /** 日期刻度层（pointer-events:none，与盘面日期环同语言的轨上标尺） */
  private readonly scaleEl: HTMLElement;
  /** 轨长变了就重排刻度 */
  private readonly resizeObserver: ResizeObserver | null;
  private readonly host: DateRailHost;

  constructor(containerEl: HTMLElement, host: DateRailHost) {
    this.host = host;
    const track = div(containerEl, "trajectory-date-rail");
    this.trackEl = track;
    /* 层序：暗纹垫底 → 日期刻度 → 最新日刻度 → 选中段 → 双柄；
     * 底纹与刻度不吃指针，命中判定只认柄/段/轨 */
    this.gapEl = div(track, "rail-gaps");
    this.scaleEl = div(track, "rail-scale");
    div(track, "rail-tick");
    this.rangeEl = div(track, "range");
    this.thumbBottomEl = div(track, "thumb");
    this.thumbTopEl = div(track, "thumb");
    this.bindTrack(track);
    /* 服务端静态渲染与测试环境没有 ResizeObserver：那里也没有要重排的刻度 */
    this.resizeObserver =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => this.renderScale());
    this.resizeObserver?.observe(track);

    this.widthEl = div(containerEl, "trajectory-date-width");
    const input = containerEl.ownerDocument.createElement("input");
    input.type = "text";
    input.inputMode = "numeric";
    this.widthEl.appendChild(input);
    this.widthInput = input;
    const unit = containerEl.ownerDocument.createElement("span");
    unit.textContent = "天";
    this.widthEl.appendChild(unit);
    this.bindWidthPill(input);

    this.syncUi();
  }

  /* ---------- 宿主侧读写口 ---------- */

  /** 选中日期（窗口最新端）；null = 全部。 */
  get anchorDay(): number | null {
    return this.anchor;
  }

  get intervalDays(): number {
    return this.interval;
  }

  get span(): DaySpan | null {
    return this.projectSpan;
  }

  /** 建模轮灌入项目完整跨度（滑块边界）。 */
  setSpan(span: DaySpan): void {
    this.projectSpan = span;
  }

  /** 建模轮 / 重烘焙后灌入空档区段（暗纹用）。 */
  setGaps(gaps: DaySpan[]): void {
    this.gaps = gaps;
  }

  /** 换一份数据复位：日期窗跟着数据走，窗与跨度一起清（两柄回撑满、竖轨禁用待新跨度）。 */
  reset(): void {
    this.anchor = null;
    this.projectSpan = null;
    this.syncUi();
  }

  /** 窗回顶满（回到原点第二段）：只清窗、跨度留着。 */
  clearWindow(): void {
    this.anchor = null;
    this.syncUi();
  }

  /** 拆掉自建 DOM 与尺寸观察器（宿主销毁时调）。 */
  destroy(): void {
    this.resizeObserver?.disconnect();
    this.trackEl.remove();
    this.widthEl.remove();
  }

  /* ---------- 折算标度 ---------- */

  private railT(d: number): number {
    const span = this.projectSpan;
    if (!span) return 0;
    return railTOf(this.host.layout(), span, d);
  }

  /** 像素 → 天序数：像素落进轨的行程占比，再走 dayAtT 逆解（顶 = d0、底 = d1）。 */
  private dayAtY(y: number, span: DaySpan): number {
    const r = this.trackEl.getBoundingClientRect();
    const t = r.height > 0 ? Math.max(0, Math.min(1, (y - r.top) / r.height)) : 0;
    return dayAtT(this.host.layout(), span, t);
  }

  /* ---------- 轨交互：双柄 / 中段拖拽 + 悬停滚轮 ---------- */

  private bindTrack(track: HTMLElement): void {
    track.addEventListener("pointerdown", (e: PointerEvent) => {
      const span = this.projectSpan;
      if (!span) return;
      e.preventDefault();
      /* 全部态一碰即接管：窗先取全跨度（与两柄顶满的显示一致），拖动收窄才真正聚焦——
       * 全跨度窗与全部等价，接管本身无感 */
      if (this.anchor === null) {
        this.anchor = span.d1;
        this.interval = span.d1 - span.d0 + 1;
      }
      const day = this.dayAtY(e.clientY, span);
      let kind: "t" | "b" | "mid";
      if (e.target === this.thumbTopEl) kind = "t";
      else if (e.target === this.thumbBottomEl) kind = "b";
      else if (e.target === this.rangeEl) kind = "mid";
      else {
        /* 轨道空白：窗最小平移把点击日纳入窗沿，随后接中段拖 */
        if (day > this.anchor) {
          this.anchor = day;
        } else if (day < this.anchor - (this.interval - 1)) {
          this.anchor = Math.min(span.d1, day + this.interval - 1);
        }
        kind = "mid";
      }
      this.drag = {
        kind,
        grabDay: day,
        startAnchor: this.anchor,
        startInterval: this.interval,
      };
      /* 捕获失败（合成事件 / 异常指针）不中断拖拽：move/up 本就挂在轨道上 */
      try {
        track.setPointerCapture(e.pointerId);
      } catch {
        /* 忽略 */
      }
      this.syncUi();
      this.host.onWindowChange();
    });
    /* 拖动过程透镜实时跟窗：软聚焦零重建，焦点/强度补间白送 */
    track.addEventListener("pointermove", (e: PointerEvent) => {
      const drag = this.drag;
      const span = this.projectSpan;
      if (!drag || !span) return;
      const day = this.dayAtY(e.clientY, span);
      let anchor = this.anchor ?? span.d1;
      let interval = this.interval;
      if (drag.kind === "b") {
        /* 底柄：只动终点，起点钉在拖拽起始时的顶沿（柄互不越过，重合 = 单日窗） */
        const top = Math.max(span.d0, drag.startAnchor - (drag.startInterval - 1));
        anchor = Math.max(top, Math.min(span.d1, day));
        interval = anchor - top + 1;
      } else if (drag.kind === "t") {
        /* 顶柄：只动起点，终点（锚点）不动 */
        const top = Math.max(span.d0, Math.min(drag.startAnchor, day));
        interval = drag.startAnchor - top + 1;
      } else {
        /* 中段：整窗平移，窗宽不变，到跨度边缘停住不缩宽 */
        const lo = Math.min(span.d1, span.d0 + drag.startInterval - 1);
        anchor = Math.max(lo, Math.min(span.d1, drag.startAnchor + (day - drag.grabDay)));
      }
      if (anchor === this.anchor && interval === this.interval) return;
      this.anchor = anchor;
      this.interval = interval;
      this.syncUi();
      this.host.onWindowChange();
    });
    const endDrag = (): void => {
      if (!this.drag) return;
      this.drag = null;
      /* 拖回顶满 = 全部：全跨度窗与不聚焦等价，归一回未选中态 */
      const span = this.projectSpan;
      if (
        span &&
        this.anchor !== null &&
        this.anchor >= span.d1 &&
        this.anchor - (this.interval - 1) <= span.d0
      ) {
        this.anchor = null;
        this.syncUi();
      }
      this.host.onWindowChange();
    };
    track.addEventListener("pointerup", endDrag);
    track.addEventListener("pointercancel", endDrag);
    /* 悬停滚轮整窗平移：与画布 ctrl+滚轮同一段代码（wheelPan）——一格窗宽一成、
     * 下滚向新、120 累积器，竖轨与画布滚哪儿结果完全一样 */
    track.addEventListener(
      "wheel",
      (e: WheelEvent) => {
        e.preventDefault();
        this.wheelPan(e);
      },
      { passive: false },
    );
  }

  /* ---------- 窗宽输入 pill ---------- */

  /** 键入 Enter/失焦提交、Esc 还原不提交，悬停滚轮 deltaY 累积每满一格走 ±1 天（上滚加宽）
   * 即时生效；pointerdown/keydown/wheel 全拦冒泡，别串进轨上平移、画布缩放与宿主快捷键。 */
  private bindWidthPill(input: HTMLInputElement): void {
    /* 提交住 blur 一处：Enter/Esc 都收敛成失焦，非法键入（含 Esc 清空）只回写还原 */
    const commit = (): void => {
      const n = Number.parseInt(input.value, 10);
      if (Number.isFinite(n)) this.applyIntervalDays(n);
      this.syncUi();
    };
    this.widthEl.addEventListener("pointerdown", (e: PointerEvent) => {
      e.stopPropagation();
    });
    input.addEventListener("keydown", (e: KeyboardEvent) => {
      e.stopPropagation();
      if (e.key === "Enter") input.blur();
      else if (e.key === "Escape") {
        input.value = "";
        input.blur();
      }
    });
    input.addEventListener("blur", commit);
    let widthWheelRemainder = 0;
    this.widthEl.addEventListener(
      "wheel",
      (e: WheelEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const span = this.projectSpan;
        if (!span) return;
        const dir = -e.deltaY; /* 上滚为正 = 加宽 */
        const wheel = consumeWheelNotches(widthWheelRemainder, dir);
        widthWheelRemainder = wheel.remainder;
        if (!wheel.notches) return;
        const cur = this.anchor === null ? span.d1 - span.d0 + 1 : this.interval;
        this.applyIntervalDays(cur + wheel.notches);
        /* 编辑到一半来了滚轮：未提交键入作废，以生效值为准强制回写（聚焦中 syncUi 不回写） */
        input.value = String(this.anchor === null ? span.d1 - span.d0 + 1 : this.interval);
      },
      { passive: false },
    );
  }

  /** 窗宽的语义门（输入框键入 / 框上滚轮共用）：锚点（最新端）钉住只收放起点，
   * 起点穿底就钳到能容纳的宽度（名义宽不超显示宽）；盖满全跨度归一回全景；透镜即时跟窗。
   * 全景态从 d1 接管锚点——与轨道「全部态一碰即接管」同律。 */
  private applyIntervalDays(n: number): void {
    const span = this.projectSpan;
    if (!span || !Number.isFinite(n)) return;
    const anchor = this.anchor ?? span.d1;
    const w = Math.max(1, Math.min(anchor - span.d0 + 1, Math.round(n)));
    this.interval = w;
    /* 全跨度窗 ≡ 全部 */
    this.anchor = anchor >= span.d1 && anchor - (w - 1) <= span.d0 ? null : anchor;
    this.syncUi();
    this.host.onWindowChange();
  }

  /** 整窗平移滚轮：画布 ctrl+滚轮与竖轨悬停滚轮共用的同一段代码——同一个操作在两个
   * 指针位置，滚哪儿都一样。一格 = 窗有效宽 × 10%（下限 1 有效天）沿显示折算域走：
   * 步长跟缩放级别（窗宽）自适应，轨上位移恒为选中段自身的一成，过空窗按折痕显示
   * 宽度匀速划过（不用固定「天/格」增益：宽窗下一格慢得像没动、窄窗下一格飞掉
   * 大半个窗，比例增益才在各缩放级别手感一致）。方向：下滚（deltaY>0）= 向新
   * （捏合手势在系统层即 ctrl+滚轮，方向随之）。
   * 整窗到跨度边缘停住不缩宽；全景态窗即全跨度、无处可移，不动作——改窗宽走竖轨双柄。 */
  wheelPan(e: WheelEvent): void {
    const span = this.projectSpan;
    if (!span || this.anchor === null) return;
    const dir = e.deltaY; /* 下滚为正 = 向新 */
    const wheel = consumeWheelNotches(this.panWheelRemainder, dir);
    this.panWheelRemainder = wheel.remainder;
    if (!wheel.notches) return;
    const layout = this.host.layout();
    const lo = Math.max(span.d0, this.anchor - (this.interval - 1));
    const effW = layout.dayEff(this.anchor) - layout.dayEff(lo);
    const a = layout.dayOfEff(layout.dayEff(this.anchor) + Math.max(1, effW * 0.1) * wheel.notches);
    const anchor = Math.round(Math.min(span.d1, Math.max(span.d0 + this.interval - 1, a)));
    if (anchor === this.anchor) return;
    this.anchor = anchor;
    this.syncUi();
    this.host.onWindowChange();
  }

  /* ---------- 回显 ---------- */

  /** 日期窗回显：竖轨双柄与选中段按竖向百分比摆位。
   * 竖排映射：top% 走折算标度（railT）——顶 = 最旧、底 = 最新，底柄终点、顶柄起点。
   * 同样的窗宽天数，选中段在密集区像素高恒定；罩住空窗时段里可见地嵌着折痕、相应变短。
   * 全部态两柄撑满全跨度（所见即现状），拖柄收窄才是聚焦；项目没卡才禁用。 */
  syncUi(): void {
    const span = this.projectSpan;
    if (span) {
      const d1 = this.anchor ?? span.d1;
      const d0 = this.anchor === null ? span.d0 : Math.max(span.d0, d1 - (this.interval - 1));
      const pct = (d: number): number => this.railT(d) * 100;
      this.thumbTopEl.style.top = `${pct(d0)}%`;
      this.thumbBottomEl.style.top = `${pct(d1)}%`;
      this.rangeEl.style.top = `${pct(d0)}%`;
      this.rangeEl.style.height = `${pct(d1) - pct(d0)}%`;
    }
    /* 窗宽 pill 跟显（全景态按全跨度算）；聚焦编辑中不回写，别冲掉正打的字 */
    if (span && this.widthInput.ownerDocument.activeElement !== this.widthInput) {
      this.widthInput.value = String(this.anchor === null ? span.d1 - span.d0 + 1 : this.interval);
    }
    this.trackEl.classList.toggle("is-disabled", !span);
    this.widthEl.classList.toggle("is-disabled", !span);
  }

  /** 空档暗纹重画：按缓存的空档日区段铺暗条，轨位走折算标度——暗条高即折痕高，
   * 与盘面小行星带径向厚度同比（gapBands 的 d0/d1 就是被折中段边界）。
   * 建模轮 + 重烘焙后各跑一趟，拖拽过程不必重铺 DOM。 */
  renderGaps(): void {
    this.gapEl.textContent = "";
    if (!this.projectSpan) return;
    for (const g of this.gaps) {
      const t0 = this.railT(g.d0) * 100;
      const t1 = this.railT(g.d1) * 100;
      if (t1 - t0 <= 0) continue;
      const band = div(this.gapEl, "rail-gap");
      band.style.top = `${t0}%`;
      band.style.height = `${t1 - t0}%`;
    }
  }

  /** 竖轨日期刻度：与盘面日期环同一套语言（MM-DD，年起点标年份加亮），轨底端恒标最新日。
   * 轨位走折算标度：换挡密度按**密集区**像素/天（轨高/折算跨度，k=1 区每天恰 1 个
   * 有效天）取标签间距不小于 24px 的最细档（竖排标签占 ~12px 字高，留一倍余量）——
   * 空窗折痕不参与换挡，长空窗项目不会被拖进年档；折进折痕的刻度挤作一堆，
   * 由像素间距守卫自然让位，空窗段不堆字。
   * 跨度或轨高变了才重画（建模轮 + 重烘焙 + 轨高变化），拖拽过程不动。 */
  renderScale(): void {
    this.scaleEl.textContent = "";
    const span = this.projectSpan;
    if (!span) return;
    const px = this.trackEl.getBoundingClientRect().height;
    if (px <= 0) return;
    const layout = this.host.layout();
    const effSpan = Math.max(1, layout.dayEff(span.d1) - layout.dayEff(span.d0));
    const pxPerDay = px / effSpan;
    const MIN_PX = 24;
    /* 已放标签的轨上像素位（折算轴上日距不再正比像素距，守卫只能认像素） */
    const placed: number[] = [];
    const put = (day: number, label: string, cls: string): void => {
      const t = this.railT(day) * 100;
      const hr = div(this.scaleEl, "rail-lbl-hr");
      hr.style.top = `${t}%`;
      const lbl = div(this.scaleEl, cls ? `rail-lbl ${cls}` : "rail-lbl");
      lbl.style.top = `${t}%`;
      lbl.textContent = label;
      placed.push((t / 100) * px);
    };
    /* 最小像素间距守卫：防轨底端最新日与相邻档位叠字，兼裁掉折痕两侧挤压的刻度 */
    const fits = (day: number): boolean => {
      const yp = this.railT(day) * px;
      return placed.every((p) => Math.abs(p - yp) >= MIN_PX * 0.8);
    };
    /* 轨底端恒标最新日：回答「底下那条亮刻度是哪天」 */
    put(span.d1, formatDay(span.d1), "rail-lbl-top");
    if (7 * pxPerDay >= MIN_PX) {
      /* 周档：短跨度盘，从最新日往回每 7 天一格 */
      for (let d = span.d1 - 7; d >= span.d0; d -= 7) {
        if (fits(d)) put(d, formatDay(d), "");
      }
    } else {
      /* 月 / 季 / 年档：走日历月起点，季档只留 1/4/7/10 月，年档只留 1 月（标年份） */
      const stepMonths = 30.4 * pxPerDay >= MIN_PX ? 1 : 91 * pxPerDay >= MIN_PX ? 3 : 12;
      const d0date = new Date(span.d0 * 86400000);
      let y = d0date.getUTCFullYear();
      let m0 = d0date.getUTCMonth();
      for (;;) {
        const day = Math.floor(Date.UTC(y, m0, 1) / 86400000);
        if (day > span.d1) break;
        const onStep = stepMonths === 1 || (stepMonths === 3 ? m0 % 3 === 0 : m0 === 0);
        if (day >= span.d0 && onStep && fits(day)) {
          if (m0 === 0) put(day, String(y), "rail-lbl-y");
          else put(day, formatDay(day), "");
        }
        m0 += 1;
        if (m0 > 11) {
          m0 = 0;
          y += 1;
        }
      }
    }
  }
}
