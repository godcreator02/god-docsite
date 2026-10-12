/**
 * gwb-collab 内部接缝图（gwb-collab.data.mjs）的坐标，用数据流的画法（flow-seam-diagram.tsx）。
 * 竖着分三列：左边浅底是协作仓那一套，右边浅底是别的仓那一套，中间是组织级的与共用的。
 * 上面一排是 Gitea（协作仓、组织、别的仓）与 ntfy，下面一排是本机的仓，最下面是 gwb-docsite、项目登记与可替换接口的实现；
 * 项目登记夹在 gwb-docsite 与 QQ 机器人之间，身份码与任务组两条线都是一小段横线。
 * 两边的目录方块对准它在 Gitea 上与本机上那一头，线都是竖直的；往下的线停在本机框的上边，不压框标题。两边交给通知的线从浅底的内侧边出来。
 */
import { AppWindow, Bell, Bot, ClipboardList, FolderGit2, FolderTree, Globe, MessageCircle, Network, Plug, Server, ServerCog, Terminal } from 'lucide-react';
import { cap } from '@godcreator/docsite-explainer';
import type { FlowSeamLayout } from '../flow-seam-diagram';

/** 上面 Gitea 那一排、两边目录第一行与第二行、本机那一排、中间最后一行、最下一排（项目登记与 QQ 机器人里的任务组）的能力方块上边 */
const TOP = 70;
const ROW1 = 210;
const ROW2 = 300;
const LOCAL = 596;
const LAST = 466;
const BOTTOM = 758;
const mid = (row: number) => row + 24;

/** 两边每一列的左边与中线：同一列里 Gitea 上的方块、目录、本机的方块上下对齐 */
const A = [50, 176, 302, 428];
const B = [1450, 1582, 1714];
const center = (x: number, w: number) => x + w / 2;

/** 竖线的送什么写在线的右边：x 是字的中线，左边沿离线 13 */
const rightOf = (x: number, text: string, y: number) => ({ text, at: [x, y] as [number, number] });

