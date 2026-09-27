/* 盘心层：世界锚定圆盘（填充兼遮穿盘连线）+ 正中根节点（项目根卡唯一上盘形态，
 * 屏径恒定）+ 项目名（根卡 label）排印根节点下方。整搬自 Obsidian 版 star/layers/hub.ts。
 *
 * 层叠序注记：build() 排在 trees 层 buildBoxes/buildEdges 之后、buildNames 之前——
 * 边先画完（盘心填充兼遮穿盘连线，不能撤），树名再叠盘心之上；place() 排在管线最末
 * （警示环状态取本帧 focusDay/strength，须晚于其余半径依赖元素摆完）。
 *
 * 盘面不接指针，交互全收窄到正中根节点：单击开根卡（hasMoved 守卫排除从盘上起手的
 * 拖拽尾梢，延迟一拍让双击有机会截住）、双击回全景、hover 同款 1.4 倍放大。
 * 悬停态（isHubHovered）与放大补间（hubHoverTween）自持——根节点悬停态只有本层的
 * stepTweens/place 读，不必经 BuildCtx 开回调后门。 */

import { ROOT_RADIUS, smoothstep } from "../../layout.ts";
import { el, text } from "../node-dom.ts";
import type { Theme } from "../theme.ts";
import type { BuildCtx, FrameCtx, StarLayer } from "./frame.ts";

/** 单击开卡的判定窗（毫秒）：窗内再来一击算双击，改走回全景。 */
const CLICK_DELAY = 250;

/** 盘心标题在模型没认出根卡（卡目录里根卡不是恰好一张）时显示的字。 */
const NO_ROOT_TITLE = "未认出根卡";

export class HubLayer implements StarLayer {
  private hubG!: SVGElement;
  private hubC!: SVGElement;
  private hubRoot!: SVGElement;
  private hubTitle!: SVGElement;
  private hubStatus!: SVGElement;
  /** 根节点悬停态与补间（0→1）：与节点同款 1 + 0.4×hv 放大手感。build() 重建时自清
   * （新一轮 DOM 悬停态无意义留旧值）。 */
  private isHubHovered = false;
  private hubHoverTween = 0;
  /** 单击判定窗句柄：双击进来就清掉，单击的开卡不再发生。 */
  private clickTimer: ReturnType<typeof setTimeout> | null = null;
  /** 建构期注入的只读引用 + 交互回调，stepTweens()/place() 读 layout/model 也靠它
   * （下一轮数据重建前都有效）。 */
  private ctx!: BuildCtx;

  build(ctx: BuildCtx): void {
    this.ctx = ctx;
    this.isHubHovered = false;
    this.hubHoverTween = 0;
    if (this.clickTimer !== null) clearTimeout(this.clickTimer);
    this.clickTimer = null;
    this.buildHub();
  }

  private buildHub(): void {
    const ctx = this.ctx;
    this.hubG = el("g", { class: "hubg" }, ctx.world);
    this.hubC = el(
      "circle",
      {
        cx: 0,
        cy: 0,
        r: ctx.layout.hubWorldR,
        "stroke-width": 1.2,
        "vector-effect": "non-scaling-stroke",
        "pointer-events": "none",
      },
      this.hubG,
    );
    /* 根节点：盘心正中的圆点 = 项目根卡（根卡唯一上盘形态）。屏径恒定与其他节点同律，
     * place 每帧按 pxToWorld 重设半径；单击开根卡、双击回全景、hover 同款 1.4 倍放大 */
    this.hubRoot = el(
      "circle",
      {
        cx: 0,
        cy: 0,
        r: ROOT_RADIUS,
        "stroke-width": 1.2,
        "vector-effect": "non-scaling-stroke",
        class: "hub-root",
      },
      this.hubG,
    );
    el("title", {}, this.hubRoot).textContent = `${ctx.model.root?.label ?? NO_ROOT_TITLE} · 根卡`;
    /* 监听器随 DOM 重建销毁（与节点同款生命周期）；hasMoved 守卫排除从盘上起手的拖拽尾梢；
     * 单击延迟一拍：判定窗内来第二击就是双击，走回全景、不开卡 */
    this.hubRoot.addEventListener("click", (ev) => {
      if (ctx.hasMoved()) return;
      const proot = ctx.model.root;
      if (!proot) return;
      const inNewTab = ev.ctrlKey || ev.metaKey;
      if (this.clickTimer !== null) clearTimeout(this.clickTimer);
      this.clickTimer = setTimeout(() => {
        this.clickTimer = null;
        ctx.openCard(proot.id, inNewTab);
      }, CLICK_DELAY);
    });
    this.hubRoot.addEventListener("dblclick", () => {
      if (this.clickTimer !== null) clearTimeout(this.clickTimer);
      this.clickTimer = null;
      ctx.goHome();
    });
    this.hubRoot.addEventListener("mouseenter", () => {
      this.isHubHovered = true;
      ctx.kick();
    });
    this.hubRoot.addEventListener("mouseleave", () => {
      this.isHubHovered = false;
      ctx.kick();
    });
    this.hubTitle = text(
      0,
      0,
      /* 项目名读根卡 label（项目短名），排印在根节点下方；盘心不背状态行
       * （卡 schema 无 status 字段） */
      ctx.model.root?.label ?? NO_ROOT_TITLE,
      "hub-t",
      { "text-anchor": "middle" },
      this.hubG,
    );
    this.hubStatus = text(0, 0, "", "hub-s", { "text-anchor": "middle" }, this.hubG);
  }

