/* 标签仲裁器：星轨盘上两池拥挤裁决——12 点注记（空窗起止 / 周月环 / 年环 / 里程碑）、
 * 节点 / 树名密度兜底，两池互不干扰、各自一套判定。
 * labelWidth 的文本宽缓存生命周期与视图同长，故仲裁器建一份实例、随视图存活。 */

import type { LabelClaim, NodeLabelClaim } from "./layers/frame.ts";

export class LabelArbiter {
  /** 标签文本宽缓存：文本内容不变，量一次终身用；WeakMap 随元素回收。 */
  private labelW = new WeakMap<SVGElement, number>();

  /** 标签屏幕宽：getComputedTextLength 量真值，量不出（display:none 等）按字符估。 */
  private labelWidth(el: SVGElement): number {
    const hit = this.labelW.get(el);
    if (hit !== undefined) return hit;
    let w = 0;
    try {
      w = (el as SVGTextElement).getComputedTextLength();
    } catch {
      w = 0;
    }
    if (!w) {
      /* 全角按 .lb 字号 10.5、半角约 5.8 估 */
      w = [...(el.textContent ?? "")].reduce(
        (s, ch) => s + (ch.charCodeAt(0) > 0x2e7f ? 10.5 : 5.8),
        0,
      );
    }
    this.labelW.set(el, w);
    return w;
  }

  /** 拥挤仲裁：12 点竖线上的注记（空窗起止 / 周月环 / 年环 / 里程碑）按调用方排好的优先级
   * 贪心占位，屏幕间距不足 14px 的后来者让隐；留下来的调它的 onShown。 */
  arbitrate(claims: LabelClaim[], pxToWorld: number): void {
    const taken: number[] = [];
    const minGap = 14 * pxToWorld;
    for (const c of claims) {
      const ok = !taken.some((y) => Math.abs(y - c.r) < minGap);
      c.label.style.display = ok ? "" : "none";
      if (ok) {
        taken.push(c.r);
        c.onShown?.();
      }
    }
  }

  /** 节点标签拥挤仲裁：先到先得（报名序 = 建构序，逐帧稳定不闪）。判定按真实文本区间
   * 而不是锚点圆距——长标签锚点离得再远、本体照样叠；行距不足 14px 且横向区间相交
   * 的后来者让隐。悬停标签先占坑。「全部标签」开启时根本不进仲裁池。 */
  arbitrateNodeLabels(claims: NodeLabelClaim[]): void {
    /* 锚点 + 锚法重建文本横向区间（屏幕 px） */
    const spanOf = (c: NodeLabelClaim): [number, number] => {
      const w = this.labelWidth(c.label);
      if (c.anchor === "start") return [c.x, c.x + w];
      if (c.anchor === "end") return [c.x - w, c.x];
      return [c.x - w / 2, c.x + w / 2];
    };
    const taken: { lo: number; hi: number; y: number }[] = [];
    const free = (c: NodeLabelClaim): boolean => {
      const [lo, hi] = spanOf(c);
      return !taken.some((t) => Math.abs(t.y - c.y) < 14 && lo - 3 < t.hi && t.lo - 3 < hi);
    };
    for (const c of claims) {
      if (!c.force) continue;
      c.label.style.display = "";
      const [lo, hi] = spanOf(c);
      taken.push({ lo, hi, y: c.y });
    }
    for (const c of claims) {
      if (c.force) continue;
      const ok = free(c);
      c.label.style.display = ok ? "" : "none";
      if (ok) {
        const [lo, hi] = spanOf(c);
        taken.push({ lo, hi, y: c.y });
      }
    }
  }
}
