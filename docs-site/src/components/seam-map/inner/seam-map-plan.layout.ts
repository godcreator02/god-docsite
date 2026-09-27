/**
 * 方案做完之后的接缝图（seam-map-plan.data.mjs）的坐标与图标。三行：站的接缝图文件；讲解播放器新加的两个文件；
 * 零件、颜色名、样式表与 react。站那一行的方块顺序跟第二行对齐，四条往下的线都是竖直的。
 */
import { Atom, Blocks, DoorOpen, Globe, Paintbrush, ScrollText, SwatchBook } from 'lucide-react';
import { cap } from '@godcreator/explainer-player';
import type { SeamLayout } from '@godcreator/explainer-player';

export const seamMapPlanLayout: SeamLayout = {
  view: { w: 900, h: 434 },
  caps: {
    'layout-data': cap(34, 52, 200),
    wrap: cap(254, 52, 200),
    'graph-data': cap(474, 52, 190),
    ai: cap(684, 52, 182),

    'layout-type': cap(34, 202, 200),
    draw: cap(254, 202, 212),
    define: cap(514, 202, 170),
    text: cap(700, 202, 166),

    pill: cap(34, 352, 122),
    role: cap(204, 352, 142),
    'seam-css': cap(394, 352, 200),
    vars: cap(604, 352, 142),
    react: cap(780, 352, 110),
  },
  groups: {
    site: { x: 20, y: 20, w: 860, h: 94 },
    diagram: { x: 20, y: 170, w: 460, h: 94 },
    graph: { x: 500, y: 170, w: 380, h: 94 },
    parts: { x: 20, y: 320, w: 150, h: 94 },
    colors: { x: 190, y: 320, w: 170, h: 94 },
    styles: { x: 380, y: 320, w: 380, h: 94 },
    react: null,
  },
  seamPaths: {
    '1': { d: 'M134,100 V202', badge: [134, 150] },
    '2': { d: 'M360,100 V202', badge: [360, 150] },
    '3': { d: 'M590,100 V202', badge: [590, 150] },
    '4': { d: 'M466,226 H514', badge: [490, 226] },
    '5': { d: 'M780,100 V202', badge: [780, 150] },
    '6': { d: 'M290,250 V300 H145 V352 M290,300 H335 V352', badge: [220, 300] },
    '7': { d: 'M420,250 V300 H675 V352', badge: [550, 300] },
    '8': { d: 'M450,250 V285 H835 V352', badge: [760, 285] },
  },
  entries: {},
  moduleIcons: {
    site: Globe,
    diagram: DoorOpen,
    graph: ScrollText,
    parts: Blocks,
    colors: SwatchBook,
    styles: Paintbrush,
    react: Atom,
  },
  entryIcons: {},
};
