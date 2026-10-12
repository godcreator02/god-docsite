/**
 * 站的功能包内部接缝图（docfirst-site.data.mjs）的坐标与图标。按依赖方向从上往下：文档站基础包；
 * 包的出口文件（remark 插件、站点出口、路由表、样式）；辅助文件、两条路由与模板；workflow、星轨盘包与 fumadocs 本体；站点目录。
 * 往下的线都从上一行两个框之间的空处穿过；读术语表的线走画布最左边，模板去轨迹卡目录的线走画布最右边。
 */
import { CircleDot, FileText, FolderGit2, Layers, LayoutTemplate, Library, Link, Orbit, Paintbrush, PanelsTopLeft, Puzzle, Route, Telescope, Workflow } from 'lucide-react';
import { cap } from '@godcreator/docsite-explainer';
import type { SeamLayout } from '@godcreator/docsite-explainer';

export const docfirstSiteLayout: SeamLayout = {
  view: { w: 1100, h: 740 },
  caps: {
    'kit-source': cap(94, 52, 160),
    'kit-site': cap(276, 52, 510),
    'kit-alias': cap(800, 52, 140),
    'kit-init': cap(950, 52, 120),

    'ct-terms': cap(34, 202, 70),
    'ct-plugin': cap(114, 202, 124),
    'site-links': cap(276, 202, 80),
    'site-mdx': cap(366, 202, 100),
    'rt-table': cap(508, 202, 165),
    'css-site': cap(711, 202, 90),

    'pf-frame': cap(34, 352, 124),
    'th-base': cap(198, 352, 192),
    'disk-loader': cap(428, 352, 90),
    'disk-page': cap(528, 352, 124),
    'card-loader': cap(690, 352, 80),
    'card-page': cap(780, 352, 156),
    'tpl-coll': cap(968, 352, 104),

    'wf-load': cap(34, 502, 90),
    'wf-remark': cap(134, 502, 160),
    'wf-css': cap(304, 502, 110),
    'wf-scan': cap(424, 502, 90),
    'tj-disk': cap(545, 502, 205),
    'fd-ui': cap(779, 502, 128),
    'fd-mdx': cap(914, 502, 118),

    'root-glossary': cap(34, 652, 120),
    'root-config': cap(810, 652, 130),
    'root-cards': cap(950, 652, 120),
  },
  groups: {
    kit: { x: 20, y: 20, w: 1060, h: 94 },
    content: { x: 20, y: 170, w: 228, h: 94 },
    site: { x: 262, y: 170, w: 218, h: 94 },
    routes: { x: 494, y: 170, w: 193, h: 94 },
    styles: { x: 697, y: 170, w: 160, h: 94 },
    'pin-frame': { x: 20, y: 320, w: 156, h: 94 },
    href: { x: 184, y: 320, w: 220, h: 94 },
    disk: { x: 414, y: 320, w: 248, h: 94 },
    card: { x: 676, y: 320, w: 276, h: 94 },
    template: { x: 958, y: 320, w: 122, h: 94 },
    workflow: { x: 20, y: 470, w: 508, h: 94 },
    trajectory: null,
    fumadocs: { x: 765, y: 470, w: 278, h: 94 },
    root: { x: 20, y: 620, w: 1060, h: 94 },
  },
  // 线只画到一端的时候，另一端（星轨盘页的 loader、卡页、读术语表、项目配置这类）固定高亮时照样亮。
  // 10 从包外层框与星轨盘地址框之间的空处往下（x 180），15 从星轨盘地址框与星轨盘页框之间的空处往下（x 409）
  seamPaths: {
    '1': { d: 'M200,100 V202', badge: [200, 142] },
    '2': { d: 'M316,100 V202', badge: [316, 142] },
    '3': { d: 'M575,100 V202', badge: [575, 142] },
    '4': { d: 'M750,100 V202', badge: [750, 142] },
    '5': { d: 'M1020,100 V352', badge: [1020, 142] },
    '6': { d: 'M880,100 V352', badge: [880, 142] },
    '7': { d: 'M134,250 V352', badge: [134, 292] },
    '8': { d: 'M300,250 V352', badge: [300, 292] },
    '9': { d: 'M500,400 V502', badge: [500, 442] },
    '10': { d: 'M180,250 V502', badge: [180, 456] },
    '11': { d: 'M144,400 V502', badge: [144, 428] },
    '12': { d: 'M590,400 V502', badge: [590, 442] },
    '13': { d: 'M840,400 V502', badge: [840, 442] },
    '14': { d: 'M1000,400 V502', badge: [1000, 442] },
    '15': { d: 'M409,250 V502', badge: [409, 442] },
    '16': { d: 'M34,226 H10 V676 H34', badge: [10, 450] },
    '17': { d: 'M1060,400 V652', badge: [1060, 590] },
  },
  entries: {},
  moduleIcons: {
    kit: LayoutTemplate,
    content: Puzzle,
    site: PanelsTopLeft,
    routes: Route,
    styles: Paintbrush,
    'pin-frame': CircleDot,
    href: Link,
    disk: Telescope,
    card: FileText,
    template: Library,
    workflow: Workflow,
    trajectory: Orbit,
    fumadocs: Layers,
    root: FolderGit2,
  },
  entryIcons: {},
};
