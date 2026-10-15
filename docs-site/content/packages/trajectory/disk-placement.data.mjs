/**
 * DiskPlacement（「trajectory：轨迹卡与星轨盘」那一页）的全部数据，画面（disk-placement.tsx）只读这一份。
 * 例子是为讲解编的一个小项目卡目录：盘心、①–⑨、病卡 ✗ 共 11 个文件。
 * 各表里的数（有效天数、半径、角度）由设计说明里的复现脚本跑出——scanCards → buildModel →
 * new RingsLayout(model)（全景态、手感参数全取默认值），保留两位小数；源码常量改了要重跑。
 */

/** 五步的标题与说明文字 */
export const steps = [
  {
    title: '卡目录 → 盘的输入',
    text: '11 个文件里，type 写 root 的只有一张，它是盘心。其余 10 张里 9 张的 born-at 写得对，全部画上星轨盘；「加一层缓存」的 born-at 写成了「三月十八号」，算不出半径，不上盘，进病卡清单——docfirst check 把它报成红。上盘只看 born-at，parent 写错这类病不挡上盘。',
  },
  {
    title: '关系 → 树与主干',
    text: '取代和转向两种关系一起把 ①–⑥ 连成一棵树，⑦⑧⑨ 一条关系都没有，是孤星。主干只沿取代走：从 ① 出发有两条链，长的那条到 03-12 就停了，短的那条走到 04-20。比终点不比长度，主干是 ①②⑥；③④⑤ 是支线。被取代过的 ①②③ 在盘上淡出。',
  },
  {
    title: '日期 → 半径',
    text: '半径只由日期定。日期先换成有效天数：03-15 到 04-20 隔了 36 天，两头各留 7 天，中间 22 天折成 4.64 天；03-06 那天界面有 2 张卡，前一段加宽到 2.5 天。全部 35.14 个有效天铺进固定的 960 个单位，最早的 03-01 在 190，最晚的 04-21 在 1150。',
  },
  {
    title: '树与孤星带 → 扇区',
    text: '角度由块定。树要 2 个槽，按半径范围换算成 17.17°；界面的孤星带 11.63°；换领域的缝各 12°。一圈只要 52.80°，于是整体放大 6.818 倍铺满整圈，首尾那道缝跨在 12 点，日期标签就挂在那里。',
  },
  {
    title: '槽与同日斜排 → 落点',
    text: '块里再分槽：主干占槽 0，支线占槽 1，各自在槽的正中。孤星带里 ⑦⑧ 同一天，各占一槽，角度大的 ⑧ 再往内退一级，免得两张叠在同一个环上；⑨ 跟 ⑦ 隔了一个多月，共用槽 0。到这一步每张卡都有了角度和半径。',
  },
];

/** 盘的画布：世界坐标以盘心为原点，halfSpan 是 viewBox 半径；maxR 是盘的最外沿 */
export const disk = { halfSpan: 1230, hubRadius: 170, hubLabel: '起步', markRadius: 30, maxR: 1200 };

/** 11 个文件与它们的去处（第 1 步右栏） */
export const files = [
  { mark: '盘心', name: '2026-03-01-start.md', verdict: 'center' },
  { mark: '①', name: '2026-03-02-json-files.mdx', verdict: 'card' },
  { mark: '②', name: '2026-03-06-sqlite.mdx', verdict: 'card' },
  { mark: '③', name: '2026-03-09-sqlite-wal.mdx', verdict: 'card' },
  { mark: '④', name: '2026-03-12-wal-network-drive.mdx', verdict: 'card' },
  { mark: '⑤', name: '2026-03-15-lock-file.mdx', verdict: 'card' },
  { mark: '⑥', name: '2026-04-20-one-file-per-record.mdx', verdict: 'card' },
  { mark: '⑦', name: '2026-03-06-dark-theme.mdx', verdict: 'card' },
  { mark: '⑧', name: '2026-03-06-sidebar-tree.mdx', verdict: 'card' },
  { mark: '⑨', name: '2026-04-21-search-box.mdx', verdict: 'card' },
  { mark: '✗', name: '2026-03-18-cache.mdx', verdict: 'sick' },
];
export const filesNote = 'center 1 张 · cards 9 张 · sick 1 个';

