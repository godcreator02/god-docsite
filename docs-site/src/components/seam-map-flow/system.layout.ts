/**
 * 全局接缝图（system.data.mjs）的坐标、送什么、箭头方向、可替换的接口与格式约定，用数据流的画法（flow-seam-diagram.tsx）。
 * 横着分两行：上面一行是协作仓（y 262–480），下面一行是别的仓（y 500–658）。每行从左到右是 Gitea 上的仓、插件里管这种仓的能力、本机的克隆，
 * 线都是同一行里的水平线。左上是工作台，协作仓左边是执行器，Gitea 下面是 ntfy；最上面一排是 gwb-docsite 与基础包，
 * 功能包在本机协作仓右边，数据模型包在功能包下面。插件下边沿开两个可替换的接口，最下面一排是能接上的实现。
 * 线的路径按送东西的方向写，arrows 为 both 时两头都有箭头。
 */
import { AppWindow, Bell, Bot, Boxes, Database, FolderGit2, FolderTree, Globe, LayoutGrid, MessageCircle, PanelsTopLeft, Plug, Radio, Server, ServerCog, ShieldCheck, Terminal } from 'lucide-react';
import { cap } from '@godcreator/docsite-explainer';
import type { FlowSeamLayout } from './flow-seam-diagram';

/** 每一行能力方块的上边：TOP 是最上面一排（gwb-docsite 与基础包的第一行），R0 是插件第一行，R1–R3 是协作仓那一行，R4–R5 是别的仓那一行，R6 是插件最后一行 */
const TOP = 70;
const R0 = 150;
const R1 = 298;
const R2 = 358;
const R3 = 418;
const R4 = 536;
const R5 = 596;
const R6 = 716;
/** 一行能力方块的中线，水平线都走这里 */
const mid = (row: number) => row + 24;

