'use client';
/**
 * DocfirstSeams 的坐标与图标。内容在 seams.data.mjs；这里只有 SeamLayout：
 * 能力方块用 cap() 给左上角与宽度（高度固定），接缝走线与编号圆点手写，线不压字、圆点不落在方块上。
 * 走线大致三层：第一行 docfirst 到第二行三个包的线走两行之间的走廊与右侧绕行，
 * 到第三行的线（1、3、9、10、11，读写磁盘，虚线）走两包之间的竖直通道下去。
 */
import { FileOutput, FolderOpen, GitBranch, Orbit, Pin, SquareTerminal, Terminal } from 'lucide-react';
import type { JSX } from 'react';
import { SeamDiagram, cap } from '@godcreator/explainer/site';
import type { SeamLayout } from '@godcreator/explainer/site';
import { docfirstSeams } from './seams.data.mjs';

const layout: SeamLayout = {
  view: { w: 1060, h: 640 },
  caps: {
    // 第 1 行：docfirst 的四个能力横排
    cli: cap(288, 56, 132),
    config: cap(434, 56, 120),
    project: cap(568, 56, 128),
    commands: cap(722, 56, 250),
    // 第 2 行：code-pin、doc-export 的三个能力竖排，trajectory 两个
    'pin-workspace': cap(52, 196, 220),
    uncommitted: cap(52, 254, 220),
    formats: cap(52, 312, 220),
    placements: cap(368, 196, 220),
    outputs: cap(368, 254, 220),
    'roster-check': cap(368, 312, 220),
    scan: cap(740, 196, 180),
    model: cap(740, 254, 180),
    // 第 3 行：repo 与 site-files 的四个能力横排
    'source-git': cap(60, 502, 160),
    'status-area': cap(268, 502, 180),
    'config-file': cap(464, 502, 140),
    'output-files': cap(620, 502, 258),
    'card-dir': cap(894, 502, 86),
  },
  groups: {
    docfirst: { x: 264, y: 16, w: 720, h: 108 },
    'code-pin': { x: 36, y: 158, w: 300, h: 222 },
    'doc-export': { x: 352, y: 158, w: 340, h: 222 },
    trajectory: { x: 724, y: 158, w: 318, h: 174 },
    repo: { x: 44, y: 470, w: 192, h: 130 },
    'site-files': { x: 252, y: 470, w: 736, h: 130 },
  },
  seamPaths: {
    // config → config-file：从 config 底部经 doc-export 与 trajectory 之间的通道下到第三行
    '1': { d: 'M540,104 V144 H716 V444 H534 V504', badge: [610, 144] },
    // config → placements：横到 doc-export 右缝标题右侧的竖线下来，进 placements 右边
    '2': { d: 'M470,104 V128 H658 V220 H588', badge: [666, 200] },
    // project → status-area：经 doc-export 与 trajectory 之间的通道下去，落在 site-files 标题右侧
    '3': { d: 'M640,104 V136 H700 V452 H442 V504', badge: [480, 452] },
    // project → pin-workspace、formats：横到 code-pin 右缝，两支分别进右边
    '4': { d: 'M590,104 V152 H296 V220 H272 M296,336 H272', badge: [292, 210] },
    // project → outputs：落进 doc-export 右缝标题右侧，进 outputs 右边
    '5': { d: 'M634,104 V136 H626 V278 H588', badge: [626, 250] },
    // commands → pin-workspace、uncommitted、formats：从右边出，绕过三个包的下方，沿 code-pin 左缝上来
    '6': { d: 'M972,80 H996 V400 H44 V220 H52 M44,278 H52 M44,336 H52', badge: [500, 400] },
    // commands → outputs、roster-check：沿 docfirst 框底部横到 doc-export 右缝标题右侧
    '7': { d: 'M730,104 V112 H642 V336 H588 M642,278 H588', badge: [642, 205] },
    // commands → scan、model：横到 trajectory 左缝（标题左侧），主干进 model，分支进 scan
    '8': { d: 'M780,104 V148 H732 V278 H740 M732,220 H740', badge: [756, 148] },
    // pin-workspace、uncommitted → source-git、status-area：主支落在 repo 标题右侧，支线绕到 status-area 左边进
    '9': { d: 'M272,220 H308 V440 H190 V502 M272,278 H344 V448 H244 V526 H268', badge: [220, 440] },
    // outputs → output-files：从 outputs 左边出去，沿第二行下方横到落点上方
    '10': { d: 'M368,278 H360 V428 H749 V504', badge: [560, 428] },
    // scan → card-dir：从 scan 右边沿 trajectory 右缝直落
    '11': { d: 'M920,220 H937 V504', badge: [937, 386] },
  },
  entries: {
    run: { box: { x: 16, y: 36, w: 224, h: 44 }, arrow: [240, 58, 260, 58] },
  },
  moduleIcons: {
    docfirst: Terminal,
    'code-pin': Pin,
    'doc-export': FileOutput,
    trajectory: Orbit,
    'site-files': FolderOpen,
    repo: GitBranch,
  },
  entryIcons: { run: SquareTerminal },
};

export function DocfirstSeams(): JSX.Element {
  return <SeamDiagram graph={docfirstSeams} layout={layout} />;
}
