/* 手感参数——语义值（设置面板滑杆上看到的数）与它们灌进布局引擎的换算。
 * 整搬自 Obsidian 版 settings.ts + star/settings-panel.ts：存的是语义值（oldSharePct 存 3
 * 而不是 0.03），语义值→内部值的换算收口在 applyStoredSettings 与项目表的 apply / patch 一处。
 * 滑杆本体由 React 壳按 SETTING_ITEMS 渲，本文件不出 DOM。 */

import type { LayoutPatch, RingsLayout } from "../layout.ts";

/** 星轨手感参数：全部语义值，与设置面板滑杆同口径。 */
export interface TrajectorySettings {
  /** 焦点带天数（窗宽即带宽，方向盘在日期轨上，面板不设滑杆） */
  focusDays: number;
  /** 内环（旧压缩）百分比 */
  oldSharePct: number;
  /** 外环（新压缩）百分比 */
  newSharePct: number;
  /** 盘心大小：时间轴内界 innerR 直接取此值（盘心世界半径 = hubSize − HUB_RIM）。
   * 环带世界深度定死（AXIS_SPAN）后 maxR 只随它变，适配态盘心占比是它的纯函数 */
  hubSize: number;
  /** 空窗阈值（天） */
  gapFree: number;
  /** 超长空档宽（天） */
  gapWide: number;
  /** 节点大小系数 */
  symbolPx: number;
  /** 节点散开乘数（同日串珠角距，纯角度口径——内环同角弧长短、允许略挤） */
  spreadMult: number;
  /** 结论放大乘数（每棵树主干末端那张在立卡吃放大档；
   * 1 = 关闭分级全员同大；纯屏幕尺寸口径，不进装箱） */
  tierMult: number;
  /** 动画速度（补间趋近系数） */
  ease: number;
}

/** 默认值：存档空手或字段缺失时的底。layout.ts 的内部默认值与它同义（换算后的形态）。 */
export const DEFAULT_SETTINGS: TrajectorySettings = {
  focusDays: 7,
  oldSharePct: 3,
  newSharePct: 3,
  hubSize: 180,
  gapFree: 14,
  gapWide: 53,
  symbolPx: 0.65,
  spreadMult: 1,
  tierMult: 1,
  ease: 0.16,
};

/** 存档合法化：只认表里的键、只收有限数，缺的补默认——手改过的 localStorage 不炸盘。 */
export function settingsOf(raw: unknown): TrajectorySettings {
  const out: TrajectorySettings = { ...DEFAULT_SETTINGS };
  if (!raw || typeof raw !== "object") return out;
  const src = raw as Record<string, unknown>;
  for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof TrajectorySettings)[]) {
    const v = src[key];
    if (typeof v === "number" && Number.isFinite(v)) out[key] = v;
  }
  return out;
}

/** 持久化手感参数 → 布局：语义值→内部值的换算全在这一处（与滑杆项目表同公式）。
 * 重烘焙由 configure 自动做。 */
export function applyStoredSettings(layout: RingsLayout, settings: TrajectorySettings): void {
  layout.configure({
    focusDays: settings.focusDays,
    oldShare: settings.oldSharePct / 100,
    newShare: settings.newSharePct / 100,
    hubBase: settings.hubSize,
    gapFree: settings.gapFree,
    gapWide: settings.gapWide,
    symbolPx: settings.symbolPx,
    spreadMult: settings.spreadMult,
    tierMult: settings.tierMult,
    ease: settings.ease,
  });
}

/** 一条滑杆：手感级（tune：改完重建鱼眼映射、重新调用 place() 即可）或世界尺度级
 * （patch：configure 落参重烘焙，视图侧半径依赖 DOM 全刷 + 重适配）。 */
export type SettingItem = {
  key: keyof TrajectorySettings;
  label: string;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
} & (
  | { kind: "tune"; apply: (layout: RingsLayout, v: number) => void }
  | { kind: "patch"; patch: (v: number) => LayoutPatch }
);

/** 设置面板的项目表：顺序即面板顺序。焦点带天数不设滑杆——窗宽即带宽，方向盘在日期窗滑块上；
 * 也不设「滚轮灵敏度」——整窗平移走窗宽比例步进，增益随缩放级别自适应。 */
export const SETTING_ITEMS: readonly SettingItem[] = [
  {
    key: "oldSharePct",
    label: "内环（旧压缩）",
    min: 0,
    max: 30,
    step: 1,
    format: (v) => `${v}%`,
    kind: "tune",
    apply: (layout, v) => {
      layout.oldShare = v / 100;
    },
  },
  {
    key: "newSharePct",
    label: "外环（新压缩）",
    min: 0,
    max: 30,
    step: 1,
    format: (v) => `${v}%`,
    kind: "tune",
    apply: (layout, v) => {
      layout.newShare = v / 100;
    },
  },
  {
    key: "hubSize",
    label: "盘心大小",
    min: 60,
    max: 300,
    step: 10,
    format: (v) => `${v}`,
    kind: "patch",
    /* 10 缓冲带随盘走（内环归零时焦点带贴环的关系不破） */
    patch: (v) => ({ hubBase: v }),
  },
  {
    key: "gapFree",
    label: "空窗阈值",
    min: 7,
    max: 60,
    step: 1,
    format: (v) => `${v} 天`,
    kind: "patch",
    /* 空档超过它才折算；调大 = 更宽容，长空窗项目盘面立现差别 */
    patch: (v) => ({ gapFree: v }),
  },
  {
    key: "gapWide",
    label: "超长空档宽",
    min: 30,
    max: 90,
    step: 1,
    format: (v) => `十年≈${v} 天`,
    kind: "patch",
    /* 十年空档折算后的总显示宽：拖大更舒展、拖小更紧凑，对数幅度由它反解 */
    patch: (v) => ({ gapWide: v }),
  },
  {
    key: "symbolPx",
    label: "节点大小",
    min: 0.4,
    max: 1.2,
    step: 0.05,
    format: (v) => v.toFixed(2),
    kind: "tune",
    apply: (layout, v) => {
      layout.symbolPx = v;
    },
  },
  {
    key: "tierMult",
    label: "结论放大",
    min: 1,
    max: 2,
    step: 0.05,
    format: (v) => `×${v.toFixed(2)}`,
    kind: "tune",
    /* 结论卡（主干末端在立卡）尺寸乘数：乘在帧缩放因子上，符号整组放大、
     * dodge 直径下帧自动跟随——纯帧变量，不碰布局，不用 rebake */
    apply: (layout, v) => {
      layout.tierMult = v;
    },
  },
  {
    key: "spreadMult",
    label: "节点散开",
    min: 0.5,
    max: 3,
    step: 0.25,
    format: (v) => `×${v.toFixed(2)}`,
    kind: "patch",
    /* 同日串珠角距乘数（纯角度口径）：进扇环宽度公式，得重装箱 */
    patch: (v) => ({ spreadMult: v }),
  },
  {
    key: "ease",
    label: "动画速度",
    min: 0.06,
    max: 0.4,
    step: 0.02,
    format: (v) => v.toFixed(2),
    kind: "tune",
    apply: (layout, v) => {
      layout.ease = v;
    },
  },
];
