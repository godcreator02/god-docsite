/* 树结构层：扇环框（装箱地盘视觉化）+ 树名（扇环外缘）+ 取代 / 转向两种边——
 * 树的地盘与连线，三件共享"树"这条组织维度而非某个具体交互。
 * 整搬自 Obsidian 版 star/layers/trees.ts。
 *
 * 这层是 framePos 的消费者：placeEdges/placeNames 从 f.framePos 取节点显示坐标（cards 层填）。
 *
 * 层叠序注记：build 序为 buildBoxes → buildEdges → hub 层 → buildNames → cards 层——
 * buildBoxes/buildEdges 紧邻，但 buildNames 被 hub 层夹断，不能合成一次 build 调用。
 * build() 只建 boxEls/edgeEls（满足 StarLayer 接口，层叠序排在 hub 之前）；buildNames 住
 * 公开方法 buildNamesLayer()，由编排者在 hub 层 build 之后原位调用，保证 DOM 插入序（层叠序）。
 *
 * 帧内调用序同款被夹断：placeEdges 排在 cards 层节点 / 虫洞摆放之后、gaps/axis/milestones
 * 三层 place 之前；placeBoxes/placeNames 排在三层之后、hub 之前。place(f) 只摆 edgeEls；
 * placeBoxes/placeNames 住公开方法 placeRest(f)，由编排者在三层 place 之后原位调用。 */

import {
  bandFade,
  type CardPlace,
  DEG,
  NODE_RADIUS,
  polar,
  type TreeBox,
} from "../../layout.ts";
import { formOf } from "../../model.ts";
import type { EdgeEl } from "../node-dom.ts";
import { el, text } from "../node-dom.ts";
import type { Theme } from "../theme.ts";
import type { BuildCtx, FrameCtx, FramePos, StarLayer } from "./frame.ts";

/** 扇环框 / 树名各挂一份树的地盘。 */
interface BoxEl {
  box: TreeBox;
  node: SVGElement;
}

export class TreesLayer implements StarLayer {
  private boxEls: BoxEl[] = [];
  private edgeEls: EdgeEl[] = [];
  private nameEls: BoxEl[] = [];
  /** 建构期注入的只读引用，buildNamesLayer()/rebake() 在下一轮数据重建前都有效
   * （layout 实例原地 configure，不随 rebake 换引用）。 */
  private ctx!: BuildCtx;

  /** 只建扇环框 + 边（层叠序排在 hub 之前）——满足 StarLayer 接口；树名见 buildNamesLayer()。 */
  build(ctx: BuildCtx): void {
    this.ctx = ctx;
    this.buildBoxes();
    this.buildEdges();
  }

  /** 扇环框：装箱地盘视觉化（内弧-径线-外弧-径线），内外相邻的两组不再误读成一条链。 */
  private buildBoxes(): void {
    this.boxEls = this.ctx.layout.treeBoxes.map((box) => ({
      box,
      node: el(
        "path",
        { "stroke-width": 1, "vector-effect": "non-scaling-stroke" },
        this.ctx.world,
      ),
    }));
  }

  /** 边（几何每帧重算；颜色由基座 recolor 刷）：两种边都画——转向卡跟源卡同树同扇环，
   * 连线短程不穿盘；取代边细实线取旧卡领域色、转向边铜绿点线，都不带箭头
   * （半径即时间，方向天然给定）。 */
  private buildEdges(): void {
    this.edgeEls = [];
    const layout = this.ctx.layout;
    const { byId, compOf, edges, trees } = this.ctx.model;
    const inTree = (from: string, to: string): boolean => compOf[from] === compOf[to];
    const buildEdge = (e: { from: string; to: string; kind: string }): void => {
      const source = byId[e.from];
      const target = byId[e.to];
      if (!source || !target) return;
      /* 布局产物表覆盖全部卡，此处及以下同类解引用一律断言非空 */
      const sameDay =
        (layout.places.get(source.id) as CardPlace).rLin ===
        (layout.places.get(target.id) as CardPlace).rLin;
      const isPivot = e.kind === "pivot";
      /* 取代边实线、转向边点线；线宽与虚线段都走 non-scaling-stroke，屏幕像素恒定 */
      const attrs: Record<string, string | number> = {
        fill: "none",
        "stroke-width": 1,
        "vector-effect": "non-scaling-stroke",
      };
      if (isPivot) {
        attrs["stroke-dasharray"] = "2 3";
        attrs["stroke-linecap"] = "round";
      }
      const node = el(sameDay ? "path" : "line", attrs, this.ctx.world);
      this.edgeEls.push({
        kind: sameDay ? "arc" : "line",
        source,
        target,
        node,
        isPivot,
        /* 转向线细一档、点线更疏，透明度给高半档才跟取代边一样看得见 */
        baseOpacity: isPivot ? 0.5 : 0.45,
      });
    };
    for (const t of trees) {
      const own = (e: { from: string; to: string }): boolean =>
        inTree(e.from, e.to) && t.ids.includes(e.from);
      const byDate = (x: { from: string }, y: { from: string }): number =>
        (byId[x.from]?.bornAt ?? "").localeCompare(byId[y.from]?.bornAt ?? "");
      for (const e of edges.filter((e) => e.kind === "supersede" && own(e)).sort(byDate)) {
        buildEdge(e);
      }
      for (const e of edges.filter((e) => e.kind === "pivot" && own(e)).sort(byDate)) {
        buildEdge(e);
      }
    }
  }

