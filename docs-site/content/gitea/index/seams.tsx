'use client';
/**
 * NasSeams 的坐标与图标。内容在 seams.data.mjs；这里只有 SeamLayout：
 * 能力方块用 cap() 给左上角与宽度（高度固定），接缝走线与编号圆点手写，线不压字、圆点不落在方块上。
 * 三列：左「人在网页上配的」四个能力竖排，中 NAS（Gitea 左上、执行器左下、ntfy 右下），右「成员的电脑」三个能力竖排。
 * 2、3 号（Gitea ⇄ 执行器）是包内两条平行竖线（x=364、470）；4 号（Gitea ⇢ ntfy）从 Gitea 右缘拐下进 ntfy 顶部；
 * 1 号（调 Gitea）主干连提交审核、支线拐下连建仓配仓；5、6 号（⇢ ntfy 发 leads changed / ntfy 推来消息）
 * 是 subscribe 与 ntfy 之间的两条水平线；7 号（组织密钥）从左列直连执行器。
 */
import { Laptop, Server, Settings } from 'lucide-react';
import type { JSX } from 'react';
import { SeamDiagram, cap } from '@godcreator/explainer/site';
import type { SeamLayout } from '@godcreator/explainer/site';
import { nasSeams } from './seams.data.mjs';

const layout: SeamLayout = {
  view: { w: 1080, h: 468 },
  caps: {
    // 左列：网页上配的四样竖排；组织密钥与执行器同高，第 7 号直连
    org: cap(38, 76, 190),
    teams: cap(38, 152, 190),
    secret: cap(38, 300, 190),
    workflow: cap(38, 376, 190),
    // 中列：Gitea 左上、执行器左下、ntfy 右下（ntfy 与右列的实时推送同高）
    gitea: cap(304, 66, 226),
    runner: cap(304, 300, 226),
    ntfy: cap(556, 300, 156),
    // 右列：提交审核与 Gitea 同高（第 1 号主干），实时推送与 ntfy 同高（第 5、6 号水平线）
    submit: cap(788, 66, 254),
    setup: cap(788, 142, 254),
    subscribe: cap(788, 300, 254),
  },
  groups: {
    config: { x: 20, y: 20, w: 226, h: 424 },
    nas: { x: 282, y: 20, w: 448, h: 352 },
    member: { x: 770, y: 20, w: 290, h: 352 },
  },
  seamPaths: {
    // 提交审核、建仓配仓 → Gitea：主干连提交审核，支线从 x=648 拐下连建仓配仓
    '1': { d: 'M530,90 H788 M648,90 V166 H788', badge: [750, 90] },
    // Gitea → 执行器：NAS 内左边的竖线
    '2': { d: 'M364,114 V300', badge: [364, 190] },
    // 执行器 → Gitea：NAS 内右边的竖线
    '3': { d: 'M470,300 V114', badge: [470, 240] },
    // Gitea ⇢ ntfy：从 Gitea 右缘拐下，进 ntfy 顶部
    '4': { d: 'M530,102 H596 V300', badge: [596, 200] },
    // 实时推送 ⇢ ntfy（发 leads changed）：两条水平线的上面一条
    '5': { d: 'M788,310 H712', badge: [744, 310] },
    // ntfy → 实时推送（推来消息）：两条水平线的下面一条
    '6': { d: 'M712,338 H788', badge: [756, 338] },
    // 组织密钥 → 执行器：左列直连
    '7': { d: 'M228,324 H304', badge: [266, 324] },
  },
  entries: {},
  moduleIcons: {
    config: Settings,
    nas: Server,
    member: Laptop,
  },
  entryIcons: {},
};

export function NasSeams(): JSX.Element {
  return <SeamDiagram graph={nasSeams} layout={layout} />;
}
