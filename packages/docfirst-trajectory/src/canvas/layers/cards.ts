/* 卡层：节点（普通卡）——星轨里交互最重的节点形态，悬停放大补间 / 点击开卡都挂在这层。
 * 整搬自 Obsidian 版 star/layers/cards.ts。
 *
 * 这层是 framePos 的生产者：placeNodes 摆完节点即写 f.framePos（trees 层的
 * placeEdges/placeNames 随后取用），也是跨日弧向避让角偏（f.dodge，编排者从
 * chains 算出后灌入）的消费者。
 *
 * hover 放大补间（节点逐个进出各自趋近）不挂 place() 的每帧重摆——它是
 * tick() 补间循环专属的一段状态步进，收进 stepTweens()，读当前悬停态走
 * BuildCtx.getHoveredCard()（层不持编排者引用）。 */

import {
  bandFade,
  type CardPlace,
  DEG,
  lodOf,
  NODE_RADIUS,
  polar,
  SPREAD_DEG,
  smoothstep,
} from "../../layout.ts";
import { formOf } from "../../model.ts";
import { buildNode, isConclusion, isPanoramaLabel, type NodeEl, spineTipIds } from "../node-dom.ts";
import type { BuildCtx, FrameCtx, StarLayer } from "./frame.ts";

export class CardsLayer implements StarLayer {
  private nodeEls: NodeEl[] = [];
  /** 建构期注入的只读引用 + 交互回调，stepTweens() 读悬停态也靠它
   * （下一轮数据重建前都有效）。 */
  private ctx!: BuildCtx;

  build(ctx: BuildCtx): void {
    this.ctx = ctx;
    this.buildNodes();
  }

  /** 节点：工厂建 DOM、壳绑交互挂载；局部坐标建组，place 里 translate + scale。
   * 根卡不占盘位：盘心正中的根节点就是它（单击开根卡），不再另设节点。 */
  private buildNodes(): void {
    this.nodeEls = [];
    const ctx = this.ctx;
    const { cards, isolated } = ctx.model;
    /* 孤星按身份认：模型经序列化过一趟后 isolated 里的对象与 cards 不共享引用 */
    const isolatedIds = new Set(isolated.map((c) => c.id));
    /* 结论卡（尺寸放大档）：每棵树主干末端那张 */
    const tipIds = spineTipIds(ctx.model.trees);
    const bindNode = (n: NodeEl): void => {
      /* 节点 DOM 随下一轮重建整棵销毁，监听器跟着走 */
      /* 点节点 = 开卡页（宿主决定怎么开）；Ctrl/Cmd+点透传给宿主 */
      n.group.addEventListener("click", (ev) => {
        ctx.openCard(n.card.id, ev.ctrlKey || ev.metaKey);
      });
      n.group.addEventListener("mouseenter", () => {
        ctx.setHoveredCard(n.card);
        ctx.world.appendChild(n.label);
        ctx.kick();
      });
      n.group.addEventListener("mouseleave", () => {
        if (ctx.getHoveredCard() === n.card) ctx.setHoveredCard(null);
        ctx.kick();
      });
      ctx.world.appendChild(n.group);
      ctx.world.appendChild(n.label);
      this.nodeEls.push(n);
    };
    for (const c of cards) {
      bindNode(
        buildNode(
          c,
          formOf(ctx.model, c.id),
          isolatedIds.has(c.id),
          tipIds.has(c.id),
          ctx.typeOf(c.id),
        ),
      );
    }
  }

  /** 节点句柄只读视图：repaint 里与基座 recolor() 合用（筛选态混色）、图例取命中统计分母
   * ——两处都在层外，给最小只读接口。 */
  getNodeEls(): NodeEl[] {
    return this.nodeEls;
  }

  /** hover 放大补间步进（tick() 补间循环专属，不挂每帧重摆的 place()）：节点
   * 逐个进出各自趋近，返回"还在动"供 tick 判定要不要续帧。 */
  stepTweens(): boolean {
    let animating = false;
    const hoveredCard = this.ctx.getHoveredCard();
    for (const n of this.nodeEls) {
      const t = hoveredCard === n.card ? 1 : 0;
      n.hoverTween += (t - n.hoverTween) * 0.25;
      if (Math.abs(t - n.hoverTween) < 0.01) n.hoverTween = t;
      else animating = true;
    }
    return animating;
  }

  /** 节点排在帧内调用序最前（边 / 树名靠 framePos，晚于本层）。 */
  place(f: FrameCtx): void {
    this.placeNodes(f);
  }

