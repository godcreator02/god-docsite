/**
 * 功能包内部的接缝图（collab-site.data.mjs）的坐标，用数据流的画法（flow-seam-diagram.tsx）。
 * 上面一排从左到右：gwb-collab 插件、基础包、服务端函数、交给基础包的出口（下面多一行日志页集合）、浅底圈住的浏览器里的界面；
 * 下面一排：站点检查、日志页、本机协作仓。最上面是定格式的数据模型包与 site-data.ts。线的路径按送东西的方向写。
 */
import { Blocks, BookOpen, Braces, CalendarDays, Database, FileCheck2, FolderGit2, Globe, LayoutGrid, PanelsTopLeft, Server } from 'lucide-react';
import { cap } from '@godcreator/explainer/site';
import type { FlowSeamLayout } from '../flow-seam-diagram';

/** 上面一排每一行能力方块的上边 */
const R1 = 236;
const R2 = 296;
const R3 = 356;
const R4 = 416;
const R5 = 476;
/** 下面一排能力方块的上边 */
const L1 = 536;
const L2 = 596;
const L3 = 656;
/** 本机协作仓里能力方块的上边，读写磁盘的竖线停在这里 */
const RLOCAL = 796;
const mid = (row: number) => row + 24;

/** 各列能力方块的左边 */
const COL_PLUGIN = 46;
const COL_KIT = 316;
const COL_SERVER = 626;
const COL_FEATURE = 936;
const COL_UI = 1246;

