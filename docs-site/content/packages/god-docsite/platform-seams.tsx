'use client';
/**
 * PlatformSeams：平台包的接缝图。模块框、能力方块、接缝与入口都由 SeamDiagram 画，
 * 这里只给坐标（SeamLayout 的 view / caps / groups / seamPaths / entries）与图标。图的内容在 platform-seams.data.mjs。
 * 走线：1、3 两条沿左边进出建站器，2 号两条横线加一条绕到站点底边的支线，5 号从站点右缘下来、
 * 经构建期与运行时两框之间的空档接页面来源左缘（不穿运行时的标题），6 号沿右边绕到底部进构建期左下角，
 * 7 号沿左边与底部绕到运行时右缘，8 号从术语标注方块下方绕过；3 号与 2 号、7 号与 1 号各有一处垂直相交。
 */
import type { JSX } from 'react';
import { Cog, FolderTree, Globe, Hammer, Package, Play, Plug, Server, SquareTerminal } from 'lucide-react';
import { SeamDiagram, cap } from '@godcreator/explainer/site';
import type { SeamLayout } from '@godcreator/explainer/site';
import { platformSeams } from './platform-seams.data.mjs';

const layout: SeamLayout = {
  view: { w: 960, h: 780 },
  caps: {
    'gwb-scaffold': cap(40, 52, 122),
    'gwb-host': cap(170, 52, 118),
    'pkg-template': cap(562, 52, 146),
    'pkg-collections': cap(716, 52, 138),
    create: cap(44, 238, 232),
    add: cap(44, 298, 232),
    regen: cap(44, 358, 232),
    'site-files': cap(516, 238, 176),
    'site-config': cap(712, 238, 164),
    'site-features': cap(516, 298, 176),
    'site-generated': cap(712, 298, 164),
    vite: cap(40, 522, 118),
    glossary: cap(166, 522, 126),
    sources: cap(416, 518, 144),
    loaders: cap(572, 518, 144),
    merge: cap(728, 518, 136),
    origin: cap(416, 578, 144),
    feed: cap(728, 578, 136),
    serve: cap(254, 652, 112),
  },
  groups: {
    gwb: { x: 24, y: 20, w: 272, h: 96 },
    pkg: { x: 548, y: 20, w: 320, h: 96 },
    scaffold: { x: 24, y: 210, w: 272, h: 212 },
    site: { x: 500, y: 210, w: 392, h: 158 },
    build: { x: 24, y: 492, w: 272, h: 104 },
    runtime: { x: 400, y: 492, w: 480, h: 158 },
    cli: { x: 240, y: 620, w: 146, h: 104 },
  },
  seamPaths: {
    '1': { d: 'M 101 100 V 168 H 220 V 238 M 120 168 H 34 V 322 H 44 M 34 262 H 44', badge: [101, 142] },
    '2': { d: 'M 276 262 H 516 M 276 322 H 516 M 276 382 H 340 V 390 H 696 V 336 H 712', badge: [410, 322] },
    '3': { d: 'M 635 100 V 144 H 300 V 372 H 276 M 300 312 H 276 M 785 100 V 122 H 635', badge: [450, 144] },
    '4': { d: 'M 789 346 V 518', badge: [789, 430] },
    '5': { d: 'M 692 278 H 708 V 478 H 396 V 540 H 416 M 627 478 V 518', badge: [500, 478] },
    '6': { d: 'M 876 262 H 930 V 732 H 200 V 570', badge: [930, 480] },
    '7': { d: 'M 229 100 V 124 H 12 V 745 H 950 V 602 H 864', badge: [400, 745] },
    '8': { d: 'M 158 546 V 582 H 340 V 606 H 416 M 366 676 H 388 V 640 H 465 V 626', badge: [360, 606] },
  },
  entries: {
    // 浏览器的箭头落在「模板写出的文件」顶边的右三分之一（x=660），在模块标题文字（约到 x=605）右边，不穿标题
    browser: { box: { x: 612, y: 182, w: 96, h: 26 }, arrow: [660, 208, 660, 238] },
    rr: { box: { x: 742, y: 142, w: 210, h: 38 }, arrow: [847, 180, 847, 238] },
  },
  moduleIcons: {
    gwb: Plug,
    pkg: Package,
    scaffold: Hammer,
    site: FolderTree,
    build: Cog,
    runtime: Server,
    cli: SquareTerminal,
  },
  entryIcons: { browser: Globe, rr: Play },
};

export function PlatformSeams(): JSX.Element {
  return <SeamDiagram graph={platformSeams} layout={layout} />;
}