/** 时间轴（第 2 步）：day 是从 03-01 起的天数，dx 是同日两张的错位，onSpine 是主干成员（外加描边） */
export const timelineCards = [
  { mark: '①', day: 1, row: 'spine', onSpine: true, superseded: true },
  { mark: '②', day: 5, row: 'spine', onSpine: true, superseded: true },
  { mark: '⑥', day: 50, row: 'spine', onSpine: true },
  { mark: '③', day: 8, row: 'subline', superseded: true },
  { mark: '④', day: 11, row: 'subline', evidence: true },
  { mark: '⑤', day: 14, row: 'subline' },
  { mark: '⑦', day: 5, row: 'isolated', dx: -20 },
  { mark: '⑧', day: 5, row: 'isolated', dx: 20 },
  { mark: '⑨', day: 51, row: 'isolated', dx: -4 },
];
export const timelineTicks = [
  { day: 0, label: '03-01' },
  { day: 14, label: '03-15' },
  { day: 31, label: '04-01' },
  { day: 51, label: '04-21' },
];
export const timelineNote = '示意：盘上没有这条轴';

/** 关系边（第 2 步时间轴、第 5 步盘上连线）：from 是被取代的旧卡或转向的起点 */
export const edges = [
  { from: '①', to: '②', kind: 'supersede' },
  { from: '②', to: '③', kind: 'supersede' },
  { from: '③', to: '④', kind: 'supersede' },
  { from: '④', to: '⑤', kind: 'pivot' },
  { from: '②', to: '⑥', kind: 'supersede' },
];

/** 主干的两条候选与结论（第 2 步右栏） */
export const candidates = [
  { tone: 'pending', text: '候选 A：①→②→③→④，4 张，终点 03-12' },
  { tone: 'good', text: '候选 B：①→②→⑥，3 张，终点 04-20 · 选中', dot: true },
];
export const candidatesNote = '比终点：04-20 晚于 03-12。终点一样晚才比长度';

/** 有卡日子的环（第 3、5 步画在盘上） */
export const dayRings = [
  { date: '03-02', r: 217.32 },
  { date: '03-06', r: 367.58 },
  { date: '03-09', r: 449.54 },
  { date: '03-12', r: 531.5 },
  { date: '03-15', r: 613.46 },
  { date: '04-20', r: 1122.68 },
  { date: '04-21', r: 1150.0 },
];

/** 12 点方向挂日期标签的日子（带刻度线） */
export const dateTags = [
  { date: '03-02', r: 217.32 },
  { date: '03-06', r: 367.58 },
  { date: '03-12', r: 531.5 },
  { date: '03-22', r: 804.69 },
  { date: '04-13', r: 931.44 },
  { date: '04-21', r: 1150.0 },
];

/** 两段特殊环带（第 3 步）：from / to 是半径 */
export const foldBand = { from: 804.69, to: 931.44, label: '折叠的 22 天' };
export const widenBand = { from: 299.28, to: 367.58, label: '加宽 2.5' };

/** 有效天数折算表（第 3 步右栏） */
export const radiusRows = [
  { date: '03-01', eff: '0', r: '190.00' },
  { date: '03-02', eff: '1', r: '217.32' },
  { date: '03-05', eff: '4', r: '299.28' },
  { date: '03-06', eff: '6.5', r: '367.58' },
  { date: '03-09', eff: '9.5', r: '449.54' },
  { date: '03-12', eff: '12.5', r: '531.50' },
  { date: '03-15', eff: '15.5', r: '613.46' },
  { date: '03-22', eff: '22.5', r: '804.69' },
  { date: '04-13', eff: '27.14', r: '931.44' },
  { date: '04-20', eff: '34.14', r: '1122.68' },
  { date: '04-21', eff: '35.14', r: '1150.00' },
];
export const radiusNote = '每个有效天 27.32 个单位：960 ÷ 35.14';

/** 参与装箱的两块（第 4 步右栏）：槽宽与内边距一栏写「弧长 → 换算后的角度」 */
export const boxRows = [
  { block: '树「记录存成 JSON 文件」', domain: '存储', span: '217.32–1122.68', slots: 2, meanR: 493.94, slotDeg: '56 → 6.50°', padDeg: '18 → 2.09°', width: '17.17°' },
  { block: '孤星带', domain: '界面', span: '367.58–1150.00', slots: 2, meanR: 650.17, slotDeg: '48 → 4.23°', padDeg: '18 → 1.59°', width: '11.63°' },
];
export const packingNotes = ['一圈要 52.80°，不到 360°', '整体放大 6.818 倍，铺满一圈'];

/** 放大后的两块（第 4 步画在盘上）：角度从 12 点起顺时针量 */
export const diskBoxes = [
  { name: '树「记录存成 JSON 文件」', domain: '存储', th0: 40.91, th1: 157.96, rMin: 217.32, rMax: 1122.68 },
  { name: '孤星带', domain: '界面', th0: 239.78, th1: 319.09, rMin: 367.58, rMax: 1150.0 },
];
export const seamLabel = '首尾那道缝 81.82°';
export const crossGapLabel = '换领域：3° + 9° = 12°';

