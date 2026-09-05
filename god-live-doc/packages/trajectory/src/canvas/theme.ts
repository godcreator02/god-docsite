/* 主题色板与配色工具——SVG 动态着色的唯一色源：两套亮暗底板 + 领域色分配、
 * 颜色插值 / 归一工具、宿主 accent 与 star.css 环色的探针解析。
 * 背景线与文字色走 CSS 变量、不经这里。
 * 领域色一律实例持有（buildThemes 出新副本），不走模块级单例——多盘同开互不干扰。
 * 整搬自 Obsidian 版 render/theme.ts，宿主变量换成 fumadocs 的 `--color-fd-*`。 */

import { NO_DOMAIN } from "../model.ts";

/* ---------- 主题调色板：SVG 动态着色走这里，背景线与文字色走 CSS 变量 ---------- */

/** 一套主题的全部动态着色项。domain 一栏由 buildThemes 按领域序填（含未分道哨兵的中性色）。 */
export interface Theme {
  domain: Record<string, string>;
  /** 未分道中性色：盘心色一档，不从领域色板出 */
  noDomain: string;
  supersede: string;
  pivot: string;
  dead: string;
  deadMix: string;
  hubFill: string;
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
    /* 未分道 = 盘心色一档（同 hubStroke） */
    noDomain: "#5a6a94",
    supersede: "#f5b942",
    pivot: "#48c9d8",
    dead: "#8a8f9c",
    deadMix: "#6b7280",
    /* 盘心填色走 CSS 变量、跟宿主主题（此值不经 mix()，可以用 var()）；
     * hubStroke 是 `--color-fd-primary` 解析失败时的兜底（hubStrokeOf 在读主题时解析覆盖），
     * 本身留死值 hex 是因为它要进 mix() 混预警色 */
    hubFill: "var(--hub-fill)",
    hubStroke: "#5a6a94",
    warn: "#f5b942",
    mute: "#3b4250",
    /* 扇环框边/底走 CSS 变量跟宿主主题（同 hubFill，不经 mix() 可以 var()） */
    boxStroke: "var(--box-stroke)",
    boxFill: "var(--box-fill)",
  },
  light: {
    domain: {},
    noDomain: "#b6c0d8",
    supersede: "#c07f10",
    pivot: "#0e7c8a",
    dead: "#8d93a0",
    deadMix: "#aab1bf",
    hubFill: "var(--hub-fill)",
    hubStroke: "#b6c0d8",
    warn: "#d97706",
    mute: "#c6ccd8",
    boxStroke: "var(--box-stroke)",
    boxFill: "var(--box-fill)",
  },
};

/* 领域色板：色相两两拉开 45° 以上，并整体避开连线色板占的两段（金黄 40°、转向青 190°）。
 * 第五色用黄绿而不是青——青跟绿只隔 20°、还跟转向线撞，盘上分不出是两个领域还是一条线。 */
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

const NS = "http://www.w3.org/2000/svg";

const HEX_RE = /^#[0-9a-f]{6}$/i;

/** 两个颜色之间按 t 混合。两边都是 #rrggbb 时线性插值出 rgb()；任一边不是 hex
 * （比如 `var(--color-fd-primary)`——服务端渲的定妆照拿不到探针解析值，直接给 CSS 变量）
 * 就交给浏览器：出一条 color-mix() 表达式，混合比同一口径。 */
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

/** CSS 颜色串归一成 #rrggbb：吃 hex 与 rgb()/rgba()（getComputedStyle 的常见产物），
 * 别的格式返回 null，调用方留死值回退。 */
export function cssToHex(c: string): string | null {
  const s = c.trim();
  const h = /^#([0-9a-f]{6})$/i.exec(s);
  if (h) return `#${(h[1] as string).toLowerCase()}`;
  const m = /^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i.exec(s);
  if (!m) return null;
  return `#${m
    .slice(1, 4)
    .map((v) => Number(v).toString(16).padStart(2, "0"))
    .join("")}`;
}

/** 盘心描边：跟宿主 `--color-fd-primary` 走。探针法让浏览器自己解变量再归一 hex——
 * 直接 getPropertyValue 拿到的是声明原样（fumadocs 的预设写的是 hsl()），字符串解析走不通；
 * 变量缺失 / 解析不出留色板死值兜底。 */
export function hubStrokeOf(theme: ThemeName): string {
  const probe = document.createElement("div");
  probe.style.color = "var(--color-fd-primary)";
  document.body.appendChild(probe);
  const rgb = getComputedStyle(probe).color;
  probe.remove();
  return cssToHex(rgb) ?? THEMES[theme].hubStroke;
}

/* ---------- 环形骨架配色：探针解 star.css 的环色（定妆照 JS 着色用） ---------- */

/** 环形骨架的一套色：月环（碎石同源，--ring-m）/ 年环 / 最新环 / 空窗雾带暗底。 */
export interface RingPalette {
  month: string;
  year: string;
  latest: string;
  gapBg: string;
}

/** 环色兜底（测试与探针失败用）：暗主题计算值的合理近似——month / latest / year 是
 * 前景色按 20% / 30% / 38% color-mix 的 rgba 形态，gapBg 是前景色 6%。 */
export const DEFAULT_RING_PALETTE: RingPalette = {
  month: "rgba(220, 221, 222, 0.2)",
  year: "rgba(220, 221, 222, 0.38)",
  latest: "rgba(220, 221, 222, 0.3)",
  gapBg: "rgba(220, 221, 222, 0.06)",
};

/** 环色的 CSS 变量形态：服务端渲的定妆照用它——环色直接写成 var()，不经 mix()，
 * 亮暗由宿主变量在浏览器里现解，静态 markup 不必按主题出两份环色。 */
export const CSS_RING_PALETTE: RingPalette = {
  month: "var(--ring-m)",
  year: "var(--ring-y)",
  latest: "var(--ring-l)",
  gapBg: "var(--gap-bg)",
};

/** 环形骨架配色：探针法让浏览器自己解 star.css 的环色——与 hubStrokeOf 同哲学，
 * 但保留 rgba 原串不做 cssToHex：环色是半透明 color-mix（前景色百分比），
 * 丢 alpha 就糊成实色。只在浏览器运行时调；探针容器带 star-disk 作用域，
 * 未匹配 / none 的项留 DEFAULT_RING_PALETTE 兜底。 */
export function ringPaletteOf(): RingPalette {
  const host = document.createElement("div");
  host.className = "star-disk";
  const svg = document.createElementNS(NS, "svg");
  host.appendChild(svg);
  document.body.appendChild(host);
  /* 未匹配到规则时 getComputedStyle 的 stroke 是初始值 none，视同失败 */
  const strokeOf = (cls: string): string | null => {
    const c = document.createElementNS(NS, "circle");
    c.setAttribute("class", cls);
    svg.appendChild(c);
    const s = getComputedStyle(c).stroke;
    return s && s !== "none" ? s : null;
  };
  const out: RingPalette = {
    month: strokeOf("ringm") ?? DEFAULT_RING_PALETTE.month,
    year: strokeOf("ringy") ?? DEFAULT_RING_PALETTE.year,
    latest: strokeOf("ringl") ?? DEFAULT_RING_PALETTE.latest,
    gapBg: strokeOf("gap-bg") ?? DEFAULT_RING_PALETTE.gapBg,
  };
  host.remove();
  return out;
}
