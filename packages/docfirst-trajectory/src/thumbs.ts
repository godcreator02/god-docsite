/**
 * 启动器卡阵的静态缩略图：star-thumb 画家喂 svg-doc 桩文档、序列化成 markup，客户端不重画。
 * 纯函数，不碰 DOM、不碰文件——服务端组件拿 buildTrajectory 的产物调它，结果作为 props 交给 StarDisk。
 */

import { DEFAULT_SETTINGS, type TrajectorySettings } from "./canvas/settings.ts";
import { renderStarThumb } from "./canvas/star-thumb.ts";
import { serializeSvg, SvgStubDocument, type SvgStubElement } from "./canvas/svg-doc.ts";
import { buildThemes, CSS_RING_PALETTE, type ThemeName } from "./canvas/theme.ts";
import type { Trajectory } from "./index.ts";
import { type LauncherThumb, type SerializableModel, toRuntimeModel } from "./serial.ts";
import type { TrajectoryModel } from "./types.ts";

export interface RenderThumbOptions {
  /** 亮 / 暗色板：领域色、连线色、混灰是 JS 色板，按主题各出一份；环色与盘心走 CSS 变量 */
  theme?: ThemeName;
  /** 手感设置：只灌 hubSize / gapFree / gapWide 三项（与大图同口径），缺省 DEFAULT_SETTINGS */
  settings?: Pick<TrajectorySettings, "hubSize" | "gapFree" | "gapWide">;
}

/** 一张盘的全景定妆照，静态 SVG markup：画家喂桩文档建树、序列化成字符串。
 * 盘心描边 / 根节点 / 虫洞走色板里的泥金，节点底色缝与环色走 CSS 变量——
 * 静态 markup 里不带任何要探针解的颜色。 */
export function renderThumb(
  model: SerializableModel | TrajectoryModel,
  options: RenderThumbOptions = {},
): string {
  const runtime: TrajectoryModel =
    model.supersededIds instanceof Set ? (model as TrajectoryModel) : toRuntimeModel(model as SerializableModel);
  const themeName = options.theme ?? "light";
  const theme = buildThemes(runtime.domains)[themeName];
  const doc = new SvgStubDocument();
  const svg = renderStarThumb(
    runtime,
    theme,
    options.settings ?? DEFAULT_SETTINGS,
    CSS_RING_PALETTE,
    doc,
  ) as unknown as SvgStubElement;
  svg.setAttribute("class", `trajectory-thumb star-thumb-${themeName}`);
  return serializeSvg(svg);
}

/** 启动器卡阵要的全部缩略图：每张盘亮 / 暗各一份（页面按 html.dark 显示其一，切主题不重画）。 */
export function launcherThumbs(data: Trajectory): Record<string, LauncherThumb> {
  const out: Record<string, LauncherThumb> = {};
  for (const disk of data.disks) {
    const model = data.models[disk.rootId];
    if (!model) continue;
    out[disk.rootId] = {
      dark: renderThumb(model, { theme: "dark" }),
      light: renderThumb(model, { theme: "light" }),
    };
  }
  return out;
}
