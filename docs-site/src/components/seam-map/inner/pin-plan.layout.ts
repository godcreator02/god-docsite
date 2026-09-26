/**
 * 「钉码与格式解耦」方案接缝图（pin-plan.data.mjs）的坐标与图标。调用方在最上，钉码编排、mdx 格式与记号写法、
 * 钉码核心依次往下，实现方在右边一列。
 */
import { Cog, FileCode, Scale, SquareTerminal, Tag, Wrench } from 'lucide-react';
import { cap } from '../diagram';
import type { SeamLayout } from '../diagram';

export const pinPlanLayout: SeamLayout = {
  view: { w: 1100, h: 640 },
  caps: {
    cli: cap(34, 52, 340),
    remark: cap(394, 52, 332),

    'check-doc': cap(34, 202, 220),
    'confirm-doc': cap(264, 202, 220),
    'check-refs': cap(494, 202, 232),

    recognize: cap(34, 352, 180),
    write: cap(224, 352, 196),
    draft: cap(474, 352, 108),
    formal: cap(592, 352, 134),

    judge: cap(34, 502, 120),
    snapshot: cap(164, 502, 120),
    check: cap(294, 502, 120),
    confirm: cap(424, 502, 120),
    hash: cap(554, 502, 172),

    load: cap(814, 52, 252),
    reader: cap(814, 352, 252),
    history: cap(814, 502, 252),
  },
  groups: {
    callers: { x: 20, y: 20, w: 720, h: 94 },
    pinning: { x: 20, y: 170, w: 720, h: 94 },
    mdx: { x: 20, y: 320, w: 420, h: 94 },
    marker: { x: 460, y: 320, w: 280, h: 94 },
    core: { x: 20, y: 470, w: 720, h: 94 },
    impl: { x: 800, y: 20, w: 280, h: 544 },
  },
  seamPaths: {
    '1': { d: 'M204,100 V150 H144 V202 M204,150 H374 V202 M560,100 V150 H610 V202', badge: [290, 150] },
    '2': { d: 'M144,250 V352 M374,250 V352', badge: [144, 300] },
    '3': { d: 'M420,376 H474', badge: [447, 376] },
    '4': { d: 'M450,250 V480 H354 V502 M450,480 V502 M610,250 V290 H450', badge: [450, 440] },
    '5': { d: 'M354,550 V580 H74 V550 M204,580 V550 M484,550 V580 H354', badge: [264, 580] },
    '6': { d: 'M740,526 H770 V376 H814', badge: [770, 450] },
    '7': { d: 'M114,550 V610 H940 V550', badge: [600, 610] },
    '8': { d: 'M814,76 H770 V226 H726', badge: [770, 150] },
    '9': { d: 'M659,400 V470', badge: [659, 440] },
  },
  entries: {},
  moduleIcons: {
    callers: SquareTerminal,
    pinning: Cog,
    mdx: FileCode,
    marker: Tag,
    core: Scale,
    impl: Wrench,
  },
  entryIcons: {},
};
