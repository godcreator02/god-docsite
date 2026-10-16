'use client';
/**
 * CodePinSeams 的坐标与图标。内容在 seams.data.mjs；这里只有 SeamLayout：
 * 能力方块用 cap() 给左上角与宽度（高度固定），接缝走线与编号圆点手写，线不压字、圆点不落在方块上。
 * code-pin 包占左边一个大框：左列 core 三块，右列 node 四块加 site 一块；两个磁盘框在各自列的正下方，
 * 让读与写回的虚线竖直下去（7、9 号）。4 号走两列之间走廊的右半进 marker/compare 右缘，
 * 5 号走 core 列下方的间隙绕到左缘进 marker/compare，与 4 号互不交叉；
 * 磁盘框里的落点避开框标题行（10 号绕 docs 框左缝，7 号绕 pinned 框左缘，9 号走右缘）。
 */
import { FileOutput, FileText, GitBranch, Monitor, Pin, Terminal } from 'lucide-react';
import type { JSX } from 'react';
import { SeamDiagram, cap } from '@godcreator/explainer/site';
import type { SeamLayout } from '@godcreator/explainer/site';
import { codePinSeams } from './seams.data.mjs';

const layout: SeamLayout = {
  view: { w: 1080, h: 690 },
  caps: {
    // code-pin 左列：core 三块
    marker: cap(64, 110, 180),
    compare: cap(64, 230, 180),
    pinner: cap(64, 350, 180),
    // code-pin 右列：node 四块加 site 一块
    'docs-io': cap(380, 90, 220),
    uncommitted: cap(380, 158, 220),
    remark: cap(380, 226, 220),
    history: cap(380, 294, 220),
    reader: cap(380, 362, 220),
    // 右列：docfirst 两个能力竖排，站点在中、doc-export 在下（让 3、5 号各自的走线互不交叉）
    'doc-check': cap(800, 64, 240),
    'doc-uncommitted': cap(800, 128, 240),
    'site-wire': cap(800, 250, 240),
    'export-code': cap(800, 370, 240),
    // 磁盘上的两种东西：文档在 core 列正下方，被钉的代码在 node 列正下方（两块竖排）
    'mdx-page': cap(56, 516, 110),
    'data-file': cap(176, 516, 110),
    'workspace-file': cap(380, 516, 220),
    'git-store': cap(380, 596, 220),
  },
  groups: {
    'code-pin': { x: 36, y: 16, w: 600, h: 420 },
    docfirst: { x: 780, y: 16, w: 280, h: 180 },
    site: { x: 780, y: 206, w: 280, h: 104 },
    'doc-export': { x: 780, y: 326, w: 280, h: 104 },
    docs: { x: 36, y: 460, w: 270, h: 130 },
    pinned: { x: 352, y: 460, w: 284, h: 204 },
  },
  seamPaths: {
    // docfirst 核对与确认 → node 整篇：走廊里下来进 docs-io 右边
    '1': { d: 'M800,88 H664 V114 H600', badge: [664, 101] },
    // docfirst 问未提交 → node 未提交判断：同一条走廊更靠里下来
    '2': { d: 'M800,152 H652 V182 H600', badge: [652, 167] },
    // 站点接线 → remark 插件：水平上来一点进 remark 右边
    '3': { d: 'M800,274 H688 V250 H600', badge: [740, 274] },
    // remark → 标记读写与核对：走两列走廊的右半，双支进左列两块的右缘（marker 高、compare 低）
    '4': { d: 'M380,250 H300 V134 H244 M300,266 H244', badge: [300, 192] },
    // doc-export → 标记读写与核对：走 node 列的间隙横到 core 列下方，绕左缝上去，双支进左列两块的左缘
    '5': { d: 'M800,394 H676 V286 H52 V150 H64 M52,230 H64', badge: [52, 220] },
    // 核对 → Reader 接口：从 compare 底缘下去横过走廊，进 reader 左边（横段在 8 号之下，竖线更深）
    '6': { d: 'M154,278 V344 H336 V386 H380', badge: [336, 365] },
    // reader ⇢ 工作区文件：绕 pinned 框左缘外侧竖直下去，进 workspace-file 左边（避开框标题行）
    '7': { d: 'M380,398 H320 V540 H380', badge: [320, 470] },
    // 核对 → History 接口：横段在 6 号之上、竖线浅，进 history 左边
    '8': { d: 'M190,278 V330 H316 V318 H380', badge: [254, 330] },
    // history ⇢ git 对象库：走 code-pin 框右缘内侧竖直下去，进 git-store 右边（避开框标题）
    '9': { d: 'M600,318 H620 V620 H600', badge: [620, 560] },
    // 确认 ⇢ 文档：pinner 底缘下来，沿两框之间的走廊走 docs 框左缝；双支落 mdx-page 左边与 data-file 顶中
    '10': { d: 'M170,398 V448 H20 V540 H56 M20,500 H270 V516', badge: [20, 494] },
  },
  entries: {},
  moduleIcons: {
    'code-pin': Pin,
    docfirst: Terminal,
    'doc-export': FileOutput,
    site: Monitor,
    docs: FileText,
    pinned: GitBranch,
  },
  entryIcons: {},
};

export function CodePinSeams(): JSX.Element {
  return <SeamDiagram graph={codePinSeams} layout={layout} />;
}
