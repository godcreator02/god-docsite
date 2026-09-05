/* 时间轴注记层：星轨的日期骨架——周月环 / 年环 / 最新环 / 焦点带边环 + 焦点带高亮本身，
 * 五件一并归此层，是注记大杂烩（彼此不共享状态，只共享"给星轨钉时间刻度"这条职责）。
 * 整搬自 Obsidian 版 star/layers/axis.ts。
 *
 * 层叠序注记：焦点带高亮（bandEl）排最底层、紧挨在 gapsLayer.build 之前；
 * 其余四件（周月环/年环/最新环/焦点带边环）排在 gapsLayer.build 之后、milestones 之前。
 * 两段被 gapsLayer 的建构夹断，不能合成一次 build 调用——build() 只建 bandEl（满足
 * StarLayer 接口），其余四件住公开方法 buildRest()，由编排者在 gapsLayer.build
 * 之后原位调用，保证 DOM 插入序、也就是层叠序。 */

import { monthGate, smoothstep } from "../../layout.ts";
import { formatDay } from "../../model.ts";
import { el, text } from "../node-dom.ts";
import type { BuildCtx, FrameCtx, StarLayer } from "./frame.ts";

/** 周 / 月背景环。 */
interface RingEl {
  d: number;
  rLin: number;
  isMonth: boolean;
  circle: SVGElement;
  label: SVGElement;
}

/** 年环：跨年主结构线。 */
interface YearEl {
  d: number;
  rLin: number;
  circle: SVGElement;
  label: SVGElement;
}

/** 最新环：dayMax 那天的环，全景态的时间外缘标记。 */
interface LatestEl {
  rLin: number;
  circle: SVGElement;
  label: SVGElement;
}

/** 焦点带边环（内 / 外各一）：鱼眼态专属，当天日期标签挂 12 点。 */
interface BandEdge {
  circle: SVGElement;
  label: SVGElement;
}

export class AxisLayer implements StarLayer {
  private bandEl!: SVGElement;
  private ringEls: RingEl[] = [];
  private yearEls: YearEl[] = [];
  private latestEl: LatestEl | null = null;
  private bandEdges: BandEdge[] = [];
  /** 建构期注入的只读引用，buildRest()/rebake() 在下一轮数据重建前都有效
   * （layout 实例原地 configure，不随 rebake 换引用）。 */
  private ctx!: BuildCtx;

  /** 只建焦点带高亮（bandEl，层叠序最底）——满足 StarLayer 接口；其余四件见 buildRest()。 */
  build(ctx: BuildCtx): void {
    this.ctx = ctx;
    this.bandEl = el("circle", { cx: 0, cy: 0, r: 0, fill: "none", "stroke-width": 0 }, ctx.world);
  }

  /** 周月环 + 年环 + 最新环 + 焦点带边环——调用序紧跟在 gapsLayer.build 之后，
   * 编排者需在那个位置原样调用本方法。 */
  buildRest(): void {
    this.ringEls = [];
    this.yearEls = [];
    this.latestEl = null;
    this.bandEdges = [];
    this.buildRings();
    this.buildYears();
    this.buildLatest();
    this.buildBandEdges();
  }

  /** 背景环：周环 + 日期标签（月环也吃局部放大率渐隐、只是不归零，压缩区不再堆成灰带）。 */
  private buildRings(): void {
    const layout = this.ctx.layout;
    const { day0, dayMax } = this.ctx.model;
    const gaps = layout.gapBands();
    for (let d = day0; d <= dayMax; d += 7) {
      const isMonth = new Date(d * 86400000).getUTCDate() <= 7;
      /* 全折进空窗中段的周环建了也永远让位（gapMute 压到零）——白建的 DOM 不建；
       * 月环保留：它渐隐有保底、空窗里还当格网残影 */
      if (!isMonth && gaps.some((b) => d > b.d0 && d < b.d1)) continue;
      /* 恰好落在 dayMax 的周环让位给最新环（月环是格网身份，撞上也保留） */
      if (!isMonth && d === dayMax) continue;
      const circle = el(
        "circle",
        {
          cx: 0,
          cy: 0,
          r: 0,
          fill: "none",
          class: isMonth ? "ringm" : "ringc",
          "stroke-width": 1,
          "vector-effect": "non-scaling-stroke",
        },
        this.ctx.world,
      );
      const label = text(0, 0, formatDay(d), "dl", {}, this.ctx.world);
      this.ringEls.push({ d, rLin: layout.radiusDay(d), isMonth, circle, label });
    }
  }

