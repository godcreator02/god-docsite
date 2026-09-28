/**
 * 星轨盘内部接缝图（trajectory.data.mjs）的坐标与图标。调用方在最上：左边 workflow，右边 fumadocs 适配；
 * 左列往下是建模，右列往下是组件、画布、布局；react 在组件右边。
 */
import { Atom, Network, Orbit, Palette, Plug, Radar, Workflow } from 'lucide-react';
import { cap } from '@godcreator/docfirst-explainer';
import type { SeamLayout } from '@godcreator/docfirst-explainer';

export const trajectoryLayout: SeamLayout = {
  view: { w: 1100, h: 600 },
  caps: {
    cards: cap(34, 52, 200),
    cli: cap(244, 52, 180),
    css: cap(494, 52, 180),
    reexport: cap(684, 52, 200),

    'star-css': cap(494, 202, 130),
    'star-disk': cap(634, 202, 150),
    react: cap(944, 202, 120),

    input: cap(34, 352, 200),
    build: cap(244, 352, 180),
    stage: cap(494, 352, 160),
    settings: cap(664, 352, 160),

    rings: cap(494, 502, 160),
    chains: cap(664, 502, 220),
  },
  groups: {
    workflow: { x: 20, y: 20, w: 420, h: 94 },
    fumadocs: { x: 480, y: 20, w: 420, h: 94 },
    disk: { x: 480, y: 170, w: 420, h: 94 },
    react: { x: 930, y: 170, w: 150, h: 94 },
    model: { x: 20, y: 320, w: 420, h: 94 },
    canvas: { x: 480, y: 320, w: 420, h: 94 },
    layout: { x: 480, y: 470, w: 420, h: 94 },
  },
  seamPaths: {
    '1': { d: 'M134,100 V352 M134,300 H300 V352', badge: [134, 220] },
    '2': { d: 'M380,100 V352', badge: [380, 220] },
    '3': { d: 'M720,100 V202', badge: [720, 150] },
    '4': { d: 'M560,100 V202', badge: [560, 150] },
    '5': { d: 'M640,250 V290 H400 V352', badge: [520, 290] },
    '6': { d: 'M648,250 V352 M760,250 V352', badge: [760, 300] },
    '7': { d: 'M574,400 V502 M744,400 V502', badge: [574, 450] },
    '8': { d: 'M784,226 H944', badge: [864, 226] },
  },
  entries: {},
  moduleIcons: {
    workflow: Workflow,
    fumadocs: Plug,
    model: Network,
    disk: Orbit,
    canvas: Palette,
    layout: Radar,
    react: Atom,
  },
  entryIcons: {},
};
