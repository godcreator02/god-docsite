/**
 * 命令行与项目内部接缝图（workflow.data.mjs）的坐标与图标。按依赖方向从上往下六行：
 * fumadocs 适配与命令行；项目配置、项目装配与钉码编排；记号写法与读文件和 git；mdx 格式；生成物与读卡、引用与清单、钉码核心；
 * 使用方的仓与轨迹核心。命令行去探针、钉码核心、轨迹核心的三条线走画布右边的三条竖道，fumadocs 适配去 mdx 格式与读卡目录的线走左边；
 * 读文件与 git、钉码编排去钉码核心的线从 mdx 格式右边的空处穿过。
 */
import { Blocks, Cog, FileCode, FileOutput, FolderGit2, HardDrive, List, Orbit, Pin, Plug, SquareTerminal, Tag, Terminal } from 'lucide-react';
import { cap } from '../diagram';
import type { SeamLayout } from '../diagram';

export const workflowLayout: SeamLayout = {
  view: { w: 1100, h: 914 },
  caps: {
    'fd-disk': cap(74, 82, 160),
    'fd-remark': cap(330, 82, 215),
    main: cap(594, 82, 250),
    report: cap(854, 82, 106),
    bin: cap(970, 82, 96),

    cfgfile: cap(74, 232, 136),
    config: cap(240, 232, 110),
    load: cap(470, 232, 164),
    'pn-check': cap(682, 232, 200),
    'pn-confirm': cap(892, 232, 120),

    'mk-draft': cap(74, 382, 80),
    'mk-formal': cap(164, 382, 155),
    'mk-key': cap(329, 382, 90),
    reader: cap(494, 382, 96),
    history: cap(600, 382, 120),
    git: cap(750, 382, 140),
    probe: cap(900, 382, 140),

    'md-tree': cap(74, 532, 165),
    'md-rw': cap(249, 532, 130),
    'md-lint': cap(389, 532, 110),
    'md-render': cap(509, 532, 160),

    'card-dir': cap(74, 682, 96),
    placing: cap(180, 682, 104),
    'card-refs': cap(294, 682, 128),
    'ref-types': cap(466, 682, 130),
    pinner: cap(640, 682, 130),
    algo: cap(790, 682, 148),
    'pin-types': cap(948, 682, 110),

    'repo-git': cap(74, 832, 84),
    'repo-fs': cap(168, 832, 96),
    'traj-text': cap(534, 832, 196),
    'traj-scan': cap(740, 832, 168),
    'traj-build': cap(918, 832, 110),
  },
  groups: {
    fumadocs: { x: 60, y: 50, w: 499, h: 94 },
    cli: { x: 580, y: 50, w: 500, h: 94 },
    'config-file': null,
    assembly: { x: 226, y: 200, w: 422, h: 94 },
    pinning: { x: 668, y: 200, w: 358, h: 94 },
    marker: { x: 60, y: 350, w: 373, h: 94 },
    io: { x: 480, y: 350, w: 574, h: 94 },
    mdx: { x: 60, y: 500, w: 623, h: 94 },
    output: { x: 60, y: 650, w: 376, h: 94 },
    reference: { x: 452, y: 650, w: 158, h: 94 },
    pin: { x: 626, y: 650, w: 446, h: 94 },
    repo: { x: 60, y: 800, w: 218, h: 94 },
    trajectory: { x: 520, y: 800, w: 522, h: 94 },
  },
  // 线只画到一端的时候，另一端（报告、探针、确认写回、摆放这类）固定高亮时照样亮。
  // 7 与 8 在左边两条竖道上、3 4 5 在右边三条竖道上，外道的线先拐出去、后拐回来，互不交叉
  seamPaths: {
    '1': { d: 'M610,130 V232', badge: [610, 172] },
    '2': { d: 'M700,130 V232', badge: [700, 172] },
    '3': { d: 'M780,130 V176 H1070 V406 H1040', badge: [1070, 280] },
    '4': { d: 'M810,130 V166 H1080 V706 H1058', badge: [1080, 560] },
    '5': { d: 'M836,130 V156 H1090 V856 H1028', badge: [1090, 780] },
    '6': { d: 'M520,130 V232', badge: [520, 172] },
    '7': { d: 'M350,130 V150 H44 V556 H74', badge: [200, 150] },
    '8': { d: 'M74,106 H30 V706 H74', badge: [30, 500] },
    '9': { d: 'M634,256 H682', badge: [658, 256] },
    '10': { d: 'M540,280 V382', badge: [540, 322] },
    '11': { d: 'M705,430 V682', badge: [705, 600] },
    '12': { d: 'M820,430 V682', badge: [820, 540] },
    '13': { d: 'M240,256 H210', badge: [225, 256] },
    '14': { d: 'M700,280 V310 H456 V472 H314 V532', badge: [385, 472] },
    '15': { d: 'M120,730 V832', badge: [120, 772] },
    '16': { d: 'M735,280 V682', badge: [735, 472] },
    '17': { d: 'M200,532 V430', badge: [200, 472] },
    '18': { d: 'M260,682 V622 H530 V580', badge: [400, 622] },
    '19': { d: 'M400,730 V772 H550 V832', badge: [475, 772] },
    '20': { d: 'M650,130 V186 H410 V382', badge: [410, 322] },
    '21': { d: 'M560,580 V682', badge: [560, 622] },
    '22': { d: 'M580,730 V760 H1003 V730', badge: [800, 760] },
  },
  entries: {
    human: { box: { x: 943, y: 8, w: 150, h: 26 }, arrow: [1018, 34, 1018, 82] },
  },
  moduleIcons: {
    cli: Terminal,
    fumadocs: Plug,
    'config-file': FolderGit2,
    assembly: Blocks,
    pinning: Cog,
    marker: Tag,
    io: HardDrive,
    mdx: FileCode,
    output: FileOutput,
    reference: List,
    pin: Pin,
    repo: FolderGit2,
    trajectory: Orbit,
  },
  entryIcons: { human: SquareTerminal },
};
