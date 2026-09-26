/* 星轨 HUD 的素材——帮助文案、图例 HTML 生成。整搬自 Obsidian 版 star/hud.ts（滑杆与
 * 动作钮的 DOM 工厂不在此列：设置浮层由 React 壳按 settings.ts 的项目表渲）。
 *
 * 这里只出字符串，不持任何视图状态——盘的 HUD 怎么摆、点了做什么归壳。 */

import { MILESTONE_HEADING } from "../parse.ts";
import { type FilterSel, SHAPE_NAMES, SHAPE_ORDER, shapeMarkup } from "./node-dom.ts";
import { mix, type Theme } from "./theme.ts";

/* ---------- 帮助浮层 ---------- */

export const HELP_HTML =
  '<div class="hh">怎么看</div>' +
  "<div>环是真实日期，内圈旧、外圈新；最外圈加重环是记录的最新一天。</div>" +
  `<div>泥金环是人工钉的里程碑（记在根卡正文「${MILESTONE_HEADING}」区块）。</div>` +
  "<div>颜色分领域，形状分卡的 type；盘心正中的根节点就是项目根卡，小一号、混灰淡出的是被取代的卡，每棵树主干末端那张在立卡大一号。</div>" +
  '<div class="hh">怎么动</div>' +
  "<div>画布上滚轮指哪缩哪，拖拽平移；ctrl+滚轮（触控板捏合同效）是时间平移——透镜宽度不变、整窗沿时间滑动，一格按窗宽的一成走、下滚向新（与竖轨悬停滚轮同一段逻辑，滚哪儿结果都一样），空档按折痕宽度匀速划过；全景态没有窗、不动作。</div>" +
  "<div>画布左缘竖轨是日期窗，常驻不收：顶旧底新，双柄收窄就进引力透镜——窗即焦点带，窗外压缩显示不丢全貌；中段拖动或悬停滚轮整窗平移（一格按窗宽的一成走），拖回顶满退回全景；左下角小框直接键入窗宽天数，框上滚轮一格一天微调；轨上的暗纹是没记录的空档——空档在轨上折成窄条（与盘面标度同比），拖过窄条那几步窗就跳过整段空窗。</div>" +
  "<div>透镜里焦点带内外边环各挂当天日期，贴到时间端点会提示。</div>" +
  "<div>「回到原点」两段式：相机动过先归相机，再按一次窗回顶满；Esc 同一条链。点盘心正中的根节点在新标签页开根卡页，双击盘心回全景；点节点在新标签页开卡页。</div>" +
  '<div class="hh">怎么筛</div>' +
  "<div>工具条：漏斗钮开图例（形态、领域可点多选取交集），放大镜钮开搜索（匹配 label 与卡身份）。</div>";

/* ---------- 图例：卡片化三组（形态 / 关系 / 领域） ---------- */

/** HTML 转义：领域名来自卡的 frontmatter、是不可信输入，拼进 innerHTML 前必须过这里。
 * 属性位（双引号内）与文本位共用：五个危险字符全数值实体化。 */
const escapeHtml = (s: string): string => s.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);

/** 图例珠光渐变的 id：图例整块一次性重渲，一张盘一份，够用。 */
const LEGEND_PEARL = "star-lg-pearl";

/** 图例 HTML：符号与画布节点同模的内联 SVG；形态（按 type 的形状表）与领域项是筛选器
 * （on = 选中，off = 本维有筛选但未选中），在立 / 被取代与关系组纯展示。
 * 形状符号吃跟大图同款的珠光渐变与底色缝，样本色取第一个领域色。 */
export function legendHtml(theme: Theme, domains: string[], sel: FilterSel): string {
  const sym = (inner: string, wide = false): string =>
    `<svg class="lgs${wide ? " lgs-w" : ""}" viewBox="${wide ? "0 -9 26 18" : "-9 -9 18 18"}">${inner}</svg>`;
  const lgi = (f: "form" | "domain", v: string, inner: string): string => {
    const on = sel[f].has(v);
    const off = sel[f].size > 0 && !on;
    return `<span class="lgi${on ? " on" : ""}${off ? " off" : ""}" data-f="${f}" data-v="${escapeHtml(v)}">${inner}</span>`;
  };
  /* 样本色：第一个领域（没有领域就用未分道中性色），与大图节点同一套着色 */
  const sample = theme.domain[domains[0] ?? ""] ?? theme.noDomain;
  const pearl = `url(#${LEGEND_PEARL})`;
  /* 渐变定义挂第一个符号里，同文档的别的符号照样引得着 */
  const pearlDefs =
    `<defs><radialGradient id="${LEGEND_PEARL}" cx="0.5" cy="0.5" r="0.5" fx="0.4" fy="0.38">` +
    `<stop offset="0" stop-color="${mix(sample, "#ffffff", 0.22)}"/>` +
    `<stop offset="1" stop-color="${sample}"/></radialGradient></defs>`;
  const forms = SHAPE_ORDER.map((key, i) =>
    lgi(
      "form",
      key,
      `${sym((i === 0 ? pearlDefs : "") + shapeMarkup(key, 4.2, key === "snapshot" ? sample : pearl, theme.bg))}${SHAPE_NAMES[key]}`,
    ),
  ).join("");
  const edgeSymbol = (col: string, dash = ""): string =>
    sym(
      `<line x1="1" y1="0" x2="23" y2="0" stroke="${col}" stroke-width="1.2"${dash ? ` stroke-dasharray="${dash}" stroke-linecap="round"` : ""}/>`,
      true,
    );
  return (
    forms +
    `<br>` +
    /* 在立 / 被取代：颜色通道的两态（纯展示，筛选维度是形状与领域） */
    `<span class="lgp">${sym(`<circle r="4" fill="${pearl}" stroke="${theme.bg}" stroke-width="1.2"/>`)}在立</span>` +
    `<span class="lgp">${sym(`<circle r="2.8" fill="${mix(sample, theme.deadMix, 0.4)}" stroke="${theme.bg}" stroke-width="0.8"/>`)}被取代</span><br>` +
    `<span class="lgp">${edgeSymbol(sample)}取代·迭代</span>` +
    `<span class="lgp">${edgeSymbol(theme.pivot, "2 3")}转向·长出</span>` +
    `<span class="lgp">${sym(`<circle r="6.2" fill="none" stroke="${theme.milestone}" stroke-width="1.3"/>`)}里程碑</span><br>` +
    domains
      .map((l) =>
        lgi(
          "domain",
          l,
          sym(`<circle r="4" fill="${theme.domain[l] ?? theme.noDomain}"/>`) + escapeHtml(l),
        ),
      )
      .join("")
  );
}