export const collabSiteLayout: FlowSeamLayout = {
  view: { w: 1540, h: 880 },
  caps: {
    hosting: cap(COL_PLUGIN, R1, 168),
    submit: cap(COL_PLUGIN, R3, 168),
    feed: cap(COL_KIT, R1, 196),
    identity: cap(COL_KIT, R2, 196),
    kitcheck: cap(COL_KIT, R3, 196),
    sitedata: cap(COL_SERVER, R1, 196),
    write: cap(COL_SERVER, R2, 196),
    mentions: cap(COL_SERVER, R3, 196),
    layout: cap(COL_FEATURE, R1, 196),
    routes: cap(COL_FEATURE, R2, 196),
    mdx: cap(COL_FEATURE, R3, 196),
    journalcoll: cap(COL_FEATURE, R4, 196),
    provider: cap(COL_UI, R1, 210),
    writer: cap(COL_UI, R2, 210),
    pages: cap(COL_UI, R3, 210),
    bar: cap(COL_UI, R4, 210),
    recordlink: cap(COL_UI, R5, 210),
    journalfiles: cap(COL_FEATURE, L1, 196),
    journalmention: cap(COL_FEATURE, L2, 196),
    journalcheck: cap(COL_FEATURE, L3, 196),
    sitecheckfn: cap(COL_KIT, L3, 196),
    models: cap(476, 66, 228),
    contract: cap(996, 66, 188),
    records: cap(COL_SERVER, RLOCAL, 196),
    journaldir: cap(COL_FEATURE, RLOCAL, 196),
  },
  groups: {
    'gwb-collab': { x: 30, y: 200, w: 200, h: 220 },
    docsite: { x: 300, y: 200, w: 228, h: 220 },
    server: { x: 610, y: 200, w: 228, h: 220 },
    feature: { x: 920, y: 200, w: 228, h: 280 },
    ui: { x: 1230, y: 200, w: 242, h: 340 },
    journal: { x: 920, y: 500, w: 228, h: 220 },
    sitecheck: { x: 300, y: 620, w: 228, h: 100 },
    'collab-model': { x: 460, y: 40, w: 260, h: 80 },
    'site-data': { x: 980, y: 40, w: 220, h: 80 },
    collabrepo: { x: 610, y: 760, w: 538, h: 100 },
  },
  regions: [{ box: { x: 1216, y: 172, w: 272, h: 384 }, label: '浏览器里' }],
  seamPaths: {
    '1': { d: `M214,${mid(R1)} H316`, badge: [240, mid(R1)], arrows: 'end', payload: { text: 'SiteFeed', at: [265, 290] } },
    '2': { d: `M512,270 H626`, badge: [540, 270], arrows: 'end', payload: { text: '数据 · 身份', at: [551, 296] } },
    '3': { d: `M512,248 H560 V160 H1420 V${R1}`, badge: [760, 160], arrows: 'end', payload: { text: 'SiteFeed', at: [1060, 152] } },
    '4': { d: `M700,${R3 + 48} V${RLOCAL}`, badge: [700, 600], arrows: 'both', payload: { text: '记录文件', at: [748, 560] } },
    // 从协作仓上来，先进日志页；在 x=1180 分出一支往上，进日志页集合（箭头只画在日志页那一头）
    '5': { d: `M1180,${mid(L1)} V${mid(R4)} H1132 M1100,${RLOCAL} V744 H1180 V${mid(L1)} H1132`, badge: [1180, 650], arrows: 'end', payload: { text: '<日期>.mdx', at: [1132, 738] } },
    '6': { d: `M936,${mid(L1)} H870 V${mid(R3)} H822`, badge: [870, 470], arrows: 'end', payload: { text: '原文', at: [903, 552] } },
    '7': { d: `M822,${mid(R1)} H936`, badge: [850, mid(R1)], arrows: 'end', payload: { text: '协作数据', at: [862, 246] } },
    '8': { d: `M1132,${mid(R1)} H1246`, badge: [1160, mid(R1)], arrows: 'end', payload: { text: '协作数据', at: [1172, 246] } },
    '9': { d: `M1246,${mid(R2)} H1132`, badge: [1160, mid(R2)], arrows: 'end', payload: { text: '写入请求', at: [1172, 306] } },
    '10': { d: `M936,${mid(R2)} H822`, badge: [850, mid(R2)], arrows: 'end', payload: { text: '请求', at: [870, 306] } },
    '11': { d: `M1246,${mid(R5)} H1200 V${mid(R3)} H1132`, badge: [1200, 470], arrows: 'end', payload: { text: '组件', at: [1166, 372] } },
    '12': { d: `M316,${mid(L3)} H130 V${R3 + 48}`, badge: [130, 560], arrows: 'end', payload: { text: '问题清单', at: [223, 672] } },
    '13': { d: `M414,${R3 + 48} V${L3}`, badge: [414, 530], arrows: 'end', payload: { text: '问题清单', at: [466, 560] } },
    '14': { d: `M936,${mid(L3)} H512`, badge: [620, mid(L3)], arrows: 'end', payload: { text: '文件名问题', at: [830, 672] } },
  },
  contracts: [
    {
      module: 'collab-model',
      seams: ['1', '2', '3', '4'],
      ports: [],
      paths: [
        // 到 ①：往左绕过基础包，从插件与基础包之间落下
        `M500,120 V140 H290 V${mid(R1)}`,
        // 到 ③ ② ④：从基础包与服务端函数之间直下，再从服务端函数下面接到读写记录的竖线上
        'M590,120 V460 H700',
      ],
      dots: [
        [290, mid(R1)],
        [590, 160],
        [590, 270],
        [700, 460],
      ],
      labels: [
        { text: '格式', at: [395, 136] },
        { text: '格式', at: [645, 454] },
      ],
    },
    {
      module: 'site-data',
      seams: ['7', '8', '9', '10'],
      ports: [],
      paths: [
        // 到 ⑦ ⑩：服务端函数与交给基础包的出口之间
        `M1010,120 V140 H905 V${mid(R2)}`,
        // 到 ⑧ ⑨：交给基础包的出口与界面之间
        `M1180,120 V140 H1210 V${mid(R2)}`,
      ],
      dots: [
        [905, mid(R1)],
        [905, mid(R2)],
        [1210, mid(R1)],
        [1210, mid(R2)],
      ],
      labels: [
        { text: '格式', at: [955, 136] },
        { text: '格式', at: [1196, 190] },
      ],
    },
  ],
  ports: [],
  entries: {
    member: { box: { x: 1385, y: 40, w: 140, h: 26 }, arrow: [1455, 66, 1455, 200] },
  },
  moduleIcons: {
    'gwb-collab': LayoutGrid,
    docsite: BookOpen,
    server: Server,
    feature: Blocks,
    ui: PanelsTopLeft,
    journal: CalendarDays,
    sitecheck: FileCheck2,
    'collab-model': Database,
    'site-data': Braces,
    collabrepo: FolderGit2,
  },
  entryIcons: { member: Globe },
};
