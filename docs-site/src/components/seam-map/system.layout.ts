/**
 * 全局接缝图（seam-map.data.mjs）的坐标与图标。能力按依赖方向从上往下，工作台插件与框外的东西在最上和最下两行。
 */
import { Bot, FolderGit2, Globe, Hammer, Layers, Orbit, Pin, Plug, Puzzle, SquareTerminal, Workflow } from 'lucide-react';
import { cap } from './diagram';
import type { SeamLayout } from './diagram';

export const systemLayout: SeamLayout = {
  view: { w: 1100, h: 750 },
  caps: {
    'fumadocs-core': cap(180, 82, 180),
    skills: cap(394, 82, 110),
    create: cap(516, 82, 170),
    wiring: cap(734, 82, 332),

    remark: cap(194, 222, 137),
    markdown: cap(341, 222, 137),
    pre: cap(488, 222, 137),
    roster: cap(635, 222, 137),
    cardset: cap(782, 222, 137),
    'disk-load': cap(929, 222, 137),

    cli: cap(194, 372, 68),
    marker: cap(270, 372, 66),
    mdx: cap(344, 372, 66),
    pinning: cap(418, 372, 72),
    project: cap(498, 372, 84),
    io: cap(590, 372, 110),
    placement: cap(708, 372, 86),
    'card-dir': cap(802, 372, 84),

    types: cap(194, 522, 136),
    pinner: cap(340, 522, 130),
    compare: cap(550, 522, 96),

    model: cap(714, 522, 120),
    layout: cap(844, 522, 100),
    disk: cap(954, 522, 112),

    root: cap(400, 676, 240),
    source: cap(650, 676, 160),
    outputs: cap(830, 676, 236),
  },
  groups: {
    plugin: { x: 380, y: 50, w: 320, h: 94 },
    'fumadocs-core': null,
    site: { x: 720, y: 50, w: 360, h: 94 },
    fumadocs: { x: 180, y: 190, w: 900, h: 94 },
    workflow: { x: 180, y: 340, w: 720, h: 94 },
    pin: { x: 180, y: 490, w: 480, h: 94 },
    trajectory: { x: 700, y: 490, w: 380, h: 94 },
    repo: { x: 180, y: 646, w: 900, h: 90 },
  },
  // 线停在框边上（6、7、8）表示接这个包里的几处能力，是哪几处看高亮。
  // 5 的另两端（卡集合、建模）与 8 落在项目根的那一端没有单独画线，固定高亮时照样亮
  seamPaths: {
    '1': { d: 'M303,420 V522', badge: [303, 462] },
    '2': { d: 'M600,420 V522', badge: [600, 462] },
    '3': { d: 'M454,420 V522', badge: [454, 462] },
    '4': { d: 'M815,420 V522', badge: [815, 462] },
    '5': { d: 'M1030,270 V522', badge: [1030, 400] },
    '6': { d: 'M600,284 V340', badge: [600, 312] },
    '7': { d: 'M265,190 V130', badge: [265, 160] },
    '8': { d: 'M905,190 V130', badge: [905, 160] },
    '9': { d: 'M520,420 V676', badge: [520, 612] },
    '10': { d: 'M666,420 V676', badge: [666, 612] },
    '11': { d: 'M730,420 V450 H688 V626 H900 V676', badge: [800, 626] },
    '12': { d: 'M686,106 H734', badge: [710, 106] },
  },
  entries: {
    agent: { box: { x: 440, y: 6, w: 200, h: 26 }, arrow: [540, 32, 540, 50] },
    next: { box: { x: 20, y: 222, w: 130, h: 48 }, arrow: [150, 246, 194, 246] },
    human: { box: { x: 20, y: 372, w: 130, h: 48 }, arrow: [150, 396, 194, 396] },
  },
  moduleIcons: {
    plugin: Puzzle,
    site: Globe,
    fumadocs: Plug,
    'fumadocs-core': Layers,
    workflow: Workflow,
    pin: Pin,
    trajectory: Orbit,
    repo: FolderGit2,
  },
  entryIcons: { agent: Bot, next: Hammer, human: SquareTerminal },
};
