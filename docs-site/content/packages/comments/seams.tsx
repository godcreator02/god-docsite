'use client';
/**
 * CommentsSeams 的坐标与图标。内容在 seams.data.mjs；这里只有 SeamLayout：
 * 能力方块用 cap() 给左上角与宽度（高度固定 48），接缝走线与编号圆点手写，线不压字、圆点不落在方块上。
 * comments 包内两列错开半层：左列 core 与 node、右列 site，接缝的横线都走在两列能力之间的空隙高度上。
 * 1 号（写入 action → identity 的 authorizeWrite）沿 comments 框右缘外的走廊下去；
 * 2 号（action ⇢ 评论文件）走左列与站点目录之间的走廊分两支进串头、回复；
 * 3 号（评论文件 → loader）走同一条走廊更下方，再横穿包内空隙进 loader；
 * 4 号（CommentsDock → site/browser）是右列里相邻两块的短竖线；
 * 5 号（gwb-docsite / gwb-collab → node 读目录）走 comments 框与右列之间的走廊，起点在 store 的中心高。
 */
import { Database, Fingerprint, Inbox, MessageSquare, Monitor, Plug, Users } from 'lucide-react';
import type { JSX } from 'react';
import { SeamDiagram, cap } from '@godcreator/explainer/site';
import type { SeamLayout } from '@godcreator/explainer/site';
import { commentsSeams } from './seams.data.mjs';

const layout: SeamLayout = {
  view: { w: 1140, h: 590 },
  caps: {
    // 左列：站点目录的两个文件竖排
    head: cap(40, 76, 210),
    reply: cap(40, 150, 210),
    // comments 包左列：core 三个加 node 一个，竖排
    file: cap(370, 76, 180),
    anchor: cap(370, 146, 180),
    threads: cap(370, 222, 180),
    store: cap(370, 292, 180),
    // comments 包右列：site 四个，与左列错开半层
    action: cap(565, 110, 180),
    loader: cap(565, 182, 180),
    dock: cap(565, 254, 180),
    browser: cap(565, 326, 180),
    // 中列下方：identity 包
    authorize: cap(370, 496, 180),
    // 右列：用它的四方
    'template-route': cap(810, 56, 290),
    'collab-pages': cap(810, 184, 290),
    'gwb-comments': cap(810, 300, 290),
    'gwb-inbox': cap(810, 428, 290),
  },
  groups: {
    'site-dir': { x: 20, y: 20, w: 250, h: 208 },
    comments: { x: 350, y: 20, w: 400, h: 380 },
    identity: { x: 350, y: 440, w: 400, h: 130 },
    template: { x: 790, y: 20, w: 330, h: 108 },
    collab: { x: 790, y: 148, w: 330, h: 108 },
    'gwb-docsite': { x: 790, y: 276, w: 330, h: 108 },
    'gwb-collab': { x: 790, y: 404, w: 330, h: 108 },
  },
  seamPaths: {
    // 写入 action → authorizeWrite：从 action 右边沿框外走廊下去，进 authorize 右边；编号圆点放在 identity 框上方的空地
    '1': { d: 'M745,134 H760 V520 H550', badge: [760, 420] },
    // 写入 action ⇢ 串头、回复：从 action 左边走走廊（x=316）分两支，圆点放在走廊空地
    '2': { d: 'M565,134 H316 V100 H250 M316,134 V174 H250', badge: [316, 137] },
    // 串头、回复 → loader：走廊更下方（x=340）汇合，横穿包内两列之间的空隙进 loader 左边，圆点放在走廊空地
    '3': { d: 'M250,100 H340 V206 H565 M250,174 H340', badge: [340, 190] },
    // CommentsDock → site/browser：右列里相邻两块的短竖线
    '4': { d: 'M655,302 V326', badge: [655, 314] },
    // gwb-docsite / gwb-collab → node 读目录：从 store 的中心高走右列外侧的走廊上去
    '5': { d: 'M550,316 H778 V324 H810 M810,452 H778', badge: [778, 388] },
  },
  entries: {},
  moduleIcons: {
    'site-dir': Database,
    comments: MessageSquare,
    identity: Fingerprint,
    template: Monitor,
    collab: Users,
    'gwb-docsite': Plug,
    'gwb-collab': Inbox,
  },
  entryIcons: {},
};

export function CommentsSeams(): JSX.Element {
  return <SeamDiagram graph={commentsSeams} layout={layout} />;
}