  /** 树名：扇环外缘——调用序紧跟在 hub 层 build 之后，编排者需在那个位置原样调用本方法。 */
  buildNamesLayer(): void {
    this.nameEls = this.ctx.layout.treeBoxes.map((box) => ({
      box,
      node: text(0, 0, box.name, "tag", { "text-anchor": "middle" }, this.ctx.world),
    }));
  }

  /** 边句柄只读视图：repaint 里与 nodeEls（cards 层）合并调基座 recolor()
   * （边色随两端节点 muted 态派生，这道跨层耦合线原样保留，不生编两处状态）。 */
  getEdgeEls(): EdgeEl[] {
    return this.edgeEls;
  }

  /** 世界尺度参数变更（rebake）重烘焙：bake 重建了 treeBoxes 数组，boxEls / nameEls
   * 手里攥的还是上一轮的对象——bake 按 model.trees 保序生成，按下标重接即可
   * （节点 places 与边两端的 rLin 都是每帧现取 Map，不受影响）。 */
  rebake(): void {
    this.ctx.layout.treeBoxes.forEach((box, i) => {
      const b = this.boxEls[i];
      const n = this.nameEls[i];
      if (b) b.box = box;
      if (n) n.box = box;
    });
  }

  /** 只摆边（帧内调用序排在 cards 层节点 / 虫洞摆放之后、gaps/axis/milestones 三层 place
   * 之前）——满足 StarLayer 接口；扇环框 / 树名见 placeRest()。 */
  place(f: FrameCtx): void {
    this.placeEdges(f);
  }

