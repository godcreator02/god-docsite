/**
 * 命令行与项目内部接缝图（workflow.data.mjs）的坐标与图标。按依赖方向从上往下排：
 * fumadocs 适配与命令行；项目配置、项目装配与钉码编排；记号写法、组件格式与读文件和 git；mdx 格式；
 * 使用方的仓、生成物、引用与清单、钉码核心；卡格式与星轨盘。
 * 命令行去探针、钉码核心、星轨盘的线走画布右边的竖道，fumadocs 适配去 mdx 格式与卡格式的线走左边；
 * 钉码编排去两个格式的线在组件格式与读文件和 git 之间往下走；两个格式去记号写法的线在记号写法下面会合；
 * 读文件与 git、钉码编排去钉码核心的线从 mdx 格式右边的空处穿过；摆放去 mdx 格式的线从生成物与引用与清单之间往上走。
 */
import { Blocks, Braces, Cog, FileCode, FileOutput, FolderGit2, HardDrive, Library, List, Orbit, Pin, Plug, SquareTerminal, Tag, Terminal } from 'lucide-react';
import { cap } from '../diagram';
import type { SeamLayout } from '../diagram';

export const workflowLayout: SeamLayout = {
  view: { w: 1100, h: 914 },
  caps: {
    'fd-disk': cap(74, 82, 110),
    'fd-cardset': cap(194, 82, 90),
    'fd-remark': cap(330, 82, 215),
    main: cap(594, 82, 250),
    report: cap(854, 82, 106),
    bin: cap(970, 82, 96),

    cfgfile: cap(74, 232, 136),
    config: cap(240, 232, 110),
    load: cap(470, 232, 164),
    'pn-check': cap(682, 232, 200),
    'pn-confirm': cap(892, 232, 120),

    'mk-formal': cap(74, 382, 130),
    'mk-key': cap(214, 382, 90),
    'cd-rw': cap(346, 382, 90),
    reader: cap(514, 382, 96),
    history: cap(620, 382, 104),
    git: cap(750, 382, 140),
    probe: cap(900, 382, 140),

    'md-tree': cap(74, 532, 165),
    'md-lint': cap(249, 532, 110),
    'md-rw': cap(369, 532, 130),
    'md-render': cap(509, 532, 160),

    'repo-git': cap(74, 682, 84),
    'repo-fs': cap(168, 682, 96),
    placing: cap(306, 682, 104),
    'ref-types': cap(466, 682, 130),
    pinner: cap(640, 682, 130),
    algo: cap(790, 682, 148),
    'pin-types': cap(948, 682, 110),

    'card-dir': cap(74, 832, 96),
    'card-keys': cap(180, 832, 180),
    'card-refs': cap(370, 832, 120),
    'card-scan': cap(500, 832, 168),
    'traj-types': cap(710, 832, 136),
    'traj-born': cap(856, 832, 90),
    'traj-build': cap(956, 832, 90),
  },
  groups: {
    fumadocs: { x: 60, y: 50, w: 499, h: 94 },
    cli: { x: 580, y: 50, w: 500, h: 94 },
    'config-file': null,
    assembly: { x: 226, y: 200, w: 422, h: 94 },
    pinning: { x: 668, y: 200, w: 358, h: 94 },
    marker: { x: 60, y: 350, w: 258, h: 94 },
    code: { x: 332, y: 350, w: 118, h: 94 },
    io: { x: 500, y: 350, w: 554, h: 94 },
    mdx: { x: 60, y: 500, w: 623, h: 94 },
    repo: { x: 60, y: 650, w: 218, h: 94 },
    output: { x: 292, y: 650, w: 140, h: 94 },
    reference: { x: 452, y: 650, w: 158, h: 94 },
    pin: { x: 626, y: 650, w: 446, h: 94 },
    cards: { x: 60, y: 800, w: 622, h: 94 },
    trajectory: { x: 696, y: 800, w: 364, h: 94 },
  },
  // 线只画到一端的时候，另一端（报告、探针、确认写回、摆放、卡集合、卡里不许钉码这类）固定高亮时照样亮。
  // 7 与 8 在左边的竖道上、3 4 5 在右边的竖道上，外道的线先拐出去、后拐回来，互不交叉。
  // 14 与 17 各是一条接缝的两个分支：14 从钉码编排分到两个格式，17 从两个格式会合到记号写法
  seamPaths: {
    '1': { d: 'M610,130 V232', badge: [610, 172] },
    '2': { d: 'M700,130 V232', badge: [700, 172] },
    '3': { d: 'M780,130 V176 H1070 V406 H1040', badge: [1070, 280] },
    '4': { d: 'M810,130 V166 H1080 V706 H1058', badge: [1080, 560] },
    '5': { d: 'M836,130 V156 H1090 V856 H1046', badge: [1090, 780] },
    '6': { d: 'M520,130 V232', badge: [520, 172] },
    '7': { d: 'M350,130 V150 H44 V556 H74', badge: [200, 150] },
    '8': { d: 'M74,106 H30 V856 H74', badge: [30, 500] },
    '9': { d: 'M634,256 H682', badge: [658, 256] },
    '10': { d: 'M560,280 V382', badge: [560, 306] },
    '11': { d: 'M705,430 V682', badge: [705, 600] },
    '12': { d: 'M820,430 V682', badge: [820, 540] },
    '13': { d: 'M240,256 H210', badge: [225, 256] },
    '14': { d: 'M700,280 V330 H420 V382 M475,330 V532', badge: [620, 330] },
    '15': { d: 'M120,730 V832', badge: [120, 781] },
    '16': { d: 'M737,280 V682', badge: [737, 472] },
    '17': { d: 'M190,532 V430 M360,430 V480 H190', badge: [190, 460] },
    '18': { d: 'M410,706 H442 V622 H530 V580', badge: [486, 622] },
    '19': { d: 'M668,856 H710', badge: [689, 856] },
    '20': { d: 'M650,130 V186 H370 V320 H260 V382', badge: [315, 320] },
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
    code: Braces,
    io: HardDrive,
    mdx: FileCode,
    output: FileOutput,
    cards: Library,
    reference: List,
    pin: Pin,
    repo: FolderGit2,
    trajectory: Orbit,
  },
  entryIcons: { human: SquareTerminal },
};
