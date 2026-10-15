'use client';
/**
 * RepoMap：总览页的接缝图。模块框、能力方块、接缝都由 SeamDiagram 画，
 * 这里只给坐标（SeamLayout 的 view / caps / groups / seamPaths）与图标。图的内容在 repo-map.data.mjs。
 * 走线都避开模块的标题行（框顶那行模块名加包名）：进出模块一律走框侧走廊——
 * 1 号绕平台框左缘进建站器左边，2 号横移到站点标题右侧再落；4 号与 6 号右支走协作与报告框右缘的走廊，
 * 6 号左支与 10 号走基础功能右侧（基础功能与文档功能之间）的走廊，6 号中支直落第一行右侧的 explainer 顶，
 * 10 号从 collab 左边出、沿两个功能组之间的走廊横到基础功能。垂直相交：6 右支与 4 号、10 号与 6 号左支、10 号与 11 号，均十字交叉。
 */
import type { JSX } from 'react';
import { BookOpen, FolderTree, LayoutTemplate, Package, Plug, Users } from 'lucide-react';
import { SeamDiagram, cap } from '@godcreator/explainer/site';
import type { SeamLayout } from '@godcreator/explainer/site';
import { repoMap } from './repo-map.data.mjs';

const layout: SeamLayout = {
  view: { w: 1040, h: 770 },
  caps: {
    'gwb-docsite': cap(356, 52, 130),
    'gwb-collab': cap(524, 52, 122),
    scaffold: cap(44, 226, 200),
    runtime: cap(44, 314, 200),
    wiring: cap(398, 226, 200),
    content: cap(398, 314, 210),
    identity: cap(42, 514, 162),
    comments: cap(42, 596, 162),
    'code-pin': cap(258, 514, 140),
    'doc-export': cap(444, 514, 140),
    explainer: cap(604, 514, 140),
    trajectory: cap(268, 596, 140),
    docfirst: cap(448, 596, 160),
    collab: cap(818, 514, 166),
    'word-report': cap(818, 596, 166),
  },
  groups: {
    plugins: { x: 340, y: 20, w: 320, h: 96 },
    platform: { x: 24, y: 180, w: 274, h: 220 },
    site: { x: 380, y: 180, w: 340, h: 220 },
    base: { x: 24, y: 470, w: 198, h: 190 },
    docs: { x: 250, y: 470, w: 520, h: 220 },
    'collab-report': { x: 794, y: 470, w: 232, h: 190 },
  },
  seamPaths: {
    // gwb-docsite → scaffold：出插件框底，绕平台框左缘（标题左边）下来进建站器左边
    '1': { d: 'M 420 100 V 150 H 34 V 250 H 44', badge: [290, 150] },
    // gwb-docsite ↔ 站点：横移到站点标题行右侧再直落接线文件顶
    '2': { d: 'M 470 100 V 160 H 560 V 226', badge: [560, 205] },
    // gwb-collab → gwb-docsite：插件框内两个能力之间的短横线
    '3': { d: 'M 486 76 H 524', badge: [505, 76] },
    // gwb-collab → collab：沿顶部走廊到右缘，走协作与报告框右缘的走廊下来进 collab 右边
    '4': { d: 'M 585 100 V 140 H 1000 V 530 H 984', badge: [1000, 320] },
    // 建站器 ↔ 接线文件：平台与站点之间的横线
    '5': { d: 'M 244 250 H 398', badge: [320, 250] },
    // 接线文件 → 三个功能组：左支绕到基础功能右侧的走廊进 identity 右边，中支直落第一行右侧的 explainer 顶，右支沿协作与报告框右缘进 word-report 右边
    '6': {
      d: 'M 470 274 V 294 H 356 V 425 H 240 V 538 H 204 M 510 274 V 294 H 672 V 514 M 580 274 V 294 H 1010 V 620 H 984',
      badge: [672, 380],
    },
    // comments → identity：基础功能框内两个能力之间的短竖线
    '7': { d: 'M 123 596 V 562', badge: [123, 580] },
    // doc-export → code-pin：文档功能框内第一行的短横线
    '8': { d: 'M 398 538 H 444', badge: [421, 538] },
    // docfirst → code-pin、doc-export、trajectory：两支向上进第一行，一支横进左边的 trajectory
    '9': { d: 'M 490 596 V 579 H 328 V 562 M 560 596 V 579 H 514 V 562 M 448 620 H 408', badge: [525, 579] },
    // collab → identity、comments：从 collab 左边出，沿两个功能组之间的走廊横到基础功能右侧，主干进 comments、支线进 identity
    '10': { d: 'M 818 538 H 800 V 445 H 232 V 620 H 204 M 232 550 H 204', badge: [280, 445] },
    // docfirst ↔ content：从文档功能右缘出去，沿协作与报告框外上去进站点的 content
    '11': { d: 'M 608 620 H 784 V 338 H 608', badge: [700, 620] },
  },
  entries: {},
  moduleIcons: {
    plugins: Plug,
    platform: LayoutTemplate,
    site: FolderTree,
    base: Package,
    docs: BookOpen,
    'collab-report': Users,
  },
  entryIcons: {},
};

export function RepoMap(): JSX.Element {
  return <SeamDiagram graph={repoMap} layout={layout} />;
}
