'use client';
/**
 * CollabSeams 的坐标与图标。内容在 seams.data.mjs；这里只有 SeamLayout：
 * 能力方块用 cap() 给左上角与宽度（高度固定），接缝走线与编号圆点手写，线不压字、圆点不落在方块上。
 * 三列：左协作仓（框外）、中 collab 包（四个能力竖排）、右用它的三方（gwb-collab、站点、执行器）。
 * 4 号（gwb-collab 提交前检查 → 状态与校验）与 2 号（站点 action → 写入规则）按两边能力中心的高度走
 * 两列之间的竖直走廊（x≈652）；1 号（读快照 ⇠ 三个文件）走协作仓与 collab 包之间的走廊（x=310）分三支；
 * 6 号（推 SiteFeed）沿右缘（x=1002）从 gwb-collab 绕到站点的通知栏。
 */
import { Database, Monitor, Plug, Server, Users } from 'lucide-react';
import type { JSX } from 'react';
import { SeamDiagram, cap } from '@godcreator/explainer/site';
import type { SeamLayout } from '@godcreator/explainer/site';
import { collabSeams } from './seams.data.mjs';

const layout: SeamLayout = {
  view: { w: 1020, h: 540 },
  caps: {
    // 左列：协作仓的三个文件竖排
    records: cap(40, 76, 210),
    people: cap(40, 150, 210),
    journal: cap(40, 224, 210),
    // 中列：collab 包的四个能力竖排
    state: cap(372, 64, 244),
    write: cap(372, 152, 244),
    io: cap(372, 244, 244),
    merge: cap(372, 416, 244),
    // 右上：gwb-collab 的两个能力并排
    'gwb-check': cap(700, 64, 134),
    'gwb-feed': cap(846, 64, 134),
    // 右中：站点的三个能力竖排
    'site-pages': cap(700, 212, 272),
    'site-feed': cap(700, 272, 272),
    'site-action': cap(700, 332, 272),
    // 右下：执行器
    runner: cap(700, 466, 272),
  },
  groups: {
    repo: { x: 20, y: 20, w: 250, h: 268 },
    collab: { x: 350, y: 20, w: 288, h: 508 },
    'gwb-collab': { x: 680, y: 20, w: 312, h: 132 },
    site: { x: 680, y: 168, w: 312, h: 232 },
    runner: { x: 680, y: 424, w: 312, h: 104 },
  },
  seamPaths: {
    // 读快照与写文件 ⇠ 三个文件：从 io 左边到走廊 x=310，分三支进三个文件的右边
    '1': { d: 'M372,268 H310 V100 H250 M310,174 H250 M310,248 H250', badge: [340, 268] },
    // 站点 action → 写入规则：从 action 左边走两列之间的走廊上去，进 write 右边
    '2': { d: 'M700,356 H652 V176 H616', badge: [652, 266] },
    // 写入规则 → 读快照与写文件：包内短竖线，编号圆点卡在两个能力方块之间
    '3': { d: 'M494,200 V244', badge: [494, 222] },
    // gwb-collab 提交前检查 → 状态与校验：两边中心同高的水平线
    '4': { d: 'M700,88 H616', badge: [658, 88] },
    // 执行器 → 合并检查：从 runner 左边经走廊抬到 merge 的中心高
    '5': { d: 'M700,490 H656 V440 H616', badge: [656, 465] },
    // gwb-collab ⇢ 站点通知栏：沿右缘绕到 site-feed 右边
    '6': { d: 'M980,88 H1002 V296 H972', badge: [1002, 180] },
  },
  entries: {},
  moduleIcons: {
    repo: Database,
    collab: Users,
    'gwb-collab': Plug,
    site: Monitor,
    runner: Server,
  },
  entryIcons: {},
};

export function CollabSeams(): JSX.Element {
  return <SeamDiagram graph={collabSeams} layout={layout} />;
}
