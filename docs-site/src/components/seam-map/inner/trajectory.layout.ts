/**
 * 轨迹核心内部接缝图（trajectory.data.mjs）的坐标与图标。调用方在最上；左半边是出口 . 这一路：扫描、主入口、
 * 校验与建模、文本解析依次往下，左边留一条竖线给 workflow 直通文本解析；右半边是画盘这一路：缩略图、星轨盘，
 * 往下是序列化与 react、画布层、布局计算。两半之间留一条竖线给卡集合直通字段表。
 */
import { Atom, Braces, FileText, Globe, Images, Network, Orbit, PackageOpen, Palette, Plug, Radar, ScanLine, Workflow } from 'lucide-react';
import { cap } from '../diagram';
import type { SeamLayout } from '../diagram';

export const trajectoryLayout: SeamLayout = {
  view: { w: 1100, h: 734 },
  caps: {
    'card-refs': cap(34, 52, 130),
    'card-dir': cap(174, 52, 100),
    cli: cap(284, 52, 136),
    cardset: cap(500, 52, 100),
    'disk-server': cap(610, 52, 178),
    page: cap(894, 52, 152),

    'scan-cards': cap(154, 202, 80),
    pick: cap(244, 202, 100),
    build: cap(392, 202, 124),
    'launcher-thumbs': cap(589, 202, 104),
    'render-thumb': cap(703, 202, 88),
    'star-disk': cap(839, 202, 128),
    'star-css': cap(977, 202, 84),

    'parse-card': cap(154, 352, 136),
    disks: cap(300, 352, 86),
    'build-model': cap(396, 352, 86),
    'to-json': cap(589, 352, 110),
    'to-runtime': cap(709, 352, 110),
    react: cap(865, 352, 130),

    lines: cap(34, 502, 207),
    fm: cap(251, 502, 124),
    keys: cap(385, 502, 90),
    body: cap(34, 560, 245),
    settings: cap(598, 502, 102),
    'svg-doc': cap(710, 502, 110),
    'star-thumb': cap(830, 502, 110),
    stage: cap(950, 502, 90),

    chains: cap(589, 652, 184),
    skeleton: cap(783, 652, 152),
    rings: cap(945, 652, 90),
  },
  groups: {
    workflow: { x: 20, y: 20, w: 414, h: 94 },
    fumadocs: { x: 486, y: 20, w: 316, h: 94 },
    site: { x: 880, y: 20, w: 180, h: 94 },
    scan: { x: 140, y: 170, w: 218, h: 94 },
    entry: { x: 378, y: 170, w: 152, h: 94 },
    thumbs: { x: 575, y: 170, w: 230, h: 94 },
    disk: { x: 825, y: 170, w: 250, h: 94 },
    model: { x: 140, y: 320, w: 356, h: 94 },
    serial: { x: 575, y: 320, w: 258, h: 94 },
    react: null,
    parse: { x: 20, y: 470, w: 469, h: 152 },
    canvas: { x: 584, y: 470, w: 470, h: 94 },
    layout: { x: 575, y: 620, w: 474, h: 94 },
  },
  // 线只画到一端的时候，另一端（挑卡、磁盘读卡、星轨整页、分盘这类）固定高亮时照样亮
  seamPaths: {
    '1': { d: 'M259,100 V202', badge: [259, 150] },
    '2': { d: 'M90,100 V502', badge: [90, 150] },
    '3': { d: 'M406,100 V202', badge: [406, 150] },
    '4': { d: 'M560,100 V442 H430 V502', badge: [560, 150] },
    '5': { d: 'M650,100 V202', badge: [650, 150] },
    '6': { d: 'M775,100 V142 H860 V202 M925,100 V202', badge: [818, 142] },
    '7': { d: 'M1010,100 V202', badge: [1010, 150] },
    '8': { d: 'M194,250 V352', badge: [194, 300] },
    '9': { d: 'M440,250 V352', badge: [440, 300] },
    '10': { d: 'M500,250 V292 H644 V352', badge: [610, 292] },
    '11': { d: 'M270,400 V502', badge: [270, 450] },
    '12': { d: 'M745,250 V352', badge: [745, 300] },
    '13': { d: 'M780,250 V285 H849 V502', badge: [849, 442] },
    '14': { d: 'M955,250 V290 H1010 V502', badge: [1010, 442] },
    '15': { d: 'M915,250 V352', badge: [915, 300] },
    '16': { d: 'M990,550 V652 M880,550 V652', badge: [990, 600] },
  },
  entries: {},
  moduleIcons: {
    workflow: Workflow,
    fumadocs: Plug,
    site: Globe,
    entry: PackageOpen,
    scan: ScanLine,
    model: Network,
    parse: FileText,
    serial: Braces,
    thumbs: Images,
    disk: Orbit,
    canvas: Palette,
    layout: Radar,
    react: Atom,
  },
  entryIcons: {},
};
