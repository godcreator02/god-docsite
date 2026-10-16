'use client';
/**
 * DocsiteSeams 的坐标与图标。内容在 seams.data.mjs；这里只有 SeamLayout：
 * 能力方块用 cap() 给左上角与宽度（高度固定），接缝走线与编号圆点手写，线不压字、圆点不落在方块上、不压别的线。
 * 左列工作台（四个服务竖排），左上与中列之间只走 1 号（注册命令，竖线 x=320）与 5 号（托管记在设置与数据里，竖线 x=288）；
 * 中列 gwb-docsite 五个能力竖排，2 号（命令 ↔ 服务）是模块内的短竖线；
 * 3 号（gwb-collab → 服务）经中列框右侧的走廊（x=672）下去，不从框顶进——顶上有模块标题行；
 * 右上平台包、右下开发服务；6、7、8 号从中列右侧过去；4 号（建站 → 建站器，在中列最低处）从下方绕开开发服务框，
 * 沿右缘（x=1008）上到平台包——线长正好呼应「建站器在插件旁边、运行时才加载」。
 */
import { AppWindow, Package, Plug, Server, Users } from 'lucide-react';
import type { JSX } from 'react';
import { SeamDiagram, cap } from '@godcreator/explainer/site';
import type { SeamLayout } from '@godcreator/explainer/site';
import { docsiteSeams } from './seams.data.mjs';

const layout: SeamLayout = {
  view: { w: 1032, h: 632 },
  caps: {
    // 左列：工作台的四个服务竖排（说明书在最上，命令、设置、数据依次）
    'skills-service': cap(48, 68, 192),
    'commands-service': cap(48, 132, 192),
    'settings-service': cap(48, 196, 192),
    'data-service': cap(48, 260, 192),
    // 顶中：gwb-collab 的一个能力
    'collab-user': cap(376, 68, 252),
    // 中列：gwb-docsite 的五个能力竖排
    'service-cap': cap(376, 212, 252),
    'commands-cap': cap(376, 296, 252),
    'host-cap': cap(376, 380, 252),
    'push-cap': cap(376, 464, 252),
    'scaffold-cap': cap(376, 548, 252),
    // 右上：平台包与功能包
    'scaffold-pkg': cap(744, 68, 236),
    'bundled-pkg': cap(744, 132, 236),
    'readonly-pkg': cap(744, 196, 236),
    // 右下：站点开发服务
    'dev-process': cap(744, 340, 236),
    'home-page': cap(744, 404, 236),
    feed: cap(744, 468, 236),
    'comments-route': cap(744, 532, 236),
  },
  groups: {
    workbench: { x: 24, y: 24, w: 240, h: 300 },
    'gwb-collab': { x: 352, y: 24, w: 300, h: 104 },
    'gwb-docsite': { x: 352, y: 168, w: 300, h: 440 },
    packages: { x: 724, y: 24, w: 272, h: 232 },
    'dev-server': { x: 724, y: 296, w: 272, h: 296 },
  },
  seamPaths: {
    // 命令服务 → 命令：从 commands-service 右边经走廊（x=320）下到 commands-cap 左边
    '1': { d: 'M240,156 H320 V320 H376', badge: [320, 240] },
    // 命令 ↔ 服务：中列内两块之间的短竖线
    '2': { d: 'M502,260 V296', badge: [502, 278] },
    // gwb-collab → 服务：从 collab-user 右边出去，经中列框右侧的走廊（x=672）下去，进 service-cap 右边
    '3': { d: 'M628,92 H672 V236 H628', badge: [672, 164] },
    // 建站与加功能 → 平台建站器：从中列最低的能力出来，从开发服务框下方绕过，沿右缘（x=1016，离两框都 20）上到右上
    '4': { d: 'M628,572 H680 V612 H1016 V92 H980', badge: [840, 612] },
    // 托管 → 设置与数据：从 host-cap 左边经走廊（x=288）上去，分两支进两个服务
    '5': { d: 'M376,404 H288 V220 H240 M288,284 H240', badge: [288, 330] },
    // 托管 → 子进程：从 host-cap 右边经走廊（x=688）抬到 dev-process 左边
    '6': { d: 'M628,404 H688 V364 H744', badge: [688, 384] },
    // 推送 → 频道：push-cap 与 feed 几乎同高，一条水平线
    '7': { d: 'M628,490 H744', badge: [676, 490] },
    // 写评论 → /comments.data：从 push-cap 右边偏下出去，经 x=700（离开发服务框左缘 24）下到 comments-route 左边
    '8': { d: 'M628,508 H700 V556 H744', badge: [700, 530] },
  },
  entries: {},
  moduleIcons: {
    workbench: AppWindow,
    'gwb-collab': Users,
    'gwb-docsite': Plug,
    packages: Package,
    'dev-server': Server,
  },
  entryIcons: {},
};

export function DocsiteSeams(): JSX.Element {
  return <SeamDiagram graph={docsiteSeams} layout={layout} />;
}
