/* 空窗小行星带层：压缩掉的空窗期折叠成一条雾带，碎石堆填充暗示「时间被跳过」，
 * 起止边界只挂 12 点日期短标签（不画边界线，带沿由雾带自身收边）。
 * 整搬自 Obsidian 版 star/layers/gaps.ts；碎石形态走 layout.ts 的 gapDots（与定妆照同一份公式）。 */

import type { GapBand } from "../../layout.ts";
import { bandFade, gapDots, LOD_MIN, polar, smoothstep } from "../../layout.ts";
import { formatDay } from "../../model.ts";
import { el, text } from "../node-dom.ts";
import type { BuildCtx, FrameCtx, StarLayer } from "./frame.ts";

/** 空窗小行星带的一粒碎石。 */
interface GapDot {
  rLin: number;
  ang: number;
  size: number;
  op: number;
  node: SVGElement;
}

/** 空窗起止边界：12 点日期短标签。 */
interface GapRim {
  rLin: number;
  label: SVGElement;
}

/** 空窗雾带暗底。 */
interface GapBg {
  b: GapBand;
  node: SVGElement;
}

export class GapsLayer implements StarLayer {
  private layer!: SVGElement;
  private dots: GapDot[] = [];
  private rims: GapRim[] = [];
  private bgs: GapBg[] = [];
  /** 建构期注入的只读引用，rebuild() 在 rebake 时重用（layout 实例原地 configure，
   * 不随 rebake 换引用，存一份到下一轮数据重建前都有效）。 */
  private ctx!: BuildCtx;

  build(ctx: BuildCtx): void {
    this.ctx = ctx;
    // 空窗小行星带垫底，其余各层按层叠序依次上
    this.layer = el("g", { "pointer-events": "none" }, ctx.world);
    this.rebuild();
  }

  /** 阈值 / 超长宽改后段清单与折算半径都变，清层重建重烘焙——rebake 时单独调。 */
  rebuild(): void {
    const layout = this.ctx.layout;
    this.layer.textContent = "";
    this.dots = [];
    this.rims = [];
    this.bgs = [];
    let idx = 0;
    layout.gapBands().forEach((b) => {
      /* 雾带：暗底圆挂羽化滤镜，模糊半径随带宽定（线性半径口径；鱼眼变形后带宽走 rr，
       * dev 不跟——软边是世界坐标特征，进焦点带放大后相对更实，恰是「放大看细节」） */
      const w = Math.max(0, layout.radiusDay(b.d1) - layout.radiusDay(b.d0));
      this.bgs.push({
        b,
        node: el(
          "circle",
          {
            cx: 0,
            cy: 0,
            fill: "none",
            class: "gap-bg",
            filter: `url(#${this.ctx.defs.blur(Math.max(3, w * 0.3))})`,
          },
          this.layer,
        ),
      });
      /* 碎石粒序跨带连续累加（gapDots 的哈希吃它），与定妆照逐位相等 */
      const dots = gapDots(layout, b, idx);
      idx += dots.length;
      for (const d of dots) {
        this.dots.push({ ...d, node: el("circle", { fill: "var(--ring-m)" }, this.layer) });
      }
      for (const d of [b.d0, b.d1]) {
        this.rims.push({
          rLin: layout.radiusDay(d),
          /* 短格式：年份归年环承载 */
          label: text(0, 0, formatDay(d), "dl", {}, this.layer),
        });
      }
    });
  }

  /** 空窗小行星带：暗底雾带铺底，碎石半径随鱼眼变形、尺寸随局部放大率胀缩
   * （上限比节点松，进焦点带的胀感要明显），鱼眼态带外随节点同律压淡；
   * 起止边界只剩日期标签挂 12 点（不画任何边界线，带沿由雾带自身收边）。 */
  place(f: FrameCtx): void {
    const layout = this.ctx.layout;
    const strength = layout.strength;
    const pxToWorld = f.pxToWorld;
    for (const gapBg of this.bgs) {
      const ra = layout.displayRadius(layout.radiusDay(gapBg.b.d0));
      const rb = layout.displayRadius(layout.radiusDay(gapBg.b.d1));
      gapBg.node.setAttribute("r", String((ra + rb) / 2));
      gapBg.node.setAttribute("stroke-width", String(Math.max(0, rb - ra)));
    }
    for (const dot of this.dots) {
      const mag = layout.mag(dot.rLin);
      const p = polar(dot.ang, layout.displayRadius(dot.rLin));
      dot.node.setAttribute("cx", String(p.x));
      dot.node.setAttribute("cy", String(p.y));
      dot.node.setAttribute(
        "r",
        String(dot.size * Math.min(3, Math.max(LOD_MIN, Math.sqrt(mag))) * pxToWorld),
      );
      /* 焦点带内提实（放大的碎石要立得住），带外随鱼眼同律压淡 */
      dot.node.setAttribute(
        "opacity",
        String(Math.min(1, dot.op + 0.3 * smoothstep(1.5, 3, mag)) * bandFade(mag, strength)),
      );
    }
    for (const rim of this.rims) {
      const r2 = layout.displayRadius(rim.rLin);
      rim.label.setAttribute(
        "transform",
        `translate(0,${-r2 - 5 * pxToWorld}) scale(${pxToWorld})`,
      );
      f.labelClaims.push({ r: r2, prio: 3, label: rim.label });
    }
  }
}
