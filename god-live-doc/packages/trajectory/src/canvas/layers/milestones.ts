/* 里程碑层：人工指定的关键时刻，金色加重环 + 6 点方向恒显标签，悬停标签出说明。
 * 里程碑数据本身（从根卡正文解析 + inRange 裁剪）归编排者——本层只从 BuildCtx.milestones
 * 拿建好的清单，不认识加载与裁剪逻辑。整搬自 Obsidian 版 star/layers/milestones.ts。 */

import { polar } from "../../layout.ts";
import { dayNum, formatDay } from "../../model.ts";
import type { Milestone } from "../../types.ts";
import { el, text } from "../node-dom.ts";
import type { Theme } from "../theme.ts";
import type { BuildCtx, FrameCtx, StarLayer } from "./frame.ts";

/** 里程碑环 + 6 点标签。 */
interface MsEl {
  m: Milestone;
  rLin: number;
  circle: SVGElement;
  label: SVGElement;
}

export class MilestonesLayer implements StarLayer {
  private milestoneEls: MsEl[] = [];
  /** 建构期注入的只读引用，rebake() 在下一轮数据重建前都有效
   * （layout 实例原地 configure，不随 rebake 换引用）。 */
  private ctx!: BuildCtx;

  build(ctx: BuildCtx): void {
    this.ctx = ctx;
    this.buildMilestones();
  }

  /** 里程碑：人工指定的关键时刻，金色加重环 + 6 点方向恒显标签，悬停标签出说明。 */
  private buildMilestones(): void {
    const layout = this.ctx.layout;
    this.milestoneEls = this.ctx.milestones.map((m) => {
      const g = el("g", {}, this.ctx.world);
      /* 细实线退淡：注记不抢内容戏 */
      const circle = el(
        "circle",
        {
          cx: 0,
          cy: 0,
          r: 0,
          fill: "none",
          "stroke-width": 1.2,
          "vector-effect": "non-scaling-stroke",
          opacity: 0.35,
        },
        g,
      );
      const label = text(
        0,
        0,
        `${formatDay(dayNum(m.date))} ${m.name}`,
        "msl",
        { "text-anchor": "middle", opacity: 0.85 },
        g,
      );
      el("title", {}, g).textContent = m.desc
        ? `${m.date} ${m.name}\n${m.desc}`
        : `${m.date} ${m.name}`;
      return { m, rLin: layout.radiusDay(dayNum(m.date)), circle, label };
    });
  }

  /** 世界尺度参数变更（rebake）重烘焙：里程碑集合不变，变的只是 layout 的
   * 日期→半径折算表，故只重算既有元素的 rLin、不增删元素。 */
  rebake(): void {
    const layout = this.ctx.layout;
    for (const e of this.milestoneEls) e.rLin = layout.radiusDay(dayNum(e.m.date));
  }

  place(f: FrameCtx): void {
    this.placeMilestones(f);
  }

  /** 里程碑环：随鱼眼变形，标签恒显在 6 点方向（正上让给日期标签）。 */
  private placeMilestones(f: FrameCtx): void {
    const layout = this.ctx.layout;
    const { pxToWorld, milestoneClaims } = f;
    for (const e of this.milestoneEls) {
      const r2 = layout.displayRadius(e.rLin);
      e.circle.setAttribute("r", String(r2));
      const p = polar(180, r2);
      e.label.setAttribute(
        "transform",
        `translate(${p.x},${p.y + 12 * pxToWorld}) scale(${pxToWorld})`,
      );
      milestoneClaims.push({ r: r2, prio: 0, label: e.label });
    }
  }

  recolor(theme: Theme): void {
    this.recolorMs(theme);
  }

  private recolorMs(theme: Theme): void {
    for (const e of this.milestoneEls) {
      e.circle.setAttribute("stroke", theme.supersede);
      e.label.setAttribute("fill", theme.supersede);
    }
  }
}
