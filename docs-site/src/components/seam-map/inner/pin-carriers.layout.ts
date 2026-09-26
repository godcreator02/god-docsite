/**
 * 「钉码的第二种载体」方案接缝图（pin-carriers.data.mjs）的坐标与图标。调用方在最上，钉码编排、两种格式、
 * 记号写法与钉码核心依次往下，项目装配在右边一列。
 */
import { Braces, Cog, FileCode, Scale, SquareTerminal, Tag, Wrench } from 'lucide-react';
import { cap } from '../diagram';
import type { SeamLayout } from '../diagram';

export const pinCarriersLayout: SeamLayout = {
  view: { w: 1100, h: 600 },
  caps: {
    cli: cap(34, 52, 340),
    remark: cap(394, 52, 332),

    'check-doc': cap(34, 202, 160),
    'confirm-doc': cap(204, 202, 160),
    'format-of': cap(374, 202, 170),
    'check-refs': cap(554, 202, 172),

    recognize: cap(34, 352, 150),
    write: cap(194, 352, 150),
    'code-parse': cap(394, 352, 166),
    'code-write': cap(570, 352, 156),

    formal: cap(34, 502, 312),
    check: cap(394, 502, 166),
    confirm: cap(570, 502, 156),

    docs: cap(814, 52, 252),
    reader: cap(814, 352, 252),
    history: cap(814, 502, 252),
  },
  groups: {
    callers: { x: 20, y: 20, w: 720, h: 94 },
    pinning: { x: 20, y: 170, w: 720, h: 94 },
    mdx: { x: 20, y: 320, w: 340, h: 94 },
    code: { x: 380, y: 320, w: 360, h: 94 },
    marker: { x: 20, y: 470, w: 340, h: 94 },
    core: { x: 380, y: 470, w: 360, h: 94 },
    impl: { x: 800, y: 20, w: 280, h: 544 },
  },
  seamPaths: {
    '1': { d: 'M204,100 V150 H114 V202 M204,150 H284 V202 M560,100 V150 H640 V202', badge: [204, 150] },
    '2': { d: 'M420,250 V300 H109 V352 M269,300 V352', badge: [340, 300] },
    '3': { d: 'M500,250 V352 M500,300 H648 V352', badge: [575, 300] },
    '4': { d: 'M109,400 V502 M269,400 V502', badge: [109, 450] },
    '5': { d: 'M430,400 V450 H300 V502', badge: [365, 450] },
    '6': { d: 'M726,226 H760 V526 H726', badge: [760, 380] },
    '7': { d: 'M740,540 H790 V376 H814 M790,526 H814', badge: [790, 450] },
    '8': { d: 'M300,52 V36 H940 V52', badge: [620, 36] },
  },
  entries: {},
  moduleIcons: {
    callers: SquareTerminal,
    pinning: Cog,
    mdx: FileCode,
    code: Braces,
    marker: Tag,
    core: Scale,
    impl: Wrench,
  },
  entryIcons: {},
};
