/* 层契约：星轨视图六层（axis / gaps / milestones / trees / cards / hub）共用的类型与接口正本。
 * 层与层互不 import，层文件也不得 import 编排者——层不认识 StarStage，建构期的宿主动作
 * （开卡 / 回到原点 / 悬停态回写 / 请帧）全走 BuildCtx 回调，
 * 每帧的显示态全走 place(f: FrameCtx) 单一入参，禁止层回头引用编排者取数据。
 * 整搬自 Obsidian 版 star/layers/frame.ts。 */

import type { RingsLayout } from "../../layout.ts";
import type { Card, TrajectoryModel } from "../../../../core/model/types.ts";
import type { DefsFactory } from "../node-dom.ts";
import type { Theme } from "../theme.ts";

/** 一张卡这一帧的显示坐标：节点先摆、边与树名随后取用。 */
export interface FramePos {
  x: number;
  y: number;
  r: number;
  symbolScale: number;
  ang: number;
}

/** 12 点竖线上注记标签拥挤仲裁的一次报名。 */
export interface LabelClaim {
  r: number;
  prio: number;
  label: SVGElement;
  /** 仲裁后这条标签确实显示时调用（嵌在环里的标签在这里把环断开） */
  onShown?: () => void;
}

/** 节点标签拥挤仲裁的一次报名（全景密度兜底，与 12 点注记仲裁分池）。 */
export interface NodeLabelClaim {
  /** 锚点屏幕坐标（区间重建与行距判定用，画布平移无关） */
  x: number;
  y: number;
  /** 文本锚法（start / middle / end）：区间从锚点向对应方向展开 */
  anchor: string;
  /** 悬停强制显示并占坑，不被挤掉 */
  force: boolean;
  label: SVGElement;
}

/** 每帧一世的上下文：place(f) 唯一入参，层间数据只走这里，层不许回头引用编排者。
 * 宁可字段多，不许层开后门直连 StarStage。 */
export interface FrameCtx {
  /** 1 / view.k：符号层统一按它反补偿到屏幕像素恒定尺寸。 */
  pxToWorld: number;
  /** view.k / fitK：LOD 显隐 = 局部放大率 × 缩放深度。 */
  kRatio: number;
  /** cards 层写、trees/edges 层读：节点先摆、边与树名随后取用。 */
  framePos: Map<string, FramePos>;
  /** 编排者从 chains 算出后灌入：跨日弧向避让角偏，cards 层消费。 */
  dodge: Map<string, number>;
  hoveredCard: Card | null;
  /** 侧栏正在看的卡的身份：cards 层给它加选中标记、标签常显。 */
  selectedId: string | null;
  /** 全部标签开关：无视 LOD 与仲裁全显（重叠也显）。 */
  showAllLabels: boolean;
  /** recolor 走静态着色，place 内仍有随帧态变化的取色（如焦点带边环 / 盘心的贴端点警示色）。 */
  theme: Theme;
  /** 12 点标签拥挤仲裁池（空窗起止 / 周月环 / 年环 / 里程碑各自投递）。 */
  labelClaims: LabelClaim[];
  /** 节点 / 树名标签仲裁池，与 12 点注记仲裁分池。 */
  nodeLabelClaims: NodeLabelClaim[];
}

/** 建构期传入（每轮数据重建一次）：层不认识编排者，交互与宿主动作只走这些回调；
 * layout / model / theme 是建构期一次性注入的只读引用，层可持有到下一轮重建。 */
export interface BuildCtx {
  world: SVGElement;
  /** 珠光渐变与空窗羽化滤镜的 defs 工厂（每轮建画布一个，id 不撞） */
  defs: DefsFactory;
  layout: RingsLayout;
  model: TrajectoryModel;
  theme: Theme;
  /** 开卡页；inNewTab 对应 Ctrl/Cmd+点（宿主决定怎么开）。 */
  openCard(id: string, inNewTab: boolean): void;
  /** 盘心双击：回全景（两段式回到原点的整链）。 */
  goHome(): void;
  /** 读当前悬停卡：节点 mouseleave 只在「还是自己」时才清态，不能只给 setter
   * （setHoveredCard(null) 分不清是谁触发的离开）。 */
  getHoveredCard(): Card | null;
  setHoveredCard(c: Card | null): void;
  /** 是否已越过拖拽判定阈值：hub 的单击开卡要排除「从盘上起手的拖拽」尾梢
   * （节点的点击目前不需要这层守卫，不强加给它）。 */
  hasMoved(): boolean;
  /** 请一帧：补间循环续帧的唯一入口。 */
  kick(): void;
}

/** 一个视觉层：build 建一次 DOM 挂 world、持句柄；place 每帧只改属性（性能纪律，
 * 不做数据驱动 place）；recolor 是着色专属通道（切主题 / 切筛选共用，与 place 内的
 * 帧态取色分工）；stepTweens 是 hover 补间步进（cards / hub 用），返回"还在动"。 */
export interface StarLayer {
  build(ctx: BuildCtx): void;
  place(f: FrameCtx): void;
  recolor?(theme: Theme): void;
  stepTweens?(): boolean;
}
