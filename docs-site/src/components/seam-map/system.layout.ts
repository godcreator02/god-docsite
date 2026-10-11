/**
 * 全局接缝图（seam-map.data.mjs）的坐标与图标。按依赖方向从上往下：fumadocs 本体、文档站基础包与工作台插件；
 * 站的功能包；fumadocs 适配；命令行与项目；钉码核心与星轨盘；使用方的仓。
 * fumadocs 适配右边空出一条竖道，站的功能包去命令行与项目、去星轨盘的两条线从那里往下走；
 * 功能包去项目根的线走画布最左边，工作台插件去项目根的线走画布最右边。
 */
import { Bot, FolderGit2, Hammer, Layers, LayoutTemplate, Orbit, Package, Pin, Plug, Puzzle, SquareTerminal, Workflow } from 'lucide-react';
import { cap } from '@godcreator/docfirst-explainer';
import type { SeamLayout } from '@godcreator/docfirst-explainer';

export const systemLayout: SeamLayout = {
  view: { w: 1100, h: 900 },
  caps: {
    'fumadocs-core': cap(180, 82, 220),
    kit: cap(430, 82, 200),
    skills: cap(714, 82, 110),
    create: cap(834, 82, 170),

    'site-content': cap(194, 222, 120),
    'site-mdx': cap(344, 222, 140),
    'site-cards': cap(514, 222, 130),
    'site-css': cap(674, 222, 110),
    'site-routes': cap(874, 222, 192),

    remark: cap(194, 372, 130),
    glossary: cap(334, 372, 110),
    cardset: cap(454, 372, 150),
    styles: cap(614, 372, 120),
    other: cap(744, 372, 226),

    cli: cap(194, 522, 68),
    marker: cap(270, 522, 66),
    mdx: cap(344, 522, 66),
    pinning: cap(418, 522, 72),
    project: cap(498, 522, 84),
    io: cap(590, 522, 110),
    placement: cap(708, 522, 86),
    cards: cap(802, 522, 84),

    types: cap(194, 672, 136),
    pinner: cap(340, 672, 130),
    compare: cap(550, 672, 96),

    model: cap(714, 672, 120),
    layout: cap(844, 672, 100),
    disk: cap(954, 672, 112),

    root: cap(400, 826, 240),
    source: cap(650, 826, 160),
    outputs: cap(830, 826, 236),
  },
  groups: {
    'fumadocs-core': null,
    'docsite-kit': null,
    plugin: { x: 700, y: 50, w: 380, h: 94 },
    'docfirst-site': { x: 180, y: 190, w: 900, h: 94 },
    fumadocs: { x: 180, y: 340, w: 810, h: 94 },
    workflow: { x: 180, y: 490, w: 720, h: 94 },
    pin: { x: 180, y: 640, w: 480, h: 94 },
    trajectory: { x: 700, y: 640, w: 380, h: 94 },
    repo: { x: 180, y: 796, w: 900, h: 90 },
  },
  // 线停在框边上（6、8 的两端，7、12、13 的一端）表示接这个包里的几处能力，是哪几处看高亮。
  // 7 从功能包的 remark 插件与侧栏入口之间穿过功能包的框；9 从钉码核心的两个方块之间穿过钉码核心的框
  seamPaths: {
    '1': { d: 'M303,570 V672', badge: [303, 612] },
    '2': { d: 'M600,570 V672', badge: [600, 612] },
    '3': { d: 'M454,570 V672', badge: [454, 612] },
    '4': { d: 'M815,570 V672', badge: [815, 612] },
    '5': { d: 'M1056,270 V672', badge: [1056, 600] },
    '6': { d: 'M600,434 V490', badge: [600, 462] },
    '7': { d: 'M329,340 V130', badge: [329, 312] },
    '8': { d: 'M560,284 V340', badge: [560, 312] },
    '9': { d: 'M520,570 V826', badge: [520, 760] },
    '10': { d: 'M666,570 V826', badge: [666, 760] },
    '11': { d: 'M730,570 V600 H688 V772 H900 V826', badge: [800, 772] },
    '12': { d: 'M1004,106 H1092 V841 H1080', badge: [1092, 300] },
    '13': { d: 'M1015,270 V530 H900', badge: [1015, 380] },
    '14': { d: 'M530,190 V130', badge: [530, 160] },
    '15': { d: 'M194,246 H14 V851 H400', badge: [14, 700] },
    '16': { d: 'M260,190 V130', badge: [260, 160] },
  },
  entries: {
    agent: { box: { x: 790, y: 6, w: 200, h: 26 }, arrow: [890, 32, 890, 50] },
    build: { box: { x: 430, y: 6, w: 200, h: 26 }, arrow: [530, 32, 530, 82] },
    human: { box: { x: 30, y: 522, w: 130, h: 48 }, arrow: [160, 546, 194, 546] },
  },
  moduleIcons: {
    'docfirst-site': Package,
    fumadocs: Plug,
    workflow: Workflow,
    pin: Pin,
    trajectory: Orbit,
    plugin: Puzzle,
    'docsite-kit': LayoutTemplate,
    'fumadocs-core': Layers,
    repo: FolderGit2,
  },
  entryIcons: { agent: Bot, build: Hammer, human: SquareTerminal },
};