  /** 边：端点通则——起止于节点边缘外固定屏幕间隙（不扎进节点）；两种几何各按自己退距，
   * 挨得太近的两颗按比例压缩退距，宁可留根短须也别整条丢掉。悬停一端的边提亮。 */
  private placeEdges(f: FrameCtx): void {
    const { framePos, pxToWorld, hoveredCard } = f;
    const layout = this.ctx.layout;
    const strength = layout.strength;
    const model = this.ctx.model;
    for (const e of this.edgeEls) {
      const a = framePos.get(e.source.id) as FramePos;
      const b = framePos.get(e.target.id) as FramePos;
      /* 退距 = 节点显示半径（symbolScale 已含形态档与结论放大档）+ 2px 净空 */
      let ia = NODE_RADIUS[formOf(model, e.source.id)] * a.symbolScale + 2 * pxToWorld;
      let ib = NODE_RADIUS[formOf(model, e.target.id)] * b.symbolScale + 2 * pxToWorld;
      /* 两端退距吃光整段就按比例压缩；连 1.2px 都不剩才判它画不出来 */
      const keep = 1.2 * pxToWorld;
      const fit = (span: number): boolean => {
        if (span <= keep) return false;
        if (ia + ib + keep > span) {
          const s = (span - keep) / (ia + ib);
          ia *= s;
          ib *= s;
        }
        return true;
      };
      let drawn: boolean;
      if (e.kind === "arc") {
        /* 同日边：沿环走弧，退距按弧长判定后换算成角度 */
        const dth = b.ang - a.ang;
        const sg = dth >= 0 ? 1 : -1;
        drawn = fit((Math.abs(dth) / DEG) * a.r);
        if (drawn) {
          const pa = polar(a.ang + sg * (ia / a.r) * DEG, a.r);
          const pb = polar(b.ang - sg * (ib / b.r) * DEG, b.r);
          e.node.setAttribute(
            "d",
            `M${pa.x},${pa.y} A${a.r},${a.r} 0 0 ${sg > 0 ? 1 : 0} ${pb.x},${pb.y}`,
          );
        }
      } else {
        /* 跨日边：沿弦缩进 */
        const len = Math.hypot(b.x - a.x, b.y - a.y);
        drawn = fit(len);
        if (drawn) {
          const ux = (b.x - a.x) / len;
          const uy = (b.y - a.y) / len;
          e.node.setAttribute("x1", String(a.x + ux * ia));
          e.node.setAttribute("y1", String(a.y + uy * ia));
          e.node.setAttribute("x2", String(b.x - ux * ib));
          e.node.setAttribute("y2", String(b.y - uy * ib));
        }
      }
      const rLinA = (layout.places.get(e.source.id) as CardPlace).rLin;
      const rLinB = (layout.places.get(e.target.id) as CardPlace).rLin;
      const edgeMag = Math.max(layout.mag(rLinA), layout.mag(rLinB));
      /* 悬停一端：这条边提到 0.9，跟着领域色一起跳出来 */
      const hot =
        hoveredCard !== null &&
        (hoveredCard.id === e.source.id || hoveredCard.id === e.target.id);
      const base = drawn ? (hot ? 0.9 : e.baseOpacity) : 0;
      e.node.setAttribute("opacity", String(base * bandFade(edgeMag, strength, 0.5)));
    }
  }

  /** 扇环框 + 树名——调用序紧跟在 gaps/axis/milestones 三层 place 之后，编排者需在
   * 那个位置原样调用本方法（树名依赖本帧 framePos，必须晚于 cards 层节点摆放）。 */
  placeRest(f: FrameCtx): void {
    this.placeBoxes();
    this.placeNames(f);
  }

  /** 扇环框：弧半径走 displayRadius() 随鱼眼变形，径向两端各放 16 世界单位余量包住节点。 */
  private placeBoxes(): void {
    const layout = this.ctx.layout;
    for (const b of this.boxEls) {
      const box = b.box;
      const r0 = Math.max(layout.innerR, layout.displayRadius(box.rMin) - 16);
      const r1 = layout.displayRadius(box.rMax) + 16;
      const large = box.th1 - box.th0 > 180 ? 1 : 0;
      const p0 = polar(box.th0, r0);
      const p1 = polar(box.th1, r0);
      const p2 = polar(box.th1, r1);
      const p3 = polar(box.th0, r1);
      b.node.setAttribute(
        "d",
        `M${p0.x},${p0.y} A${r0},${r0} 0 ${large} 1 ${p1.x},${p1.y} ` +
          `L${p2.x},${p2.y} A${r1},${r1} 0 ${large} 0 ${p3.x},${p3.y} Z`,
      );
    }
  }

  /** 树名：扇环外弧上方（屏幕 22px 间隙 + 字号反补偿）；依赖本帧 framePos，必须晚于节点摆放。 */
  private placeNames(f: FrameCtx): void {
    const { framePos, pxToWorld, nodeLabelClaims } = f;
    for (const nameEl of this.nameEls) {
      const rT =
        Math.max(...nameEl.box.tree.ids.map((i) => (framePos.get(i) as FramePos).r)) +
        22 * pxToWorld;
      const p = polar(nameEl.box.angMid, rT);
      nameEl.node.setAttribute("transform", `translate(${p.x},${p.y}) scale(${pxToWorld})`);
      /* 树名与节点标签同池仲裁、排在节点与虫洞之后（报名晚）——撞车时树名让隐 */
      nodeLabelClaims.push({
        x: p.x / pxToWorld,
        y: p.y / pxToWorld,
        anchor: "middle",
        force: false,
        label: nameEl.node,
      });
    }
  }

  recolor(theme: Theme): void {
    this.recolorBoxes(theme);
  }

  private recolorBoxes(theme: Theme): void {
    for (const b of this.boxEls) {
      b.node.setAttribute("stroke", theme.boxStroke);
      b.node.setAttribute("fill", theme.boxFill);
    }
  }
}
