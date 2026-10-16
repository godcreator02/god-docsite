'use client';
/**
 * CollabPluginSeams 的坐标与图标。内容在 seams.data.mjs；这里只有 SeamLayout：
 * 能力方块用 cap() 给左上角与宽度（高度固定），接缝走线与编号圆点手写，线不压字、圆点不落在别的线上。
 * 大致四层：顶上 Gitea 与 NAS（ntfy 直落 organization/events，两套上行读 Gitea 接口）；
 * 左中本机的仓（两套向左跑 git）；中下 gwb-collab 的五个目录（左列两套、右列组织事件、站点进程与通知）
 * 与左下打包进来的 collab 包（提交审核的检查下行去用）；底行通知的三个去处。
 * 6 号（两套 → 通知）的两条横线各跨过 2 号的竖线一次（走廊里线多，绕不开的两处交叉，其余线互不相交）。
 */
import { HardDrive, MessageCircle, Monitor, Package, PanelLeft, Plug, Server } from 'lucide-react';
import type { JSX } from 'react';
import { SeamDiagram, cap } from '@godcreator/explainer/site';
import type { SeamLayout } from '@godcreator/explainer/site';
import { collabPluginSeams } from './seams.data.mjs';

const layout: SeamLayout = {
  view: { w: 1120, h: 810 },
  caps: {
    // 顶行：Gitea 与 NAS 的三个能力横排（执行器在这页只是边界，没有线）
    api: cap(484, 52, 140),
    ntfy: cap(644, 52, 130),
    runner: cap(794, 52, 146),
    // 左中：本机的仓两个能力竖排，各对准两套
    'repo-collab': cap(40, 320, 160),
    'repo-others': cap(40, 410, 160),
    // 中间：gwb-collab 的五个目录，左列两套、右列组织事件、站点进程与通知
    'collab-repo': cap(300, 320, 180),
    'other-repos': cap(300, 410, 150),
    'org-events': cap(590, 240, 160),
    'site-process': cap(590, 320, 120),
    notifications: cap(590, 410, 140),
    // 左下：打包进来的 collab 包四个能力竖排
    'format-check': cap(40, 530, 176),
    'lead-only': cap(40, 600, 176),
    inbox: cap(40, 670, 176),
    'site-feed': cap(40, 740, 176),
    // 底行：通知的三个去处
    'notice-bar': cap(306, 700, 228),
    projects: cap(620, 700, 140),
    'private-chat': cap(830, 700, 180),
  },
  groups: {
    'gitea-nas': { x: 460, y: 16, w: 480, h: 120 },
    repos: { x: 20, y: 200, w: 200, h: 260 },
    plugin: { x: 280, y: 200, w: 520, h: 400 },
    'collab-pkg': { x: 20, y: 500, w: 232, h: 300 },
    site: { x: 280, y: 660, w: 280, h: 110 },
    pane: { x: 600, y: 660, w: 180, h: 110 },
    'qq-bot': { x: 810, y: 660, w: 220, h: 110 },
  },
  seamPaths: {
    // ntfy → organization/events：底中直落顶中
    '1': { d: 'M709,100 V240', badge: [709, 170] },
    // organization/events → 两套：走两列之间的走廊 x520 下行，分支进两套右缘（两套右缘的落点上下错开）
    '2': { d: 'M590,264 H520 V430 H450 M520,350 H480', badge: [520, 300] },
    // 两套 ⇢ 本机的仓：两条水平虚线（git 读写磁盘）
    '3': { d: 'M300,344 H200 M300,434 H200', badge: [250, 390] },
    // 两套 → Gitea 接口：协作仓那套从顶边出、绕两框之间的横带；别的仓那套从右缘最下出走廊 x566
    '4': { d: 'M460,320 V168 H540 V100 M450,454 H566 V100', badge: [500, 168] },
    // 提交审核 → collab 包两项检查：从协作仓那套底边出、横到两框之间的竖线下行分支（不贴别的仓右边）
    '5': { d: 'M465,368 V389 H268 V624 M268,554 H216 M268,624 H216', badge: [366, 389] },
    // 两套 → 通知：右中出走廊 x540 下行进通知左中；别的仓那套与进通知的横线同高相接
    '6': { d: 'M480,322 H540 V442 H590 M450,442 H540', badge: [540, 382] },
    // 通知 → 三个去处：底中下行，沿框外横带分三支下到出口顶中
    '7': { d: 'M660,458 V620 H420 V660 M660,620 V660 M660,620 H920 V660', badge: [660, 539] },
  },
  entries: {},
  moduleIcons: {
    'gitea-nas': Server,
    repos: HardDrive,
    plugin: Plug,
    'collab-pkg': Package,
    site: Monitor,
    pane: PanelLeft,
    'qq-bot': MessageCircle,
  },
  entryIcons: {},
};

export function CollabPluginSeams(): JSX.Element {
  return <SeamDiagram graph={collabPluginSeams} layout={layout} />;
}
