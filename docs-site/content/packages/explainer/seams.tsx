'use client';
/**
 * ExplainerSeams 的坐标与图标。内容在 seams.data.mjs；这里只有 SeamLayout：
 * 能力方块用 cap() 给左上角与宽度（高度固定），接缝走线与编号圆点手写，线不压字、圆点不落在方块上。
 */
import { Blocks, Braces, FileText, FolderOpen, Hammer, Palette, Plug, Terminal } from 'lucide-react';
import type { JSX } from 'react';
import { SeamDiagram, cap } from '@godcreator/explainer/site';
import type { SeamLayout } from '@godcreator/explainer/site';
import { explainerSeams } from './seams.data.mjs';

const layout: SeamLayout = {
  view: { w: 900, h: 625 },
  caps: {
    // 第 1 行
    mdx: cap(85, 46, 150),
    roster: cap(588, 46, 118),
    pincheck: cap(722, 46, 128),
    // 第 2 行
    view: cap(238, 180, 130),
    data: cap(383, 180, 170),
    ai: cap(568, 180, 105),
    // 第 3 行：site 在左、core 在右
    shells: cap(58, 320, 225),
    diagram: cap(298, 320, 130),
    parts: cap(58, 388, 320),
    graphdef: cap(508, 320, 235),
    colors: cap(758, 320, 107),
    texts: cap(508, 388, 285),
    // 第 4 行
    wiring: cap(128, 540, 145),
    css: cap(596, 540, 175),
  },
  groups: {
    page: { x: 40, y: 16, w: 240, h: 100 },
    docfirst: { x: 570, y: 16, w: 310, h: 100 },
    folder: { x: 220, y: 150, w: 470, h: 104 },
    site: { x: 40, y: 290, w: 410, h: 174 },
    core: { x: 490, y: 290, w: 395, h: 174 },
    feature: { x: 110, y: 510, w: 285, h: 100 },
    styles: { x: 578, y: 510, w: 310, h: 100 },
  },
  seamPaths: {
    // 页面（左上）→ 画面：绕开组件文件夹的标题，从画面左边进
    '1': { d: 'M160,94 V133 H200 V204 H238', badge: [200, 160] },
    // 画面 → 数据：两块并排，从底下绕
    '2': { d: 'M303,228 V242 H468 V228', badge: [385, 242] },
    // 画面 → 外壳与零件：从画面左边出，沿图左缘下来，分叉进两个能力
    '3': { d: 'M238,204 H30 V412 H58 M30,344 H58', badge: [134, 204] },
    // 机读规则 → 数据（底下绕）与 → 机读文字（沿右侧通道下去）
    '4': { d: 'M620,228 V242 H468 V228 M673,204 H750 V388', badge: [545, 242] },
    '5': { d: 'M647,94 V133 H620 V180', badge: [633, 133] },
    // 外壳、零件、接缝图画面 → 颜色名、接缝图内容：site 与 core 之间那条通道汇合后进 core
    '6': { d: 'M428,344 H508 M170,368 V378 H470 V344 M378,412 H470 V378', badge: [478, 344] },
    '7': { d: 'M273,564 H596', badge: [435, 564] },
    // docfirst 读数据文件核对钉码：读写磁盘上的文件，虚线
    '8': { d: 'M786,94 V140 H468 V180', badge: [560, 140] },
  },
  entries: {
    scaffold: { box: { x: 16, y: 542, w: 74, h: 44 }, arrow: [90, 564, 124, 564] },
  },
  moduleIcons: {
    page: FileText,
    folder: FolderOpen,
    site: Blocks,
    core: Braces,
    styles: Palette,
    feature: Plug,
    docfirst: Terminal,
  },
  entryIcons: { scaffold: Hammer },
};

export function ExplainerSeams(): JSX.Element {
  return <SeamDiagram graph={explainerSeams} layout={layout} />;
}