  /** 年环：每年 1 月 1 日一条跨年主结构线（一年一圈的那条），标签挂年份；
   * 空窗内不让位（跨年是主结构信息，起止标签因此回归 MM-DD 短格式、年份由它承载）。 */
  private buildYears(): void {
    const layout = this.ctx.layout;
    const { day0, dayMax } = this.ctx.model;
    const y0 = new Date(day0 * 86400000).getUTCFullYear() + 1;
    const y1 = new Date(dayMax * 86400000).getUTCFullYear();
    for (let y = y0; y <= y1; y++) {
      const d = Date.parse(`${y}-01-01T00:00:00Z`) / 86400000;
      const circle = el(
        "circle",
        {
          cx: 0,
          cy: 0,
          r: 0,
          fill: "none",
          class: "ringy",
          "stroke-width": 1.2,
          "vector-effect": "non-scaling-stroke",
        },
        this.ctx.world,
      );
      const label = text(0, 0, String(y), "yl", {}, this.ctx.world);
      this.yearEls.push({ d, rLin: layout.radiusDay(d), circle, label });
    }
  }

  /** 最新环：dayMax 那天的环——全景态的时间外缘，月环同族加重一档；
   * 标签静态（一轮模型一个日期），鱼眼渐隐归 placeLatest；空盘不建。 */
  private buildLatest(): void {
    if (!this.ctx.model.cards.length) return;
    const { dayMax } = this.ctx.model;
    const circle = el(
      "circle",
      {
        cx: 0,
        cy: 0,
        r: 0,
        fill: "none",
        class: "ringl",
        "stroke-width": 1.2,
        "vector-effect": "non-scaling-stroke",
      },
      this.ctx.world,
    );
    const label = text(0, 0, formatDay(dayMax), "dl", {}, this.ctx.world);
    this.latestEl = { rLin: this.ctx.layout.radiusDay(dayMax), circle, label };
  }

  /** 焦点带边环：内 / 外两条细实线，给焦点带描出窗口边界；
   * 当天日期标签挂 12 点（鱼眼态的主角标签，盘心不再背日期），显隐与日期归 placeBandEdges。 */
  private buildBandEdges(): void {
    this.bandEdges = [0, 1].map(() => ({
      circle: el(
        "circle",
        {
          cx: 0,
          cy: 0,
          r: 0,
          fill: "none",
          class: "ringb",
          "stroke-width": 1,
          "vector-effect": "non-scaling-stroke",
          opacity: 0,
        },
        this.ctx.world,
      ),
      label: text(0, 0, "", "dl", {}, this.ctx.world),
    }));
  }

  /** 世界尺度参数变更（rebake）重烘焙：day0/dayMax 集合不变，变的只是 layout 的
   * 日期→半径折算表，故只重算既有元素的 rLin、不增删元素。 */
  rebake(): void {
    const { layout, model } = this.ctx;
    for (const ring of this.ringEls) ring.rLin = layout.radiusDay(ring.d);
    for (const year of this.yearEls) year.rLin = layout.radiusDay(year.d);
    if (this.latestEl) this.latestEl.rLin = layout.radiusDay(model.dayMax);
  }

  /** 五件按序摆一遍：焦点带高亮 → 周月环 + 年环 → 最新环 → 焦点带边环
   * （均为纯属性写入、不影响 DOM 层叠序）。 */
  place(f: FrameCtx): void {
    this.placeBand();
    this.placeRings(f);
    this.placeLatest(f);
    this.placeBandEdges(f);
  }

  /** 焦点带高亮。 */
  private placeBand(): void {
    const layout = this.ctx.layout;
    const strength = layout.strength;
    if (strength > 0.003) {
      const ra = layout.displayRadius(layout.bandLinear[0]);
      const rb = layout.displayRadius(layout.bandLinear[1]);
      this.bandEl.setAttribute("r", String((ra + rb) / 2));
      this.bandEl.setAttribute("stroke-width", String(Math.max(0, rb - ra)));
      /* 焦点带跟主题走：color-mix 从前景色兑透明度，透明度随鱼眼强度 strength 动态兑，
       * 明暗主题自适应 */
      this.bandEl.setAttribute(
        "stroke",
        `color-mix(in srgb, var(--color-fd-foreground) ${(5 * strength).toFixed(2)}%, transparent)`,
      );
    } else {
      this.bandEl.setAttribute("stroke-width", "0");
    }
  }