/** 每张卡的落点（第 5 步）：角度从 12 点起顺时针量；labelAngle / labelR 是编号标签的位置（避开环线） */
export const places = [
  { mark: '①', slot: '主干 0', angle: 77.29, radius: 217.32, labelAngle: 91, labelR: 262, domain: '存储', superseded: true, note: '被取代，淡出' },
  { mark: '②', slot: '主干 0', angle: 77.29, radius: 367.58, labelAngle: 90.5, labelR: 409.5, domain: '存储', superseded: true, note: '被取代，淡出' },
  { mark: '⑥', slot: '主干 0', angle: 77.29, radius: 1122.68, labelAngle: 89, labelR: 1070, domain: '存储', note: '主干末端' },
  { mark: '③', slot: '支线 1', angle: 121.58, radius: 449.54, labelAngle: 135, labelR: 490, domain: '存储', superseded: true, note: '被取代，淡出' },
  { mark: '④', slot: '支线 1', angle: 121.58, radius: 531.5, labelAngle: 135, labelR: 572, domain: '存储', evidence: true, note: '证据卡，三角形' },
  { mark: '⑤', slot: '支线 1', angle: 121.58, radius: 613.46, labelAngle: 135, labelR: 700, domain: '存储', note: '' },
  { mark: '⑦', slot: '孤星槽 0', angle: 265.01, radius: 367.58, labelAngle: 251.5, labelR: 490, domain: '界面', note: '同日两张里角度小的，留在当天的环上' },
  { mark: '⑧', slot: '孤星槽 1', angle: 293.86, radius: 333.43, labelAngle: 307, labelR: 410, domain: '界面', note: '同日第二张，往内退一级' },
  { mark: '⑨', slot: '孤星槽 0', angle: 265.01, radius: 1150.0, labelAngle: 251.5, labelR: 1070, domain: '界面', note: '跟 ⑦ 隔开超过 2 天，共用槽 0' },
];
export const dodgeLabel = '同日第二张，往内退一级';

/* ↓↓↓ 数据里照抄源码的常量与公式：改源码要回来复核这一段 ↓↓↓ */

/* 源码里的定型常量：排位相关的数全从这一组出 */
/* ref file="../packages/trajectory/src/site/disk/layout.ts" lines="16-35" hash="3a42e0e17fcb" blob="ccb3c5bcc225" */
export const constants = {
  slotArc: 56, // 组内槽宽（世界单位弧长：一条链一槽）
  isoSlotArc: 48, // 孤星带内的槽宽（弧长）
  padArc: 18, // 扇环两侧内边距（弧长）
  sameDomainGapDeg: 3, // 同领域相邻两块的角向缝
  crossDomainGapDeg: 9, // 换领域时额外多留的缝
  laneGapDays: 2, // 同槽净空（天）：隔开不到它就换槽
  crowdStepEff: 1.5, // 同组同日每多一张卡，那天环带加宽的有效天
  axisSpan: 960, // 时间轴环带世界深度：day0 到 dayMax 恒拉伸填满
};

/* 直建 RingsLayout 时的默认值（全景态不改这些） */
/* ref file="../packages/trajectory/src/site/disk/layout.ts" lines="249-253" hash="b6d06968eba1" blob="ccb3c5bcc225" */
export const defaults = { hubBase: 180, gapFreeDays: 14, gapWideDays: 53 };

/* 半径公式的两个锚点：最早一环在 hubBase + 10 = 190，最新一环在 190 + 960 = 1150 */
/* ref file="../packages/trajectory/src/site/disk/layout.ts" lines="521-530" hash="65a6e26a2e7e" blob="ccb3c5bcc225" */
export const radiusAnchors = { firstRing: 190, latestRing: 1150 };

/* 弧长换角度：除以内外半径的几何平均 */
/* ref file="../packages/trajectory/src/site/disk/layout.ts" lines="138-142" hash="711cd89fb03b" blob="ccb3c5bcc225" */
export const meanRadius = (rMin, rMax) => Math.sqrt(rMin * rMax);

/* 落点角度 = 块起点 + 内边距 + (槽号 + 0.5) × 槽宽 */
/* ref file="../packages/trajectory/src/site/disk/layout.ts" lines="717-735" hash="a5cc9ab707b5" blob="ccb3c5bcc225" */
export const angleOfSlot = (boxStartDeg, padDeg, slot, slotDeg) => boxStartDeg + padDeg + (slot + 0.5) * slotDeg;
