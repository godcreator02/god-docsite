/* 里程碑层：人工指定的关键时刻，金黄细环；名字沿环写在 12 点方向、嵌进环里（环在字的位置断开），
 * 跟日期标签同池避让，悬停出说明。
 * 里程碑数据本身（从根卡正文解析 + inRange 裁剪）归编排者——本层只从 BuildCtx.milestones
 * 拿建好的清单，不认识加载与裁剪逻辑。 */

import { dayNum, formatDay } from "../../model.ts";
import type { Milestone } from "../../types.ts";
import { el } from "../node-dom.ts";
import { RingLabel } from "../ring-label.ts";
import type { Theme } from "../theme.ts";
import type { BuildCtx, FrameCtx, StarLayer } from "./frame.ts";

/** 名字的屏幕字号（px）。 */
const LABEL_PX = 10.5;

/** 里程碑：环 + 嵌在环里的名字。 */
interface MsEl {
  m: Milestone;
  rLin: number;
  rl: RingLabel;
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

  private buildMilestones(): void {
    const layout = this.ctx.layout;
    this.milestoneEls = this.ctx.milestones.map((m) => {
      const g = el("g", {}, this.ctx.world);
      /* 细实线退淡：注记不抢内容戏 */
      const rl = new RingLabel(
        this.ctx.defs,
        g,
        { "stroke-width": 1.2, "vector-effect": "non-scaling-stroke", opacity: 0.35 },
        "msl",
        LABEL_PX,
      );
      rl.label.setAttribute("opacity", "0.9");
      rl.setText(`${formatDay(dayNum(m.date))} ${m.name}`);
      el("title", {}, g).textContent = m.desc ? `${m.date} ${m.name}\n${m.desc}` : `${m.date} ${m.name}`;
      return { m, rLin: layout.radiusDay(dayNum(m.date)), rl };
    });
  }

  /** 世界尺度参数变更（rebake）重烘焙：里程碑集合不变，变的只是 layout 的
   * 日期→半径折算表，故只重算既有元素的 rLin、不增删元素。 */
  rebake(): void {
    const layout = this.ctx.layout;
    for (const e of this.milestoneEls) e.rLin = layout.radiusDay(dayNum(e.m.date));
  }

  /** 环随鱼眼变形；名字沿环写在 12 点方向——扇环铺满整圈后只有那里留着缝。
   * 跟日期标签同池避让，优先级在透镜边界日期（5）之下、年份（4）之上；同一天的日期标签让给它
   * （名字自带日期）。名字确实显示时环才在字的位置断开。 */
  place(f: FrameCtx): void {
    const layout = this.ctx.layout;
    for (const e of this.milestoneEls) {
      const r = layout.displayRadius(e.rLin);
      e.rl.place(r, r, f.pxToWorld);
      f.labelClaims.push({ r, prio: 4.5, label: e.rl.label, onShown: () => e.rl.embed() });
    }
  }

  recolor(theme: Theme): void {
    for (const e of this.milestoneEls) {
      e.rl.ring?.setAttribute("stroke", theme.milestone);
      e.rl.label.setAttribute("fill", theme.milestone);
    }
  }
}
