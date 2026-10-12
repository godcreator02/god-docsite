/**
 * 「执行器与自动合并」那一页的接缝图（auto-merge.data.mjs）的坐标与图标。上一行是成员的工作台与 Gitea，中间是协作仓 main 与 NAS 执行器，
 * 最下是合并检查包。Gitea 里的能力按它们接到执行器的位置排：Actions 在最左，正对着左下的工作流；接缝之间不交叉。
 */
import { Bot, FolderGit2, GitPullRequest, Package, Puzzle, Server } from 'lucide-react';
import { cap } from '@godcreator/docfirst-explainer';
import type { SeamLayout } from '@godcreator/docfirst-explainer';

export const autoMergeLayout: SeamLayout = {
  view: { w: 1100, h: 490 },
  caps: {
    submit: cap(30, 72, 172),

    actions: cap(254, 72, 150),
    pulls: cap(416, 72, 150),
    api: cap(578, 72, 150),
    secret: cap(740, 72, 150),
    npm: cap(902, 72, 170),

    workflow: cap(30, 222, 232),
    dep: cap(30, 280, 232),
    people: cap(30, 338, 232),

    job: cap(314, 222, 430),
    node: cap(756, 222, 150),
    cache: cap(918, 222, 154),

    cli: cap(314, 412, 300),
    model: cap(626, 412, 200),
    sitecheck: cap(838, 412, 234),
  },
  groups: {
    plugin: { x: 16, y: 40, w: 200, h: 94 },
    gitea: { x: 240, y: 40, w: 844, h: 94 },
    repo: { x: 16, y: 190, w: 260, h: 210 },
    runner: { x: 300, y: 190, w: 784, h: 94 },
    site: { x: 300, y: 380, w: 784, h: 94 },
  },
  // 2 只画 Actions 到执行器这一段，组织密钥那一端固定高亮时照样亮；5 只画 npm 源到检查工具这一段；
  // 8 从提交审核右边比 1 高的地方出来，在两个框之间往上，从 Gitea 框上方横过去，停在框的上边
  seamPaths: {
    '1': { d: 'M202,96 H254', badge: [228, 96] },
    '2': { d: 'M380,120 V222', badge: [380, 171] },
    '3': { d: 'M200,222 V170 H330 V120', badge: [265, 170] },
    '4': { d: 'M490,120 V222', badge: [490, 171] },
    '5': { d: 'M990,120 V222', badge: [990, 171] },
    '6': { d: 'M460,270 V412', badge: [460, 341] },
    '7': { d: 'M650,120 V222', badge: [650, 171] },
    '8': { d: 'M202,80 H232 V22 H660 V40', badge: [440, 22] },
  },
  entries: {
    ai: { box: { x: 52, y: 6, w: 128, h: 26 }, arrow: [116, 32, 116, 40] },
  },
  moduleIcons: {
    plugin: Puzzle,
    gitea: GitPullRequest,
    repo: FolderGit2,
    runner: Server,
    site: Package,
  },
  entryIcons: { ai: Bot },
};
