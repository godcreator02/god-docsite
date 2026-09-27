/**
 * 「星轨盘收中性输入」方案接缝图（trajectory-plan.data.mjs）的坐标与图标。调用方在最上；左边是卡格式，
 * 中间往下是建模，右边是组件、画布、布局一列。卡格式与组件之间留一条竖线给命令行直通建模。
 */
import { Atom, FileText, Network, Orbit, Palette, Radar, SquareTerminal } from 'lucide-react';
import { cap } from '../diagram';
import type { SeamLayout } from '../diagram';

export const trajectoryPlanLayout: SeamLayout = {
  view: { w: 1100, h: 600 },
  caps: {
    cardset: cap(34, 52, 180),
    load: cap(224, 52, 190),
    cli: cap(424, 52, 150),
    css: cap(584, 52, 150),
    reexport: cap(744, 52, 150),

    parse: cap(34, 202, 120),
    keys: cap(164, 202, 150),
    'scan-dir': cap(324, 202, 124),
    'star-css': cap(584, 202, 130),
    'star-disk': cap(724, 202, 150),
    react: cap(944, 202, 120),

    input: cap(294, 352, 200),
    build: cap(504, 352, 192),
    stage: cap(754, 352, 300),

    rings: cap(754, 502, 300),
  },
  groups: {
    callers: { x: 20, y: 20, w: 890, h: 94 },
    cards: { x: 20, y: 170, w: 440, h: 94 },
    disk: { x: 570, y: 170, w: 318, h: 94 },
    react: { x: 930, y: 170, w: 150, h: 94 },
    model: { x: 280, y: 320, w: 430, h: 94 },
    canvas: { x: 740, y: 320, w: 330, h: 94 },
    layout: { x: 740, y: 470, w: 330, h: 94 },
  },
  seamPaths: {
    '1': { d: 'M380,100 V202 M440,100 V202', badge: [380, 150] },
    '2': { d: 'M99,100 V202 M200,100 V202', badge: [99, 150] },
    '3': { d: 'M380,250 V352', badge: [380, 300] },
    '4': { d: 'M520,100 V352 M740,250 V290 H640 V352', badge: [520, 300] },
    '5': { d: 'M800,100 V202', badge: [800, 150] },
    '6': { d: 'M650,100 V202', badge: [650, 150] },
    '7': { d: 'M840,250 V352', badge: [840, 300] },
    '8': { d: 'M900,400 V502', badge: [900, 450] },
    '9': { d: 'M874,226 H944', badge: [909, 226] },
  },
  entries: {},
  moduleIcons: {
    callers: SquareTerminal,
    cards: FileText,
    model: Network,
    disk: Orbit,
    canvas: Palette,
    layout: Radar,
    react: Atom,
  },
  entryIcons: {},
};
