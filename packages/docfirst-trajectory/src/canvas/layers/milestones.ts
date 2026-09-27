/* 里程碑层：人工指定的关键时刻，金黄细环；名字沿环写在 12 点方向、嵌进环里（环在字的位置断开），
 * 跟日期标签同池避让，悬停出说明。
 * 里程碑数据本身（从根卡正文解析 + inRange 裁剪）归编排者——本层只从 BuildCtx.milestones
 * 拿建好的清单，不认识加载与裁剪逻辑。 */

import { DEG, polar } from "../../layout.ts";
import { dayNum, formatDay } from "../../model.ts";
import type { Milestone } from "../../types.ts";
import { el } from "../node-dom.ts";
import type { Theme } from "../theme.ts";
import type { BuildCtx, FrameCtx, StarLayer } from "./frame.ts";

/** 名字的屏幕字号（px）：字号按 1/缩放 换成世界单位，屏幕上恒定。 */
const LABEL_PX = 10.5;
/** 环在字两侧多断开的屏幕距离（px）。 */
const GAP_PAD_PX = 6;

/** 名字的宽度（按字号计）：全角一个字号宽、半角约 0.58；只用来定环上断口的宽度。 */
function emWidth(s: string): number {
  return [...s].reduce((w, ch) => w + (ch.charCodeAt(0) > 0x2e7f ? 1 : 0.58), 0);
}

/** 里程碑：断开的环 + 走在上半圆路径上的名字。 */
interface MsEl {
  m: Milestone;
  rLin: number;
  ring: SVGElement;
  /** 名字走的上半圆路径（不画出来） */
  arc: SVGElement;
  label: SVGElement;
  /** 名字宽度（字号的倍数） */
  em: number;
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
      const ring = el(
        "path",
        { fill: "none", "stroke-width": 1.2, "vector-effect": "non-scaling-stroke", opacity: 0.35 },
        g,
      );
      const { id, path: arc } = this.ctx.defs.textArc();
      const name = `${formatDay(dayNum(m.date))} ${m.name}`;
      const label = el("text", { class: "msl", opacity: 0.9 }, g);
      const tp = el(
        "textPath",
        { href: `#${id}`, startOffset: "50%", "text-anchor": "middle", "dominant-baseline": "central" },
        label,
      );
      tp.textContent = name;
      el("title", {}, g).textContent = m.desc ? `${m.date} ${m.name}\n${m.desc}` : `${m.date} ${m.name}`;
      return { m, rLin: layout.radiusDay(dayNum(m.date)), ring, arc, label, em: emWidth(name) };
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

  /** 环随鱼眼变形；名字沿环写在 12 点方向——扇环铺满整圈后只有那里留着缝。
   * 字号、描边、路径、断口每帧按当前半径与缩放重算。跟日期标签同池避让，优先级在透镜边界日期（5）
   * 之下、年份（4）之上；同一天的日期标签让给它（名字自带日期）。 */
  private placeMilestones(f: FrameCtx): void {
    const layout = this.ctx.layout;
    const { pxToWorld, labelClaims } = f;
    const fontWorld = LABEL_PX * pxToWorld;
    for (const e of this.milestoneEls) {
      const r = layout.displayRadius(e.rLin);
      /* 名字走的上半圆：从 9 点经 12 点到 3 点，字居中落在 12 点 */
      const left = polar(-90, r);
      const right = polar(90, r);
      e.arc.setAttribute("d", `M${left.x},${left.y} A${r},${r} 0 0 1 ${right.x},${right.y}`);
      e.label.setAttribute("font-size", String(fontWorld));
      e.label.setAttribute("stroke-width", String(3 * pxToWorld));
      /* 环在字的位置断开：断口半角 = (字宽一半 + 两侧留白) / 半径，最多断到半圈 */
      const half = Math.min(90, (((e.em * fontWorld) / 2 + GAP_PAD_PX * pxToWorld) / r) * DEG);
      const a = polar(half, r);
      const b = polar(-half, r);
      e.ring.setAttribute("d", `M${a.x},${a.y} A${r},${r} 0 1 1 ${b.x},${b.y}`);
      labelClaims.push({ r, prio: 4.5, label: e.label });
    }
  }

  recolor(theme: Theme): void {
    for (const e of this.milestoneEls) {
      e.ring.setAttribute("stroke", theme.milestone);
      e.label.setAttribute("fill", theme.milestone);
    }
  }
}
