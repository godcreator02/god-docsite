/* 主题色板与配色工具——SVG 动态着色的唯一色源：两套亮暗底板（矿彩）+ 领域色分配、
 * 颜色插值工具。
 * 背景线与文字色走 CSS 变量、不经这里；节点底色缝也走变量（`bg`），亮暗由宿主自己翻。
 * 领域色一律实例持有（buildThemes 出新副本），不走模块级单例。
 * 整搬自 Obsidian 版 render/theme.ts，宿主变量换成 fumadocs 的 `--color-fd-*`。 */

import { NO_DOMAIN } from "../model.ts";

/* ---------- 主题调色板：SVG 动态着色走这里，背景线与文字色走 CSS 变量 ---------- */

/** 一套主题的全部动态着色项。domain 一栏由 buildThemes 按领域序填（含未分道哨兵的中性色）。 */
export interface Theme {
  domain: Record<string, string>;
  /** 未分道中性色：混灰基色一档，不从领域色板出 */
  noDomain: string;
  /** 转向边：铜绿，色相避开领域色板 */
  pivot: string;
  /** 里程碑环与标签：泥金（与盘心描边同色） */
  milestone: string;
  /** 被取代卡的混灰基色 */
  deadMix: string;
  /** 节点底色缝（外圈描边）：密集处靠这圈缝把彩点分开 */
  bg: string;
  hubFill: string;
  /** 盘心描边与根节点：泥金 */
  hubStroke: string;
  warn: string;
  mute: string;
  boxStroke: string;
  boxFill: string;
}

export type ThemeName = "dark" | "light";

/** 两套底色板（domain 待填）。 */
const THEMES: Record<ThemeName, Theme> = {
  dark: {
    domain: {},
    noDomain: "#6B7280",
    pivot: "#6FB8AE",
    milestone: "#CBB27A",
    deadMix: "#6B7280",
    /* 底色缝与盘心填色走 CSS 变量、跟宿主主题（这两项不经 mix()，可以用 var()） */
    bg: "var(--color-fd-background)",
    hubFill: "var(--hub-fill)",
    /* 泥金，与里程碑同色；要进 mix() 混端点警示色，留 hex */
    hubStroke: "#CBB27A",
    warn: "#f5b942",
    mute: "#454A52",
    /* 扇环框边/底走 CSS 变量跟宿主主题（同 hubFill，不经 mix() 可以 var()） */
    boxStroke: "var(--box-stroke)",
    boxFill: "var(--box-fill)",
  },
  light: {
    domain: {},
    noDomain: "#AAB1BF",
    pivot: "#2F8C82",
    /* 泥金在浅底上发虚，压深一档 */
    milestone: "#8A7238",
    deadMix: "#AAB1BF",
    bg: "var(--color-fd-background)",
    hubFill: "var(--hub-fill)",
    hubStroke: "#8A7238",
    warn: "#d97706",
    mute: "#C8CCD3",
    boxStroke: "var(--box-stroke)",
    boxFill: "var(--box-fill)",
  },
};

/* 领域色板「矿彩」：石青 / 赭石 / 松绿 / 胭脂 / 藤紫，低饱和暖偏，
 * 色相避开连线占的两段（转向铜绿 175°、里程碑与盘心泥金 45°）。
 * 第六个领域出现先扩色板，不循环复用。 */
const DOMAIN_HUES: Record<ThemeName, string[]> = {
  dark: ["#6C9BD2", "#D08A5B", "#8FBF8A", "#D07C93", "#A28BD0"],
  light: ["#3F6FA8", "#A85F32", "#4F8A4A", "#A64B66", "#6E55A0"],
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
