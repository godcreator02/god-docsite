/**
 * 合并检查包自己的接缝图（collab-merge-check.data.mjs）的坐标与图标。上一行是使用方（gwb-collab、执行器），中间从左到右是
 * check、cli、bin 与 templates/，执行器的调用从右往左一路传到 check；下一行是协作仓。7 从执行器穿过 bin 与 templates/ 之间的空隙下到工作流文件。
 */
import { FileCog, FolderGit2, Puzzle, Server, ShieldCheck, SlidersHorizontal, SquareTerminal } from 'lucide-react';
import { cap } from '@godcreator/docsite-explainer';
import type { SeamLayout } from '@godcreator/docsite-explainer';

export const collabMergeCheckLayout: SeamLayout = {
  view: { w: 1130, h: 490 },
  caps: {
    submit: cap(50, 82, 260),
    job: cap(630, 82, 450),

    changed: cap(50, 242, 140),
    leadonly: cap(202, 242, 120),
    verdict: cap(334, 242, 90),
    cli: cap(504, 242, 130),
    bin: cap(704, 242, 150),
    tpl: cap(934, 242, 156),

    gitrepo: cap(50, 402, 394),
    wf: cap(934, 402, 156),
  },
  groups: {
    'plugin-out': { x: 30, y: 50, w: 300, h: 94 },
    runner: { x: 610, y: 50, w: 490, h: 94 },
    checkTs: { x: 30, y: 210, w: 414, h: 94 },
    cliTs: { x: 484, y: 210, w: 170, h: 94 },
    binTs: { x: 684, y: 210, w: 190, h: 94 },
    templates: { x: 914, y: 210, w: 196, h: 94 },
    repo: { x: 30, y: 370, w: 1080, h: 94 },
  },
  seamPaths: {
    '1': { d: 'M180,130 V210', badge: [180, 170] },
    '2': { d: 'M780,130 V210', badge: [780, 170] },
    '3': { d: 'M684,266 H654', badge: [669, 266] },
    '4': { d: 'M484,266 H444', badge: [464, 266] },
    '5': { d: 'M240,304 V370', badge: [240, 337] },
    '6': { d: 'M1012,304 V370', badge: [1012, 337] },
    '7': { d: 'M894,130 V418 H934', badge: [894, 250] },
  },
  entries: {},
  moduleIcons: {
    'plugin-out': Puzzle,
    runner: Server,
    checkTs: ShieldCheck,
    cliTs: SlidersHorizontal,
    binTs: SquareTerminal,
    templates: FileCog,
    repo: FolderGit2,
  },
  entryIcons: {},
};
