/**
 * 方案做完之后的 workflow 接缝图（workflow-plan.data.mjs）的坐标与图标。按依赖方向从上往下五行：
 * fumadocs 适配与命令行；卡格式与项目装配；钉码编排与两种格式、生成物；node/；包外的配置、磁盘与 git、钉码核心、星轨盘。
 * 读卡目录走画布左边的竖道，外部环境与轨迹走右边的两条竖道；装配去钉码编排与现状区去两种格式的两条线，
 * 横段一低一高，起点在右的那条走低，所以不交叉。进框的线都落在框标题文字的右边，不穿过标题。
 */
import { Blocks, FileCode, FileOutput, FolderGit2, Hammer, HardDrive, Library, Orbit, Pin, Plug, SquareTerminal, Terminal } from 'lucide-react';
import { cap } from '../diagram';
import type { SeamLayout } from '../diagram';

export const workflowPlanLayout: SeamLayout = {
  view: { w: 1120, h: 760 },
  caps: {
    'fd-cards': cap(74, 82, 190),
    'fd-remark': cap(274, 82, 200),
    'cli-cmds': cap(574, 82, 380),
    'cli-entry': cap(964, 82, 100),

    'card-dir': cap(74, 232, 170),
    'card-scan': cap(254, 232, 192),
    cfg: cap(494, 232, 170),
    zones: cap(674, 232, 180),
    load: cap(864, 232, 200),

    ref: cap(74, 382, 190),
    fmt: cap(274, 382, 180),
    pn: cap(464, 382, 180),
    placing: cap(694, 382, 370),

    dirfiles: cap(74, 532, 150),
    env: cap(234, 532, 170),
    reader: cap(414, 532, 120),
    history: cap(544, 532, 150),
    git: cap(704, 532, 170),
    probe: cap(884, 532, 180),

    cfgfile: cap(74, 682, 142),
    'repo-fs': cap(264, 682, 150),
    'repo-git': cap(424, 682, 142),
    pinner: cap(614, 682, 212),
    traj: cap(874, 682, 192),
  },
  groups: {
    fumadocs: { x: 60, y: 50, w: 430, h: 94 },
    cli: { x: 560, y: 50, w: 520, h: 94 },
    cards: { x: 60, y: 200, w: 400, h: 94 },
    assembly: { x: 480, y: 200, w: 600, h: 94 },
    formats: { x: 60, y: 350, w: 600, h: 94 },
    placing: { x: 680, y: 350, w: 400, h: 94 },
    node: { x: 60, y: 500, w: 1020, h: 94 },
    'config-file': null,
    repo: { x: 250, y: 650, w: 330, h: 94 },
    pin: { x: 600, y: 650, w: 240, h: 94 },
    trajectory: { x: 860, y: 650, w: 220, h: 94 },
  },
  // 线只画到一端的时候，另一端（钉码核心、卡解析、读取器与旧内容来源、git 原语这类）固定高亮时照样亮
  seamPaths: {
    '1': { d: 'M940,130 V232', badge: [940, 176] },
    '2': { d: 'M466,130 V176 H900 V232', badge: [680, 176] },
    '3': { d: 'M220,130 V232', badge: [220, 176] },
    '4': { d: 'M950,130 V160 H1106 V706 H1066', badge: [1106, 620] },
    '5': { d: 'M1000,280 V340 H560 V382', badge: [780, 340] },
    '6': { d: 'M1040,280 V382', badge: [1040, 331] },
    '7': { d: 'M700,280 V316 H380 V382', badge: [540, 316] },
    '8': { d: 'M1064,256 H1090 V556 H1064', badge: [1090, 420] },
    '9': { d: 'M74,256 H44 V556 H74', badge: [44, 406] },
    '10': { d: 'M500,580 V682', badge: [500, 631] },
    '11': { d: 'M250,580 V620 H150 V682', badge: [200, 620] },
    '12': { d: 'M680,580 V620 H790 V682', badge: [735, 620] },
  },
  entries: {
    human: { box: { x: 940, y: 8, w: 150, h: 26 }, arrow: [1014, 34, 1014, 82] },
    build: { box: { x: 300, y: 8, w: 150, h: 26 }, arrow: [374, 34, 374, 82] },
  },
  moduleIcons: {
    fumadocs: Plug,
    cli: Terminal,
    cards: Library,
    assembly: Blocks,
    formats: FileCode,
    placing: FileOutput,
    node: HardDrive,
    'config-file': FolderGit2,
    repo: FolderGit2,
    pin: Pin,
    trajectory: Orbit,
  },
  entryIcons: { human: SquareTerminal, build: Hammer },
};