export const gwbCollabLayout: FlowSeamLayout = {
  view: { w: 1900, h: 840 },
  caps: {
    collabprs: cap(A[0]!, TOP, 116),
    collabmain: cap(A[1]!, TOP, 116),
    collabprotect: cap(A[2]!, TOP, 116),
    collaborators: cap(A[3]!, TOP, 140),
    ntfytopic: cap(640, TOP, 120),
    orghook: cap(836, TOP, 100),
    orgrepos: cap(944, TOP, 96),
    setup: cap(1120, TOP, 220),
    otherbranches: cap(B[0]!, TOP, 124),
    otherprs: cap(B[1]!, TOP, 124),
    otherprotect: cap(B[2]!, TOP, 124),

    submit: cap(A[0]!, ROW1, 116),
    sync: cap(A[1]!, ROW1, 116),
    collabrules: cap(A[2]!, ROW1, 116),
    leads: cap(A[3]!, ROW1, 140),
    records: cap(A[3]!, ROW2, 140),
    events: cap(660, 180, 690),
    fetch: cap(B[0]!, ROW1, 124),
    review: cap(B[1]!, ROW1, 124),
    otherrules: cap(B[2]!, ROW1, 124),

    keep: cap(630, LAST, 150),
    pane: cap(850, LAST, 115),
    compute: cap(1025, LAST, 140),
    handoff: cap(1235, LAST, 140),

    worktree: cap(A[0]!, LOCAL, 242),
    collabdir: cap(A[3]!, LOCAL, 140),
    otherwt: cap(B[0]!, LOCAL, 200),

    hosting: cap(570, BOTTOM, 110),
    identity: cap(690, BOTTOM, 110),
    project: cap(850, BOTTOM, 100),
    qqgroups: cap(1005, BOTTOM, 145),
  },
  groups: {
    collabremote: { x: 40, y: 30, w: 544, h: 110 },
    org: { x: 820, y: 30, w: 230, h: 110 },
    otherremote: { x: 1440, y: 30, w: 408, h: 110 },
    ntfy: null,
    submit: null,
    sync: null,
    collabrules: null,
    leads: null,
    records: null,
    fetch: null,
    review: null,
    otherrules: null,
    events: null,
    setup: null,
    pane: null,
    project: null,
    'site-process': { x: 620, y: 430, w: 170, h: 130 },
    notifications: { x: 1015, y: 430, w: 160, h: 130 },
    'ai-handoff': { x: 1225, y: 430, w: 160, h: 130 },
    collablocal: { x: 40, y: 560, w: 544, h: 100 },
    otherlocal: { x: 1440, y: 560, w: 220, h: 100 },
    docsite: { x: 560, y: 720, w: 250, h: 100 },
    qq: { x: 990, y: 720, w: 175, h: 100 },
    otherchannel: { x: 1175, y: 720, w: 80, h: 60 },
    zcode: { x: 1265, y: 720, w: 92, h: 60 },
    claude: { x: 1367, y: 720, w: 92, h: 60 },
  },
  regions: [
    { box: { x: 20, y: 160, w: 564, h: 320 }, label: 'collab-repo/ · 协作仓', vertical: true },
    { box: { x: 1420, y: 160, w: 434, h: 320 }, label: 'other-repos/ · 别的仓', vertical: true },
  ],
  seamPaths: {
    '1': { d: `M700,118 V180`, badge: [700, 150], arrows: 'end', payload: rightOf(741, '位置消息', 154) },
    '2': { d: `M886,118 V180`, badge: [886, 150], arrows: 'both', payload: rightOf(937, '核对 · 配好', 162) },
    '3': { d: `M660,${mid(180)} H584`, badge: [622, mid(180)], arrows: 'end', payload: { text: '协作仓的事', at: [622, mid(180) - 14] } },
    '4': { d: `M1350,${mid(180)} H1420`, badge: [1385, mid(180)], arrows: 'end', payload: { text: '别的仓的事', at: [1385, mid(180) - 14] } },
    '5': { d: `M108,118 V${ROW1}`, badge: [108, 150], arrows: 'both', payload: rightOf(171, '合并请求 · 结论', 154) },
    '6': { d: `M234,118 V${ROW1}`, badge: [234, 150], arrows: 'end', payload: rightOf(268, '新提交', 154) },
    '7': { d: `M360,118 V${ROW1}`, badge: [360, 150], arrows: 'both', payload: rightOf(410, '核对 · 配好', 154) },
    '8': { d: `M498,118 V${ROW1}`, badge: [498, 150], arrows: 'end', payload: rightOf(533, '协作者', 154) },
    '9': { d: `M498,258 V${ROW2}`, badge: [498, 279], arrows: 'end', payload: rightOf(533, '负责人', 284) },
    '10': { d: `M108,258 V560`, badge: [108, 505], arrows: 'end', payload: rightOf(169, '在 main 上提交', 530) },
    '11': { d: `M234,258 V560`, badge: [234, 505], arrows: 'both', payload: rightOf(308, '快进 · 没提交的改动', 530) },
    '12': { d: `M498,348 V560`, badge: [498, 505], arrows: 'both', payload: rightOf(539, '记录文件', 530) },
    '13': { d: `M1512,118 V${ROW1}`, badge: [1512, 150], arrows: 'end', payload: rightOf(1563, '分支 · 新仓', 154) },
    '14': { d: `M1644,118 V${ROW1}`, badge: [1644, 150], arrows: 'end', payload: rightOf(1695, 'PR · issue', 154) },
    '15': { d: `M1776,118 V${ROW1}`, badge: [1776, 150], arrows: 'both', payload: rightOf(1827, '核对 · 配好', 154) },
    '16': { d: `M1512,258 V560`, badge: [1512, 505], arrows: 'both', payload: rightOf(1565, '快进 · HEAD', 530) },
    '17': { d: 'M584,360 H1060 V430', badge: [950, 360], arrows: 'end', payload: { text: '状态 · 负责人 · 找我的', at: [800, 346] } },
    '18': { d: 'M1420,360 H1120 V430', badge: [1350, 360], arrows: 'end', payload: { text: '别的仓的状态', at: [1260, 346] } },
    '19': { d: 'M1090,228 V430', badge: [1090, 300], arrows: 'end', payload: { text: 'webhook · 出错', at: [1150, 304] } },
    '20': { d: 'M1030,430 V400 H705 V430', badge: [950, 400], arrows: 'end', payload: { text: '通知 + 负责人', at: [860, 386] } },
    '21': { d: `M790,${mid(LAST)} H850`, badge: [820, mid(LAST)], arrows: 'end', payload: { text: '地址 · 出错', at: [820, mid(LAST) - 14] } },
    '22': { d: `M1015,${mid(LAST)} H965`, badge: [990, mid(LAST)], arrows: 'end', payload: { text: '计数', at: [990, mid(LAST) - 14] } },
    '23': { d: `M1175,${mid(LAST)} H1225`, badge: [1200, mid(LAST)], arrows: 'end', payload: { text: '此刻的通知', at: [1200, mid(LAST) - 14] } },
    '24': { d: `M1120,${mid(TOP)} H1040`, badge: [1080, mid(TOP)], arrows: 'both', payload: { text: '列出 · 新建', at: [1080, mid(TOP) - 16] } },
    // 从建项目上边沿往上，越过组织那块，停在 ntfy 方块的上边
    '25': { d: `M1300,${TOP} V20 H720 V${TOP}`, badge: [1000, 20], arrows: 'end', payload: rightOf(1360, 'leads changed', 48) },
    // 从项目登记的右边沿横着进 QQ 机器人框，停在任务组方块的左边
    '26': { d: `M950,${mid(BOTTOM)} H1005`, badge: [977, mid(BOTTOM)], arrows: 'end', payload: { text: '任务组', at: [977, mid(BOTTOM) - 14] } },
    // 从站点框的下边沿往下，拐到 gwb-docsite 框里初始化与托管那一块的上边
    '27': { d: `M705,560 V690 H625 V${BOTTOM}`, badge: [705, 625], arrows: 'end', payload: rightOf(775, '初始化 · 托管 · 推数据', 630) },
    // 从项目登记的左边沿横着进 gwb-docsite 框，停在身份码方块的右边
    '28': { d: `M850,${mid(BOTTOM)} H800`, badge: [825, mid(BOTTOM)], arrows: 'both', payload: { text: '身份码', at: [825, mid(BOTTOM) - 14] } },
  },
  contracts: [],
  ports: [
    {
      letter: 'B',
      name: '发通知',
      text: '做完过一次完整刷新后，通知把此刻的全部通知交给实现，由实现只发新出现的，句子用通知模型的短句；已有的实现是 QQ 私聊（notifications/qq-private-chat.ts，还没提交审核的文件不发），设置 qq-notifications 开关，默认关。',
      module: 'notifications',
      side: 'bottom',
      at: center(1015, 160),
      payload: { text: '新通知', at: [1095, 660] },
      adapters: [
        { module: 'qq', side: 'top', at: 1060, active: true },
        { module: 'otherchannel', side: 'top', at: center(1175, 80), active: false },
      ],
    },
    {
      letter: 'A',
      name: '交给 AI',
      text: '把提示词交给能读它做事的工具，交给哪个看设置 ai-handling，默认 off 不交。两个实现是 ai-handoff/ 里的 zcode.ts 与 claude-terminal.ts。',
      module: 'ai-handoff',
      side: 'bottom',
      at: center(1225, 160),
      payload: { text: '提示词', at: [1305, 660] },
      adapters: [
        { module: 'zcode', side: 'top', at: center(1265, 92), active: true },
        { module: 'claude', side: 'top', at: center(1367, 92), active: true },
      ],
    },
  ],
  entries: {},
  moduleIcons: {
    collabremote: Server,
    org: Network,
    otherremote: ServerCog,
    ntfy: Bell,
    submit: FolderGit2,
    sync: FolderGit2,
    collabrules: FolderGit2,
    leads: FolderGit2,
    records: FolderGit2,
    fetch: FolderTree,
    review: FolderTree,
    otherrules: FolderTree,
    events: Network,
    setup: Network,
    notifications: Bell,
    'site-process': Globe,
    pane: AppWindow,
    project: ClipboardList,
    'ai-handoff': Bot,
    collablocal: FolderGit2,
    otherlocal: FolderTree,
    docsite: Plug,
    qq: MessageCircle,
    otherchannel: Bell,
    zcode: Bot,
    claude: Terminal,
  },
  entryIcons: {},
};
