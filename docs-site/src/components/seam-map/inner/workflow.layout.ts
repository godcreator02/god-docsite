/**
 * 命令行与项目内部接缝图（workflow.data.mjs）的坐标与图标。调用方在最上：fumadocs 适配在左，命令行在右，入口从上面进可执行文件；
 * 第二行项目装配与钉码核心左右相邻，读盘与 git 在它们下面；再往下是项目配置、磁盘与 git、格式接口，mdx 格式，最下是生成物与读卡、轨迹核心。
 * 命令行去格式接口、生成物、轨迹核心的线走画布右边，fumadocs 适配去 mdx 格式与读卡目录的线走画布左边。
 */
import { Blocks, FileCode, FileOutput, FolderGit2, HardDrive, Orbit, Pin, Plug, Shapes, SquareTerminal, Terminal } from 'lucide-react';
import { cap } from '../diagram';
import type { SeamLayout } from '../diagram';

export const workflowLayout: SeamLayout = {
  view: { w: 1100, h: 924 },
  caps: {
    'fd-disk': cap(74, 82, 160),
    'fd-remark': cap(330, 82, 215),
    main: cap(594, 82, 250),
    report: cap(854, 82, 106),
    bin: cap(970, 82, 96),

    config: cap(74, 232, 196),
    migrate: cap(280, 232, 100),
    load: cap(390, 232, 164),
    service: cap(596, 232, 110),
    algo: cap(716, 232, 142),
    marker: cap(868, 232, 158),

    probe: cap(234, 382, 148),
    reader: cap(392, 382, 96),
    history: cap(596, 382, 112),
    git: cap(718, 382, 176),

    cfgfile: cap(74, 532, 196),
    'repo-git': cap(298, 532, 84),
    'repo-fs': cap(392, 532, 96),
    refusal: cap(536, 532, 205),
    reason: cap(751, 532, 96),
    'doc-format': cap(890, 532, 100),

    'md-tree': cap(74, 682, 165),
    'md-format': cap(249, 682, 150),
    'md-lint': cap(409, 682, 110),
    'md-render': cap(529, 682, 100),

    'card-dir': cap(74, 832, 110),
    placing: cap(194, 832, 110),
    'card-refs': cap(314, 832, 125),
    'traj-text': cap(494, 832, 196),
    'traj-scan': cap(700, 832, 168),
    'traj-build': cap(878, 832, 110),
  },
  groups: {
    fumadocs: { x: 60, y: 50, w: 499, h: 94 },
    cli: { x: 580, y: 50, w: 500, h: 94 },
    assembly: { x: 60, y: 200, w: 508, h: 94 },
    pin: { x: 582, y: 200, w: 458, h: 94 },
    io: { x: 220, y: 350, w: 688, h: 94 },
    'config-file': null,
    repo: { x: 284, y: 500, w: 218, h: 94 },
    format: { x: 522, y: 500, w: 482, h: 94 },
    mdx: { x: 60, y: 650, w: 583, h: 94 },
    output: { x: 60, y: 800, w: 393, h: 94 },
    trajectory: { x: 480, y: 800, w: 522, h: 94 },
  },
  // 线只画到一端的时候，另一端（迁移、报告、探针、历史、摆放这类）固定高亮时照样亮
  seamPaths: {
    '1': { d: 'M600,130 V172 H520 V232', badge: [560, 172] },
    '2': { d: 'M620,130 V190 H575 V240 H596', badge: [575, 215] },
    '3': { d: 'M830,130 V160 H1080 V904 H249 V880', badge: [660, 904] },
    '4': { d: 'M800,130 V184 H1052 V556 H990', badge: [1021, 556] },
    '5': { d: 'M815,130 V172 H1066 V856 H988', badge: [1024, 856] },
    '6': { d: 'M460,130 V232', badge: [460, 172] },
    '7': { d: 'M350,130 V150 H44 V706 H74', badge: [200, 150] },
    '8': { d: 'M74,106 H30 V856 H74', badge: [30, 780] },
    '9': { d: 'M554,256 H596', badge: [575, 256] },
    '10': { d: 'M440,280 V382', badge: [440, 322] },
    '11': { d: 'M650,382 V280', badge: [650, 322] },
    '12': { d: 'M786,382 V280', badge: [786, 322] },
    '13': { d: 'M140,280 V532', badge: [140, 406] },
    '14': { d: 'M256,580 V682', badge: [256, 622] },
    '15': { d: 'M470,430 V532', badge: [470, 472] },
    '16': { d: 'M950,280 V532', badge: [950, 472] },
    '17': { d: 'M590,682 V580', badge: [590, 622] },
    '18': { d: 'M515,280 V556 H536', badge: [515, 472] },
    '19': { d: 'M439,856 H494', badge: [466, 856] },
  },
  entries: {
    human: { box: { x: 943, y: 8, w: 150, h: 26 }, arrow: [1018, 34, 1018, 82] },
  },
  moduleIcons: {
    cli: Terminal,
    fumadocs: Plug,
    assembly: Blocks,
    io: HardDrive,
    output: FileOutput,
    mdx: FileCode,
    format: Shapes,
    pin: Pin,
    trajectory: Orbit,
    'config-file': FolderGit2,
    repo: FolderGit2,
  },
  entryIcons: { human: SquareTerminal },
};