  /** 节点：先摆卡、存显示坐标（framePos），边与树名随后用；显名标签投递仲裁池。 */
  private placeNodes(f: FrameCtx): void {
    const { framePos, pxToWorld, kRatio, dodge, hoveredCard, selectedId, showAllLabels, nodeLabelClaims } =
      f;
    const layout = this.ctx.layout;
    const strength = layout.strength;
    /* 盘心世界半径（与 placeHub 同一值）：贴盘心的内圈卡标签要向盘外锚 */
    const hubR = layout.hubWorldR;
    for (const n of this.nodeEls) {
      const c = n.card;
      /* 布局产物表覆盖全部上盘卡，断言非空 */
      const place = layout.places.get(c.id) as CardPlace;
      const r2 = layout.displayRadius(place.rLin);
      const mag = layout.mag(place.rLin);
      const lod = lodOf(mag);
      /* 结论放大档：主干末端在立卡吃 tierMult；乘在 symbolScale 上符号整组放大，
       * 命中区同比跟随，标签锚点偏移（rBase × symbolScale）自动变长 */
      const tier = isConclusion(n.form, n.isTip) ? layout.tierMult : 1;
      /* 世界缩放因子：屏幕尺寸恒定；hover 放大 1.4 倍 */
      const symbolScale = layout.symbolPx * lod * pxToWorld * tier * (1 + 0.4 * n.hoverTween);
      /* 节点屏幕直径 */
      const diamPx = 2 * NODE_RADIUS[n.form] * tier * layout.symbolPx * lod;
      /* 焦点带内才按屏幕弧长挤开；基准角距吃散开乘数（spreadOff 布局侧已乘，除回同基准归一） */
      const gate = smoothstep(1.5, 3, mag);
      const baseDeg = SPREAD_DEG * layout.spreadMult;
      /* r2 * view.k 等价换算：层不持相机引用，f.pxToWorld（= 1/view.k）是契约唯一通道 */
      const needDeg = ((diamPx + 14) / (r2 / pxToWorld)) * DEG;
      const spread = baseDeg + Math.max(0, needDeg - baseDeg) * gate;
      const ang = place.angBase + (dodge.get(c.id) ?? 0) + (place.spreadOff / baseDeg) * spread;
      const p = polar(ang, r2);
      framePos.set(c.id, { x: p.x, y: p.y, r: r2, symbolScale, ang });
      n.group.setAttribute("transform", `translate(${p.x},${p.y}) scale(${symbolScale})`);
      /* 鱼眼态带外压淡、带内全亮（opacity 两主题通用） */
      const dim = bandFade(mag, strength);
      n.group.setAttribute("opacity", String(dim));
      /* 锚点半径压进盘心影响圈（盘沿 + 约一条长标签的净空）的内圈卡：翻成向盘外锚。
       * 只比盘沿多半行的锚点没用——文字本体还要向圆心再伸一条标签宽，照样泡盘心 */
      const rIn = r2 - NODE_RADIUS[n.form] * symbolScale - 6 * pxToWorld;
      const outward = rIn < hubR + 64 * pxToWorld;
      const lp = polar(ang, outward ? r2 + NODE_RADIUS[n.form] * symbolScale + 6 * pxToWorld : rIn);
      const ap = this.anchorLabel(n.label, ang, lp.x, lp.y, pxToWorld, outward);
      const eff = mag * kRatio;
      /* 标签分级：在立的卡全景即显（eff>0.5）——全景读格局；被取代的进鱼眼才显
       * （eff>1.8）——鱼眼读细节。「全部标签」开关无视分级与仲裁全显（人就是要看重叠） */
      const labelGate = isPanoramaLabel(n.form) ? 0.5 : 1.8;
      /* 侧栏正在看的卡：节点加选中标记，标签跟悬停一样常显、先占坑 */
      const selected = selectedId === c.id;
      n.group.setAttribute("class", selected ? "nd star-sel" : "nd");
      if (showAllLabels || hoveredCard === c || selected || eff > labelGate) {
        if (showAllLabels) n.label.style.display = "";
        else
          nodeLabelClaims.push({
            x: ap.x / pxToWorld,
            y: ap.y / pxToWorld,
            anchor: ap.anchor,
            force: hoveredCard === c || selected,
            label: n.label,
          });
      } else {
        n.label.style.display = "none";
      }
    }
  }

  /** 标签四象限锚定：默认锚在节点靠圆心一侧，文字向圆心方向退开、不横穿节点；
   * outward = true 时象限镜像（贴盘心的内圈卡用——向圆心退会泡进盘心，改向外退）。
   * 返回最终锚点世界坐标与文本锚法（节点标签仲裁的区间重建用）。 */
  private anchorLabel(
    label: SVGElement,
    ang: number,
    lx: number,
    ly: number,
    pxToWorld: number,
    outward: boolean,
  ): { x: number; y: number; anchor: string } {
    /* 0 = 正上，顺时针 */
    const normAng = ((ang % 360) + 360) % 360;
    let anchor = "middle";
    let dy = 0;
    if (!outward) {
      if (normAng < 45 || normAng >= 315)
        dy = 9; // 顶部：文字整体下移一行，避开节点
      else if (normAng < 135) {
        anchor = "end"; // 右侧：右对齐，向圆心（左）延伸
        dy = 3.5;
      } else if (normAng < 225)
        dy = -2; // 底部：文字在锚点上方，自然远离节点
      else {
        anchor = "start"; // 左侧：左对齐，向圆心（右）延伸
        dy = 3.5;
      }
    } else {
      if (normAng < 45 || normAng >= 315)
        dy = -10; // 顶部：文字抬到节点上方（向外）
      else if (normAng < 135) {
        anchor = "start"; // 右侧：左对齐，向外（右）延伸
        dy = 3.5;
      } else if (normAng < 225)
        dy = 10; // 底部：文字压到节点下方（向外）
      else {
        anchor = "end"; // 左侧：右对齐，向外（左）延伸
        dy = 3.5;
      }
    }
    label.style.textAnchor = anchor;
    const ay = ly + dy * pxToWorld;
    label.setAttribute("transform", `translate(${lx},${ay}) scale(${pxToWorld})`);
    return { x: lx, y: ay, anchor };
  }
}
