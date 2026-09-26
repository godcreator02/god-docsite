/**
 * 轨迹核心内部接缝图（trajectory.data.mjs）的坐标与图标。调用方在最上；左半边是出口 . 这一路：扫描、主入口、
 * 校验与建模、文本解析依次往下，左边留一条竖线给 workflow 直通文本解析；右半边是画盘这一路：星轨盘，
 * 往下是序列化与 react、画布层、布局计算，星轨盘到画布层的线走序列化与 react 之间的空隙。
 * 两半之间留一条竖线给卡集合直通字段表。
 */
import { Atom, Braces, FileText, Network, Orbit, PackageOpen, Palette, Plug, Radar, ScanLine, Workflow } from 'lucide-react';
import { cap } from '../diagram';
import type { SeamLayout } from '../diagram';

export const trajectoryLayout: SeamLayout = {
  view: { w: 1100, h: 734 },
  caps: {
    'card-refs': cap(34, 52, 130),
    'card-dir': cap(174, 52, 100),
    cli: cap(284, 52, 136),
    cardset: cap(500, 52, 100),
    load: cap(640, 52, 190),
    css: cap(860, 52, 170),

    'scan-cards': cap(154, 202, 80),
    pick: cap(244, 202, 100),
    build: cap(392, 202, 124),
    'star-disk': cap(700, 202, 128),
    'star-css': cap(930, 202, 84),

    'parse-card': cap(154, 352, 136),
    'build-model': cap(300, 352, 110),
    'to-json': cap(589, 352, 110),
    'to-runtime': cap(709, 352, 110),
    react: cap(900, 352, 130),

    lines: cap(34, 502, 207),
    fm: cap(251, 502, 124),
    keys: cap(385, 502, 90),
    body: cap(34, 560, 245),
    settings: cap(700, 502, 102),
    stage: cap(812, 502, 90),

    chains: cap(589, 652, 184),
    skeleton: cap(783, 652, 152),
    rings: cap(945, 652, 90),
  },
  groups: {
    workflow: { x: 20, y: 20, w: 414, h: 94 },
    fumadocs: { x: 486, y: 20, w: 558, h: 94 },
    scan: { x: 140, y: 170, w: 218, h: 94 },
    entry: { x: 378, y: 170, w: 152, h: 94 },
    disk: { x: 686, y: 170, w: 342, h: 94 },
    model: { x: 140, y: 320, w: 284, h: 94 },
    serial: { x: 575, y: 320, w: 258, h: 94 },
    react: null,
    parse: { x: 20, y: 470, w: 469, h: 152 },
    canvas: { x: 686, y: 470, w: 230, h: 94 },
    layout: { x: 575, y: 620, w: 474, h: 94 },
  },
  // 线只画到一端的时候，另一端（挑卡、读卡目录、设置项这类）固定高亮时照样亮
  seamPaths: {
    '1': { d: 'M259,100 V202', badge: [259, 150] },
    '2': { d: 'M90,100 V502', badge: [90, 150] },
    '3': { d: 'M406,100 V202', badge: [406, 150] },
    '4': { d: 'M560,100 V442 H430 V502', badge: [560, 150] },
    '5': { d: 'M740,100 V202', badge: [740, 150] },
    '6': { d: 'M970,100 V202', badge: [970, 150] },
    '7': { d: 'M194,250 V352', badge: [194, 300] },
    '8': { d: 'M400,250 V352', badge: [400, 300] },
    '9': { d: 'M500,250 V292 H644 V352', badge: [610, 292] },
    '10': { d: 'M270,400 V502', badge: [270, 450] },
    '11': { d: 'M764,250 V352', badge: [764, 300] },
    '12': { d: 'M790,250 V300 H849 V502', badge: [849, 442] },
    '13': { d: 'M820,250 V285 H960 V352', badge: [960, 318] },
    '14': { d: 'M857,550 V652 M750,550 V652', badge: [857, 600] },
  },
  entries: {},
  moduleIcons: {
    workflow: Workflow,
    fumadocs: Plug,
    entry: PackageOpen,
    scan: ScanLine,
    model: Network,
    parse: FileText,
    serial: Braces,
    disk: Orbit,
    canvas: Palette,
    layout: Radar,
    react: Atom,
  },
  entryIcons: {},
};