  /** 背景环：周环随缩放展开（全景只留月环，放大 / 进鱼眼后渐显）；月环渐隐保底不归零；
   * 空窗压缩带内环与标签整体让位小行星带（荒年密环糊成灰带，信号由带接管）；
   * 12 点标签不直接定显隐，先报名进拥挤仲裁（年环 > 空窗起止 > 月环 > 周环，先到先得）。 */
  private placeRings(f: FrameCtx): void {
    const layout = this.ctx.layout;
    const { pxToWorld, kRatio, labelClaims } = f;
    for (const ring of this.ringEls) {
      const r2 = layout.displayRadius(ring.rLin);
      const mag = layout.mag(ring.rLin);
      ring.circle.setAttribute("r", String(r2));
      const t = Math.min(1, Math.max(0, (mag - 0.3) / 0.4));
      /* 缩放门：全景全隐、约 1.2 倍起现身 */
      const tWeek = smoothstep(1.2, 2.2, mag * kRatio);
      const gapMute = layout.effRate(ring.d);
      const reff = mag * kRatio;
      /* 月环密度门：环带世界深度定死后密盘（月环间距无下限）会糊成同心圆纹，乘 mag·kRatio
       * 让放大 / 进鱼眼后月环重新现身（同周环缩放门思路）；非月环恒 1，不受影响 */
      const monthGateV = ring.isMonth ? monthGate(layout.monthSpacingWorld(ring.d) * reff) : 1;
      ring.circle.setAttribute(
        "opacity",
        String((ring.isMonth ? 0.27 + 0.73 * t : t * tWeek) * gapMute * monthGateV),
      );
      ring.label.setAttribute(
        "transform",
        `translate(0,${-r2 - 5 * pxToWorld}) scale(${pxToWorld})`,
      );
      /* 周标签跟环同步展开、略晚现身；月环标签同吃密度门，门 < 0.5 不报名 */
      const want =
        gapMute > 0.5 &&
        monthGateV >= 0.5 &&
        ((!ring.isMonth && reff > 1.6) || (ring.isMonth && reff > 0.25));
      if (want) labelClaims.push({ r: r2, prio: ring.isMonth ? 2 : 1, label: ring.label });
      else ring.label.style.display = "none";
    }
    // 年环：跨年主结构线，恒显不吃 LOD 门、空窗内不让位；标签最高优先级
    for (const year of this.yearEls) {
      const r2 = layout.displayRadius(year.rLin);
      year.circle.setAttribute("r", String(r2));
      year.label.setAttribute(
        "transform",
        `translate(0,${-r2 - 6 * pxToWorld}) scale(${pxToWorld})`,
      );
      labelClaims.push({ r: r2, prio: 4, label: year.label });
    }
  }

  /** 最新环：全景恒显、随鱼眼强度渐隐（鱼眼态的时间外缘由焦点带边环接班）；
   * 标签 12 点，优先级压年环之下、空窗起止之上——全景的核心信息，基本恒显。 */
  private placeLatest(f: FrameCtx): void {
    const e = this.latestEl;
    if (!e) return;
    const layout = this.ctx.layout;
    const r2 = layout.displayRadius(e.rLin);
    e.circle.setAttribute("r", String(r2));
    const vis = 1 - smoothstep(0, 0.4, layout.strength);
    e.circle.setAttribute("opacity", String(vis));
    e.label.setAttribute(
      "transform",
      `translate(0,${-r2 - 5 * f.pxToWorld}) scale(${f.pxToWorld})`,
    );
    if (vis > 0.5) f.labelClaims.push({ r: r2, prio: 3.5, label: e.label });
    else e.label.style.display = "none";
  }

  /** 焦点带边环与日期：鱼眼态专属，随强度渐入（与焦点带高亮同门）；
   * 内外边环各挂当天日期，贴端点时加「已到最早 / 最新」后缀并染警示色；
   * 标签优先级全盘最高——鱼眼态它们是主角，结构环标签该让。 */
  private placeBandEdges(f: FrameCtx): void {
    const layout = this.ctx.layout;
    const strength = layout.strength;
    const vis = smoothstep(0, 0.4, strength);
    const { day0, dayMax } = this.ctx.model;
    /* 贴端点判定与盘心警示环同一套：目标贴死 + 补间基本到位 */
    const early = layout.focusDayTarget <= day0 + 1e-9 && layout.focusDay <= day0 + 0.6;
    const late = layout.focusDayTarget >= dayMax - 1e-9 && layout.focusDay >= dayMax - 0.6;
    const clampDay = (n: number): number => Math.max(day0, Math.min(dayMax, n));
    /* 内边环锚在 innerR + 旧压缩区宽——盘心世界锚定后恒在内界之内（hubWorldR = innerR −
     * HUB_RIM），圆环不可能被罩；钳到盘沿外只是双保险，日期不丢 */
    const hubW = layout.hubWorldR;
    this.bandEdges.forEach((e, i) => {
      if (strength < 0.003) {
        e.circle.setAttribute("opacity", "0");
        e.label.style.display = "none";
        return;
      }
      const r2 = layout.displayRadius(layout.bandLinear[i] as number);
      e.circle.setAttribute("r", String(r2));
      e.circle.setAttribute("opacity", String(0.85 * vis));
      const warn = i === 0 ? early : late;
      const d = formatDay(Math.round(clampDay(layout.dayOfRadius(layout.bandLinear[i] as number))));
      e.label.textContent = warn ? `${d} · 已到${i === 0 ? "最早" : "最新"}` : d;
      e.label.style.fill = warn ? f.theme.warn : "";
      const rLab = i === 0 ? Math.max(r2, hubW + 10 * f.pxToWorld) : r2;
      e.label.setAttribute(
        "transform",
        `translate(0,${-rLab - 5 * f.pxToWorld}) scale(${f.pxToWorld})`,
      );
      if (vis > 0.5) f.labelClaims.push({ r: rLab, prio: 5, label: e.label });
      else e.label.style.display = "none";
    });
  }
}