  /** hover 放大补间步进（tick() 补间循环专属，不挂每帧重摆的 place()）：根节点同款
   * 1 + 0.4×hv 手感，趋近目标态，返回"还在动"供 tick 判定要不要续帧。 */
  stepTweens(): boolean {
    const t = this.isHubHovered ? 1 : 0;
    this.hubHoverTween += (t - this.hubHoverTween) * 0.25;
    if (Math.abs(t - this.hubHoverTween) < 0.01) {
      this.hubHoverTween = t;
      return false;
    }
    return true;
  }

  /** 盘心：世界锚定圆盘 + 正中根节点（屏径恒定）+ 项目名（根卡 label）排印根节点
   * 下方；贴近时间轴端点时警示环渐显（距端点 2 天内渐变、同色不分顶底）。 */
  place(f: FrameCtx): void {
    const { pxToWorld, theme } = f;
    const layout = this.ctx.layout;
    const { day0, dayMax } = this.ctx.model;
    const strength = layout.strength;
    const focusDay = layout.focusDay;
    /* 盘心世界锚定：半径 = innerR − HUB_RIM（hubWorldR），随视图缩放，第一环恒贴盘沿；
     * 占比 = (hubBase − HUB_RIM) / (maxR + 60)——maxR 只随 hubR 变、不随数据深浅变
     * （时间轴环带世界深度定死 AXIS_SPAN），同一 hubBase 下跨项目恒等。世界半径
     * 每帧重设，innerR 只在重 bake 时变 */
    this.hubC.setAttribute("r", String(layout.hubWorldR));
    /* 盘心边平时不画（外面紧贴着第一天的日期环，画出来就是两道环），
     * 只在透镜贴近时间轴端点时用警示色渐显 */
    const distEnd = Math.min(focusDay - day0, dayMax - focusDay);
    const warnT = strength * (1 - smoothstep(0, 2, distEnd));
    this.hubC.setAttribute("stroke", theme.warn);
    this.hubC.setAttribute("stroke-opacity", String(warnT));
    /* 根节点屏径恒定（与其他节点同一 pxToWorld 律）：不跟盘心世界锚定——推进鱼眼时盘心环等比
     * 放大，根节点若跟着走会远超其他节点；吃 symbolPx 与节点尺寸设置联动，
     * hover 放大 1.4 倍与节点同款手感 */
    const dotR = ROOT_RADIUS * layout.symbolPx * pxToWorld * (1 + 0.4 * this.hubHoverTween);
    this.hubRoot.setAttribute("r", String(dotR));
    /* 侧栏正在看根卡：根节点加选中标记 */
    const rootSelected = f.selectedId !== null && f.selectedId === this.ctx.model.root?.id;
    this.hubRoot.setAttribute("class", rootSelected ? "hub-root star-sel" : "hub-root");
    /* 盘心只留项目名：鱼眼态的内外圈日期在焦点带边环（axis 层 placeBandEdges），
     * 端点警示由盘心描边环 + 边环标签后缀两个通道分担；状态行只剩全景空盘的一句提示 */
    this.hubStatus.textContent =
      strength < 0.01 && !this.ctx.model.cards.length ? "还没有记录" : "";
    /* 标题 / status 排印根节点下方，两行排版相对关系不变（twoLine 时标题让位上半行）。
     * status 非空（空盘提示）才是两行排版；绝大多数时候 status 是空串。
     * 项目名屏径恒定（scale pxToWorld，与 .lb 同律），不跟盘等比放大；
     * 纵向基准跟根节点走（dotR 含 pxToWorld 与 hover 放大），缩放时文字始终贴点下、不压点 */
    const twoLine = !!this.hubStatus.textContent;
    const base = dotR + 13 * pxToWorld;
    this.hubTitle.setAttribute(
      "transform",
      `translate(0,${base - (twoLine ? 8 : 0) * pxToWorld}) scale(${pxToWorld})`,
    );
    this.hubStatus.setAttribute(
      "transform",
      `translate(0,${base + 10 * pxToWorld}) scale(${pxToWorld})`,
    );
  }

  /** 着色：切主题 / 切筛选共用（盘心边的颜色随帧态变，归 place 的警示环那段）。 */
  recolor(theme: Theme): void {
    this.hubC.setAttribute("fill", theme.hubFill);
    /* 根节点：实心亮点加一道描边 */
    this.hubRoot.setAttribute("fill", theme.hubRoot);
    this.hubRoot.setAttribute("stroke", theme.hubStroke);
  }
}