export const systemLayout: FlowSeamLayout = {
  view: { w: 1820, h: 980 },
  caps: {
    giteacred: cap(264, R0, 146),
    automerge: cap(30, R1, 140),
    collabprs: cap(264, R1, 146),
    collabmain: cap(264, R2, 146),
    collaborators: cap(264, R3, 146),
    otherbranches: cap(264, R4, 146),
    otherprs: cap(264, R5, 146),
    ntfytopic: cap(264, R6, 146),

    cmds: cap(546, R0, 116),
    pane: cap(672, R0, 116),
    siteproc: cap(798, R0, 136),
    submit: cap(570, R1, 190),
    sync: cap(570, R2, 190),
    leads: cap(570, R3, 190),
    otherfetch: cap(570, R4, 190),
    otherwatch: cap(570, R5, 190),
    events: cap(546, R6, 116),
    handoff: cap(672, R6, 116),
    notify: cap(798, R6, 136),

    dsidentity: cap(1056, TOP, 168),
    dshost: cap(1056, R0, 168),
    kitcomments: cap(1306, TOP, 130),
    kitdev: cap(1306, R0, 130),
    kitfeed: cap(1650, R0, 104),

    worktree: { x: 1062, y: R1, w: 140, h: R2 + 48 - R1 },
    commentsdir: cap(1278, R1, 100),
    records: cap(1278, R2, 100),
    pages: cap(1278, R3, 100),
    otherwt: cap(1062, R4, 200),

    feature: cap(1536, R1, 104),
    siteui: cap(1650, R1, 104),
    server: cap(1536, R2, 104),
    sitecheck: cap(1650, R2, 104),
    models: cap(1536, 486, 218),
  },
  groups: {
    gwb: { x: 216, y: 114, w: 208, h: 98 },
    runner: { x: 20, y: 262, w: 160, h: 100 },
    collabremote: { x: 216, y: 262, w: 208, h: 218 },
    otherremote: { x: 216, y: 500, w: 208, h: 158 },
    ntfy: null,
    plugin: { x: 530, y: 108, w: 420, h: 700 },
    docsite: { x: 1040, y: 40, w: 200, h: 172 },
    kit: { x: 1290, y: 40, w: 480, h: 172 },
    collabrepo: { x: 1046, y: 262, w: 348, h: 218 },
    otherrepos: { x: 1046, y: 500, w: 348, h: 158 },
    site: { x: 1520, y: 262, w: 250, h: 158 },
    model: { x: 1520, y: 450, w: 250, h: 96 },
    zcode: { x: 672, y: 900, w: 124, h: 64 },
    claude: { x: 808, y: 900, w: 124, h: 64 },
    qq: { x: 944, y: 900, w: 124, h: 64 },
    otherchannel: { x: 1080, y: 900, w: 124, h: 64 },
  },
  regions: [
    { box: { x: 200, y: 232, w: 240, h: 442 }, label: 'Gitea · 一个项目一个私有组织' },
    { box: { x: 1030, y: 232, w: 380, h: 442 }, label: '本机 · 项目文件夹（以组织命名）' },
    { box: { x: 556, y: 266, w: 218, h: 212 }, label: '协作仓' },
    { box: { x: 556, y: 504, w: 218, h: 154 }, label: '别的仓' },
  ],
  seamPaths: {
    '1': { d: `M934,${mid(R0)} H1056`, badge: [990, mid(R0)], arrows: 'end', payload: { text: '托管 · 推数据', at: [995, mid(R0) - 14] } },
    // 从身份码方块左边沿出来，在插件框上面横过去，再落到命令方块的上边
    '2': { d: `M1056,${mid(TOP)} H630 V${R0}`, badge: [980, mid(TOP)], arrows: 'both', payload: { text: '身份码 · 加进人员列表', at: [880, mid(TOP) - 14] } },
    '3': { d: `M1224,${mid(R0)} H1306`, badge: [1265, mid(R0)], arrows: 'end', payload: { text: 'pnpm dev', at: [1265, mid(R0) - 14] } },
    '4': { d: `M1680,${R0 + 48} V${R1}`, badge: [1680, 236], arrows: 'end', payload: { text: '推来的数据', at: [1610, 240] } },
    '5': { d: `M1536,${mid(R2)} H1378`, badge: [1440, mid(R2)], arrows: 'both', payload: { text: '记录文件', at: [1424, mid(R2) - 14] } },
    // 从评论方块右边沿出来，沿本机项目文件夹与功能包之间的空处直下，横进评论与人员那一块
    '6': { d: `M1436,${mid(TOP)} H1460 V${mid(R1)} H1378`, badge: [1460, 250], arrows: 'both', payload: { text: '评论 · 人员列表', at: [1460, 226] } },
    '7': { d: `M570,${mid(R1)} H410`, badge: [440, mid(R1)], arrows: 'both', payload: { text: '合并请求 · 结论', at: [480, mid(R1) - 14] } },
    '8': { d: `M264,${mid(R1)} H170`, badge: [190, mid(R1)], arrows: 'both', payload: { text: '合并 / 打回', at: [222, mid(R1) - 14] } },
    '9': { d: `M760,${mid(R1)} H1062`, badge: [990, mid(R1)], arrows: 'end', payload: { text: '在 main 上提交', at: [880, mid(R1) - 14] } },
    '10': { d: `M410,${mid(R2)} H570`, badge: [440, mid(R2)], arrows: 'end', payload: { text: '新提交', at: [480, mid(R2) - 14] } },
    '11': { d: `M760,${mid(R2)} H1062`, badge: [990, mid(R2)], arrows: 'both', payload: { text: '快进 · 没提交的改动', at: [880, mid(R2) - 14] } },
    '12': { d: `M410,${mid(R3)} H570`, badge: [440, mid(R3)], arrows: 'end', payload: { text: '协作者', at: [480, mid(R3) - 14] } },
    '13': { d: `M410,${mid(R4)} H570`, badge: [440, mid(R4)], arrows: 'end', payload: { text: '分支 · 新仓', at: [480, mid(R4) - 14] } },
    '14': { d: `M760,${mid(R4)} H1062`, badge: [990, mid(R4)], arrows: 'both', payload: { text: '人要求时快进 · HEAD', at: [880, mid(R4) - 14] } },
    '15': { d: `M410,${mid(R5)} H570`, badge: [440, mid(R5)], arrows: 'end', payload: { text: 'PR · issue', at: [480, mid(R5) - 14] } },
    // 从组织（Gitea 那块浅底）的下边沿出来：webhook 配在组织上，不分哪种仓
    '16': { d: `M337,674 V${R6}`, badge: [337, 695], arrows: 'end', payload: { text: '仓里出了事', at: [400, 700] } },
    '17': { d: `M410,${mid(R6)} H546`, badge: [440, mid(R6)], arrows: 'end', payload: { text: '位置消息', at: [492, mid(R6) - 14] } },
    '18': { d: `M410,${mid(R0)} H546`, badge: [440, mid(R0)], arrows: 'end', payload: { text: '地址 · 令牌', at: [490, mid(R0) - 14] } },
  },
  contracts: [
    {
      module: 'model',
      seams: ['1', '4', '5'],
      ports: ['B'],
      paths: [
        // 到 ⑤：从上边沿沿本机项目文件夹与功能包之间的空处直上，接上记录文件那条线
        `M1500,450 V${mid(R2)}`,
        // 到 B 送的「新通知」：从下边沿出来，绕过本机项目文件夹下面，接到 B 线旁的「新通知」
        'M1645,546 V824 H957',
      ],
      dots: [
        [1500, mid(R2)],
        [957, 824],
      ],
      labels: [
        { text: '格式', at: [1500, 432] },
        { text: '格式', at: [1300, 828] },
      ],
    },
  ],
  ports: [
    {
      letter: 'A',
      name: '交给 AI',
      text: '把一个项目此刻的通知写成一份提示词交出去，交给哪个看设置 ai-handling，默认 off 不交；以后有别的能读提示词干活的工具，接在这里就行。',
      module: 'plugin',
      side: 'bottom',
      at: 730,
      payload: { text: '提示词', at: [766, 850] },
      adapters: [
        { module: 'zcode', side: 'top', at: 734, active: true },
        { module: 'claude', side: 'top', at: 870, active: true },
      ],
    },
    {
      letter: 'B',
      name: '发通知',
      text: '通知一出现就推一条出去，只发新出现的；已有的实现是 QQ 私聊，设置 qq-notifications 开关，默认关。以后可以接别的渠道。',
      module: 'plugin',
      side: 'bottom',
      at: 866,
      payload: { text: '新通知', at: [934, 824] },
      adapters: [
        { module: 'qq', side: 'top', at: 1006, active: true },
        { module: 'otherchannel', side: 'top', at: 1142, active: false },
      ],
    },
  ],
  entries: {
    ai: { box: { x: 530, y: 44, w: 150, h: 26 }, arrow: [570, 70, 570, R0] },
    desk: { box: { x: 690, y: 44, w: 150, h: 26 }, arrow: [730, 70, 730, R0] },
    web: { box: { x: 1700, y: 222, w: 110, h: 24 }, arrow: [1735, 246, 1735, R1] },
  },
  moduleIcons: {
    plugin: LayoutGrid,
    site: PanelsTopLeft,
    model: Database,
    kit: Boxes,
    docsite: Plug,
    collabremote: Server,
    otherremote: ServerCog,
    collabrepo: FolderGit2,
    otherrepos: FolderTree,
    gwb: Plug,
    ntfy: Radio,
    runner: ShieldCheck,
    zcode: Bot,
    claude: Terminal,
    qq: MessageCircle,
    otherchannel: Bell,
  },
  entryIcons: { ai: Bot, desk: AppWindow, web: Globe },
};
