/* 主题色板与配色工具——SVG 动态着色的唯一色源：两套亮暗底板 + 领域色分配、颜色插值工具。
 * 色值照 trail 星盘：深色是深蓝底上的亮色，盘不跟宿主站的灰底走。
 * 背景线与文字色走 CSS 变量（star.css 里同样两套），不经这里。
 * 领域色一律实例持有（buildThemes 出新副本），不走模块级单例。 */

import { NO_DOMAIN } from "../model.ts";

/* ---------- 主题调色板：SVG 动态着色走这里，背景线与文字色走 CSS 变量 ---------- */

/** 一套主题的全部动态着色项。domain 一栏由 buildThemes 按领域序填（含未分道哨兵的中性色）。 */
export interface Theme {
  domain: Record<string, string>;
  /** 未分道中性色：混灰基色一档，不从领域色板出 */
  noDomain: string;
  /** 取代边与它的箭头：金黄 */
  supersede: string;
  /** 转向边与它的箭头：青，色相避开领域色板 */
  pivot: string;
  /** 里程碑环与标签：与取代边同一金黄 */
  milestone: string;
  /** 被取代卡的混灰基色 */
  deadMix: string;
  /** 实心节点的细描边：密集处靠它把彩点分开 */
  nodeStroke: string;
  hubFill: string;
  /** 盘心描边：要进 mix() 混端点警示色，只能是 hex */
  hubStroke: string;
  /** 盘心正中的根节点 */
  hubRoot: string;
  warn: string;
  mute: string;
  /** 扇环外弧处的领域色不透明度（往内淡到 0） */
  boxAlpha: number;
}

export type ThemeName = "dark" | "light";

/** 两套底色板（domain 待填）。 */
const THEMES: Record<ThemeName, Theme> = {
  dark: {
    domain: {},
    noDomain: "#8a8f9c",
    supersede: "#f5b942",
    pivot: "#48c9d8",
    milestone: "#f5b942",
    deadMix: "#6b7280",
    nodeStroke: "rgba(255,255,255,0.75)",
    hubFill: "#0b1020",
    hubStroke: "#5a6a94",
    hubRoot: "#e8eeff",
    warn: "#f5b942",
    mute: "#3b4250",
    boxAlpha: 0.16,
  },
  light: {
    domain: {},
    noDomain: "#8d93a0",
    supersede: "#c07f10",
    pivot: "#0e7c8a",
    milestone: "#c07f10",
    deadMix: "#aab1bf",
    nodeStroke: "rgba(22,30,52,0.55)",
    hubFill: "#ffffff",
    hubStroke: "#b6c0d8",
    hubRoot: "#1a2238",
    warn: "#d97706",
    mute: "#c6ccd8",
    boxAlpha: 0.14,
  },
};

/* 领域色板：色相两两拉开 45° 以上，并整体避开连线占的两段（取代金黄 40°、转向青 190°）。
 * 第五色用黄绿而不是青——青跟绿只隔 20°、还跟转向线撞。第六个领域出现先扩色板，不循环复用。 */
const DOMAIN_HUES: Record<ThemeName, string[]> = {
  dark: ["#5ea8ff", "#c78bfa", "#4ade9e", "#ff7ab8", "#c3e35c"],
  light: ["#2b6fd4", "#8b47d6", "#0e9e63", "#d6478a", "#6f8f14"],
};

/** 按领域出现序循环分配领域色，返回两套主题的新副本（不改模板单例）。
 * 未分道哨兵不占色板、着 noDomain 中性色；色板序号只数真领域，哨兵压尾不影响分配。 */
export function buildThemes(domains: string[]): Record<ThemeName, Theme> {
  const out: Record<ThemeName, Theme> = {
    dark: { ...THEMES.dark, domain: {} },
    light: { ...THEMES.light, domain: {} },
  };
  let hue = 0;
  for (const name of domains) {
    if (name === NO_DOMAIN) {
      out.dark.domain[name] = out.dark.noDomain;
      out.light.domain[name] = out.light.noDomain;
      continue;
    }
    out.dark.domain[name] = DOMAIN_HUES.dark[hue % DOMAIN_HUES.dark.length] as string;
    out.light.domain[name] = DOMAIN_HUES.light[hue % DOMAIN_HUES.light.length] as string;
    hue++;
  }
  return out;
}

const HEX_RE = /^#[0-9a-f]{6}$/i;

/** 两个颜色之间按 t 混合。两边都是 #rrggbb 时线性插值出 rgb()；任一边不是 hex
 * （比如 `var(--color-fd-primary)` 这类 CSS 变量）就交给浏览器：出一条 color-mix() 表达式，
 * 混合比同一口径。 */
export function mix(c1: string, c2: string, t: number): string {
  if (!HEX_RE.test(c1) || !HEX_RE.test(c2)) {
    return `color-mix(in srgb, ${c1} ${((1 - t) * 100).toFixed(1)}%, ${c2})`;
  }
  const p = (h: string): number[] => [
    parseInt(h.slice(1, 3), 16),
    parseInt(h.slice(3, 5), 16),
    parseInt(h.slice(5, 7), 16),
  ];
  const a = p(c1);
  const b = p(c2);
  return `rgb(${a.map((v, i) => Math.round(v + ((b[i] as number) - v) * t)).join(",")})`;
}
