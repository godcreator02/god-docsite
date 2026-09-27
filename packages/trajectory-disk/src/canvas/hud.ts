/* 星轨 HUD 的素材——帮助文案、图例 HTML 生成。整搬自 Obsidian 版 star/hud.ts（滑杆与
 * 动作钮的 DOM 工厂不在此列：设置浮层由 React 壳按 settings.ts 的项目表渲）。
 *
 * 这里只出字符串，不持任何视图状态——盘的 HUD 怎么摆、点了做什么归壳。 */

import { type FilterSel, SHAPE_NAMES, SHAPE_ORDER, shapeMarkup, supersededColor } from "./node-dom.ts";
import type { Theme } from "./theme.ts";

/* ---------- 帮助浮层 ---------- */

export const HELP_HTML =
  '<div class="hh">怎么看</div>' +
  "<div>环是真实日期，内圈旧、外圈新；最外圈加重环是记录的最新一天。</div>" +
  "<div>金黄的环是人工钉的里程碑（记在根卡正文「里程碑」区块），名字沿环写在 12 点方向。</div>" +
  "<div>颜色分领域，形状分卡的 type，所有卡一样大；盘心正中的根节点就是项目根卡。在立的卡外套一圈同色细环；再往外一圈实线的是每棵树主干末端那张在立卡（这条线目前的结论），虚线的是孤星（跟别的卡没有关系）；混灰、没有环的是被取代的卡。</div>" +
  "<div>金黄的线是取代，青色的线是转向；线从旧卡到新卡由淡变亮，亮的那头是新卡。每棵树占一片扇形，颜色跟它的领域一样。</div>" +
  '<div class="hh">怎么动</div>' +
  "<div>画布上滚轮指哪缩哪，拖拽平移；ctrl+滚轮（触控板捏合同效）是时间平移——透镜宽度不变、整窗沿时间滑动，一格按窗宽的一成走、下滚向新（与日期轨悬停滚轮同一段逻辑，滚哪儿结果都一样），空档按折痕宽度匀速划过；全景态没有窗、不动作。</div>" +
  "<div>工具条下方的日期轨是日期窗，常驻不收：上旧下新，双柄收窄就进引力透镜——窗即焦点带，窗外压缩显示不丢全貌；中段拖动或悬停滚轮整窗平移（一格按窗宽的一成走），拖回撑满退回全景；轨底的小框直接键入窗宽天数，框上滚轮一格一天微调；轨上的暗纹是没记录的空档——空档在轨上折成窄条（与盘面标度同比），拖过窄条那几步窗就跳过整段空窗。</div>" +
  "<div>透镜里焦点带内外边环各挂当天日期，贴到时间端点会提示。</div>" +
  "<div>点节点在右侧栏看这张卡（盘心正中的根节点是根卡），栏里指向别的卡的链接也在栏里切换；Ctrl/Cmd+点在新标签页开卡页；分割条可拖宽窄。Esc 依次收浮层、关侧栏、回到原点。</div>" +
  "<div>「回到原点」两段式：相机动过先归相机，再按一次窗回顶满。双击盘心回全景。</div>" +
  '<div class="hh">怎么筛</div>' +
  "<div>工具条：漏斗钮开图例（形态、领域可点多选取交集），放大镜钮开搜索（匹配 label 与卡身份）。</div>";

/* ---------- 图例：卡片化三组（形态 / 关系 / 领域） ---------- */

/** HTML 转义：领域名来自下游送进来的卡、是不可信输入，拼进 innerHTML 前必须过这里。
 * 属性位（双引号内）与文本位共用：五个危险字符全数值实体化。 */
const escapeHtml = (s: string): string => s.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);

/** 图例 HTML：符号与画布节点同模的内联 SVG；形态（按 type 的形状表）与领域项是筛选器
 * （on = 选中，off = 本维有筛选但未选中），在立 / 孤星 / 被取代与关系组纯展示。
 * 样本色取第一个领域色。 */
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
  const forms = SHAPE_ORDER.map((key) =>
    lgi("form", key, `${sym(shapeMarkup(key, 4.2, sample, theme.nodeStroke))}${SHAPE_NAMES[key]}`),
  ).join("");
  /* 连线样本：跟大图同款，左淡右亮（旧 → 新）；横线包围盒高为 0 渐变画不出，用细长矩形代替 */
  const edgeSymbol = (id: string, col: string): string =>
    sym(
      `<defs><linearGradient id="${id}"><stop offset="0" stop-color="${col}" stop-opacity="0.12"/>` +
        `<stop offset="1" stop-color="${col}"/></linearGradient></defs>` +
        `<rect x="1" y="-0.8" width="23" height="1.6" rx="0.8" fill="url(#${id})"/>`,
      true,
    );
  return (
    forms +
    `<br>` +
    /* 在立 / 结论 / 孤星 / 被取代：纯展示，筛选维度是形状与领域 */
    `<span class="lgp">${sym(shapeMarkup(null, 3.6, sample, theme.nodeStroke, { crown: true }))}在立</span>` +
    `<span class="lgp">${sym(shapeMarkup(null, 3.6, sample, theme.nodeStroke, { crown: true, outer: "conclusion" }))}结论</span>` +
    `<span class="lgp">${sym(shapeMarkup(null, 3.6, sample, theme.nodeStroke, { crown: true, outer: "isolated" }))}孤星</span>` +
    `<span class="lgp">${sym(shapeMarkup(null, 3.6, supersededColor(sample, theme), theme.nodeStroke))}被取代</span><br>` +
    `<span class="lgp">${edgeSymbol("star-lg-sup", theme.supersede)}取代·迭代</span>` +
    `<span class="lgp">${edgeSymbol("star-lg-piv", theme.pivot)}转向·长出</span>` +
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
