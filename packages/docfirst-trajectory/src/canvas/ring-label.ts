/* 嵌在环里的标签：12 点方向的注记（日期、年份、最新一天、透镜边界日期、里程碑名字）沿环写，
 * 环在字的位置断开。环先按整圈画，12 点标签仲裁完、确定这条标签显示了，才把环断开——
 * 标签被让掉时环不留空口。字号按 1/缩放 换成世界单位，屏幕上恒定。 */

import { DEG, polar } from "../layout.ts";
import { el } from "./node-dom.ts";
import type { DefsFactory } from "./node-dom.ts";

/** 环在字两侧多断开的屏幕距离（px）。 */
const GAP_PAD_PX = 5;
/** 字的衬底描边宽（屏幕 px，只对带描边样式的标签类起作用）。 */
const HALO_PX = 3;

/** 字的宽度（按字号计）：全角一个字号宽、半角约 0.58；只用来定环上断口的宽度。 */
function emWidth(s: string): number {
  return [...s].reduce((w, ch) => w + (ch.charCodeAt(0) > 0x2e7f ? 1 : 0.58), 0);
}

/** 半径 r 的圆，12 点方向留出 ±halfDeg 的缺口；halfDeg ≤ 0 画整圈。 */
export function ringPath(r: number, halfDeg: number): string {
  if (halfDeg <= 0) {
    const top = polar(0, r);
    const bottom = polar(180, r);
    return `M${top.x},${top.y} A${r},${r} 0 1 1 ${bottom.x},${bottom.y} A${r},${r} 0 1 1 ${top.x},${top.y}`;
  }
  const a = polar(Math.min(90, halfDeg), r);
  const b = polar(-Math.min(90, halfDeg), r);
  return `M${a.x},${a.y} A${r},${r} 0 1 1 ${b.x},${b.y}`;
}

export class RingLabel {
  /** 环（没有环线的注记为 null，只让字沿弧写） */
  readonly ring: SVGElement | null;
  readonly label: SVGElement;
  private readonly tp: SVGElement;
  private readonly arc: SVGElement;
  private readonly fontPx: number;
  private em = 0;
  /* 本帧的几何：embed() 用 */
  private rRing = 0;
  private rText = 0;
  private pxToWorld = 1;

  /** ring：环的属性（class、线宽等），null = 不画环；labelClass：字的样式类；fontPx：屏幕字号。 */
  constructor(
    defs: DefsFactory,
    parent: SVGElement,
    ring: Record<string, string | number> | null,
    labelClass: string,
    fontPx: number,
  ) {
    this.ring = ring ? el("path", { fill: "none", ...ring }, parent) : null;
    const { id, path } = defs.textArc();
    this.arc = path;
    this.label = el("text", { class: labelClass }, parent);
    this.tp = el(
      "textPath",
      { href: `#${id}`, startOffset: "50%", "text-anchor": "middle", "dominant-baseline": "central" },
      this.label,
    );
    this.fontPx = fontPx;
  }

  setRingOpacity(v: number): void {
    this.ring?.setAttribute("opacity", String(v));
  }

  setText(s: string): void {
    if (this.tp.textContent === s) return;
    this.tp.textContent = s;
    this.em = emWidth(s);
  }

  /** 每帧：环画成整圈（半径 rRing），字沿半径 rText 的上半圆居中写在 12 点。 */
  place(rRing: number, rText: number, pxToWorld: number): void {
    this.rRing = rRing;
    this.rText = rText;
    this.pxToWorld = pxToWorld;
    this.ring?.setAttribute("d", ringPath(rRing, 0));
    const left = polar(-90, rText);
    const right = polar(90, rText);
    this.arc.setAttribute("d", `M${left.x},${left.y} A${rText},${rText} 0 0 1 ${right.x},${right.y}`);
    this.label.style.fontSize = `${this.fontPx * pxToWorld}px`;
    this.label.style.strokeWidth = `${HALO_PX * pxToWorld}px`;
  }

  /** 仲裁后这条标签确实显示：环在字的位置断开（字不在环上时不断）。 */
  embed(): void {
    if (!this.ring || this.rText !== this.rRing) return;
    const fontWorld = this.fontPx * this.pxToWorld;
    const half = (((this.em * fontWorld) / 2 + GAP_PAD_PX * this.pxToWorld) / this.rRing) * DEG;
    this.ring.setAttribute("d", ringPath(this.rRing, half));
  }
}
