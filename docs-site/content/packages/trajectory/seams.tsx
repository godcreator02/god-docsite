'use client';
/**
 * TrajectorySeams 的坐标与图标。内容在 seams.data.mjs；这里只有 SeamLayout：
 * 能力方块用 cap() 给左上角与宽度（高度固定），接缝走线与编号圆点手写，线不压字、圆点不落在方块上、
 * 也不放在别的线上；线不贴着模块框边走（离框边至少 12px）。
 * trajectory 包占中列：左窄列是命令行到汇总再到建模、排盘的竖链（3、4、9、10 号在链上），
 * 右宽列是站点这条路的卡集合与两页 loader；两条路在第 8 号汇进同一个汇总（assembleCardSet）。
 * 5 号从卡集合下到两个框的下方再绕进卡目录，与 8 号在 (509,318) 有全图唯一一处线线交叉（附近没有编号圆点）。
 * 卡目录在左下（两条读卡路 2、5 号都通到它），docfirst 在右上，站点在右下。
 */
import { FolderOpen, Monitor, Orbit, Terminal } from 'lucide-react';
import type { JSX } from 'react';
import { SeamDiagram, cap } from '@godcreator/explainer/site';
import type { SeamLayout } from '@godcreator/explainer/site';
import { trajectorySeams } from './seams.data.mjs';

const layout: SeamLayout = {
  view: { w: 1060, h: 560 },
  caps: {
    // trajectory 包左窄列：命令行这条路下来的竖链
    scan: cap(290, 60, 204),
    single: cap(290, 150, 204),
    assemble: cap(290, 244, 204),
    model: cap(290, 338, 204),
    layout: cap(290, 432, 204),
    // trajectory 包右宽列：站点这条路
    collection: cap(524, 150, 214),
    loaders: cap(524, 244, 214),
    // 左下：卡目录（框外）
    dir: cap(32, 420, 182),
    // 右上：docfirst
    'df-cap': cap(808, 60, 216),
    // 右下：站点的两个页面
    'card-page': cap(808, 344, 216),
    'disk-page': cap(808, 412, 216),
  },
  groups: {
    dir: { x: 16, y: 380, w: 214, h: 118 },
    traj: { x: 266, y: 16, w: 486, h: 484 },
    df: { x: 788, y: 16, w: 256, h: 108 },
    site: { x: 788, y: 300, w: 256, h: 168 },
  },
  seamPaths: {
    // docfirst 命令 → node 读卡目录：跨过 trajectory 包右边框进 scan 的右边
    '1': { d: 'M808,84 H494', badge: [770, 84] },
    // 读卡目录 ⇢ 卡目录：沿包外左走廊（x=250）下到卡目录右边
    '2': { d: 'M290,84 H250 V444 H214', badge: [250, 250] },
    // scanCards 逐个 readCardFile：竖链第一节
    '3': { d: 'M392,108 V150', badge: [392, 129] },
    // readCardFile → assembleCardSet：竖链第二节（命令行这条路到汇总）
    '4': { d: 'M392,198 V244', badge: [392, 221] },
    // 卡集合 ⇢ 卡目录：从卡集合左边下出包底，在两个框的下方横过去，从卡目录底下进它的底边
    '5': { d: 'M524,186 H509 V530 H123 V468', badge: [300, 530] },
    // 卡集合 → 两页 loader：站点这边的竖链
    '6': { d: 'M631,198 V244', badge: [631, 221] },
    // 卡页与星轨盘页 → 两页 loader：两页合流经右走廊（x=770）进 loader 右边
    '7': { d: 'M808,368 H770 V278 H738 M808,436 H770', badge: [770, 320] },
    // 两页 loader → 汇总：从 loader 底下绕进汇总的底边（编号圆点离 5 号的竖线 20px 开外）
    '8': { d: 'M610,292 V318 H420 V292', badge: [540, 318] },
    // 汇总 → 建模：竖链第三节
    '9': { d: 'M392,292 V338', badge: [392, 315] },
    // 建模 → 排盘：竖链第四节
    '10': { d: 'M392,386 V432', badge: [392, 409] },
  },
  entries: {},
  moduleIcons: {
    dir: FolderOpen,
    traj: Orbit,
    df: Terminal,
    site: Monitor,
  },
  entryIcons: {},
};

export function TrajectorySeams(): JSX.Element {
  return <SeamDiagram graph={trajectorySeams} layout={layout} />;
}
